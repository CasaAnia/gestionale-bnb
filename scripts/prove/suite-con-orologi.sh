#!/bin/bash
# La suite deve dare lo stesso esito in qualunque giorno e a qualunque ora, in TZ Europe/Rome e UTC.
# Uso: scripts/prove/suite-con-orologi.sh   (esce con 1 se anche una sola combinazione ha un test rosso)
cd "$(dirname "$0")/../.." || exit 1
ISTANTI=(
  "2026-09-17T10:00:00+02:00"   # il giorno in cui sono nate molte prove
  "2026-10-25T00:30:00Z"        # cambio dell'ora legale d'autunno, 02:30 la prima volta
  "2026-10-25T01:30:00Z"        # 02:30 la seconda volta
  "2026-12-31T22:59:30Z"        # mezzanotte di capodanno a Roma
  "2027-01-01T00:00:30Z"        # appena dopo la mezzanotte UTC
  "2027-02-28T23:30:00Z"        # fine mese
  "2027-03-28T01:30:00Z"        # cambio dell'ora legale di primavera
  "2027-06-15T12:00:00Z"        # un anno dopo
  "2028-02-29T12:00:00Z"        # anno bisestile
)
fallite=0
for tz in Europe/Rome UTC; do
  for t in "${ISTANTI[@]}"; do
    esito=$(TZ=$tz OROLOGIO_FINTO="$t" NODE_OPTIONS="--import $PWD/scripts/prove/orologio-finto.mjs" node --test --test-concurrency=4 'lib/**/*.test.ts' 2>&1)
    n=$(echo "$esito" | grep -E "^ℹ fail" | awk '{print $3}')
    echo "TZ=$tz  $t  → falliti: ${n:-?}"
    if [ "${n:-1}" != "0" ]; then fallite=1; echo "$esito" | grep -E "^✖" | grep -v "failing tests" | sort -u | head -8; fi
  done
done
exit $fallite
