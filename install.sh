#!/usr/bin/env bash
# install.sh - installe (ou met à jour) le plugin everything-claude-code au scope utilisateur.
#
# Usage :
#   ./install.sh             installation, idempotente (relançable sans risque)
#   ./install.sh --update    mise à jour de la marketplace et du plugin
#   ./install.sh --no-rules  ne pas copier rules/ dans ~/.claude/rules/
#
# Variables d'environnement :
#   CLAUDE_CONFIG_DIR  répertoire de configuration Claude Code (défaut : ~/.claude)
#   ECC_REPO           dépôt GitHub de la marketplace (défaut : Nexus-Conseil/everything-claude-code)
#
# Une installation au scope utilisateur vaut pour tous les projets de la machine
# et pour tous les comptes Claude utilisés dessus (la configuration dépend de la
# session système, pas du compte Claude).
set -euo pipefail

REPO="${ECC_REPO:-Nexus-Conseil/everything-claude-code}"
MARKETPLACE="everything-claude-code"
PLUGIN="everything-claude-code@everything-claude-code"
CLAUDE_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
UPDATE=0
RULES=1

for arg in "$@"; do
  case "$arg" in
    --update) UPDATE=1 ;;
    --no-rules) RULES=0 ;;
    -h|--help) sed -n '2,15p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "[ECC] Option inconnue : $arg" >&2; exit 1 ;;
  esac
done

for cmd in claude node git; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "[ECC] '$cmd' est introuvable dans le PATH. Installez-le puis relancez ce script." >&2
    exit 1
  fi
done

if [ "$UPDATE" = 1 ]; then
  echo "[ECC] Mise à jour de la marketplace $MARKETPLACE..."
  claude plugin marketplace update "$MARKETPLACE"
  echo "[ECC] Mise à jour du plugin $PLUGIN..."
  claude plugin update "$PLUGIN"
else
  echo "[ECC] Enregistrement de la marketplace $REPO (scope utilisateur, sans effet si déjà présente)..."
  claude plugin marketplace add "$REPO" --scope user
  echo "[ECC] Installation du plugin $PLUGIN (scope utilisateur)..."
  claude plugin install "$PLUGIN" --scope user
fi

# Mise à jour automatique : Claude Code vérifie la marketplace au démarrage.
node - "$CLAUDE_DIR/settings.json" "$MARKETPLACE" "$REPO" <<'NODE'
const fs = require('fs');
const path = require('path');
const [file, marketplace, repo] = process.argv.slice(2);

let settings = {};
if (fs.existsSync(file)) {
  try {
    settings = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    console.error(`[ECC] ${file} n'est pas un JSON valide, autoUpdate non modifié : ${err.message}`);
    process.exit(0);
  }
}
if (Array.isArray(settings.extraKnownMarketplaces)) {
  console.error('[ECC] extraKnownMarketplaces est un tableau dans ce fichier : autoUpdate non modifié.');
  process.exit(0);
}
settings.extraKnownMarketplaces = settings.extraKnownMarketplaces || {};
let entry = settings.extraKnownMarketplaces[marketplace];
if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
  entry = { source: { source: 'github', repo } };
}
if (entry.autoUpdate !== true) {
  entry.autoUpdate = true;
  settings.extraKnownMarketplaces[marketplace] = entry;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(settings, null, 2) + '\n');
  console.log(`[ECC] Mise à jour automatique activée pour la marketplace ${marketplace} (${file}).`);
}
NODE

# Règles : un plugin Claude Code ne peut pas distribuer de règles, on les copie
# au niveau utilisateur (chargées dans tous les projets de la machine).
if [ "$RULES" = 1 ]; then
  MARKET_RULES="$CLAUDE_DIR/plugins/marketplaces/$MARKETPLACE/rules"
  # En mode --update, la copie de la marketplace vient d'être rafraîchie : on la préfère au clone local.
  if [ "$UPDATE" = 1 ] && [ -d "$MARKET_RULES" ]; then
    SRC="$MARKET_RULES"
  elif [ -d "$SCRIPT_DIR/rules" ]; then
    SRC="$SCRIPT_DIR/rules"
  else
    SRC="$MARKET_RULES"
  fi
  DEST="$CLAUDE_DIR/rules/everything-claude-code"
  if [ -d "$SRC" ]; then
    rm -rf "$DEST"
    mkdir -p "$DEST"
    cp "$SRC"/*.md "$DEST"/
    echo "[ECC] Règles copiées dans $DEST ($(ls "$DEST" | wc -l | tr -d ' ') fichiers)."
  else
    echo "[ECC] Dossier rules introuvable ($SRC) : règles non copiées." >&2
  fi
fi

echo
echo "[ECC] Terminé. Redémarrez Claude Code, puis vérifiez avec : claude plugin list"
