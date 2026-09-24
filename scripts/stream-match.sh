#!/usr/bin/env bash
#
# Conecta ao stream SSE de uma partida e imprime os eventos recebidos, já
# formatados. Bom para acompanhar o fluxo ao vivo enquanto a simulação roda.
#
# Uso:
#   ./scripts/stream-match.sh [MATCH_ID]
#
# Variáveis de ambiente:
#   BASE_URL   URL da API (padrão: http://localhost:3000)
#
# Dica: rode este script num terminal e, em outro, dispare a simulação:
#   ./scripts/simulate-match.sh [MATCH_ID]
# O primeiro evento é o `snapshot` (estado atual); depois vêm os eventos ao vivo.

set -uo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
MATCH_ID="${1:-wc-2022-semifinal}"
URL="${BASE_URL}/matches/${MATCH_ID}/stream"

# Formata o corpo `data:` como JSON compacto quando o jq está disponível.
format_data() {
  if command -v jq >/dev/null 2>&1; then jq -c . 2>/dev/null || cat; else cat; fi
}

echo "Conectando ao stream de '${MATCH_ID}' em ${URL}"
echo "(Ctrl+C para sair)"
echo

# -N: sem buffering; -sS: silencioso mas mostra erros; segue conectado.
curl -sS -N -H 'Accept: text/event-stream' "$URL" | while IFS= read -r line; do
  case "$line" in
    'event: '*) printf '\n▶ %s\n' "${line#event: }" ;;
    'data: '*) printf '  %s\n' "$(printf '%s' "${line#data: }" | format_data)" ;;
    ': '*) printf '· %s\n' "${line#: }" ;; # comentários SSE (ex.: heartbeat)
    '') ;;                                  # linha em branco separa eventos
    *) printf '%s\n' "$line" ;;
  esac
done
