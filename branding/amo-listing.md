# Firefox Add-ons listing text

Copy each section into the matching field on addons.mozilla.org.

## Name
Structy Sync for Firefox

## Summary (max 250 characters)
Automatically commit your passing Structy solutions to your own GitHub repository, organised by module with the problem prompt alongside your code. Not affiliated with Structy.

## Description
Build a GitHub portfolio while you practise data structures and algorithms on Structy.

When every test passes on a Structy problem, Structy Sync commits your solution and the problem prompt to a GitHub repository you choose:

    Structy-Hub/
      <module>/<NNN>-<problem-name>/
        <problem-name>.py | .js | .cpp | .java
        README.md

<b>Features</b>
• Automatic commits as soon as all tests pass, with a confirmation toast on the page
• Supports Python, JavaScript, C++ and Java, including premium problems
• One commit per solve, organised by module and problem number
• Skips the commit if your solution hasn't changed

<b>Setup</b>
1. Create a repository on GitHub (for example "Structy-Hub").
2. Install the "Structy Sync for Firefox" GitHub App on just that repository.
3. Click the extension icon, choose "Sign in with GitHub", and enter the code shown.

<b>Privacy and security</b>
• Sign-in uses a GitHub App, so the extension can only access the repositories you install it on, with read and write access to their contents. It cannot see or change anything else on your account.
• Your code goes only to GitHub. There is no developer server, analytics or tracking.
• Open source: https://github.com/Aravind-Sridhar/structyhub-firefox

Firefox port of StructyHub by Cameron Beck (MIT licence). Not affiliated with or endorsed by Structy.

## Categories
Other (and/or Productivity, if offered)

## Tags (optional)
github, coding, programming, productivity

## Support site
https://github.com/Aravind-Sridhar/structyhub-firefox

## Support email
(leave empty, or use an address you're happy to make public)

## License
MIT License

## Privacy policy
Paste the contents of PRIVACY.md (without the top heading).

## Notes to reviewer
No build step: the uploaded files are the hand-written source.
Testing needs a Structy account (structy.net) and a GitHub account. Sign-in uses the GitHub App device flow (client ID Iv23lizGJxjt5Jq91O9h, no client secret). Solve any free Structy problem with all tests passing to trigger a commit. A personal access token can be pasted under "Advanced" in the popup instead.
