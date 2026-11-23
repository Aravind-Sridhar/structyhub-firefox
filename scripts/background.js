// Background event page: watches Structy API traffic and performs all GitHub
// API calls, so the token never has to live in the page's content script.

const LANGUAGES = ["python3", "node", "cpp", "java"];
const README_FOOTER =
  "Made with StructyHub for Firefox (port of https://github.com/cbkinase/StructyHub)";

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

// ---------- GitHub helpers ----------

async function getToken() {
  const { accessToken } = await browser.storage.local.get("accessToken");
  if (!accessToken) throw new Error("Not signed in: add a GitHub token in the popup");
  return accessToken;
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

async function ensureRepo(token, owner, repo, isPrivate) {
  try {
    return await gh(`/repos/${owner}/${repo}`, token);
  } catch (e) {
    if (e.status !== 404) throw e;
  }
  const created = await gh("/user/repos", token, {
    method: "POST",
    body: JSON.stringify({ name: repo, private: isPrivate, auto_init: false }),
  });
  // Empty repos have no refs; seed one with a README via the contents API.
  await gh(`/repos/${owner}/${repo}/contents/README.md`, token, {
    method: "PUT",
    body: JSON.stringify({
      message: "Initialize repository",
      content: b64(`# ${repo}\n\nMy Structy solutions.\n\n${README_FOOTER}\n`),
    }),
  });
  await sleep(1000); // give GitHub a moment to register the first commit
  return created;
}

async function commitFiles(token, owner, repo, branch, message, files) {
  const ref = await gh(`/repos/${owner}/${repo}/git/ref/heads/${branch}`, token);
  const parentSha = ref.object.sha;
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
  const token = await getToken();
  const { repoName = "Structy-Hub", isPrivate = true } =
    await browser.storage.local.get(["repoName", "isPrivate"]);
  const { login } = await gh("/user", token);
  const repo = await ensureRepo(token, login, repoName, isPrivate);
  return commitFiles(token, login, repoName, repo.default_branch || "main", message, files);
}

// ---------- Message router ----------

browser.runtime.onMessage.addListener((msg) => {
  if (msg?.action === "upload") {
    return uploadSolution(msg.payload).then(
      (result) => ({ ok: true, ...result }),
      (error) => ({ ok: false, error: String(error.message || error) }),
    );
  }
  if (msg?.action === "get_language") {
    return browser.storage.local.get("language").then((r) => r.language);
  }
  return undefined;
});
