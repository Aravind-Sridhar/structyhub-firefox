const $ = (id) => document.getElementById(id);
const HOSTS = browser.runtime.getManifest().host_permissions;
const REPO_RE = /^[A-Za-z0-9._-]{1,100}$/;

function setStatus(text, cls = "muted") {
  $("status").textContent = text;
  $("status").className = cls;
}

async function validateToken(token) {
  if (!token) return null;
  try {
    const res = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.ok ? (await res.json()).login : null;
  } catch {
    return null;
  }
}

// Firefox MV3 treats host permissions as optional; make sure we have them.
async function checkPermissions() {
  const has = await browser.permissions.contains({ origins: HOSTS });
  $("perm").classList.toggle("hidden", has);
  return has;
}

$("grant").addEventListener("click", async () => {
  await browser.permissions.request({ origins: HOSTS });
  checkPermissions();
});

async function refresh() {
  await checkPermissions();
  const { accessToken, repoName, isPrivate } = await browser.storage.local.get([
    "accessToken", "repoName", "isPrivate",
  ]);
  $("repo").value = repoName || "Structy-Hub";
  $("private").checked = isPrivate !== false;
  $("token").value = "";
  $("token").placeholder = accessToken ? "•••••••• (saved, leave blank to keep)" : "github_pat_… or ghp_…";

  const login = await validateToken(accessToken);
  if (login) setStatus(`Signed in as ${login}`, "ok");
  else if (accessToken) setStatus("Saved token is invalid or expired", "err");
  else setStatus("Not signed in: paste a GitHub token below");
}

$("form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const repoName = $("repo").value.trim() || "Structy-Hub";
  if (!REPO_RE.test(repoName)) {
    $("msg").textContent = "Invalid repository name";
    $("msg").className = "err";
    return;
  }
  const update = { repoName, isPrivate: $("private").checked };
  const newToken = $("token").value.trim();
  if (newToken) {
    $("msg").textContent = "Checking token…";
    if (!(await validateToken(newToken))) {
      $("msg").textContent = "GitHub rejected that token";
      $("msg").className = "err";
      return;
    }
    update.accessToken = newToken;
  }
  await browser.storage.local.set(update);
  $("msg").textContent = "Saved";
  $("msg").className = "ok";
  refresh();
});

$("signout").addEventListener("click", async () => {
  await browser.storage.local.remove("accessToken");
  $("msg").textContent = "Token removed";
  $("msg").className = "muted";
  refresh();
});

refresh();
