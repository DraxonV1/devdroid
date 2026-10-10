import os
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, FileResponse, HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from storage import append_event, get_events, clear_events, list_capture_files

app = FastAPI(title="DevDroid Backend")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

command_counter = 0
pending_command = {}
execute_results = {}
last_result = {}

@app.post("/api/log")
async def log_event(request: Request):
    try:
        data = await request.json()
        append_event(data)
        return {"status": "ok"}
    except Exception as e:
        return JSONResponse({"status": "error", "message": str(e)}, status_code=400)

@app.get("/api/events")
async def read_events(limit: int = 100, method: str = None):
    res = get_events(limit, method)
    return {"total": len(res), "events": res}

@app.get("/api/files")
async def read_files():
    return {"files": list_capture_files()}

@app.get("/api/clear")
async def clear_all():
    return clear_events()

@app.post("/api/execute")
async def execute_cmd(request: Request):
    global command_counter, pending_command
    try:
        data = await request.json()
        method = data.get("method")
        params = data.get("params", {})
        if not method and data.get("expression"):
            method = "Runtime.evaluate"
            params = {"expression": data.get("expression"), "awaitPromise": True}
        if not method:
            return JSONResponse({"status": "error", "message": "method required"}, status_code=400)
        command_counter += 1
        pending_command = {"id": command_counter, "method": method, "params": params}
        return {"id": command_counter}
    except Exception as e:
        return JSONResponse({"status": "error", "message": str(e)}, status_code=400)

@app.get("/api/poll")
async def poll_cmd():
    global pending_command
    cmd = pending_command
    pending_command = {}
    return cmd

@app.post("/api/execute_result")
async def post_result(request: Request):
    global last_result
    try:
        data = await request.json()
        cmd_id = data.get("id")
        res = {"id": cmd_id, "result": data.get("result"), "exception": data.get("exception")}
        if cmd_id is not None:
            execute_results[cmd_id] = res
        last_result = res
        return {"status": "ok"}
    except Exception as e:
        return JSONResponse({"status": "error", "message": str(e)}, status_code=400)

@app.get("/api/execute_result")
async def get_result(id: int = None):
    if id is not None:
        return execute_results.get(id, {})
    return last_result

@app.get("/download")
async def download():
    for p in ["ext/devdroid.zip", "devdroid.zip"]:
        if os.path.exists(p):
            return FileResponse(p, filename="devdroid.zip")
    return JSONResponse({"error": "not found"}, status_code=404)

@app.get("/", response_class=HTMLResponse)
async def dashboard():
    return "<html><body style='font-family:sans-serif;'><h2>DevDroid Server (Python)</h2><p>Ready.</p></body></html>"

def main():
    uvicorn.run(app, host="0.0.0.0", port=8765)

if __name__ == "__main__":
    main()
