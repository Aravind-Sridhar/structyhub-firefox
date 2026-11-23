# Privacy Policy: Structy Sync for Firefox

_Last updated: 2026-11-23_

Structy Sync for Firefox ("the extension") commits your passing Structy solutions to a GitHub
repository you choose. This policy explains what data it handles.

## What the extension reads
- **On structy.net only:** the problem you are working on (title, module, number, prompt) and your
  submitted solution code, read from Structy's API using your existing Structy session. It also
  notices which programming language you selected and whether all tests passed.
- It does not read any other websites.

## Where data is sent
- **To GitHub only** (`api.github.com`): your solution code and the problem prompt are committed to
  the repository you configured, on your own GitHub account. This happens only after all tests pass.
- **GitHub sign-in** uses GitHub's device flow (`github.com/login/...`) through the
  "Structy Sync for Firefox" GitHub App. The app can only access repositories you install it on,
  with read and write access to their contents.
- Nothing is sent to the developer of this extension or to any other third party. There is no
  server operated by the developer.

## What is stored on your device
Kept in Firefox's local extension storage and never sent anywhere except GitHub:
- your GitHub access token (from sign-in or a personal access token you paste in)
- your repository name and settings
- the last programming language you used on Structy

Signing out in the extension popup deletes the token from your device. You can also revoke the
app at <https://github.com/settings/apps/authorizations>, and uninstalling the extension removes
all of its local data.

## What the extension does not do
- No analytics, tracking, advertising or telemetry.
- No sale or sharing of data.
- No access to your GitHub account beyond the repositories you install the app on.

## Changes and contact
Changes to this policy will be published in this file in the project's repository:
<https://github.com/Aravind-Sridhar/structyhub-firefox>. Questions:
<https://github.com/Aravind-Sridhar/structyhub-firefox/issues>.

_Not affiliated with or endorsed by Structy._
