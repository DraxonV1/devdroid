export function handleWebRequest(details, isCapturing, isOwnServerUrl, postLog) {
  if (!isCapturing || isOwnServerUrl(details.url)) return;

  let postBody = null;
  if (details.requestBody) {
    if (details.requestBody.raw) {
      try {
        const decoder = new TextDecoder("utf-8");
        postBody = details.requestBody.raw.map((r) => decoder.decode(r.bytes)).join("");
      } catch (e) {}
    } else if (details.requestBody.formData) {
      postBody = JSON.stringify(details.requestBody.formData);
    }
  }

  postLog({
    timestamp: Date.now(),
    tabId: details.tabId,
    method: "Network.requestWillBeSent",
    params: {
      requestId: details.requestId,
      type: details.type,
      request: { url: details.url, method: details.method, postData: postBody }
    }
  });
}

export function handleHeaders(details, isCapturing, isOwnServerUrl, postLog) {
  if (!isCapturing || isOwnServerUrl(details.url)) return;
  const hdrs = {};
  (details.requestHeaders || []).forEach((h) => { hdrs[h.name.toLowerCase()] = h.value; });
  postLog({
    timestamp: Date.now(),
    tabId: details.tabId,
    method: "Network.requestWillBeSentExtraInfo",
    params: { requestId: details.requestId, headers: hdrs, url: details.url }
  });
}

export function handleResponse(details, isCapturing, isOwnServerUrl, postLog) {
  if (!isCapturing || isOwnServerUrl(details.url)) return;
  const hdrs = {};
  (details.responseHeaders || []).forEach((h) => { hdrs[h.name.toLowerCase()] = h.value; });
  postLog({
    timestamp: Date.now(),
    tabId: details.tabId,
    method: "Network.responseReceived",
    params: {
      requestId: details.requestId,
      type: details.type,
      response: { url: details.url, status: details.statusCode, headers: hdrs }
    }
  });
}
