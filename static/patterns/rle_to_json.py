import os
import json
import re
from pathlib import Path

def parse_rle(file_path):
    """Parses an RLE file into a dictionary."""
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    metadata = []
    header = ""
    content_lines = []
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
        
        # Capture metadata lines (starting with #)
        if line.startswith('#'):
            metadata.append(line)
        # Capture the header line (x = ..., y = ..., rule = ...)
        elif line.startswith('x ='):
            header = line
        # Everything else is the pattern data
        else:
            content_lines.append(line)

    return {
        "fileName": file_path.name,
        "metadata": metadata,
        "header": header,
        "pattern": "".join(content_lines)
    }

def main():
    # Define the sibling directory name (change this to your folder's name)
    sibling_dir_name = "patterns" 
    
    # Path logic: Go up one level, then into the sibling directory
    base_path = Path(__file__).parent.parent / sibling_dir_name
    output_file = Path(__file__).parent / "patterns.json"

    if not base_path.exists():
        print(f"Error: Directory '{base_path}' not found.")
        return

    all_patterns = []

    # Scan for all .rle files
    for rle_file in base_path.glob("*.rle"):
        print(f"Processing: {rle_file.name}")
        try:
            parsed_data = parse_rle(rle_file)
            all_patterns.append(parsed_data)
        except Exception as e:
            print(f"Failed to parse {rle_file.name}: {e}")

    # Write to JSON
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(all_patterns, f, indent=4)

    print(f"\nSuccess! Created {output_file} with {len(all_patterns)} patterns.")

if __name__ == "__main__":
    main()