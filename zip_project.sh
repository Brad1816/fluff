#!/bin/bash

# Define the output filename
OUTPUT_FILE="fluffy_industries.zip"
if [ ! -z "$1" ]; then
    OUTPUT_FILE="fluffy_industries_$1.zip"
fi

# Remove existing zip if it exists
rm -f "$OUTPUT_FILE"

# Run tests
echo "Running interaction tests..."
if [ -d "tests" ]; then
    (cd tests && npm test)
    if [ $? -ne 0 ]; then
        echo "❌ Tests failed! Aborting zip process."
        exit 1
    fi
    echo "✅ Tests passed."
else
    echo "⚠️ Warning: tests directory not found, skipping tests."
fi

# Wipe metadata from images in assets/
if command -v exiftool &> /dev/null; then
    echo "Wiping metadata from assets/..."
    exiftool -all= -overwrite_original assets/
else
    echo "exiftool not found, skipping metadata wipe."
fi

# Zip the project files
# -r: recursive
# -x: exclude patterns
zip -r "$OUTPUT_FILE" . \
    -x ".git/*" \
    -x ".gitignore" \
    -x "*.md" \
    -x "zip_project.sh" \
    -x ".DS_Store" \
    -x "__MACOSX*" \
    -x "tests/*" \
    -x "node_modules/*" \
    -x "*.zip"

echo "Project zipped into $OUTPUT_FILE"
