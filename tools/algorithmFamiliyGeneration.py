import json

# Step 1: Load JSON data safely using context managers
with open("../schema/cryptography-defs.json", "r", encoding="utf-8") as defs_file:
    defs_data = json.load(defs_file)

with open("../schema/cryptography-defs.schema.json", "r", encoding="utf-8") as schema_file:
    schema_data = json.load(schema_file)

# Step 2: Extract unique algorithm families and sort them
families = sorted({algo['family'] for algo in defs_data.get('algorithms', [])})

# Step 3: Update the schema with the extracted families
try:
    schema_properties = schema_data['properties']
except KeyError as e:
    raise KeyError(f"Schema path missing: {e}")

schema_data['properties']['algorithmFamilies'] = {
    "type": "string",
    "title": "Algorithm Families",
    "description": "An enum for the The algorithm families.",
    "enum": families,
}

# Step 4: Write the updated schema back to the file
with open("../schema/cryptography-defs.schema.json", "w", encoding="utf-8") as update_file:
    json.dump(schema_data, update_file, indent=2, ensure_ascii=False)

print("Schema updated successfully.")