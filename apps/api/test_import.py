import sys
sys.path.insert(0, ".")
from main import app
print("App loaded OK")
print(f"Routes: {len(app.routes)}")
