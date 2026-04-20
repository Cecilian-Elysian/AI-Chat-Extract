import pytest
import os
import tempfile
import json
from src.export.json_exporter import JsonExporter
from src.export.csv_exporter import CsvExporter
from src.core.extractor import ChatSession


class TestJsonExporter:
    def test_export_creates_file(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            session = ChatSession("test_001", "openai", "Test")
            session.add_message("user", "Hello")
            exporter = JsonExporter(tmpdir)
            filepath = exporter.export([session], "test.json")
            assert os.path.exists(filepath)
            with open(filepath, "r", encoding="utf-8") as f:
                data = json.load(f)
            assert data["session_count"] == 1
            assert len(data["sessions"]) == 1


class TestCsvExporter:
    def test_export_creates_file(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            session = ChatSession("test_002", "claude", "Test CSV")
            session.add_message("user", "Test message")
            exporter = CsvExporter(tmpdir)
            filepath = exporter.export([session], "test.csv")
            assert os.path.exists(filepath)
