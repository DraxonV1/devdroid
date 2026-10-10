import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import { appendEvent, getEvents, clearEvents, listCaptureFiles } from "../js/storage.js";

test("Node.js storage rotation & capture", () => {
  clearEvents();

  appendEvent({ method: "Network.requestWillBeSent", params: { url: "https://node.test" } });
  appendEvent({ method: "Page.navigate", params: { url: "https://node.org" } });

  const events = getEvents(10);
  assert.equal(events.length, 2);
  assert.equal(events[0].method, "Page.navigate");
  assert.equal(events[1].method, "Network.requestWillBeSent");

  const files = listCaptureFiles();
  assert.ok(files.length > 0);
  assert.ok(files[0].name.endsWith(".jsonl"));
});

test("Node.js clearEvents", () => {
  appendEvent({ method: "Temp" });
  const res = clearEvents();
  assert.equal(res.status, "cleared");
  assert.equal(getEvents().length, 0);
});
