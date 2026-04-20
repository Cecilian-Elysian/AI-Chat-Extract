import pytest
from src.core.config import Config
from src.core.extractor import ChatSession, ChatMessage


class TestChatExtractor:
    def test_chat_message_to_dict(self):
        msg = ChatMessage("user", "Hello", "2024-01-01T00:00:00")
        data = msg.to_dict()
        assert data["role"] == "user"
        assert data["content"] == "Hello"
        assert data["timestamp"] == "2024-01-01T00:00:00"

    def test_chat_session_add_message(self):
        session = ChatSession("sess_001", "openai", "Test Session")
        session.add_message("user", "Hello")
        session.add_message("assistant", "Hi there")
        assert len(session.messages) == 2

    def test_chat_session_to_dict(self):
        session = ChatSession("sess_002", "claude", "My Chat")
        session.add_message("user", "Test")
        data = session.to_dict()
        assert data["session_id"] == "sess_002"
        assert data["platform"] == "claude"
        assert len(data["messages"]) == 1


class TestConfig:
    def test_config_defaults(self):
        config = Config()
        assert config.scheduler_enabled is True
        assert config.interval_minutes == 60
        assert config.export_format == "json"
        assert config.output_dir == "./exports"
