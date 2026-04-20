import argparse
import sys
from typing import List

from src.core.config import Config
from src.core.extractor import ChatSession
from src.platforms import OpenAIPlatform
from src.export import JsonExporter, CsvExporter
from src.scheduler import Scheduler


class ChatExtractApp:
    def __init__(self, config_path: str = None):
        self.config = Config(config_path)
        self.scheduler = Scheduler(self.config.interval_minutes)

    def run_extract(self) -> List[ChatSession]:
        sessions = []
        for platform_config in self.config.platforms:
            if not platform_config.get("enabled", False):
                continue
            platform_name = platform_config.get("name", "")
            api_key = platform_config.get("api_key", "")
            platform = self._create_platform(platform_name, api_key)
            if platform:
                sessions.extend(platform.run())
        return sessions

    def _create_platform(self, name: str, api_key: str):
        if name == "openai":
            return OpenAIPlatform(api_key)
        return None

    def export_sessions(self, sessions: List[ChatSession]) -> None:
        fmt = self.config.export_format.lower()
        exporter = JsonExporter(self.config.output_dir) if fmt == "json" else CsvExporter(self.config.output_dir)
        filepath = exporter.export(sessions)
        print(f"Exported to: {filepath}")

    def run_once(self) -> None:
        sessions = self.run_extract()
        if sessions:
            self.export_sessions(sessions)
        else:
            print("No sessions to export.")

    def run_scheduled(self) -> None:
        self.scheduler.add_job(self.run_once)
        self.scheduler.start()
        print(f"Scheduler started. Running every {self.config.interval_minutes} minutes. Press Ctrl+C to stop.")
        try:
            import time
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            self.scheduler.stop()
            print("Scheduler stopped.")


def main():
    parser = argparse.ArgumentParser(description="AI Chat Extract - Scheduled chat export tool")
    parser.add_argument("-c", "--config", help="Path to config file")
    parser.add_argument("--once", action="store_true", help="Run once and exit")
    args = parser.parse_args()

    app = ChatExtractApp(args.config)
    if args.once or not app.config.scheduler_enabled:
        app.run_once()
    else:
        app.run_scheduled()


if __name__ == "__main__":
    main()
