import os
import sys
import unittest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../py")))
from server import app

class TestServerEndpoints(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_log_and_events(self):
        # 1. Log event
        res = self.client.post("/api/log", json={"method": "Console.log", "params": {"text": "hello"}})
        self.assertEqual(res.status_code, 200)

        # 2. Query events
        res = self.client.get("/api/events?limit=5")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertGreater(data["total"], 0)

    def test_command_execution_flow(self):
        # Queue command
        res = self.client.post("/api/execute", json={"method": "Page.navigate", "params": {"url": "https://test.com"}})
        self.assertEqual(res.status_code, 200)
        cmd_id = res.json()["id"]

        # Poll command
        res = self.client.get("/api/poll")
        self.assertEqual(res.status_code, 200)
        polled = res.json()
        self.assertEqual(polled["id"], cmd_id)
        self.assertEqual(polled["method"], "Page.navigate")

        # Post result
        res = self.client.post("/api/execute_result", json={"id": cmd_id, "result": {"success": True}, "exception": None})
        self.assertEqual(res.status_code, 200)

        # Get result
        res = self.client.get(f"/api/execute_result?id={cmd_id}")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["result"]["success"], True)

    def test_file_list(self):
        res = self.client.get("/api/files")
        self.assertEqual(res.status_code, 200)
        self.assertIn("files", res.json())

if __name__ == "__main__":
    unittest.main()
