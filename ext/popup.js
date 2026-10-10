document.addEventListener("DOMContentLoaded", async () => {
  const statusBadge = document.getElementById("statusBadge");
  const eventCount = document.getElementById("eventCount");
  const toggleBtn = document.getElementById("toggleBtn");
  const enableDebuggerInput = document.getElementById("enableDebugger");
  const exportBtn = document.getElementById("exportBtn");
  const clearBtn = document.getElementById("clearBtn");
  const urlDisplay = document.getElementById("urlDisplay");
  const editUrlBtn = document.getElementById("editUrlBtn");
  const historyList = document.getElementById("historyList");

  let currentBackendUrl = "";
  let logHistory = [];

  function setBadge(isCapturing, text) {
    if (isCapturing) {
      statusBadge.innerText = text || "Recording";
      statusBadge.className = "badge recording";
      toggleBtn.innerText = "Stop Capture";
      toggleBtn.className = "btn-stop";
    } else {
      statusBadge.innerText = "Idle";
      statusBadge.className = "badge idle";
      toggleBtn.innerText = "Start Capture";
      toggleBtn.className = "btn-main";
    }
  }

  function renderHistory() {
    historyList.innerHTML = "";
    if (!logHistory || logHistory.length === 0) {
      historyList.innerHTML = '<div class="empty-state">No exports yet</div>';
      return;
    }

    [...logHistory].reverse().forEach((item, idx) => {
      const card = document.createElement("div");
      card.className = "history-card";

      const meta = document.createElement("div");
      meta.className = "history-meta";

      const name = document.createElement("div");
      name.className = "history-name";
      name.innerText = item.filename;

      const count = document.createElement("div");
      count.className = "history-count";
      count.innerText = `${item.count} events`;

      meta.appendChild(name);
      meta.appendChild(count);

      const dlBtn = document.createElement("button");
      dlBtn.className = "btn-secondary btn-sm";
      dlBtn.innerText = "Download";
      dlBtn.onclick = () => downloadFile(item.filename, item.data);

      card.appendChild(meta);
      card.appendChild(dlBtn);
      historyList.appendChild(card);
    });
  }

  function downloadFile(filename, content) {
    try {
      const blob = new Blob([content], { type: "application/jsonl" });
      const url = URL.createObjectURL(blob);
      if (chrome.downloads && chrome.downloads.download) {
        chrome.downloads.download({ url: url, filename: filename, saveAs: false }, () => {
          setTimeout(() => URL.revokeObjectURL(url), 4000);
        });
      } else {
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 4000);
      }
    } catch (e) {
      alert("Download failed: " + e.message);
    }
  }

  // Init state
  chrome.runtime.sendMessage({ action: "getStatus" }, (res) => {
    if (res) {
      setBadge(res.isCapturing);
      if (res.backendUrl) {
        currentBackendUrl = res.backendUrl;
        urlDisplay.innerText = res.backendUrl;
        urlDisplay.classList.add("active");
      }
    }
  });

  chrome.storage.local.get(["enableDebugger", "logHistory"], (res) => {
    enableDebuggerInput.checked = Boolean(res.enableDebugger);
    logHistory = res.logHistory || [];
    renderHistory();
  });

  enableDebuggerInput.addEventListener("change", () => {
    chrome.storage.local.set({ enableDebugger: enableDebuggerInput.checked });
  });
  editUrlBtn.addEventListener("click", () => {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open(chrome.runtime.getURL("options.html"));
    }
  });

  clearBtn.addEventListener("click", () => {
    chrome.runtime.sendMessage({ action: "getLogs", clear: true }, () => {
      eventCount.innerText = "0";
      logHistory = [];
      chrome.storage.local.set({ logHistory: [] });
      renderHistory();
    });
  });

  exportBtn.addEventListener("click", () => {
    chrome.runtime.sendMessage({ action: "getLogs", clear: false }, (res) => {
      if (!res || !res.logs || res.logs.length === 0) {
        alert("No captured events to export.");
        return;
      }

      const count = res.logs.length;
      const jsonl = res.logs.map((l) => JSON.stringify(l)).join("\n");
      const filename = `devdroid_${new Date().toISOString().replace(/[:.]/g, "-")}.jsonl`;

      downloadFile(filename, jsonl);

      logHistory.push({ filename, count, data: jsonl });
      if (logHistory.length > 5) logHistory.shift();
      chrome.storage.local.set({ logHistory });
      renderHistory();
    });
  });

  toggleBtn.addEventListener("click", async () => {
    chrome.runtime.sendMessage({ action: "getStatus" }, async (res) => {
      if (res && res.isCapturing) {
        chrome.runtime.sendMessage({ action: "stopCapture" }, () => setBadge(false));
      } else {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const tab = tabs && tabs[0] ? tabs[0] : null;
        chrome.runtime.sendMessage(
          { action: "startCapture", tabId: tab ? tab.id : null, enableDebugger: enableDebuggerInput.checked },
          (resp) => {
            if (resp && resp.success) {
              setBadge(true);
            } else {
              alert("Start failed: " + (resp?.error || "Unknown"));
            }
          }
        );
      }
    });
  });

  // Keep count updated
  function syncCount() {
    chrome.runtime.sendMessage({ action: "getLogCount" }, (res) => {
      if (res && res.count !== undefined) {
        eventCount.innerText = String(res.count);
      }
    });
  }
  setInterval(syncCount, 1000);
  syncCount();
});