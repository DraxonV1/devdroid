#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import os from "os";
import { startServer } from "./server.js";
import { sendCdp, evalJs, handleScreenshot } from "./client.js";
import { CORE_TOOLS_DEF, CDP_DOMAINS } from "./tools_def.js";

let SERVER_URL = process.env.DEVDROID_SERVER_URL || "http://localhost:8765";
let srvInstance = null;
let srvPort = null;

function getIps() {
  const ifaces = os.networkInterfaces();
  const res = [];
  for (const n of Object.keys(ifaces)) {
    for (const f of ifaces[n] || []) {
      if (f.family === "IPv4" && !f.internal) res.push(f.address);
    }
  }
  return res;
}

const ALL_TOOLS = [...CORE_TOOLS_DEF];
for (const [name, method] of CDP_DOMAINS) {
  ALL_TOOLS.push({
    name,
    description: `Execute ${method}`,
    inputSchema: { type: "object", properties: { params: { type: "object" } } }
  });
}

const server = new Server({ name: "devdroid-mcp", version: "1.0.0" }, { capabilities: { tools: {} } });
server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: ALL_TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: a = {} } = req.params;
  try {
    if (name === "start_api_server") {
      const port = a.port || 8765;
      const host = a.public !== false ? "0.0.0.0" : "127.0.0.1";
      if (!srvInstance) {
        srvInstance = await startServer(port, host);
        srvPort = port;
        SERVER_URL = `http://127.0.0.1:${port}`;
      }
      return { content: [{ type: "text", text: JSON.stringify({ status: "running", port: srvPort, local: SERVER_URL, lan: getIps().map(i => `http://${i}:${srvPort}/api/log`) }, null, 2) }] };
    }
    if (name === "get_api_status") return { content: [{ type: "text", text: JSON.stringify({ url: SERVER_URL, running: Boolean(srvInstance), port: srvPort, ips: getIps() }, null, 2) }] };
    if (name === "list_tools") {
      const q = (a.category || "").toLowerCase();
      const res = ALL_TOOLS.filter(t => !q || t.name.includes(q) || t.description.toLowerCase().includes(q)).map(t => ({ name: t.name, desc: t.description }));
      return { content: [{ type: "text", text: JSON.stringify({ count: res.length, tools: res }, null, 2) }] };
    }
    if (name === "get_tool_help") {
      const t = ALL_TOOLS.find(x => x.name === a.tool_name);
      return t ? { content: [{ type: "text", text: JSON.stringify(t, null, 2) }] } : { content: [{ type: "text", text: "Tool not found" }], isError: true };
    }
    if (name === "open_new_tab") return { content: [{ type: "text", text: JSON.stringify(await sendCdp(SERVER_URL, "Tabs.create", { url: a.url }), null, 2) }] };
    if (name === "execute_cdp") return { content: [{ type: "text", text: JSON.stringify(await sendCdp(SERVER_URL, a.method, a.params || {}), null, 2) }] };
    if (name === "navigate_to") return { content: [{ type: "text", text: JSON.stringify(await sendCdp(SERVER_URL, "Page.navigate", { url: a.url }), null, 2) }] };
    if (name === "reload_page") return { content: [{ type: "text", text: JSON.stringify(await sendCdp(SERVER_URL, "Page.reload", { ignoreCache: Boolean(a.ignoreCache) }), null, 2) }] };
    if (name === "go_back") return { content: [{ type: "text", text: JSON.stringify(await evalJs(SERVER_URL, "history.back(); 'back'")) }] };
    if (name === "go_forward") return { content: [{ type: "text", text: JSON.stringify(await evalJs(SERVER_URL, "history.forward(); 'forward'")) }] };
    if (name === "get_current_url") return { content: [{ type: "text", text: JSON.stringify(await evalJs(SERVER_URL, "location.href")) }] };
    if (name === "get_page_title") return { content: [{ type: "text", text: JSON.stringify(await evalJs(SERVER_URL, "document.title")) }] };
    if (name === "take_screenshot") return { content: [{ type: "text", text: JSON.stringify(await handleScreenshot(SERVER_URL, a), null, 2) }] };
    if (name === "get_page_html") return { content: [{ type: "text", text: JSON.stringify(await evalJs(SERVER_URL, "document.documentElement.outerHTML")) }] };
    if (name === "get_page_text") return { content: [{ type: "text", text: JSON.stringify(await evalJs(SERVER_URL, "document.body.innerText")) }] };
    if (name === "query_selector") return { content: [{ type: "text", text: JSON.stringify(await evalJs(SERVER_URL, `(() => { const el = document.querySelector(${JSON.stringify(a.selector)}); if (!el) return null; const r = el.getBoundingClientRect(); return { tag: el.tagName.toLowerCase(), id: el.id, class: el.className, text: el.innerText ? el.innerText.slice(0, 300) : '', value: el.value, rect: { x: r.x, y: r.y, w: r.width, h: r.height } }; })()`)) }] };
    if (name === "query_selector_all") return { content: [{ type: "text", text: JSON.stringify(await evalJs(SERVER_URL, `Array.from(document.querySelectorAll(${JSON.stringify(a.selector)})).slice(0, ${a.limit || 30}).map(el => ({ tag: el.tagName.toLowerCase(), text: el.innerText ? el.innerText.slice(0, 80) : '', href: el.href || null }))`)) }] };
    if (name === "get_all_links") return { content: [{ type: "text", text: JSON.stringify(await evalJs(SERVER_URL, "Array.from(document.querySelectorAll('a[href]')).map(a => ({ text: a.innerText.trim(), href: a.href })).slice(0, 50)")) }] };
    if (name === "get_all_images") return { content: [{ type: "text", text: JSON.stringify(await evalJs(SERVER_URL, "Array.from(document.querySelectorAll('img')).map(i => ({ src: i.src, alt: i.alt || '' })).slice(0, 50)")) }] };
    if (name === "get_all_inputs") return { content: [{ type: "text", text: JSON.stringify(await evalJs(SERVER_URL, "Array.from(document.querySelectorAll('input, textarea, select, button')).map(e => ({ tag: e.tagName.toLowerCase(), type: e.type, name: e.name, id: e.id, value: e.value })).slice(0, 50)")) }] };
    if (name === "click_element") return { content: [{ type: "text", text: JSON.stringify(await evalJs(SERVER_URL, `(() => { const el = document.querySelector(${JSON.stringify(a.selector)}); if (!el) return 'Not found'; el.scrollIntoView({ behavior: 'instant', block: 'center' }); el.click(); return 'Clicked'; })()`)) }] };
    if (name === "type_text") return { content: [{ type: "text", text: JSON.stringify(await evalJs(SERVER_URL, `(() => { const el = document.querySelector(${JSON.stringify(a.selector)}); if (!el) return 'Not found'; el.focus(); if (${JSON.stringify(a.clear_first !== false)}) el.value = ''; el.value = ${JSON.stringify(a.text)}; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); return 'Typed'; })()`)) }] };
    if (name === "clear_input") return { content: [{ type: "text", text: JSON.stringify(await evalJs(SERVER_URL, `(() => { const el = document.querySelector(${JSON.stringify(a.selector)}); if (el) { el.value = ''; el.dispatchEvent(new Event('input')); return 'Cleared'; } return 'Not found'; })()`)) }] };
    if (name === "scroll_to") return { content: [{ type: "text", text: JSON.stringify(await evalJs(SERVER_URL, `window.scrollTo(${a.x}, ${a.y}); 'Scrolled'`)) }] };
    if (name === "scroll_element_into_view") return { content: [{ type: "text", text: JSON.stringify(await evalJs(SERVER_URL, `document.querySelector(${JSON.stringify(a.selector)})?.scrollIntoView({ behavior: 'smooth', block: 'center' }); 'Scrolled'`)) }] };
    if (name === "scroll_to_bottom") return { content: [{ type: "text", text: JSON.stringify(await evalJs(SERVER_URL, "window.scrollTo(0, document.body.scrollHeight); 'Scrolled'")) }] };
    if (name === "scroll_to_top") return { content: [{ type: "text", text: JSON.stringify(await evalJs(SERVER_URL, "window.scrollTo(0, 0); 'Scrolled'")) }] };
    if (name === "inject_javascript") return { content: [{ type: "text", text: JSON.stringify(await evalJs(SERVER_URL, a.code)) }] };
    if (name === "inject_stylesheet") return { content: [{ type: "text", text: JSON.stringify(await evalJs(SERVER_URL, `(() => { const s = document.createElement('style'); s.textContent = ${JSON.stringify(a.css)}; document.head.appendChild(s); return 'Style injected'; })()`)) }] };
    if (name === "get_cookies") return { content: [{ type: "text", text: JSON.stringify(await sendCdp(SERVER_URL, "Network.getCookies")) }] };
    if (name === "clear_browser_cookies") return { content: [{ type: "text", text: JSON.stringify(await sendCdp(SERVER_URL, "Network.clearBrowserCookies")) }] };
    if (name === "get_local_storage") return { content: [{ type: "text", text: JSON.stringify(await evalJs(SERVER_URL, "JSON.stringify(window.localStorage)")) }] };
    if (name === "get_captured_traffic") {
      const r = await fetch(`${SERVER_URL}/api/events?limit=${a.limit || 50}`);
      return { content: [{ type: "text", text: JSON.stringify((await r.json()).events || [], null, 2) }] };
    }
    if (name === "clear_captured_traffic") {
      const r = await fetch(`${SERVER_URL}/api/clear`);
      return { content: [{ type: "text", text: JSON.stringify(await r.json()) }] };
    }
    const gen = CDP_DOMAINS.find(([t]) => t === name);
    if (gen) return { content: [{ type: "text", text: JSON.stringify(await sendCdp(SERVER_URL, gen[1], a.params || {}), null, 2) }] };
    return { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true };
  } catch (err) {
    return { content: [{ type: "text", text: err.message }], isError: true };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
