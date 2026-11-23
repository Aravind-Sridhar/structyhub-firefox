# StructyHub for Firefox

Firefox port of [StructyHub](https://github.com/cbkinase/StructyHub) (MIT, © Cameron Beck).
When every test passes on a Structy problem, the solution and problem prompt are committed to a GitHub repo:

```
Structy-Hub/
  <module>/<NNN>-<problem-name>/
    <problem-name>.py|.js|.cpp|.java
    README.md
```

## Differences from the Chrome version
- **Auth:** GitHub App device flow (no client secret), with a personal access token as a fallback,
  instead of an OAuth app. Access is limited to the repos you install the app on.
- GitHub calls run in the background script, so the token never reaches the page.
- Repos are **private by default** (toggle in the popup).
- Fixes: UTF-8-safe base64 (non-ASCII text crashed `btoa`), waits for the test results to render instead of checking once, uses the repo's real default branch, and skips empty commits.

## Install (temporary, for development)
1. Open `about:debugging#/runtime/this-firefox`
2. **Load Temporary Add-on…** → pick `manifest.json` in this folder.
3. Click the toolbar icon → **Grant access** if prompted → **Sign in with GitHub** (see below).

Temporary add-ons are removed when Firefox restarts. For a permanent install, sign it via AMO
(`web-ext sign --channel=unlisted`) or publish it on addons.mozilla.org.

## Sign in
**Recommended: Sign in with GitHub.** This uses the
[Structy Sync for Firefox](https://github.com/apps/structy-sync-for-firefox) GitHub App via the
[device flow](https://docs.github.com/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app#using-the-device-flow-to-generate-a-user-access-token),
so there is no client secret and no server.
1. [Create your solutions repo](https://github.com/new?name=Structy-Hub) (tick *Add a README*, or the extension seeds one).
2. [Install the app](https://github.com/apps/structy-sync-for-firefox/installations/new) on **only that repo**.
3. In the popup click **Sign in with GitHub**, then **Copy code & open GitHub**, paste the code and approve.

The app asks only for **Contents: read & write** (plus read-only metadata) on the repos you install it on.
It can't create or delete repos or see anything else on your account. Sign out in the popup, and revoke it under
[GitHub → Settings → Applications](https://github.com/settings/apps/authorizations).

**Advanced: personal access token.** Paste one under *Advanced* in the popup. A fine-grained token
limited to your solutions repo with **Contents: Read and write** is safest. Add
**Administration: Read and write** only if you want the extension to create the repo for you.

## Attribution
This project is a Firefox port of **[StructyHub](https://github.com/cbkinase/StructyHub)** by
**Cameron Beck**, released under the MIT License. The original design, repository layout, Structy
API usage and commit approach come from that project; this port rewrites it for Firefox
(Manifest V3 event page, token-based auth, background-side GitHub calls) and adds the fixes listed above.
The original copyright notice is kept in [LICENSE](LICENSE).

Not affiliated with or endorsed by Structy or the original StructyHub author.

## Caveat
It depends on Structy's undocumented API (`api.structy.net/api/...`) and its DOM (Font Awesome
`.fa-check-circle` icons for passing tests). If Structy changes either, the extension needs updating.
