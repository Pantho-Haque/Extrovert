#!/bin/bash
# End-to-end check: launches a dev build with a throwaway profile and a local fixture "service",
# drives it through the features (tests/e2e/driver.cjs), then prints the report.
# Screenshots and report.json land in $EXTROVERT_E2E_OUT (default /tmp/extrovert-e2e).
set -u
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
export EXTROVERT_E2E_OUT="${EXTROVERT_E2E_OUT:-/tmp/extrovert-e2e}"
PROFILE="$(mktemp -d)"
cp "$ROOT/tests/e2e/profile.json" "$PROFILE/workspaces.json"
rm -rf "$EXTROVERT_E2E_OUT"

python3 -m http.server 8765 --directory "$ROOT/tests/e2e/fixture" >/dev/null 2>&1 &
SERVER=$!
BEFORE=$(pgrep -f "MacOS/Electron \.$|electron \.$" | tr '\n' ' ')
(cd "$ROOT" && EXTROVERT_PROFILE_DIR="$PROFILE" EXTROVERT_DEBUG_SCRIPT="$ROOT/tests/e2e/driver.cjs" pnpm dev > "$PROFILE/dev.log" 2>&1) &
DEV=$!

# Find our own Electron process, so the user's running Extrovert is never touched.
MINE=""
for _ in $(seq 1 60); do
  sleep 1
  PAT=$(echo $BEFORE | tr ' ' '|' | sed 's/|$//')
  MINE=$(pgrep -f "MacOS/Electron \.$|electron \.$" | grep -vwE "${PAT:-^$}" | head -1)
  [ -n "$MINE" ] && break
done
for _ in $(seq 1 360); do sleep 1; [ -f "$EXTROVERT_E2E_OUT/report.json" ] && break; done
sleep 3
[ -n "$MINE" ] && kill -0 "$MINE" 2>/dev/null && kill -TERM "$MINE"
kill "$SERVER" 2>/dev/null; pkill -P "$DEV" 2>/dev/null; kill "$DEV" 2>/dev/null

if [ ! -f "$EXTROVERT_E2E_OUT/report.json" ]; then echo "No report. Log: $PROFILE/dev.log"; exit 1; fi
python3 - "$EXTROVERT_E2E_OUT/report.json" <<'PY'
import json, sys
steps = json.load(open(sys.argv[1]))
bad = [s for s in steps if s['name'].endswith('error') or 'failed' in s['name']]
for s in steps: print(('✗ ' if s in bad else '✓ ') + s['name'])
print(f"\n{len(steps) - len(bad)} passed, {len(bad)} failed · screenshots in {sys.argv[1].rsplit('/', 1)[0]}")
sys.exit(1 if bad else 0)
PY
