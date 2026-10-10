import requests
import json
import time
from typing import Dict, Any, Optional

def send_cdp(server_url: str, method: str, params: Optional[Dict[str, Any]] = None, timeout: int = 15) -> Dict[str, Any]:
    if params is None:
        params = {}
    try:
        r = requests.post(f"{server_url}/api/execute", json={"method": method, "params": params}, timeout=10)
        r.raise_for_status()
        cmd_id = r.json().get("id")
        
        start = time.time()
        while time.time() - start < timeout:
            time.sleep(0.4)
            res = requests.get(f"{server_url}/api/execute_result", params={"id": cmd_id}, timeout=10)
            if res.status_code == 200:
                data = res.json()
                if data and (data.get("result") is not None or data.get("exception") is not None):
                    return data
        return {"error": f"Timeout waiting for command {method} (id={cmd_id})"}
    except Exception as e:
        return {"error": str(e)}

def eval_js(server_url: str, js_code: str) -> Any:
    res = send_cdp(server_url, "Runtime.evaluate", {"expression": js_code, "returnByValue": True, "awaitPromise": True})
    if "result" in res and isinstance(res["result"], dict):
        inner = res["result"].get("result", {})
        return inner.get("value")
    return res
