#!/bin/bash
# LightBot Release Script
# Usage: ./scripts/release.sh [version]
# Example: ./scripts/release.sh 0.2.0

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

# Parse version argument
VERSION="${1:-}"
if [ -z "$VERSION" ]; then
    echo -e "${RED}Error: Version number required${NC}"
    echo "Usage: ./scripts/release.sh [version]"
    echo "Example: ./scripts/release.sh 0.2.0"
    exit 1
fi

# Validate version format (semver-like)
if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo -e "${RED}Error: Version must be in format X.Y.Z (e.g., 0.2.0)${NC}"
    exit 1
fi

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  LightBot Release Build${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Get build metadata
GIT_HASH=$(git rev-parse --short HEAD)
DATE=$(date +%Y%m%d)
BUILD_ID="${VERSION}+${DATE}.${GIT_HASH}"

echo -e "${GREEN}Version:${NC} $VERSION"
echo -e "${GREEN}Build ID:${NC} $BUILD_ID"
echo -e "${GREEN}Git Hash:${NC} $GIT_HASH"
echo ""

# Check for uncommitted changes
if ! git diff-index --quiet HEAD --; then
    echo -e "${YELLOW}Warning: You have uncommitted changes${NC}"
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Step 1: Bump versions in config files
echo -e "${BLUE}[1/6] Bumping version to $VERSION...${NC}"

# Update package.json
jq --arg v "$VERSION" '.version = $v' package.json > package.json.tmp && mv package.json.tmp package.json
echo "  ✓ package.json"

# Update package-lock.json (via npm install)
npm install --package-lock-only 2>/dev/null || npm install
echo "  ✓ package-lock.json"

# Update tauri.conf.json
jq --arg v "$VERSION" '.version = $v' src-tauri/tauri.conf.json > src-tauri/tauri.conf.json.tmp && mv src-tauri/tauri.conf.json.tmp src-tauri/tauri.conf.json
echo "  ✓ src-tauri/tauri.conf.json"

# Update Cargo.toml
sed -i '' "s/^version = \"[0-9]*\.[0-9]*\.[0-9]*\"/version = \"$VERSION\"/" src-tauri/Cargo.toml
echo "  ✓ src-tauri/Cargo.toml"

# Update pyproject.toml
sed -i '' "s/^version = \"[0-9]*\.[0-9]*\.[0-9]*\"/version = \"$VERSION\"/" pyproject.toml
echo "  ✓ pyproject.toml"

# Update python/server.py - HealthResponse version
sed -i '' "s/version: str = \"[0-9]*\.[0-9]*\.[0-9]*\"/version: str = \"$VERSION\"/" python/server.py
echo "  ✓ python/server.py (HealthResponse)"

# Update python/server.py - FastAPI version
sed -i '' "s/^    version=\"[0-9]*\.[0-9]*\.[0-9]*\"/    version=\"$VERSION\"/" python/server.py
echo "  ✓ python/server.py (FastAPI)"

echo ""

# Step 2: Build Python sidecar
echo -e "${BLUE}[2/6] Building Python sidecar...${NC}"
./scripts/build-sidecar.sh
echo ""

# Step 3: Set build ID for Vite
echo -e "${BLUE}[3/6] Setting build metadata...${NC}"
export VITE_BUILD_ID="$BUILD_ID"
if [ -z "$VITE_BUILD_ID" ]; then
    echo -e "${RED}Error: VITE_BUILD_ID could not be set${NC}"
    exit 1
fi
echo "  ✓ VITE_BUILD_ID=$BUILD_ID"
echo ""

# Step 4: Build Tauri app
echo -e "${BLUE}[4/6] Building Tauri application...${NC}"
echo "  This may take a few minutes..."
echo ""

npm run tauri build

echo ""
echo -e "${GREEN}✓ Build complete!${NC}"
echo ""

# Step 5: Update Cargo.lock
echo -e "${BLUE}[5/6] Updating Cargo.lock...${NC}"
(cd src-tauri && cargo update --workspace)
echo "  ✓ Cargo.lock updated"
echo ""

# Step 6: Package and sign (placeholder)
echo -e "${BLUE}[6/6] Packaging...${NC}"

# Find the built app
APP_BUNDLE="src-tauri/target/release/bundle/macos/LightBot.app"
DMG_PATH="src-tauri/target/release/bundle/dmg/LightBot_${VERSION}.dmg"

if [ -f "$DMG_PATH" ]; then
    echo "  ✓ DMG created: $DMG_PATH"
else
    echo "  ⚠ DMG not found at expected path"
fi

echo ""
echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}  Code Signing & Notarization${NC}"
echo -e "${YELLOW}========================================${NC}"
echo ""
echo "To sign and notarize the app for distribution:"
echo ""
echo "1. Code sign the app:"
echo "   codesign --force --options runtime --sign \"Developer ID Application: Your Name\" \"$APP_BUNDLE\""
echo ""
echo "2. Create signed DMG (using create-dmg or dropdmg)"
echo ""
echo "3. Notarize the DMG:"
echo "   xcrun notarytool submit \"$DMG_PATH\" --keychain-profile \"AC_PASSWORD\" --wait"
echo ""
echo "4. Staple the notarization ticket:"
echo "   xcrun stapler staple \"$DMG_PATH\""
echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}  Release Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "Version:     ${GREEN}$VERSION${NC}"
echo -e "Build ID:    ${GREEN}$BUILD_ID${NC}"
echo -e "Git Hash:    ${GREEN}$GIT_HASH${NC}"
echo ""
echo -e "Output:      ${GREEN}$DMG_PATH${NC}"
echo ""
echo -e "${YELLOW}Note: This is an unsigned build suitable for local installation only.${NC}"
echo -e "${YELLOW}For distribution, complete the code signing steps above.${NC}"
echo ""
