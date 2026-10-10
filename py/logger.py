try:
    from easygradients import color, bg_color
    def _c(text, hex_code): return color(text, hex_code)
    def _bg(text, hex_code): return bg_color(f" {text} ", hex_code)
except ImportError:
    def _c(text, hex_code): return text
    def _bg(text, hex_code): return f"[{text}]"

def log_event(method: str, details: str = ""):
    badge = _bg("EVENT", "#1f6feb")
    method_styled = _c(method, "#58a6ff")
    detail_styled = _c(details, "#8b949e") if details else ""
    print(f"{badge} {method_styled} {detail_styled}")

def log_cdp(cmd_id: int, method: str, params: dict = None):
    badge = _bg("CDP", "#238636")
    id_styled = _c(f"#{cmd_id}", "#7ee787")
    method_styled = _c(method, "#58a6ff")
    print(f"{badge} {id_styled} {method_styled}")

def log_error(err_type: str, message: str):
    badge = _bg("ERR", "#da3633")
    print(f"{badge} {_c(err_type, '#ff7b72')} {_c(message, '#f0f6fc')}")

def log_server(action: str, target: str):
    badge = _bg("HTTP", "#8957e5")
    print(f"{badge} {_c(action, '#d2a8ff')} {_c(target, '#8b949e')}")
