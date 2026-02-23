# -*- mode: python ; coding: utf-8 -*-
import sys
from pathlib import Path

# Determine target name based on platform
import platform
system = platform.system()
arch = platform.machine()

if system == "Darwin":
    if arch == "x86_64":
        target_name = "python-sidecar-x86_64-apple-darwin"
    else:
        target_name = "python-sidecar-aarch64-apple-darwin"
elif system == "Linux":
    target_name = "python-sidecar-x86_64-unknown-linux-gnu"
else:
    target_name = "python-sidecar"

block_cipher = None

a = Analysis(
    ['python/server.py'],
    pathex=['python'],
    binaries=[],
    datas=[('python/*.py', '.'), ('python/tools', 'tools')],
    hiddenimports=[
        'engine',
        'tools.search',
        'tools.query_rewrite',
        'prompts',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name=target_name,
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
