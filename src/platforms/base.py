from abc import ABC, abstractmethod
from typing import List, Optional

from ..core.extractor import ChatSession


class BasePlatform(ABC):
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key

    @property
    @abstractmethod
    def platform_name(self) -> str:
        pass

    @abstractmethod
    def fetch_sessions(self) -> List[ChatSession]:
        pass

    @abstractmethod
    def fetch_messages(self, session_id: str) -> List[dict]:
        pass

    def run(self) -> List[ChatSession]:
        sessions = self.fetch_sessions()
        for session in sessions:
            messages = self.fetch_messages(session.session_id)
            for msg in messages:
                session.add_message(msg.get("role", "user"), msg.get("content", ""))
        return sessions
