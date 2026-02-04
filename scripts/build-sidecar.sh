#!/bin/bash
# Build Python sidecar binary using PyInstaller

set -e

echo "Building Python sidecar..."

# Create bin directory
mkdir -p src-tauri/bin

# Detect platform
PLATFORM=$(uname -s)
ARCH=$(uname -m)

if [ "$PLATFORM" == "Darwin" ]; then
    TARGET="python-sidecar-aarch64-apple-darwin"
    if [ "$ARCH" == "x86_64" ]; then
        TARGET="python-sidecar-x86_64-apple-darwin"
    fi
elif [ "$PLATFORM" == "Linux" ]; then
    TARGET="python-sidecar-x86_64-unknown-linux-gnu"
else
    echo "Unsupported platform: $PLATFORM"
    exit 1
fi

echo "Target: $TARGET"

# Install pyinstaller if not present
pip install pyinstaller

# Build with PyInstaller
pyinstaller \
    --onefile \
    --name "$TARGET" \
    --paths python \
    --distpath src-tauri/bin \
    --clean \
    python/server.py

echo "Sidecar built successfully: src-tauri/bin/$TARGET"
