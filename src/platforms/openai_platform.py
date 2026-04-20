from typing import List, Optional
from datetime import datetime

from .base import BasePlatform
from ..core.extractor import ChatSession


class OpenAIPlatform(BasePlatform):
    @property
    def platform_name(self) -> str:
        return "openai"

    def fetch_sessions(self) -> List[ChatSession]:
        if not self.api_key:
            return []
        sessions = []
        return sessions

    def fetch_messages(self, session_id: str) -> List[dict]:
        return []
