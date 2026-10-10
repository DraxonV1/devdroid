import test from "node:test";
import assert from "node:assert/strict";
import http from "http";
import { createServerApp } from "../js/server.js";

test("Node.js server endpoints flow", async () => {
  const app = createServerApp();
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 1. Log event
    const logRes = await fetch(`${baseUrl}/api/log`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method: "Console.log", text: "node test" }),
    });
    assert.equal(logRes.status, 200);

    // 2. Queue command
    const execRes = await fetch(`${baseUrl}/api/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method: "Page.navigate", params: { url: "https://node.org" } }),
    });
    assert.equal(execRes.status, 200);
    const { id: cmdId } = await execRes.json();
    assert.ok(cmdId);

    // 3. Poll command
    const pollRes = await fetch(`${baseUrl}/api/poll`);
    assert.equal(pollRes.status, 200);
    const polled = await pollRes.json();
    assert.equal(polled.id, cmdId);
    assert.equal(polled.method, "Page.navigate");

    // 4. Post execution result
    const postRes = await fetch(`${baseUrl}/api/execute_result`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: cmdId, result: { done: true } }),
    });
    assert.equal(postRes.status, 200);

    // 5. Get execution result
    const getRes = await fetch(`${baseUrl}/api/execute_result?id=${cmdId}`);
    assert.equal(getRes.status, 200);
    const resultObj = await getRes.json();
    assert.equal(resultObj.result.done, true);
  } finally {
    server.close();
  }
});
