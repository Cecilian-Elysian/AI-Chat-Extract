import os
from pathlib import Path
from typing import List, Dict, Any, Optional

import yaml


class Config:
    def __init__(self, config_path: Optional[str] = None):
        self._data: Dict[str, Any] = {}
        self.config_path = config_path or self._get_default_config_path()
        self.load()

    def _get_default_config_path(self) -> str:
        return os.path.join(Path(__file__).parent.parent.parent, "config.yaml")

    def load(self) -> None:
        if os.path.exists(self.config_path):
            with open(self.config_path, "r", encoding="utf-8") as f:
                self._data = yaml.safe_load(f) or {}
        else:
            example_path = os.path.join(Path(__file__).parent.parent.parent, "config.example.yaml")
            if os.path.exists(example_path):
                with open(example_path, "r", encoding="utf-8") as f:
                    self._data = yaml.safe_load(f) or {}

    def get(self, key: str, default: Any = None) -> Any:
        keys = key.split(".")
        value = self._data
        for k in keys:
            if isinstance(value, dict):
                value = value.get(k)
            else:
                return default
            if value is None:
                return default
        return value

    @property
    def platforms(self) -> List[Dict[str, Any]]:
        return self.get("platforms", [])

    @property
    def scheduler_enabled(self) -> bool:
        return self.get("scheduler.enabled", True)

    @property
    def interval_minutes(self) -> int:
        return self.get("scheduler.interval_minutes", 60)

    @property
    def export_format(self) -> str:
        return self.get("export.format", "json")

    @property
    def output_dir(self) -> str:
        return self.get("export.output_dir", "./exports")
