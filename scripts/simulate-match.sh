#!/usr/bin/env bash
#
# Dispara os endpoints da API simulando uma partida: início → chute + gol →
# intervalo → substituição → chute + gol → encerramento.
#
# Uso:
#   ./scripts/simulate-match.sh [MATCH_ID]
#
# Variáveis de ambiente:
#   BASE_URL   URL da API (padrão: http://localhost:3000)
#   DELAY      Segundos de espera após cada chamada (padrão: 30) — dá tempo de
#              acompanhar os eventos chegando no stream SSE.
#
# Pré-requisito: a partida MATCH_ID já deve existir e estar SCHEDULED, com
# time A = "arg" e time B = "fra" (ids usados abaixo). Não há endpoint de
# criação de partida — ela precisa ser semeada/inserida antes.

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
MATCH_ID="${1:-wc-2022-semifinal}"
DELAY="${DELAY:-30}"

# POST opcional com corpo JSON; imprime status HTTP e resposta e então aguarda
# DELAY segundos antes da próxima chamada (para acompanhar o stream ao vivo).
post() {
  local path="$1" body="${2:-}"
  echo "▶ POST ${path}"
  local status
  if [ -n "$body" ]; then
    status=$(curl -sS -o /tmp/sim-resp -w '%{http_code}' \
      -X POST "${BASE_URL}${path}" -H 'content-type: application/json' -d "$body")
  else
    status=$(curl -sS -o /tmp/sim-resp -w '%{http_code}' -X POST "${BASE_URL}${path}")
  fi
  echo "  → HTTP ${status}"
  if [ -s /tmp/sim-resp ]; then
    echo "  $(cat /tmp/sim-resp)"
  fi
  echo "  … aguardando ${DELAY}s"
  sleep "${DELAY}"
  echo
}

echo "Simulando partida '${MATCH_ID}' em ${BASE_URL}"
echo

post "/matches/${MATCH_ID}/start"

# Pênalti + gol do Messi (Argentina).
post "/matches/${MATCH_ID}/events" \
  '{"type":"PENALTY_KICK","player":{"id":"arg-10","name":"Lionel Messi","teamId":"arg","shirtNumber":10,"position":"FORWARD"}}'
post "/matches/${MATCH_ID}/events" \
  '{"type":"GOAL","goal":{"id":"sim-goal-1","playerId":"arg-10","playerName":"Lionel Messi","teamId":"arg","minute":23}}'

# Intervalo (fim do primeiro tempo).
post "/matches/${MATCH_ID}/events" \
  '{"type":"HALF_TIME"}'

# Substituição na França (sai Giroud, entra Kolo Muani).
post "/matches/${MATCH_ID}/events" \
  '{"type":"SUBSTITUTION","playerOut":{"id":"fra-9","name":"Olivier Giroud","teamId":"fra","shirtNumber":9,"position":"FORWARD"},"playerIn":{"id":"fra-12","name":"Randal Kolo Muani","teamId":"fra","shirtNumber":12,"position":"FORWARD"}}'

# Pênalti + gol do Mbappé (França).
post "/matches/${MATCH_ID}/events" \
  '{"type":"PENALTY_KICK","player":{"id":"fra-10","name":"Kylian Mbappé","teamId":"fra","shirtNumber":10,"position":"FORWARD"}}'
post "/matches/${MATCH_ID}/events" \
  '{"type":"GOAL","goal":{"id":"sim-goal-2","playerId":"fra-10","playerName":"Kylian Mbappé","teamId":"fra","minute":80}}'

post "/matches/${MATCH_ID}/finish"

echo "Simulação concluída."
