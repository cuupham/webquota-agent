# WebQuota Agent Bridge Extension

The extension operates only on a ChatGPT tab in the Chrome profile where you manually install it and sign in. It does not read or export cookies, passwords, or local storage from ChatGPT.

## Install

1. Start the WebQuota API from the repository root with \`.\scripts\start.ps1\`.
2. Open \`chrome://extensions\` in your normal Chrome profile.
3. Turn on **Developer mode**.
4. Select **Load unpacked** and choose this repository's \`extension\` folder.
5. Open \`https://chatgpt.com\` in that same Chrome profile. Sign in manually if needed; if the tab was open before installing the extension, reload it once.
6. Click the WebQuota extension icon. It opens the Bridge Panel in a regular extension tab.
7. Paste \`WEBQUOTA_API_KEY\` from the root \`.env\` file and select **Connect**.
8. Keep both the ChatGPT tab and Bridge Panel open while making local API requests.

The extension calls only \`http://127.0.0.1:4153\` and \`https://chatgpt.com\`. It requires host permissions for those origins so its extension page can call the local HTTP API. No public tunnel is required.

## Troubleshooting

- **API key check failed:** ensure the API is running and the key exactly matches \`.env\`.
- **No ChatGPT tab found:** open \`https://chatgpt.com\` in this Chrome profile and sign in manually.
- **Content script not available:** reload the ChatGPT tab after loading or updating the extension.
- **New chat control not found:** the ChatGPT page layout may have changed; inspect and update \`content.js\` selectors.
- **Verification or security challenge:** complete it manually in Chrome. The extension does not solve or bypass challenges.

## Security

The API key is stored in this extension's local storage and sent only to the loopback API. Do not share the extension profile or the key. The extension reads assistant response text in the active ChatGPT UI to fulfill local API calls; review applicable service terms before enabling automated workflows.
