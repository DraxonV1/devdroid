import express from "express";
import fs from "fs";
import path from "path";
import cors from "cors";
import url from "url";
import { appendEvent, getEvents, clearEvents, listCaptureFiles } from "./storage.js";

export function createServerApp() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

  let pendingCommand = null;
  let commandCounter = 0;
  const executeResults = new Map();

  app.post("/api/log", (req, res) => {
    try {
      appendEvent(req.body);
      res.json({ status: "ok" });
    } catch (err) {
      res.status(400).json({ status: "error", message: err.message });
    }
  });

  app.get("/api/events", (req, res) => {
    const limit = parseInt(req.query.limit, 10) || 100;
    const method = req.query.method;
    const result = getEvents(limit, method);
    res.json({ total: result.length, events: result });
  });

  app.get("/api/files", (req, res) => {
    res.json({ files: listCaptureFiles() });
  });

  app.get("/api/clear", (req, res) => {
    res.json(clearEvents());
  });

  app.post("/api/execute", (req, res) => {
    try {
      let method = req.body.method;
      let params = req.body.params || {};
      if (!method && req.body.expression) {
        method = "Runtime.evaluate";
        params = { expression: req.body.expression, awaitPromise: true };
      }
      if (!method) return res.status(400).json({ status: "error", message: "method required" });

      commandCounter += 1;
      pendingCommand = { id: commandCounter, method, params };
      res.json({ id: commandCounter });
    } catch (err) {
      res.status(400).json({ status: "error", message: err.message });
    }
  });

  app.get("/api/poll", (req, res) => {
    const cmd = pendingCommand || {};
    pendingCommand = null;
    res.json(cmd);
  });

  app.post("/api/execute_result", (req, res) => {
    try {
      const cmdId = req.body.id;
      const resObj = { id: cmdId, result: req.body.result, exception: req.body.exception };
      if (cmdId !== undefined && cmdId !== null) {
        executeResults.set(Number(cmdId), resObj);
      }
      res.json({ status: "ok" });
    } catch (err) {
      res.status(400).json({ status: "error", message: err.message });
    }
  });

  app.get("/api/execute_result", (req, res) => {
    const qId = req.query.id ? Number(req.query.id) : null;
    if (qId !== null) {
      if (executeResults.has(qId)) {
        return res.json(executeResults.get(qId));
      }
      return res.json({});
    }
    res.json({});
  });

  app.get("/download", (req, res) => {
    for (const p of ["ext/devdroid.zip", "devdroid.zip"]) {
      if (fs.existsSync(p)) return res.download(path.resolve(p));
    }
    res.status(404).json({ error: "zip not found" });
  });

  app.get("/", (req, res) => {
    res.send("<html><body><h2>DevDroid Server (Node.js)</h2><p>Ready.</p></body></html>");
  });

  return app;
}

export function startServer(port = 8765, host = "0.0.0.0") {
  const app = createServerApp();
  return new Promise((resolve, reject) => {
    const srv = app.listen(port, host, () => {
      console.error(`DevDroid Node server running on http://${host}:${port}`);
      resolve(srv);
    });
    srv.on("error", reject);
  });
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(url.fileURLToPath(import.meta.url));
if (isDirectRun) {
  startServer(process.env.PORT ? parseInt(process.env.PORT, 10) : 8765);
}

export default createServerApp;
