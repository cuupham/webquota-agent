# Changelog

## 0.2.0 - Chrome extension bridge

- Replace the separate Playwright Chromium profile with an extension for the user's normal Chrome profile.
- Add authenticated local queue/result endpoints for browser jobs.
- Add a Bridge Panel for pairing with the local API key and polling for work.
- Add a content script that interacts with a manually signed-in ChatGPT tab.
- Remove the Playwright runtime dependency and browser installation step.
- Add extension bridge lifecycle tests and update Windows setup/uninstall docs.

## 0.1.0 - initial prototype

- Add loopback-only OpenAI-compatible Chat Completions gateway.
- Add dedicated Playwright browser profile and manual login flow.
- Add simulated JSON tool-call protocol with allowlisted names.
- Add prompt and protocol tests, CI workflow, and security documentation.
