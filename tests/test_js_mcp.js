import test from "node:test";
import assert from "node:assert/strict";
import { CORE_TOOLS_DEF, CDP_DOMAINS } from "../js/tools_def.js";

test("Node.js MCP tools definitions", () => {
  const coreNames = CORE_TOOLS_DEF.map((t) => t.name);
  assert.ok(coreNames.includes("start_api_server"));
  assert.ok(coreNames.includes("get_api_status"));
  assert.ok(coreNames.includes("list_tools"));
  assert.ok(coreNames.includes("get_tool_help"));
  assert.ok(coreNames.includes("take_screenshot"));
  assert.ok(coreNames.includes("navigate_to"));
  assert.ok(coreNames.includes("execute_cdp"));

  assert.ok(CDP_DOMAINS.length >= 50);
  const total = CORE_TOOLS_DEF.length + CDP_DOMAINS.length;
  assert.ok(total >= 80);
});
