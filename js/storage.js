import fs from "fs";
import path from "path";

const CAPTURED_DIR = "captured";
if (!fs.existsSync(CAPTURED_DIR)) {
  fs.mkdirSync(CAPTURED_DIR, { recursive: true });
}

let events = [];
let currentFilePath = null;
let currentSessionHour = null;

function getSessionFile() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const hourKey = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}`;
  if (!currentFilePath || currentSessionHour !== hourKey) {
    currentSessionHour = hourKey;
    const ts = `${hourKey}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
    currentFilePath = path.join(CAPTURED_DIR, `capture_${ts}.jsonl`);
  }
  return currentFilePath;
}

export function appendEvent(payload) {
  events.push(payload);
  if (events.length > 5000) events.shift();
  const file = getSessionFile();
  fs.appendFile(file, JSON.stringify(payload) + "\n", () => {});
}

export function getEvents(limit = 100, method = null) {
  let filtered = events;
  if (method) {
    filtered = filtered.filter((e) => e.method === method);
  }
  return filtered.slice(-limit).reverse();
}

export function clearEvents() {
  events = [];
  return { status: "cleared", total_memory: 0 };
}

export function listCaptureFiles() {
  if (!fs.existsSync(CAPTURED_DIR)) return [];
  return fs
    .readdirSync(CAPTURED_DIR)
    .filter((f) => f.endsWith(".jsonl"))
    .map((f) => {
      const p = path.join(CAPTURED_DIR, f);
      return { name: f, size: fs.statSync(p).size, path: p };
    })
    .reverse();
}
