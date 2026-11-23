// Background event page: watches Structy API traffic, runs GitHub sign-in
// (device flow) and performs all GitHub API calls, so the token never has to
// live in the page's content script.

const GITHUB_APP_CLIENT_ID = "Iv23lizGJxjt5Jq91O9h";
const GITHUB_APP_SLUG = "structy-sync-for-firefox";
const INSTALL_URL = `https://github.com/apps/${GITHUB_APP_SLUG}/installations/new`;
const POLL_ALARM = "device-flow-poll";

const LANGUAGES = ["python3", "node", "cpp", "java"];
const README_FOOTER =
  "Made with StructyHub for Firefox (https://github.com/Aravind-Sridhar/structyhub-firefox), " +
  "a port of StructyHub (https://github.com/cbkinase/StructyHub)";

// ---------- Structy traffic watcher ----------

browser.webRequest.onCompleted.addListener(
  (details) => {
    const language = LANGUAGES.find((l) =>
      details.url.includes(`/runtimes/${l}`),
    );
    if (language) browser.storage.local.set({ language });

    if (
      details.url.includes("test-results") &&
      details.tabId >= 0 &&
      details.statusCode === 200
    ) {
      browser.tabs
        .sendMessage(details.tabId, { action: "submitted" })
        .catch(() => {}); // content script may not be ready; ignore
    }
  },
  { urls: ["https://api.structy.net/*"] },
);

// ---------- GitHub device flow sign-in ----------
// https://docs.github.com/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app#using-the-device-flow-to-generate-a-user-access-token

async function githubForm(url, params) {
  const res = await fetch(url, {
    method: "POST",
    headers: { Accept: "application/json" },
    body: new URLSearchParams(params),
  });
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${await res.text()}`);
  return res.json();
}

async function startDeviceFlow() {
  const data = await githubForm("https://github.com/login/device/code", {
    client_id: GITHUB_APP_CLIENT_ID,
  });
  if (data.error) throw new Error(data.error_description || data.error);

  const deviceFlow = {
    device_code: data.device_code,
    user_code: data.user_code,
    verification_uri: data.verification_uri,
    interval: data.interval || 5,
    expires_at: Date.now() + data.expires_in * 1000,
    last_poll: 0,
  };
  await browser.storage.local.set({ deviceFlow });
  await browser.storage.local.remove("deviceFlowError");

  // Backup wake-up in case Firefox suspends this event page mid-flow.
  browser.alarms.create(POLL_ALARM, { periodInMinutes: 0.5 });
  scheduleNextPoll(deviceFlow.interval);

  const { device_code, ...visible } = deviceFlow;
  return visible;
}

let pollTimer = null;
function scheduleNextPoll(seconds) {
  clearTimeout(pollTimer);
  pollTimer = setTimeout(pollOnce, seconds * 1000);
}

async function endDeviceFlow(error) {
  clearTimeout(pollTimer);
  await browser.alarms.clear(POLL_ALARM);
  await browser.storage.local.remove("deviceFlow");
  if (error) await browser.storage.local.set({ deviceFlowError: error });
}

let polling = false;
async function pollOnce() {
  if (polling) return;
  polling = true;
  try {
    const { deviceFlow: flow } = await browser.storage.local.get("deviceFlow");
    if (!flow) return endDeviceFlow();
    if (Date.now() > flow.expires_at) {
      return endDeviceFlow("The sign-in code expired. Please try again.");
    }
    // Respect GitHub's minimum interval no matter who triggered this poll.
    const wait = flow.last_poll + flow.interval * 1000 - Date.now();
    if (wait > 0) return scheduleNextPoll(wait / 1000);

    flow.last_poll = Date.now();
    await browser.storage.local.set({ deviceFlow: flow });

    const data = await githubForm("https://github.com/login/oauth/access_token", {
      client_id: GITHUB_APP_CLIENT_ID,
      device_code: flow.device_code,
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
    });

    if (data.access_token) {
      await browser.storage.local.set({
        accessToken: data.access_token,
        authMethod: "app",
      });
      return endDeviceFlow();
    }

    switch (data.error) {
      case "authorization_pending":
        return scheduleNextPoll(flow.interval);
      case "slow_down":
        flow.interval = data.interval || flow.interval + 5;
        await browser.storage.local.set({ deviceFlow: flow });
        return scheduleNextPoll(flow.interval);
      case "expired_token":
        return endDeviceFlow("The sign-in code expired. Please try again.");
      case "access_denied":
        return endDeviceFlow("Sign-in was cancelled on GitHub.");
      default:
        return endDeviceFlow(data.error_description || data.error || "Sign-in failed");
    }
  } catch (err) {
    // Network hiccup: keep trying until the code expires.
    console.error("[StructyHub] device flow poll failed", err);
    const { deviceFlow: flow } = await browser.storage.local.get("deviceFlow");
    if (flow) scheduleNextPoll(flow.interval);
  } finally {
    polling = false;
  }
}

browser.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === POLL_ALARM) pollOnce();
});

// ---------- GitHub API helpers ----------

async function getAuth() {
  const { accessToken, authMethod = "token" } = await browser.storage.local.get([
    "accessToken",
    "authMethod",
  ]);
  if (!accessToken) throw new Error("Not signed in: open the extension popup and sign in with GitHub");
  return { token: accessToken, authMethod };
}

async function gh(path, token, options = {}) {
  const res = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const err = new Error(`GitHub ${res.status}: ${await res.text()}`);
    err.status = res.status;
    throw err;
  }
  return res.status === 204 ? null : res.json();
}

// UTF-8 safe base64 (plain btoa throws on non-Latin1 characters).
function b64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function seedReadme(token, owner, repo) {
  await gh(`/repos/${owner}/${repo}/contents/README.md`, token, {
    method: "PUT",
    body: JSON.stringify({
      message: "Initialize repository",
      content: b64(`# ${repo}\n\nMy Structy solutions.\n\n${README_FOOTER}\n`),
    }),
  });
  await sleep(1000); // give GitHub a moment to register the first commit
}

async function ensureRepo({ token, authMethod }, owner, repo, isPrivate) {
  try {
    return await gh(`/repos/${owner}/${repo}`, token);
  } catch (e) {
    if (e.status !== 404) throw e;
  }
  if (authMethod === "app") {
    // The GitHub App has no Administration permission, so it can't create
    // repos; a 404 also means the app isn't installed on an existing repo.
    throw new Error(
      `Can't access ${owner}/${repo}. Create the repo on GitHub, then install the app on it (see the extension popup).`,
    );
  }
  const created = await gh("/user/repos", token, {
    method: "POST",
    body: JSON.stringify({ name: repo, private: isPrivate, auto_init: false }),
  });
  await seedReadme(token, owner, repo);
  return created;
}

async function getHeadSha(token, owner, repo, branch) {
  try {
    const ref = await gh(`/repos/${owner}/${repo}/git/ref/heads/${branch}`, token);
    return ref.object.sha;
  } catch (e) {
    // 409 = "Git Repository is empty"; seed it so we have a commit to build on.
    if (e.status !== 409 && e.status !== 404) throw e;
    await seedReadme(token, owner, repo);
    const ref = await gh(`/repos/${owner}/${repo}/git/ref/heads/${branch}`, token);
    return ref.object.sha;
  }
}

async function commitFiles(token, owner, repo, branch, message, files) {
  const parentSha = await getHeadSha(token, owner, repo, branch);
  const parent = await gh(`/repos/${owner}/${repo}/git/commits/${parentSha}`, token);

  const tree = await gh(`/repos/${owner}/${repo}/git/trees`, token, {
    method: "POST",
    body: JSON.stringify({
      base_tree: parent.tree.sha,
      tree: files.map(({ path, content }) => ({
        path,
        mode: "100644",
        type: "blob",
        content,
      })),
    }),
  });

  if (tree.sha === parent.tree.sha) return { skipped: true }; // nothing changed

  const commit = await gh(`/repos/${owner}/${repo}/git/commits`, token, {
    method: "POST",
    body: JSON.stringify({ message, tree: tree.sha, parents: [parentSha] }),
  });

  await gh(`/repos/${owner}/${repo}/git/refs/heads/${branch}`, token, {
    method: "PATCH",
    body: JSON.stringify({ sha: commit.sha }),
  });
  return { skipped: false, url: commit.html_url };
}

async function uploadSolution({ message, files }) {
  const auth = await getAuth();
  const { repoName = "Structy-Hub", isPrivate = true } =
    await browser.storage.local.get(["repoName", "isPrivate"]);
  const { login } = await gh("/user", auth.token);
  const repo = await ensureRepo(auth, login, repoName, isPrivate);
  return commitFiles(auth.token, login, repoName, repo.default_branch || "main", message, files);
}

// Used by the popup to show whether uploads will work.
async function checkRepoAccess() {
  const { accessToken: token, authMethod = "token", repoName = "Structy-Hub" } =
    await browser.storage.local.get(["accessToken", "authMethod", "repoName"]);
  if (!token) return { signedIn: false };
  let login;
  try {
    ({ login } = await gh("/user", token));
  } catch {
    return { signedIn: false, invalid: true };
  }
  const result = { signedIn: true, login, authMethod, repo: `${login}/${repoName}`, installUrl: INSTALL_URL };
  try {
    const repo = await gh(`/repos/${login}/${repoName}`, token);
    result.repoOk = Boolean(repo.permissions?.push ?? true);
  } catch (e) {
    result.repoOk = false;
    result.repoMissing = e.status === 404;
  }
  return result;
}

// ---------- Message router ----------

function respond(promise) {
  return promise.then(
    (result) => ({ ok: true, ...result }),
    (error) => ({ ok: false, error: String(error.message || error) }),
  );
}

browser.runtime.onMessage.addListener((msg) => {
  switch (msg?.action) {
    case "upload":
      return respond(uploadSolution(msg.payload));
    case "get_language":
      return browser.storage.local.get("language").then((r) => r.language);
    case "device_start":
      return respond(startDeviceFlow());
    case "device_poll_now":
      pollOnce();
      return Promise.resolve({ ok: true });
    case "device_cancel":
      return respond(endDeviceFlow().then(() => ({})));
    case "check_access":
      return respond(checkRepoAccess());
    default:
      return undefined;
  }
});

// Resume an in-progress sign-in after the event page restarts.
browser.storage.local.get("deviceFlow").then(({ deviceFlow }) => {
  if (deviceFlow) pollOnce();
});
