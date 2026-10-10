export async function executeCommand(cmd, attachedTabId, globalEnableDebugger, resultUrl) {
  let method = cmd.method;
  let params = cmd.params || {};

  if (!method && cmd.expression) {
    method = "Runtime.evaluate";
    params = { expression: cmd.expression, awaitPromise: true };
  }
  if (!method) return;

  // 1. Native Tab Creation & Control
  if (method === "Tabs.create" || method === "open_tab" || method === "new_tab") {
    try {
      const newTab = await chrome.tabs.create({ url: params.url || "about:blank", active: Boolean(params.active ?? true) });
      fetch(resultUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: cmd.id, result: { tabId: newTab.id, url: newTab.url }, exception: null })
      }).catch(() => {});
    } catch (e) {
      fetch(resultUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: cmd.id, result: null, exception: e.message })
      }).catch(() => {});
    }
    return;
  }

  // 2. Screenshot handler
  if (method === "Page.captureScreenshot" || method === "screenshot") {
    try {
      const tabInfo = await chrome.tabs.get(attachedTabId).catch(() => null);
      const winId = tabInfo?.windowId || null;
      chrome.tabs.captureVisibleTab(
        winId,
        { format: params.format === "png" ? "png" : "jpeg", quality: params.quality || 80 },
        (dataUrl) => {
          const err = chrome.runtime.lastError;
          const b64 = dataUrl ? dataUrl.replace(/^data:image\/[a-z]+;base64,/, "") : null;
          fetch(resultUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: cmd.id, result: { data: b64 }, exception: err ? err.message : null })
          }).catch(() => {});
        }
      );
    } catch (e) {
      fetch(resultUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: cmd.id, result: null, exception: e.message })
      }).catch(() => {});
    }
    return;
  }

  // 3. Debugger execution
  if (chrome.debugger && globalEnableDebugger) {
    try { await chrome.debugger.attach({ tabId: attachedTabId }, "1.3"); } catch (e) {}
    chrome.debugger.sendCommand({ tabId: attachedTabId }, method, params, (res) => {
      const err = chrome.runtime.lastError;
      fetch(resultUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: cmd.id, result: res || null, exception: err ? err.message : null })
      }).catch(() => {});
    });
  } else if (method === "Runtime.evaluate" && params.expression) {
    if (chrome.tabs?.executeScript) {
      chrome.tabs.executeScript(attachedTabId, { code: params.expression }, (res) => {
        const err = chrome.runtime.lastError;
        fetch(resultUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: cmd.id, result: res ? { value: res[0] } : null, exception: err ? err.message : null })
        }).catch(() => {});
      });
    }
  }
}
