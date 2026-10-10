import os
import sys
import unittest
import tempfile
import shutil

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../py")))
import storage
import logger

class TestStorage(unittest.TestCase):
    def setUp(self):
        storage.clear_events()

    def test_append_and_rotation(self):
        storage.append_event({"method": "Network.requestWillBeSent", "params": {"url": "https://example.com"}})
        storage.append_event({"method": "Page.navigate", "params": {"url": "https://example.org"}})
        
        events = storage.get_events(limit=10)
        self.assertEqual(len(events), 2)
        self.assertEqual(events[0]["method"], "Page.navigate")
        self.assertEqual(events[1]["method"], "Network.requestWillBeSent")

        files = storage.list_capture_files()
        self.assertGreater(len(files), 0)
        self.assertTrue(files[0]["name"].endswith(".jsonl"))

    def test_clear_events(self):
        storage.append_event({"method": "Test"})
        res = storage.clear_events()
        self.assertEqual(res["status"], "cleared")
        self.assertEqual(len(storage.get_events()), 0)

    def test_logger_smoke(self):
        # Ensure easygradients logging handles calls cleanly
        logger.log_event("TEST.event", "details")
        logger.log_cdp(1, "Page.navigate", {"url": "https://test.com"})
        logger.log_server("POST", "/api/log")
        logger.log_error("ERR_TEST", "Test error message")

if __name__ == "__main__":
    unittest.main()
