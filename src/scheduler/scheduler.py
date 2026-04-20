from typing import Callable, Optional
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger


class Scheduler:
    def __init__(self, interval_minutes: int = 60):
        self.interval_minutes = interval_minutes
        self._scheduler = BackgroundScheduler()
        self._job_id = "chat_extract_job"

    def add_job(self, func: Callable, job_id: str = None) -> None:
        self._scheduler.add_job(
            func,
            trigger=IntervalTrigger(minutes=self.interval_minutes),
            id=job_id or self._job_id,
            replace_existing=True,
        )

    def start(self) -> None:
        if not self._scheduler.running:
            self._scheduler.start()

    def stop(self) -> None:
        if self._scheduler.running:
            self._scheduler.shutdown()

    def run_now(self, func: Callable) -> None:
        func()
