#!/usr/bin/env bash
# Push one stage's R kernel to Kaggle, wait for it to finish, and fetch ONLY
# its log and small text summaries (never the data files).
# Usage: tools/run_stage.sh kernels/01-inspect
# Needs KAGGLE_USERNAME plus KAGGLE_API_TOKEN (new tokens) or KAGGLE_KEY (legacy
# kaggle.json key) in the environment. Normally run by .github/workflows/kaggle-stage.yml.
set -euo pipefail
dir="$1"
: "${KAGGLE_USERNAME:?set KAGGLE_USERNAME}"
root="$(cd "$(dirname "$0")/.." && pwd)"
stage="$(basename "$dir")"
work="$(mktemp -d)"
# Fill in the username placeholder in a temp copy, so the repo keeps the template
cp "$dir"/* "$work"/
sed -i "s/__USER__/${KAGGLE_USERNAME}/g" "$work/kernel-metadata.json"
slug="$(python3 -c "import json;print(json.load(open('$work/kernel-metadata.json'))['id'])")"
df_before=$(df --output=avail -k / | tail -1)

kaggle kernels push -p "$work"
echo "pushed $slug, polling..."
deadline=$(( $(date +%s) + ${MAX_WAIT_MIN:-600} * 60 ))
while true; do
  sleep 30
  if [ "$(date +%s)" -gt "$deadline" ]; then echo "still running on Kaggle; fetch the log later"; break; fi
  st="$(kaggle kernels status "$slug" 2>&1 || true)"
  echo "$(date -u +%H:%M:%S) $st"
  case "$st" in *COMPLETE*|*ERROR*|*CANCEL*) break;; esac
done
mkdir -p "$root/logs/$stage"
kaggle kernels output "$slug" -p "$root/logs/$stage" -o -q --file-pattern '(\.log$|^summary_.*\.(txt|csv)$)' || true
# Kaggle logs are JSON lines; turn them into plain text for reading
for f in "$root/logs/$stage"/*.log; do
  [ -f "$f" ] || continue
  python3 - "$f" "${f%.log}.txt" <<'PY'
import json,sys
src,dst=sys.argv[1],sys.argv[2]
raw=open(src,encoding="utf-8").read()
try:
    out="".join(e.get("data","") for e in json.loads(raw))
except Exception:
    out=raw
open(dst,"w",encoding="utf-8").write(out)
PY
  rm -f "$f"
done
rm -rf "$work"
df_after=$(df --output=avail -k / | tail -1)
echo "local disk change: $(( (df_before - df_after) / 1024 )) MB"
echo "$st"
