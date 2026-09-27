#!/bin/bash

# Define the output file name
ZIP_FILE="thin_client.zip"

# Check if thin_client directory exists
if [ -d "thin_client" ]; then
    echo "Zipping thin_client project..."
    
    # Remove existing zip if it exists
    rm -f "$ZIP_FILE"
    
    # Zip the thin_client directory
    zip -r "$ZIP_FILE" thin_client
    
    echo "Done! Created $ZIP_FILE"
else
    echo "Error: thin_client directory not found."
    exit 1
fi
