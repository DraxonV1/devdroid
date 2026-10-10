document.addEventListener("DOMContentLoaded", () => {
  const urlInput = document.getElementById("urlInput");
  const saveBtn = document.getElementById("saveBtn");
  const localBtn = document.getElementById("localBtn");
  const statusMsg = document.getElementById("statusMsg");

  function showMsg(text) {
    statusMsg.innerText = text;
    statusMsg.className = "msg ok";
    setTimeout(() => {
      statusMsg.className = "msg";
    }, 2500);
  }

  chrome.storage.local.get(["backendUrl"], (res) => {
    if (res.backendUrl) {
      urlInput.value = res.backendUrl;
    }
  });

  saveBtn.addEventListener("click", () => {
    const val = urlInput.value.trim();
    chrome.storage.local.set({ backendUrl: val }, () => {
      chrome.runtime.sendMessage({ action: "setBackendUrl", url: val });
      showMsg("Saved: " + (val || "Local Mode"));
    });
  });

  localBtn.addEventListener("click", () => {
    urlInput.value = "";
    chrome.storage.local.set({ backendUrl: "" }, () => {
      chrome.runtime.sendMessage({ action: "setBackendUrl", url: "" });
      showMsg("Switched to Local Mode");
    });
  });
});