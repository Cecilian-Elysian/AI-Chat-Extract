from typing import List, Dict, Any, Optional
from datetime import datetime


class ChatMessage:
    def __init__(self, role: str, content: str, timestamp: Optional[str] = None):
        self.role = role
        self.content = content
        self.timestamp = timestamp or datetime.now().isoformat()

    def to_dict(self) -> Dict[str, str]:
        return {
            "role": self.role,
            "content": self.content,
            "timestamp": self.timestamp,
        }


class ChatSession:
    def __init__(self, session_id: str, platform: str, title: Optional[str] = None):
        self.session_id = session_id
        self.platform = platform
        self.title = title or session_id
        self.messages: List[ChatMessage] = []
        self.created_at = datetime.now().isoformat()

    def add_message(self, role: str, content: str) -> None:
        self.messages.append(ChatMessage(role, content))

    def to_dict(self) -> Dict[str, Any]:
        return {
            "session_id": self.session_id,
            "platform": self.platform,
            "title": self.title,
            "messages": [msg.to_dict() for msg in self.messages],
            "created_at": self.created_at,
        }


class ChatExtractor:
    def __init__(self, platform_name: str, api_key: Optional[str] = None):
        self.platform_name = platform_name
        self.api_key = api_key

    def fetch_sessions(self) -> List[ChatSession]:
        raise NotImplementedError

    def extract_messages(self, session: ChatSession) -> ChatSession:
        raise NotImplementedError

    def run(self) -> List[ChatSession]:
        sessions = self.fetch_sessions()
        for session in sessions:
            self.extract_messages(session)
        return sessions
