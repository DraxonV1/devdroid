# DevDroid

> Real-time mobile and desktop browser remote control MCP server and DevTools CDP bridge for AI agents.

---

## Directory Structure

```text
devdroid/
├── ext/                         # Chrome Extension source
│   ├── manifest.json            # Manifest V3 configuration & permissions
│   ├── background.js            # Background service worker (CDP & webRequest engine)
│   ├── command_runner.js        # Command dispatcher & screenshot handler
│   ├── webrequest_handler.js    # Network event processor
│   ├── popup.html               # Mobile-responsive control popup
│   ├── popup.js                 # Popup controller & local export history
│   ├── popup.css                # Popup styling
│   ├── options.html             # Full-tab settings page for configuring server URL
│   └── options.js               # Settings page logic
│
├── py/                          # Python Backend & MCP implementation
│   ├── server.py                # FastAPI HTTP bridge between extension and agents
│   ├── devdroid_mcp.py          # FastMCP server with 125+ browser automation tools
│   ├── storage.py               # Timestamped capture file rotation
│   ├── logger.py                # Terminal logger styled with easygradients
│   ├── client.py                # HTTP client for CDP execution
│   └── cdp_specs.py             # CDP domain specifications
│
├── js/                          # Node.js Backend & MCP implementation
│   ├── server.js                # Express HTTP bridge equivalent to server.py
│   ├── index.js                 # Official @modelcontextprotocol/sdk MCP server
│   ├── storage.js               # Capture file rotation (Node.js)
│   ├── client.js                # HTTP client for CDP execution (Node.js)
│   ├── tools_def.js             # MCP tool schemas
│   └── package.json             # NPM package specification
│
├── captured/                    # Auto-rotated JSONL capture dumps (created on first event)
│   └── capture_YYYYMMDD_HHMMSS.jsonl
│
├── tests/                       # Complete unit test suite (Node.js & Python)
├── pyproject.toml               # PyPI package build configuration
├── devdroid.zip                 # Packaged extension ready to load
└── .github/workflows/
    └── release.yml              # Automated release workflow (GitHub, NPM, PyPI)
```

---

## Architecture

```text
+-----------------------+         HTTP Poll & Post         +------------------------+
|   Browser Extension   |  <============================>  |  Bridge API Server     |
|   (Desktop / Mobile)  |    /api/poll & /api/execute      |  (Python or Node.js)   |
+-----------------------+                                  +------------------------+
                                                                       ^
                                                                       | STDIO (MCP)
                                                                       v
                                                           +------------------------+
                                                           |   AI Coding Agent      |
                                                           | (Claude Code, Cursor,  |
                                                           |  Windsurf, Cline, OMP) |
                                                           +------------------------+
```

1. The Bridge Server runs on port `8765` (can be started directly by the AI agent via the `start_api_server` tool).
2. The Extension connects to the Bridge Server URL (e.g. `http://YOUR_IP:8765/api/log`).
3. Captured network and console events stream into rotating, timestamped JSONL files in `captured/`.
4. When the AI agent calls any browser tool, the command is queued via `POST /api/execute`.
5. The extension fetches the command from `GET /api/poll`, executes it in the browser tab via `chrome.debugger` or DOM APIs, and posts the output back to `POST /api/execute_result`.
6. The MCP server returns the result directly to the AI agent.

---

## 1. Extension (`ext/`)

### Key Features
- **Control Mode (CDP)**: Connects to the browser tab using the Chrome Debugger API to enable navigation, DOM querying, mouse clicks, key events, and screenshot capture.
- **Active Tab Tracking**: Listens to tab switches and immediately directs automation to the currently focused tab.
- **Native Tab Creation**: `open_new_tab(url)` creates a native tab directly using `chrome.tabs.create`.
- **Loop Prevention**: Automatically filters out its own network calls to the bridge server, preventing infinite logging loops.
- **Memory Capping**: Buffers up to 5,000 requests locally, preventing mobile browsers from running out of memory.
- **Local JSONL Export**: Exports recorded requests and console messages directly to a timestamped `.jsonl` file with one click, requiring no backend server.
- **Full-Tab Settings (`options.html`)**: Mobile browser popups close when opening the on-screen keyboard. Tapping "Change API URL" opens a standard browser tab where you can type and paste server addresses without interruption.

### How to Install the Extension
1. Open Chrome, Brave, Kiwi, or Lemur.
2. Navigate to `chrome://extensions` and enable **Developer Mode**.
3. Click **Load unpacked** and select the `ext/` directory, or drag and drop `devdroid.zip`.
4. Click the DevDroid icon, tap **Change API URL**, enter your server address, and save.
5. Enable **Control Mode (CDP)** and click **Start Capture**.

---

## 2. Server Management from MCP

Agents do not need to manually run an external server process beforehand. The MCP server bundles the HTTP bridge directly and can spin it up on demand:

- `start_api_server(port, public)`: Starts the Bridge HTTP server in the background and returns the local URL, port, and all discovered LAN IP addresses for mobile devices.
- `get_api_status()`: Returns whether the embedded bridge server is currently running, its active port, host, and configured URL.
- `list_tools(category)`: Lists all 125+ tools available in the MCP server with brief descriptions. Supports filtering by category (`server`, `navigation`, `dom`, `input`, `scroll`, `storage`, `traffic`, `cdp`).
- `get_tool_help(tool_name)`: Returns complete documentation, schemas, and parameter details for any specific tool.

---

## 3. Bridge API Servers (`py/server.py` and `js/server.js`)

Both servers provide identical endpoints on port `8765`. Choose whichever runtime fits your environment.

### Endpoints
- `POST /api/log`: Ingests network and console events captured by the extension into timestamped files in `captured/`.
- `GET /api/events?limit=100`: Returns captured traffic logs as JSON.
- `GET /api/files`: Lists all rotated JSONL files in `captured/` with file names, sizes, and file paths.
- `GET /api/clear`: Flushes in-memory event logs.
- `POST /api/execute`: Queues a command (`method` and `params`) for the browser.
- `GET /api/poll`: Fetches and dequeues the pending command for the extension.
- `POST /api/execute_result`: Receives the execution result from the extension.
- `GET /api/execute_result?id=<id>`: Retrieves the result of a specific command.
- `GET /download`: Serves `devdroid.zip` for remote setup.

### Captured Event File Rotation
Events are written to timestamped files:
```text
captured/capture_YYYYMMDD_HHMMSS.jsonl
```
Each line is a self-contained JSON object with timestamp, tabId, method, and parameters (request/response headers, body, cookies). A new file is automatically started each session or hour to prevent massive single files.

### Running the Python Server (Standalone)
```bash
pip install devdroid
devdroid-server
```

### Running the Node.js Server (Standalone)
```bash
npm install -g devdroid
devdroid-server
```

---

## 4. MCP Servers (`js/index.js` and `py/devdroid_mcp.py`)

Both MCP servers expose 125+ tools over standard I/O (STDIO) for AI coding agents.

### Tool Categories

#### Server Management & Discovery
- `start_api_server(port, public)`: Starts the bridge server in background. Returns connection URLs.
- `get_api_status()`: Returns active server status and network endpoints.
- `list_tools(category)`: Lists all available tools.
- `get_tool_help(tool_name)`: Provides detailed documentation for a specific tool.

#### Navigation & Tabs
- `open_new_tab(url)`: Opens a new browser tab with target URL.
- `navigate_to(url)`: Directs the active tab to a new URL.
- `reload_page(ignoreCache)`: Reloads the page.
- `go_back()`: Navigates back in browser history.
- `go_forward()`: Navigates forward in browser history.
- `get_current_url()`: Returns the active URL and pathname.
- `get_page_title()`: Returns the current document title.

#### Visuals
- `take_screenshot(format, quality, save_path)`: Captures the visible tab and returns base64 or writes directly to a local image file.
- `print_to_pdf()`: Generates a PDF snapshot of the page.

#### DOM Reading
- `get_page_html()`: Returns full `document.documentElement.outerHTML`.
- `get_page_text()`: Returns readable text content of `document.body`.
- `query_selector(selector)`: Returns tag name, text, value, and bounding box for a selector.
- `query_selector_all(selector, limit)`: Returns matching elements up to the specified limit.
- `get_all_links()`: Returns an array of `{ text, href }` objects for links on the page.
- `get_all_images()`: Returns an array of `{ src, alt }` objects for images on the page.
- `get_all_inputs()`: Returns all form elements with their types, names, and values.

#### User Actions & Inputs
- `click_element(selector)`: Scrolls an element into view and triggers a click.
- `click_coords(x, y)`: Dispatches physical mouse press and release events at specific coordinates.
- `type_text(selector, text, clear_first)`: Focuses an input, sets value, and triggers change events.
- `clear_input(selector)`: Clears the value of an input field.
- `press_key(key)`: Dispatches keyboard key down and up events (e.g. `Enter`, `Tab`, `Escape`).

#### Scrolling
- `scroll_to(x, y)`: Moves viewport to absolute coordinate positions.
- `scroll_element_into_view(selector)`: Centers the element in the viewport.
- `scroll_to_bottom()`: Scrolls to the bottom of the page.
- `scroll_to_top()`: Scrolls to the top of the page.

#### Code Injection
- `inject_javascript(code)`: Executes arbitrary JavaScript in the page context.
- `inject_stylesheet(css)`: Appends a `<style>` block to the document head.

#### Storage & Cookies
- `get_cookies()`: Returns cookies for the current domain.
- `clear_browser_cookies()`: Deletes all cookies.
- `get_local_storage()`: Dumps all `localStorage` key-value pairs.

#### Raw Protocol & CDP Domains
- `execute_cdp(method, params)`: Sends any arbitrary CDP command.
- Includes 50+ pre-registered domain methods across `DOM`, `CSS`, `Page`, `Network`, `Runtime`, `Console`, `Log`, `Security`, `ServiceWorker`, `Storage`, `Memory`, `Profiler`, and `HeapProfiler`.

---

## 5. Agent Setup Guide

### Node.js / `npx` Configuration
Compatible with Claude Code, Cursor, Windsurf, Cline, and Roo:

```json
{
  "mcpServers": {
    "devdroid": {
      "command": "npx",
      "args": ["-y", "devdroid"],
      "env": {
        "DEVDROID_SERVER_URL": "http://127.0.0.1:8765"
      }
    }
  }
}
```

### Python Configuration
```json
{
  "mcpServers": {
    "devdroid": {
      "command": "devdroid",
      "env": {
        "DEVDROID_SERVER_URL": "http://127.0.0.1:8765"
      }
    }
  }
}
```

---

## Contributing

Contributions are welcome. Please open an issue or submit a pull request.

1. Fork the repository.
2. Create your feature branch (`git checkout -b feature/my-feature`).
3. Ensure tests pass (`node --test tests/test_js_*.js` and `python -m unittest discover -s tests -p "test_py_*.py"`).
4. Commit your changes (`git commit -m "feat: add feature"`).
5. Push to the branch (`git push origin feature/my-feature`).
6. Open a Pull Request.
---

## License

MIT License. See `LICENSE` for details.
