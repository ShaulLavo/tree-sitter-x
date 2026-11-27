# Configuration loader and validator
from __future__ import annotations
from dataclasses import dataclass
from typing import Optional

MAX_RETRIES: int = 5
DEFAULT_HOST = "localhost"

@dataclass(frozen=True)
class ServiceConfig:
    host: str
    port: int = 8080
    debug: bool = False

    def endpoint(self, path: str) -> str:
        """Build the full service URL."""
        scheme = "http" if self.debug else "https"
        return f"{scheme}://{self.host}:{self.port}/{path}\n"

async def fetch_all(items: list[str], limit: Optional[int] = None) -> dict[str, int]:
    counts: dict[str, int] = {}
    for index, name in enumerate(items):
        if limit is not None and index >= limit:
            break
        try:
            counts[name] = len(name) + 1
        except ValueError as err:
            print(f"error: {err}")
            raise
    return counts
