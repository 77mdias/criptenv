import os
import sys
from pathlib import Path


API_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(API_ROOT))

os.environ.setdefault("DATABASE_URL", "postgresql://user:pass@localhost:5432/test")
os.environ.setdefault("SECRET_KEY", "test-secret")
os.environ.setdefault("INTEGRATION_CONFIG_SECRET", "test-integration-config-secret-32-chars")
os.environ["DEBUG"] = "true"
