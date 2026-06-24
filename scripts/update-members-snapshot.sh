#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

mkdir -p data

for house in Commons Lords; do
  lower="$(printf "%s" "$house" | tr '[:upper:]' '[:lower:]')"
  total="$(curl -s "https://members-api.parliament.uk/api/Members/Search?House=${house}&IsCurrentMember=true&skip=0&take=20" | jq -r '.totalResults')"
  out="data/${lower}-members.tmp.ndjson"
  : > "$out"

  for ((skip=0; skip<total; skip+=20)); do
    curl -s "https://members-api.parliament.uk/api/Members/Search?House=${house}&IsCurrentMember=true&skip=${skip}&take=20" |
      jq -c --arg house "$house" '
        def stripHonorifics:
          gsub("^(Rt Hon |Rt\\. Hon\\. |Mr |Mrs |Ms |Miss |Dr |Sir |Dame )+"; "") | gsub("^\\s+|\\s+$"; "");
        def cleanLordsName:
          gsub("^The\\s+Right\\s+Honourable\\s+"; "")
          | gsub("^The\\s+Rt\\.?\\s*Hon\\.?\\s+"; "")
          | gsub("^Rt\\.?\\s*Hon\\.?\\s+"; "")
          | gsub("^The\\s+"; "")
          | gsub(",\\s*(?:[A-Z]{2,}(?:\\s*,\\s*[A-Z]{2,})*)$"; "")
          | gsub("\\s+(?:[A-Z]{2,}(?:\\s+[A-Z]{2,})*)$"; "")
          | gsub("^\\s+|\\s+$"; "");
        .items[]?.value
        | {
            id,
            name: (if $house == "Commons" then (.nameDisplayAs | stripHonorifics) else (.nameDisplayAs | cleanLordsName) end),
            house: $house,
            party: (.latestParty.name // "Unknown"),
            partyColour: (if (.latestParty.backgroundColour // "") != "" then ("#" + .latestParty.backgroundColour) else "#000000" end),
            membershipFrom: (.latestHouseMembership.membershipFrom // null),
            gender: (.gender // null),
            thumbnailUrl: (.thumbnailUrl // null)
          }
      ' >> "$out"
  done

  jq -s '.' "$out" > "data/${lower}-members.json"
  rm -f "$out"
done

jq -n \
  --slurpfile commons data/commons-members.json \
  --slurpfile lords data/lords-members.json \
  '{
    generatedAt: (now | strftime("%Y-%m-%dT%H:%M:%SZ")),
    members: ($commons[0] + $lords[0])
  }' > data/members-snapshot.json

rm -f data/commons-members.json data/lords-members.json

echo "Snapshot updated: data/members-snapshot.json"
echo "Members: $(jq '.members | length' data/members-snapshot.json)"
