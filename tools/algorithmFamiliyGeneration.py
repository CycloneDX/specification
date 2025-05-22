import json

# Step 1: Load JSON data safely using context managers
with open("cryptography-defs.json", "r", encoding="utf-8") as defs_file:
    defs_data = json.load(defs_file)

with open("bom-1.7.schema.json", "r", encoding="utf-8") as schema_file:
    schema_data = json.load(schema_file)

# Step 2: Extract unique algorithm families and sort them
families = sorted({algo['family'] for algo in defs_data.get('algorithms', [])})

# Step 3: Update the schema with the extracted families
try:
    algorithm_properties = (
        schema_data['definitions']['cryptoProperties']['properties']['algorithmProperties']['properties']
    )
except KeyError as e:
    raise KeyError(f"Schema path missing: {e}")

algorithm_properties['algorithmFamily'] = {
    "type": "object",
    "title": "Algorithm Family",
    "description": "The algorithm family for the given algorithm.",
    "enum": families,
}

# Step 4: Write the updated schema back to the file
with open("bom-1.7.schema.json", "w", encoding="utf-8") as update_file:
    json.dump(schema_data, update_file, indent=2, ensure_ascii=False)

print("Schema updated successfully.")