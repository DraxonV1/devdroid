import os
import json
import time
from datetime import datetime
from logger import log_event

CAPTURED_DIR = "captured"
os.makedirs(CAPTURED_DIR, exist_ok=True)

events = []
current_file_path = None
current_session_hour = None

def get_session_file() -> str:
    global current_file_path, current_session_hour
    now = datetime.now()
    hour_key = now.strftime("%Y%m%d_%H")
    if current_file_path is None or current_session_hour != hour_key:
        current_session_hour = hour_key
        ts_name = now.strftime("capture_%Y%m%d_%H%M%S.jsonl")
        current_file_path = os.path.join(CAPTURED_DIR, ts_name)
    return current_file_path

def append_event(payload: dict):
    events.append(payload)
    if len(events) > 5000:
        events.pop(0)
    file_path = get_session_file()
    with open(file_path, "a", encoding="utf-8") as f:
        f.write(json.dumps(payload) + "\n")
    m = payload.get("method", "Unknown")
    u = payload.get("params", {}).get("url") or payload.get("params", {}).get("request", {}).get("url") or ""
    log_event(m, u[:60] if u else "")

def get_events(limit: int = 100, method: str = None):
    filtered = events
    if method:
        filtered = [e for e in filtered if e.get("method") == method]
    return filtered[-limit:][::-1]

def clear_events():
    events.clear()
    return {"status": "cleared", "total_memory": 0}

def list_capture_files():
    if not os.path.exists(CAPTURED_DIR):
        return []
    files = []
    for f in sorted(os.listdir(CAPTURED_DIR), reverse=True):
        if f.endswith(".jsonl"):
            p = os.path.join(CAPTURED_DIR, f)
            files.append({"name": f, "size": os.path.getsize(p), "path": p})
    return files
