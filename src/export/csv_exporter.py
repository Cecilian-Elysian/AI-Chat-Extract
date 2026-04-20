import csv
import os
from pathlib import Path
from typing import List
from datetime import datetime

from ..core.extractor import ChatSession


class CsvExporter:
    def __init__(self, output_dir: str = "./exports"):
        self.output_dir = output_dir
        self._ensure_output_dir()

    def _ensure_output_dir(self) -> None:
        Path(self.output_dir).mkdir(parents=True, exist_ok=True)

    def export(self, sessions: List[ChatSession], filename: str = None) -> str:
        if filename is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"chats_{timestamp}.csv"

        filepath = os.path.join(self.output_dir, filename)
        with open(filepath, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(["session_id", "platform", "title", "role", "content", "timestamp"])
            for session in sessions:
                for msg in session.messages:
                    writer.writerow([
                        session.session_id,
                        session.platform,
                        session.title,
                        msg.role,
                        msg.content,
                        msg.timestamp,
                    ])
        return filepath
