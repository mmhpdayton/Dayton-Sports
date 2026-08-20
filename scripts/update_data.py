import json
from datetime import datetime, timezone

data = {
    "status": "Dayton Sports updater is working",
    "updatedAt": datetime.now(timezone.utc).isoformat()
}

with open("sports-data.json", "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2)

print("Dayton Sports data refreshed")
