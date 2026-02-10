#!/usr/bin/env python3
"""
Migration script: Convert .env (JSON format) to config.toml (TOML format)

Usage:
    python scripts/migrate-config.py

This script will:
1. Read existing .env file
2. Parse JSON model configurations
3. Convert to TOML format
4. Write config.toml
5. Backup .env to .env.backup
"""

import json
import sys
from pathlib import Path

# Add project root to path for imports
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from dotenv import load_dotenv
import os


def load_env_config(env_path: Path) -> dict:
    """Load configuration from .env file."""
    if not env_path.exists():
        print(f"Error: .env file not found at {env_path}")
        sys.exit(1)

    # Load .env
    load_dotenv(env_path, override=True)

    # Parse JSON model arrays
    def parse_json_array(env_var: str) -> list:
        json_str = os.getenv(env_var, "")
        if not json_str:
            return []
        try:
            data = json.loads(json_str)
            if isinstance(data, list):
                return [m for m in data if m.get("name", "").strip()]
        except json.JSONDecodeError:
            print(f"Warning: Failed to parse {env_var} as JSON")
        return []

    def parse_int(env_var: str, default: int = 0) -> int:
        try:
            return int(os.getenv(env_var, str(default)))
        except ValueError:
            return default

    config = {
        "models": {
            "selected_index": parse_int("LLM_MODEL_INDEX", 0),
            "list": parse_json_array("LLM_MODELS"),
        },
        "fast_models": {
            "selected_index": parse_int("LLM_FAST_MODEL_INDEX", 0),
            "list": parse_json_array("LLM_FAST_MODELS"),
        },
        "settings": {
            "system_prompt": os.getenv(
                "LLM_SYSTEM_PROMPT",
                "You are a helpful AI assistant with web search capabilities. "
                "You provide concise, accurate answers. "
                "When you need current information, you can search the web.",
            ),
            "search_provider": os.getenv("SEARCH_PROVIDER", "ddgs"),
            "search_url": os.getenv("SEARCH_URL", ""),
            "hotkey": os.getenv("GLOBAL_HOTKEY", "Command+Shift+O"),
        },
    }

    return config


def save_toml_config(config: dict, toml_path: Path):
    """Save configuration to TOML file."""
    try:
        import tomli_w
    except ImportError:
        print("Error: tomli-w not installed. Run: pip install tomli-w")
        sys.exit(1)

    # Ensure directory exists
    toml_path.parent.mkdir(parents=True, exist_ok=True)

    # Write TOML
    with open(toml_path, "wb") as f:
        tomli_w.dump(config, f)

    print(f"✓ Created TOML config: {toml_path}")


def backup_env_file(env_path: Path):
    """Backup .env file."""
    backup_path = env_path.with_suffix(".backup")

    # If backup already exists, add number suffix
    counter = 1
    original_backup = backup_path
    while backup_path.exists():
        backup_path = original_backup.with_suffix(f".backup.{counter}")
        counter += 1

    # Rename .env to backup
    env_path.rename(backup_path)
    print(f"✓ Backed up .env to: {backup_path}")


def main():
    """Main migration function."""
    print("=" * 60)
    print("LightBot Configuration Migration: .env → config.toml")
    print("=" * 60)

    # Determine paths
    project_root = Path(__file__).parent.parent
    dev_env = project_root / ".env"
    user_env = Path.home() / ".lightbot" / ".env"

    # Find .env file
    if dev_env.exists():
        env_path = dev_env
        toml_path = project_root / "config.toml"
        mode = "development"
    elif user_env.exists():
        env_path = user_env
        toml_path = Path.home() / ".lightbot" / "config.toml"
        mode = "production"
    else:
        print("Error: No .env file found!")
        print("Searched locations:")
        print(f"  - {dev_env}")
        print(f"  - {user_env}")
        sys.exit(1)

    print(f"\nDetected {mode} mode")
    print(f"Source: {env_path}")
    print(f"Target: {toml_path}")

    # Check if config.toml already exists
    if toml_path.exists():
        response = input(f"\n⚠️  {toml_path} already exists. Overwrite? (y/N): ")
        if response.lower() != "y":
            print("Migration cancelled.")
            sys.exit(0)

    # Load .env config
    print("\nLoading .env configuration...")
    config = load_env_config(env_path)

    # Show summary
    print("\nConfiguration summary:")
    print(f"  Models: {len(config['models']['list'])}")
    print(f"  Fast Models: {len(config['fast_models']['list'])}")
    print(f"  Search Provider: {config['settings']['search_provider']}")

    # Confirm
    response = input("\nProceed with migration? (y/N): ")
    if response.lower() != "y":
        print("Migration cancelled.")
        sys.exit(0)

    # Save TOML
    print("\nMigrating...")
    save_toml_config(config, toml_path)

    # Backup .env
    backup_env_file(env_path)

    print("\n" + "=" * 60)
    print("✓ Migration completed successfully!")
    print("=" * 60)
    print("\nNext steps:")
    print("  1. Review config.toml to ensure everything looks correct")
    print("  2. Restart LightBot to use the new TOML configuration")
    print("  3. Your old .env has been backed up (see above)")
    print("\nNote: Future settings changes will be saved to config.toml")


if __name__ == "__main__":
    main()
