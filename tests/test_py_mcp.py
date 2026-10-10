import os
import sys
import unittest
import asyncio

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../py")))
import devdroid_mcp

class TestPythonMCP(unittest.TestCase):
    def test_tools_registered(self):
        tools = asyncio.run(devdroid_mcp.mcp.list_tools())
        names = [t.name for t in tools]
        self.assertIn("start_api_server", names)
        self.assertIn("get_api_status", names)
        self.assertIn("list_tools", names)
        self.assertIn("get_tool_help", names)
        self.assertIn("take_screenshot", names)
        self.assertIn("navigate_to", names)
        self.assertIn("execute_cdp", names)
        self.assertGreater(len(names), 60)

    def test_list_tools_filtering(self):
        res = devdroid_mcp.list_tools("server")
        self.assertGreaterEqual(res["total"], 2)
        tool_names = [t["name"] for t in res["tools"]]
        self.assertIn("start_api_server", tool_names)

    def test_get_tool_help(self):
        res = devdroid_mcp.get_tool_help("navigate_to")
        self.assertEqual(res["name"], "navigate_to")
        self.assertIn("description", res)

if __name__ == "__main__":
    unittest.main()
