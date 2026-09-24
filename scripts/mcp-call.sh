#!/usr/bin/env bash
#
# Invoca uma tool do MCP server de status (src/main/mcp-server.ts) numa linha só,
# sem montar o JSON-RPC na mão. Faz o handshake `initialize` + `tools/call` via
# stdio e imprime só o resultado da tool.
#
# Uso:
#   ./scripts/mcp-call.sh <tool> [json-args]
#
# Exemplos:
#   ./scripts/mcp-call.sh list_matches
#   ./scripts/mcp-call.sh list_matches '{"status":"FINISHED"}'
#   ./scripts/mcp-call.sh list_matches '{"competitionId":"wc-2022"}'
#   ./scripts/mcp-call.sh get_match_status '{"matchId":"wc-2022-semifinal"}'
#
# Variáveis de ambiente:
#   DATABASE_URL  Conexão do Postgres (padrão: o banco local do docker-compose).

set -euo pipefail

TOOL="${1:-}"
ARGS="${2:-}"
[[ -z "$ARGS" ]] && ARGS='{}'

if [[ -z "$TOOL" ]]; then
  echo "Uso: $0 <tool> [json-args]" >&2
  echo "Tools: list_matches | get_match_status" >&2
  exit 1
fi

export DATABASE_URL="${DATABASE_URL:-postgresql://fifa:fifa@localhost:5432/fifa?schema=public}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

INIT='{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"mcp-call","version":"0"}}}'
CALL="{\"jsonrpc\":\"2.0\",\"id\":2,\"method\":\"tools/call\",\"params\":{\"name\":\"${TOOL}\",\"arguments\":${ARGS}}}"

# Manda os dois envelopes pelo stdin e filtra a resposta de id=2 (a da tool).
# Extrai o texto do resultado; usa jq quando disponível, senão imprime cru.
RESPONSE="$(printf '%s\n%s\n' "$INIT" "$CALL" \
  | (cd "$SCRIPT_DIR" && npx --yes tsx src/main/mcp-server.ts 2>/dev/null) \
  | { grep '"id":2' || true; })"

if [[ -z "$RESPONSE" ]]; then
  echo "Sem resposta do servidor. O Postgres está no ar? (docker compose ps)" >&2
  exit 1
fi

if command -v jq >/dev/null 2>&1; then
  echo "$RESPONSE" | jq -r '.result.content[0].text // .error.message // .'
else
  echo "$RESPONSE"
fi
