#!/bin/bash
# Bump version across all project files
# Usage: ./scripts/bump-version.sh [version]
# Example: ./scripts/bump-version.sh 0.2.0

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
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
    echo "Usage: ./scripts/bump-version.sh [version]"
    echo "Example: ./scripts/bump-version.sh 0.2.0"
    exit 1
fi

# Validate version format (semver-like)
if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo -e "${RED}Error: Version must be in format X.Y.Z (e.g., 0.2.0)${NC}"
    exit 1
fi

echo -e "${BLUE}Bumping version to $VERSION...${NC}"

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
echo -e "${GREEN}✓ Version bumped to $VERSION${NC}"
