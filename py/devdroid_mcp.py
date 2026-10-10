import os
import time
import base64
import socket
import threading
from typing import Dict, Any, List, Optional
from mcp.server.fastmcp import FastMCP
import uvicorn
from server import app as server_app
from client import send_cdp, eval_js
from cdp_specs import CDP_SPECS

mcp = FastMCP("DevDroid-Browser-Controller")
SERVER_URL = os.environ.get("DEVDROID_SERVER_URL", "http://localhost:8765")
running_srv = {"thread": None, "port": None, "host": None}

def _get_ips():
    ips = []
    try:
        h = socket.gethostname()
        for ip in socket.gethostbyname_ex(h)[2]:
            if not ip.startswith("127."): ips.append(ip)
    except Exception: pass
    return ips

@mcp.tool()
def start_api_server(port: int = 8765, public: bool = True) -> Dict[str, Any]:
    """Start DevDroid Bridge server in background inside MCP process."""
    global SERVER_URL
    host = "0.0.0.0" if public else "127.0.0.1"
    if not (running_srv["thread"] and running_srv["thread"].is_alive()):
        t = threading.Thread(target=lambda: uvicorn.run(server_app, host=host, port=port, log_level="warning"), daemon=True)
        t.start()
        running_srv.update({"thread": t, "port": port, "host": host})
        SERVER_URL = f"http://127.0.0.1:{port}"
        time.sleep(1)
    return {"status": "running", "port": running_srv["port"], "local": SERVER_URL, "lan": [f"http://{i}:{running_srv['port']}/api/log" for i in _get_ips()]}

@mcp.tool()
def get_api_status() -> Dict[str, Any]:
    """Check status of DevDroid HTTP server."""
    return {"url": SERVER_URL, "running": bool(running_srv["thread"] and running_srv["thread"].is_alive()), "port": running_srv["port"], "ips": _get_ips()}

@mcp.tool()
def list_tools(category: Optional[str] = None) -> Dict[str, Any]:
    """List all available tools."""
    tools = []
    for name, tool in mcp._tool_manager._tools.items():
        doc = (tool.description or "").strip()
        if not category or category.lower() in name.lower() or category.lower() in doc.lower():
            tools.append({"name": name, "description": doc.splitlines()[0] if doc else ""})
    return {"total": len(tools), "tools": tools}

@mcp.tool()
def get_tool_help(tool_name: str) -> Dict[str, Any]:
    """Get documentation for specific tool."""
    tool = mcp._tool_manager._tools.get(tool_name)
    return {"name": tool_name, "description": tool.description} if tool else {"error": "Not found"}

@mcp.tool()
def open_new_tab(url: str) -> Dict[str, Any]:
    """Open a new browser tab with target URL."""
    return send_cdp(SERVER_URL, "Tabs.create", {"url": url})

@mcp.tool()
def execute_cdp(method: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Execute raw Chrome DevTools Protocol command."""
    return send_cdp(SERVER_URL, method, params or {})

@mcp.tool()
def navigate_to(url: str) -> Dict[str, Any]:
    """Navigate current tab to target URL."""
    return send_cdp(SERVER_URL, "Page.navigate", {"url": url})

@mcp.tool()
def reload_page(ignore_cache: bool = False) -> Dict[str, Any]:
    """Reload the current page."""
    return send_cdp(SERVER_URL, "Page.reload", {"ignoreCache": ignore_cache})

@mcp.tool()
def get_current_url() -> Any:
    """Get active tab URL."""
    return eval_js(SERVER_URL, "location.href")

@mcp.tool()
def get_page_title() -> Any:
    """Get document title."""
    return eval_js(SERVER_URL, "document.title")

@mcp.tool()
def take_screenshot(format: str = "jpeg", quality: int = 75, save_path: Optional[str] = None) -> Dict[str, Any]:
    """Capture screenshot to base64 or file."""
    res = send_cdp(SERVER_URL, "Page.captureScreenshot", {"format": format, "quality": quality})
    data = res.get("result", {}).get("data") if isinstance(res.get("result"), dict) else None
    if not data: return {"error": "No screenshot", "raw": res}
    if save_path:
        with open(save_path, "wb") as f: f.write(base64.b64decode(data))
        return {"success": True, "saved_to": os.path.abspath(save_path), "size": len(data)}
    return {"success": True, "preview": data[:100] + "...", "bytes": len(data)}

@mcp.tool()
def get_page_html() -> Any:
    """Get document outer HTML."""
    return eval_js(SERVER_URL, "document.documentElement.outerHTML")

@mcp.tool()
def get_page_text() -> Any:
    """Get document body text."""
    return eval_js(SERVER_URL, "document.body.innerText")

@mcp.tool()
def query_selector(selector: str) -> Any:
    """Inspect element by CSS selector."""
    return eval_js(SERVER_URL, f"(() => {{ const el = document.querySelector({repr(selector)}); if (!el) return null; const r = el.getBoundingClientRect(); return {{ tag: el.tagName.toLowerCase(), text: el.innerText ? el.innerText.slice(0, 300) : '', value: el.value, rect: {{ x: r.x, y: r.y, w: r.width, h: r.height }} }}; }})()")

@mcp.tool()
def click_element(selector: str) -> Any:
    """Click DOM element."""
    return eval_js(SERVER_URL, f"(() => {{ const el = document.querySelector({repr(selector)}); if (!el) return 'Not found'; el.scrollIntoView({{ behavior: 'instant', block: 'center' }}); el.click(); return 'Clicked'; }})()")

@mcp.tool()
def type_text(selector: str, text: str, clear_first: bool = True) -> Any:
    """Type text into input."""
    return eval_js(SERVER_URL, f"(() => {{ const el = document.querySelector({repr(selector)}); if (!el) return 'Not found'; el.focus(); if ({str(clear_first).lower()}) el.value = ''; el.value = {repr(text)}; el.dispatchEvent(new Event('input', {{ bubbles: true }})); el.dispatchEvent(new Event('change', {{ bubbles: true }})); return 'Typed'; }})()")

@mcp.tool()
def scroll_to(x: int, y: int) -> Any:
    """Scroll window to coordinates."""
    return eval_js(SERVER_URL, f"window.scrollTo({x}, {y}); 'Scrolled'")

@mcp.tool()
def inject_javascript(code: str) -> Any:
    """Execute arbitrary JavaScript in document context."""
    return eval_js(SERVER_URL, code)

@mcp.tool()
def get_cookies() -> Dict[str, Any]:
    """Retrieve cookies for current page."""
    return send_cdp(SERVER_URL, "Network.getCookies")

# Register 50+ granular CDP domains
for name, cdp_m, doc in CDP_SPECS:
    def _create(m=cdp_m, d=doc):
        def tool_fn(params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
            return send_cdp(SERVER_URL, m, params or {})
        tool_fn.__name__ = name
        tool_fn.__doc__ = d
        return tool_fn
    mcp.tool()(_create())

def main():
    mcp.run(transport="stdio")

if __name__ == "__main__":
    main()
