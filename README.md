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
- **Auth:** GitHub personal access token instead of OAuth. The original OAuth app's secret isn't public, and Firefox uses a different redirect URL, so a token works without a server.
- GitHub calls run in the background script, so the token never reaches the page.
- Repos are **private by default** (toggle in the popup).
- Fixes: UTF-8-safe base64 (non-ASCII text crashed `btoa`), waits for the test results to render instead of checking once, uses the repo's real default branch, and skips empty commits.

## Install (temporary, for development)
1. Open `about:debugging#/runtime/this-firefox`
2. **Load Temporary Add-on…** → pick `manifest.json` in this folder.
3. Click the toolbar icon → **Grant access** if prompted → paste a token → Save.

Temporary add-ons are removed when Firefox restarts. For a permanent install, sign it via AMO
(`web-ext sign --channel=unlisted`) or publish it on addons.mozilla.org.

## Token
- Classic: scope `repo` ([create](https://github.com/settings/tokens/new?scopes=repo&description=StructyHub%20Firefox)).
- Fine-grained: *All repositories* (or pre-create the repo and select it), with **Contents: Read and write**
  and **Administration: Read and write** (needed only for auto-creating the repo).

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
