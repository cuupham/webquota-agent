const API_BASE = 'http://127.0.0.1:4153';
const apiKeyInput = document.getElementById('apiKey');
const connectButton = document.getElementById('connect');
const disconnectButton = document.getElementById('disconnect');
const statusElement = document.getElementById('status');

let running = false;
let activeController = null;

function setStatus(message, kind = '') {
  statusElement.textContent = message;
  statusElement.className = 'status' + (kind ? ' ' + kind : '');
}

async function getKey() {
  const value = apiKeyInput.value.trim();
  if (value) return value;
  const stored = await chrome.storage.local.get(['webquotaApiKey']);
  return typeof stored.webquotaApiKey === 'string' ? stored.webquotaApiKey : '';
}

function headers(key) {
  return {
    Authorization: 'Bearer ' + key,
    'Content-Type': 'application/json'
  };
}

async function getChatGPTTab() {
  const tabs = await chrome.tabs.query({ url: 'https://chatgpt.com/*' });
  const ready = tabs.filter((tab) => Number.isInteger(tab.id));
  if (ready.length === 0) return null;
  return ready.find((tab) => tab.active && tab.status === 'complete') ||
    ready.find((tab) => tab.status === 'complete') ||
    ready[0];
}

async function postResult(key, job, result) {
  const response = await fetch(API_BASE + '/bridge/result', {
    method: 'POST',
    headers: headers(key),
    body: JSON.stringify({
      id: job.id,
      success: result.ok === true,
      text: result.text || '',
      error: result.error || ''
    })
  });
  if (!response.ok) {
    const details = await response.text().catch(() => '');
    throw new Error('Could not return browser result to local API (' + response.status + '): ' + details.slice(0, 200));
  }
}

async function runJob(key, job) {
  setStatus('Working on job ' + job.id.slice(0, 8) + '…');
  let result;
  try {
    const tab = await getChatGPTTab();
    if (!tab || !Number.isInteger(tab.id)) {
      result = { ok: false, error: 'No ChatGPT tab found. Open https://chatgpt.com in this Chrome profile and sign in manually.' };
    } else {
      const reply = await chrome.tabs.sendMessage(tab.id, {
        type: 'WEBQUOTA_RUN',
        prompt: job.prompt
      });
      result = reply && reply.ok === true
        ? { ok: true, text: String(reply.text || '') }
        : { ok: false, error: String(reply && reply.error || 'The ChatGPT content script returned no result.') };
    }
  } catch (error) {
    result = {
      ok: false,
      error: error instanceof Error
        ? error.message + '. Ensure the ChatGPT tab is loaded, then reload it once after installing the extension.'
        : String(error)
    };
  }

  await postResult(key, job, result);
  if (result.ok) setStatus('Connected · last reply received successfully', 'good');
  else setStatus('Job failed: ' + result.error, 'bad');
}

async function pollLoop(key) {
  while (running) {
    activeController = new AbortController();
    try {
      const response = await fetch(API_BASE + '/bridge/next?waitMs=20000', {
        method: 'GET',
        headers: { Authorization: 'Bearer ' + key },
        signal: activeController.signal,
        cache: 'no-store'
      });

      if (response.status === 204) continue;
      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new Error('Local bridge returned HTTP ' + response.status + ': ' + detail.slice(0, 200));
      }

      const job = await response.json();
      await runJob(key, job);
    } catch (error) {
      if (!running) break;
      setStatus(error instanceof Error ? error.message : String(error), 'bad');
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }

  activeController = null;
}

connectButton.addEventListener('click', async () => {
  if (running) return;
  const key = await getKey();
  if (key.length < 32) {
    setStatus('Paste the WEBQUOTA_API_KEY from your local .env file.', 'bad');
    return;
  }

  connectButton.disabled = true;
  try {
    const response = await fetch(API_BASE + '/v1/models', {
      headers: { Authorization: 'Bearer ' + key },
      cache: 'no-store'
    });
    if (!response.ok) throw new Error('API key check failed (HTTP ' + response.status + '). Is WebQuota Agent running?');
    await chrome.storage.local.set({ webquotaApiKey: key });
    apiKeyInput.value = key;
    running = true;
    disconnectButton.disabled = false;
    setStatus('Connected to local API. Waiting for jobs…', 'good');
    void pollLoop(key);
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), 'bad');
  } finally {
    connectButton.disabled = running;
  }
});

disconnectButton.addEventListener('click', () => {
  running = false;
  activeController?.abort();
  connectButton.disabled = false;
  disconnectButton.disabled = true;
  setStatus('Disconnected');
});

chrome.storage.local.get(['webquotaApiKey']).then((stored) => {
  if (typeof stored.webquotaApiKey === 'string') apiKeyInput.value = stored.webquotaApiKey;
});
