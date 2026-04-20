import json
import os
from pathlib import Path
from typing import List

from ..core.extractor import ChatSession


class JsonExporter:
    def __init__(self, output_dir: str = "./exports"):
        self.output_dir = output_dir
        self._ensure_output_dir()

    def _ensure_output_dir(self) -> None:
        Path(self.output_dir).mkdir(parents=True, exist_ok=True)

    def export(self, sessions: List[ChatSession], filename: str = None) -> str:
        if filename is None:
            from datetime import datetime
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"chats_{timestamp}.json"

        filepath = os.path.join(self.output_dir, filename)
        data = {
            "exported_at": datetime.now().isoformat(),
            "session_count": len(sessions),
            "sessions": [session.to_dict() for session in sessions],
        }
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return filepath
