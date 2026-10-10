import { handleWebRequest, handleHeaders, handleResponse } from "./webrequest_handler.js";
import { executeCommand } from "./command_runner.js";

let BACKEND_URL = "";
let attachedTabId = null;
let isCapturing = false;
let localLogs = [];
globalThis.enableDebugger = false;

chrome.storage.local.get(["isCapturing", "attachedTabId", "backendUrl", "enableDebugger"], (res) => {
  if (res.isCapturing !== undefined) isCapturing = res.isCapturing;
  if (res.attachedTabId !== undefined) attachedTabId = res.attachedTabId;
  if (res.backendUrl !== undefined) BACKEND_URL = res.backendUrl;
  if (res.enableDebugger !== undefined) globalThis.enableDebugger = Boolean(res.enableDebugger);
  if (isCapturing) {
    chrome.action.setBadgeText({ text: "REC" });
    chrome.action.setBadgeBackgroundColor({ color: "#FF0000" });
  }
});

function isOwnServerUrl(url) {
  if (!url) return false;
  if (url.includes("/api/log") || url.includes("/api/poll") || url.includes("/api/execute")) return true;
  if (BACKEND_URL) {
    try {
      const host = new URL(BACKEND_URL).host;
      if (host && url.includes(host)) return true;
    } catch (e) {}
  }
  return false;
}

function postLog(payload) {
  localLogs.push(payload);
  if (localLogs.length > 5000) localLogs.shift();
  if (!BACKEND_URL || BACKEND_URL.trim() === "") return;
  fetch(BACKEND_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  }).catch(() => {});
}

async function resolveWorkingTab(tabId) {
  if (tabId) {
    const exists = await chrome.tabs.get(tabId).catch(() => null);
    if (exists && exists.id) return exists.id;
  }
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tabs && tabs[0]?.id) return tabs[0].id;
  const anyTabs = await chrome.tabs.query({ active: true });
  return anyTabs && anyTabs[0]?.id ? anyTabs[0].id : null;
}

if (chrome.tabs?.onActivated) {
  chrome.tabs.onActivated.addListener(async (info) => {
    if (!isCapturing) return;
    const prev = attachedTabId;
    attachedTabId = info.tabId;
    chrome.storage.local.set({ attachedTabId });
    if (globalThis.enableDebugger && chrome.debugger && prev !== info.tabId) {
      if (prev) { try { await chrome.debugger.detach({ tabId: prev }); } catch (e) {} }
      try {
        await chrome.debugger.attach({ tabId: info.tabId }, "1.3");
        await chrome.debugger.sendCommand({ tabId: info.tabId }, "Network.enable");
      } catch (e) {}
    }
  });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResp) => {
  if (msg.action === "getStatus") sendResp({ isCapturing, attachedTabId, backendUrl: BACKEND_URL });
  else if (msg.action === "startCapture") {
    globalThis.enableDebugger = Boolean(msg.enableDebugger);
    chrome.storage.local.set({ enableDebugger: globalThis.enableDebugger });
    startCapture(msg.tabId).then(() => sendResp({ success: true }));
    return true;
  } else if (msg.action === "stopCapture") {
    stopCapture().then(() => sendResp({ success: true }));
    return true;
  } else if (msg.action === "setBackendUrl") {
    BACKEND_URL = msg.url;
    chrome.storage.local.set({ backendUrl: BACKEND_URL });
    sendResp({ success: true });
  } else if (msg.action === "getLogs") {
    sendResp({ logs: localLogs });
    if (msg.clear) localLogs = [];
  } else if (msg.action === "getLogCount") sendResp({ count: localLogs.length });
});

async function startCapture(tabId) {
  if (isCapturing && attachedTabId) await stopCapture();
  attachedTabId = await resolveWorkingTab(tabId);
  isCapturing = true;
  chrome.storage.local.set({ isCapturing: true, attachedTabId });
  chrome.action.setBadgeText({ text: "REC" });
  chrome.action.setBadgeBackgroundColor({ color: "#FF0000" });
  postLog({ timestamp: Date.now(), tabId: attachedTabId, method: "Capture.started" });

  if (chrome.debugger && attachedTabId && globalThis.enableDebugger) {
    try {
      await chrome.debugger.attach({ tabId: attachedTabId }, "1.3");
      await chrome.debugger.sendCommand({ tabId: attachedTabId }, "Network.enable");
      await chrome.debugger.sendCommand({ tabId: attachedTabId }, "Runtime.enable");
    } catch (e) {}
  }
}

async function stopCapture() {
  if (attachedTabId && globalThis.enableDebugger && chrome.debugger) {
    try { await chrome.debugger.detach({ tabId: attachedTabId }); } catch (e) {}
  }
  postLog({ timestamp: Date.now(), tabId: attachedTabId, method: "Capture.stopped" });
  attachedTabId = null;
  isCapturing = false;
  chrome.storage.local.set({ isCapturing: false, attachedTabId: null });
  chrome.action.setBadgeText({ text: "" });
}

if (chrome.webRequest) {
  chrome.webRequest.onBeforeRequest.addListener(d => handleWebRequest(d, isCapturing, isOwnServerUrl, postLog), { urls: ["<all_urls>"] }, ["requestBody"]);
  chrome.webRequest.onSendHeaders.addListener(d => handleHeaders(d, isCapturing, isOwnServerUrl, postLog), { urls: ["<all_urls>"] }, ["requestHeaders", "extraHeaders"]);
  chrome.webRequest.onResponseStarted.addListener(d => handleResponse(d, isCapturing, isOwnServerUrl, postLog), { urls: ["<all_urls>"] }, ["responseHeaders", "extraHeaders"]);
}

setInterval(async () => {
  if (!isCapturing || !BACKEND_URL || BACKEND_URL.trim() === "") return;
  attachedTabId = await resolveWorkingTab(attachedTabId);
  if (!attachedTabId) return;

  const pollUrl = BACKEND_URL.replace("/api/log", "/api/poll");
  const resultUrl = BACKEND_URL.replace("/api/log", "/api/execute_result");
  try {
    const r = await fetch(pollUrl);
    const cmd = await r.json();
    if (cmd?.id) executeCommand(cmd, attachedTabId, globalThis.enableDebugger, resultUrl);
  } catch (e) {}
}, 1000);
