#!/bin/bash
# Build Python sidecar binary using PyInstaller

set -e

echo "Building Python sidecar..."

# Create bin directory
mkdir -p src-tauri/bin

# Install pyinstaller if not present
pip install pyinstaller

# Build using spec file
pyinstaller lightbot.spec --clean --distpath src-tauri/bin

echo "Sidecar built successfully"
ls -lh src-tauri/bin/
