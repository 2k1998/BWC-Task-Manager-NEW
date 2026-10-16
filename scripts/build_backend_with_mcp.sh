#!/usr/bin/env bash
# Render Root Directory: backend. Resolve API and MCP dependencies together.
set -euo pipefail
repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root/backend"
python -m pip install -r requirements.txt '../mcp_server[postgres]'
