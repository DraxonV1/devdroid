import fs from "fs";
import path from "path";

export async function sendCdp(serverUrl, method, params = {}, timeoutMs = 15000) {
  try {
    const postRes = await fetch(`${serverUrl}/api/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method, params })
    });
    const postData = await postRes.json();
    const cmdId = postData.id;
    if (!cmdId) return { error: "Failed to queue command", raw: postData };

    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      await new Promise(r => setTimeout(r, 400));
      const res = await fetch(`${serverUrl}/api/execute_result?id=${cmdId}`);
      if (res.ok) {
        const data = await res.json();
        // Check if data matches this cmdId
        if (data && data.id === cmdId && (data.result !== undefined && data.result !== null || data.exception)) {
          return data;
        }
      }
    }
    return { error: `Timeout waiting for command ${method} (id=${cmdId})` };
  } catch (err) {
    return { error: err.message };
  }
}

export async function evalJs(serverUrl, code) {
  const res = await sendCdp(serverUrl, "Runtime.evaluate", { expression: code, returnByValue: true, awaitPromise: true });
  if (res && res.result && res.result.result) {
    return res.result.result.value;
  }
  return res;
}

export async function handleScreenshot(serverUrl, a) {
  const res = await sendCdp(serverUrl, "Page.captureScreenshot", { format: a.format || "jpeg", quality: a.quality || 75 });
  const b64 = res?.result?.data;
  if (!b64) return { error: "Failed to capture", raw: res };
  if (a.save_path) {
    fs.writeFileSync(a.save_path, Buffer.from(b64, "base64"));
    return { success: true, saved_to: path.resolve(a.save_path), bytes: b64.length };
  }
  return { success: true, bytes_len: b64.length, preview: b64.slice(0, 100) + "..." };
}
