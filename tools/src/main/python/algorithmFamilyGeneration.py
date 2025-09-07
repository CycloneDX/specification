#!/usr/bin/env python3

from json import dump as json_dump, load as json_load
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List

# config
SCHEMA_DIR = Path(__file__).parent.parent.parent.parent.parent / "schema"
DEFS_FILE = SCHEMA_DIR / "cryptography-defs.json"
SCHEMA_FILE = SCHEMA_DIR / "cryptography-defs.schema.json"

# Step 1: Load JSON data safely using context managers
with DEFS_FILE.open("r", encoding="utf-8") as defs_file:
    defs_data: Dict[str, List[Dict[str, Any]]] = json_load(defs_file)

with SCHEMA_FILE.open("r", encoding="utf-8") as schema_file:
    schema_data: Dict[str, Any] = json_load(schema_file)

# Step 2: Extract unique algorithm families and sort them
families: List[str] = sorted({algo['family'] for algo in defs_data.get('algorithms', [])})

# Step 3: Update the schema with the extracted families
try:
    schema_properties = schema_data['properties']
except KeyError as e:
    raise KeyError(f"Required schema property 'properties' missing: {e}")

schema_data['$comment'] = datetime.now(timezone.utc).replace(microsecond=0) \
    .isoformat().replace('+00:00', 'Z')

schema_data['definitions']['algorithmFamiliesEnum'] = {
    "type": "string",
    "title": "Algorithm Families",
    "description": "An enum for the algorithm families.",
    "enum": families,
}

# Step 4: Write the updated schema back to the file
with SCHEMA_FILE.open("w", encoding="utf-8") as update_file:
    json_dump(schema_data, update_file, indent=2, ensure_ascii=False)

print("Schema updated successfully.")
