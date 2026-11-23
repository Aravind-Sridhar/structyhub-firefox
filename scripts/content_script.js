// Runs on structy.net. Reads problem + solution from Structy's API (with the
// page's cookies) and hands the files to the background script for upload.

const EXTENSIONS = { node: ".js", python3: ".py", cpp: ".cpp", java: ".java" };

// In Firefox, `content.fetch` makes requests as the page (same origin and
// cookies), which Structy's API expects. Fall back to plain fetch elsewhere.
const pageFetch =
  typeof content !== "undefined" && content.fetch
    ? content.fetch.bind(content)
    : fetch;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function testStatus() {
  const passed = document.querySelectorAll(".far.fa-check-circle").length;
  const failed = document.querySelectorAll(".far.fa-times-circle").length;
  const pending = document.querySelectorAll(".far.fa-circle").length;
  const total = passed + failed + pending;
  return { total, passed, failed, pending };
}

// The test-results request can finish before React renders the icons, so
// poll briefly instead of checking once.
async function waitForAllPassed(timeoutMs = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const s = testStatus();
    if (s.failed > 0) return false;
    if (s.total > 0 && s.passed === s.total) return true;
    await sleep(250);
  }
  return false;
}

function sanitize(str) {
  return String(str).trim().replace(/[^\w\- ]/g, "").replace(/\s+/g, "-");
}

async function structyJson(path) {
  const res = await pageFetch(`https://api.structy.net/api/${path}`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error(`Structy ${res.status}: ${await res.text()}`);
  return res.json();
}

function showToast(message, success = true, duration = 3500) {
  const el = document.createElement("div");
  el.textContent = message;
  Object.assign(el.style, {
    position: "fixed",
    top: "20px",
    right: "20px",
    padding: "10px 16px",
    borderRadius: "6px",
    color: "#fff",
    background: success ? "#00A884" : "#D93F0B",
    font: "600 14px system-ui, sans-serif",
    zIndex: "2147483647",
    opacity: "0",
    transition: "opacity .3s",
    maxWidth: "360px",
  });
  document.body.appendChild(el);
  requestAnimationFrame(() => (el.style.opacity = "1"));
  setTimeout(() => {
    el.style.opacity = "0";
    setTimeout(() => el.remove(), 400);
  }, duration);
}

let busy = false;

async function handleSubmission() {
  if (busy) return;
  busy = true;
  try {
    if (!(await waitForAllPassed())) return;

    const language = await browser.runtime.sendMessage({ action: "get_language" });
    if (!language) throw new Error("Couldn't detect the language; reload the problem page");

    const slug = location.pathname.split("/").filter(Boolean).at(-1);
    if (!slug) throw new Error("Couldn't read the problem slug from the URL");
    const infoPath = location.pathname.includes("/premium/")
      ? `problems/premium/${slug}`
      : `problems/${slug}`;

    const [info, answer] = await Promise.all([
      structyJson(infoPath),
      structyJson(`code/problems/${slug}/runtimes/${language}`),
    ]);

    const { environments, module, number, name } = info;
    const cleanName = sanitize(name);
    const dir = `${sanitize(module)}/${String(number).padStart(3, "0")}-${cleanName}`;
    const prompt = environments?.[language]?.prompt ?? `# ${name}`;

    const result = await browser.runtime.sendMessage({
      action: "upload",
      payload: {
        message: `Solved '${name}' (${language})`,
        files: [
          { path: `${dir}/${cleanName}${EXTENSIONS[language] || ".txt"}`, content: answer.code },
          { path: `${dir}/README.md`, content: prompt },
        ],
      },
    });

    if (!result?.ok) throw new Error(result?.error || "Unknown upload error");
    showToast(result.skipped ? "No changes since last upload" : "Pushed to GitHub ✓");
  } catch (err) {
    console.error("[StructyHub]", err);
    showToast(`GitHub upload failed: ${err.message}`, false, 6000);
  } finally {
    busy = false;
  }
}

browser.runtime.onMessage.addListener((msg) => {
  if (msg?.action === "submitted") handleSubmission();
});
