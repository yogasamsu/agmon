#!/bin/sh
# Mode laptop: jalankan oracle setiap 30 menit selama jendela Terminal ini terbuka.
# Pakai: npm run loop        Berhenti: Ctrl+C
# caffeinate mencegah Mac tertidur selama loop berjalan. Log lengkap ada di oracle.log.
# Untuk server 24 jam, pakai cron di VPS (lihat README).

INTERVAL="${ORACLE_INTERVAL_SECONDS:-1800}"

# caffeinate -w berhenti sendiri begitu proses loop ini selesai.
if command -v caffeinate >/dev/null 2>&1; then
  caffeinate -i -w $$ &
fi

while true; do
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] putaran oracle dimulai" | tee -a oracle.log
  out=$(npm run -s oracle 2>&1)
  status=$?
  printf '%s\n' "$out" >> oracle.log
  printf '%s\n' "$out" | tail -n 12
  [ "$status" -ne 0 ] && echo "Putaran gagal, dicoba lagi di putaran berikutnya. Detail di oracle.log."
  echo "Putaran berikutnya dalam $((INTERVAL / 60)) menit. Tekan Ctrl+C untuk berhenti."
  sleep "$INTERVAL"
done
