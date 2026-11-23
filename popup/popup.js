const $ = (id) => document.getElementById(id);
const HOSTS = browser.runtime.getManifest().host_permissions;
const REPO_RE = /^[A-Za-z0-9._-]{1,100}$/;
const REVOKE_URL = "https://github.com/settings/apps/authorizations";

const show = (id, visible) => $(id).classList.toggle("hidden", !visible);

function setStatus(text, cls = "muted") {
  $("status").textContent = text;
  $("status").className = cls;
}

function setMsg(text, cls = "muted") {
  $("msg").textContent = text;
  $("msg").className = cls;
}

function link(text, href) {
  const a = document.createElement("a");
  a.textContent = text;
  a.href = href;
  a.target = "_blank";
  return a;
}

// Firefox MV3 treats host permissions as optional; make sure we have them.
async function checkPermissions() {
  const has = await browser.permissions.contains({ origins: HOSTS });
  show("perm", !has);
  return has;
}

$("grant").addEventListener("click", async () => {
  await browser.permissions.request({ origins: HOSTS });
  render();
});

function renderRepoWarning(access) {
  const box = $("repoWarn");
  box.replaceChildren();
  if (!access.signedIn || access.repoOk) return show("repoWarn", false);

  if (access.authMethod === "app") {
    box.append(
      `Can't reach ${access.repo}. `,
      link("Create the repo", `https://github.com/new?name=${encodeURIComponent(access.repo.split("/")[1])}`),
      " (if it doesn't exist), then ",
      link("install the app on it", access.installUrl),
      ".",
    );
  } else if (access.repoMissing) {
    box.append(`${access.repo} doesn't exist yet. It will be created on your first upload.`);
  } else {
    box.append(`Your token can't push to ${access.repo}.`);
  }
  show("repoWarn", true);
}

async function render() {
  await checkPermissions();
  const store = await browser.storage.local.get([
    "accessToken", "repoName", "isPrivate", "deviceFlow", "deviceFlowError",
  ]);
  $("repo").value = store.repoName || "Structy-Hub";
  $("private").checked = store.isPrivate !== false;
  $("token").value = "";
  $("signinErr").textContent = store.deviceFlowError || "";

  // Sign-in in progress
  if (store.deviceFlow && Date.now() < store.deviceFlow.expires_at) {
    $("userCode").textContent = store.deviceFlow.user_code;
    show("device", true);
    show("signin", false);
    show("signout", false);
    show("repoWarn", false);
    setStatus("Signing in…");
    browser.runtime.sendMessage({ action: "device_poll_now" });
    return;
  }
  show("device", false);

  if (!store.accessToken) {
    show("signin", true);
    show("signout", false);
    show("repoWarn", false);
    setStatus("Not signed in");
    return;
  }

  setStatus("Checking GitHub…");
  const access = await browser.runtime.sendMessage({ action: "check_access" });
  if (!access?.ok || !access.signedIn) {
    show("signin", true);
    show("signout", true);
    setStatus(access?.invalid ? "Saved sign-in is invalid or was revoked" : "Not signed in", "err");
    show("repoWarn", false);
    return;
  }
  show("signin", false);
  show("signout", true);
  const via = access.authMethod === "app" ? "GitHub App" : "token";
  setStatus(`Signed in as ${access.login} (${via})`, "ok");
  renderRepoWarning(access);
}

$("signinBtn").addEventListener("click", async () => {
  $("signinBtn").disabled = true;
  $("signinErr").textContent = "";
  const res = await browser.runtime.sendMessage({ action: "device_start" });
  $("signinBtn").disabled = false;
  if (!res?.ok) {
    $("signinErr").textContent = res?.error || "Couldn't start sign-in";
    return;
  }
  render();
});

$("openGithub").addEventListener("click", async () => {
  const { deviceFlow } = await browser.storage.local.get("deviceFlow");
  if (!deviceFlow) return render();
  try {
    await navigator.clipboard.writeText(deviceFlow.user_code);
  } catch {
    /* clipboard unavailable: the code stays visible when the popup is reopened */
  }
  browser.tabs.create({ url: deviceFlow.verification_uri });
});

$("cancelSignin").addEventListener("click", async () => {
  await browser.runtime.sendMessage({ action: "device_cancel" });
  render();
});

$("form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const repoName = $("repo").value.trim() || "Structy-Hub";
  if (!REPO_RE.test(repoName)) return setMsg("Invalid repository name", "err");

  const update = { repoName, isPrivate: $("private").checked };
  const newToken = $("token").value.trim();
  if (newToken) {
    setMsg("Checking token…");
    const res = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${newToken}` },
    }).catch(() => null);
    if (!res?.ok) return setMsg("GitHub rejected that token", "err");
    update.accessToken = newToken;
    update.authMethod = "token";
  }
  await browser.storage.local.set(update);
  setMsg("Saved", "ok");
  render();
});

$("signout").addEventListener("click", async () => {
  const { authMethod } = await browser.storage.local.get("authMethod");
  await browser.storage.local.remove(["accessToken", "authMethod"]);
  $("msg").replaceChildren(
    "Signed out on this device. ",
    authMethod === "app"
      ? link("Revoke the app on GitHub", REVOKE_URL)
      : "You can also delete the token on GitHub.",
  );
  $("msg").className = "muted";
  render();
});

// Re-render when the background finishes sign-in while the popup is open.
browser.storage.onChanged.addListener((changes) => {
  if ("accessToken" in changes || "deviceFlow" in changes || "deviceFlowError" in changes) {
    render();
  }
});

render();
