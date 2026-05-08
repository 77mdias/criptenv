from __future__ import annotations

from pathlib import Path
import sys

import uvicorn

API_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(API_ROOT))

from scripts.e2e_env import load_e2e_env

env_path = load_e2e_env()
print(f"Starting E2E API with {env_path.relative_to(API_ROOT)}")

uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=False, log_level="warning")
