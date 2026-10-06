#Requires -Version 5.1
<#
.SYNOPSIS
  Installe (ou met à jour) le plugin everything-claude-code au scope utilisateur.

.DESCRIPTION
  Une installation au scope utilisateur vaut pour tous les projets de la machine
  et pour tous les comptes Claude utilisés dessus.

  Variables d'environnement :
    CLAUDE_CONFIG_DIR  répertoire de configuration Claude Code (défaut : ~\.claude)
    ECC_REPO           dépôt GitHub de la marketplace (défaut : Nexus-Conseil/everything-claude-code)

.PARAMETER Update
  Met à jour la marketplace et le plugin au lieu de les installer.

.PARAMETER NoRules
  Ne copie pas rules\ dans ~\.claude\rules\.

.EXAMPLE
  .\install.ps1
  .\install.ps1 -Update
#>
param(
  [switch]$Update,
  [switch]$NoRules
)

$ErrorActionPreference = 'Stop'

$Repo = if ($env:ECC_REPO) { $env:ECC_REPO } else { 'Nexus-Conseil/everything-claude-code' }
$Marketplace = 'everything-claude-code'
$Plugin = 'everything-claude-code@everything-claude-code'
$ClaudeDir = if ($env:CLAUDE_CONFIG_DIR) { $env:CLAUDE_CONFIG_DIR } else { Join-Path $HOME '.claude' }
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

foreach ($cmd in @('claude', 'node', 'git')) {
  if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
    Write-Error "[ECC] '$cmd' est introuvable dans le PATH. Installez-le puis relancez ce script."
    exit 1
  }
}

function Invoke-Claude {
  param([string[]]$Arguments)
  & claude @Arguments
  if ($LASTEXITCODE -ne 0) {
    Write-Error "[ECC] La commande 'claude $($Arguments -join ' ')' a échoué (code $LASTEXITCODE)."
    exit $LASTEXITCODE
  }
}

if ($Update) {
  Write-Host "[ECC] Mise à jour de la marketplace $Marketplace..."
  Invoke-Claude @('plugin', 'marketplace', 'update', $Marketplace)
  Write-Host "[ECC] Mise à jour du plugin $Plugin..."
  Invoke-Claude @('plugin', 'update', $Plugin)
} else {
  $list = (& claude plugin marketplace list 2>$null) -join "`n"
  if ($list -match "(?m)^\s*>\s*$([regex]::Escape($Marketplace))\s*$") {
    Write-Host "[ECC] Marketplace $Marketplace déjà enregistrée."
  } else {
    Write-Host "[ECC] Enregistrement de la marketplace $Repo (scope utilisateur)..."
    Invoke-Claude @('plugin', 'marketplace', 'add', $Repo, '--scope', 'user')
  }
  Write-Host "[ECC] Installation du plugin $Plugin (scope utilisateur)..."
  Invoke-Claude @('plugin', 'install', $Plugin, '--scope', 'user')
}

# Mise à jour automatique : Claude Code vérifie la marketplace au démarrage.
$settingsFile = Join-Path $ClaudeDir 'settings.json'
$autoUpdateScript = @'
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
const entry = settings.extraKnownMarketplaces[marketplace] || { source: { source: 'github', repo } };
if (entry.autoUpdate !== true) {
  entry.autoUpdate = true;
  settings.extraKnownMarketplaces[marketplace] = entry;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(settings, null, 2) + '\n');
  console.log(`[ECC] Mise à jour automatique activée pour la marketplace ${marketplace} (${file}).`);
}
'@
$autoUpdateScript | & node - $settingsFile $Marketplace $Repo

# Règles : un plugin Claude Code ne peut pas distribuer de règles, on les copie
# au niveau utilisateur (chargées dans tous les projets de la machine).
if (-not $NoRules) {
  $src = Join-Path $ScriptDir 'rules'
  if (-not (Test-Path $src)) {
    $src = Join-Path $ClaudeDir "plugins\marketplaces\$Marketplace\rules"
  }
  $dest = Join-Path $ClaudeDir 'rules\everything-claude-code'
  if (Test-Path $src) {
    if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
    New-Item -ItemType Directory -Path $dest | Out-Null
    Copy-Item (Join-Path $src '*.md') $dest
    $count = (Get-ChildItem $dest -Filter '*.md').Count
    Write-Host "[ECC] Règles copiées dans $dest ($count fichiers)."
  } else {
    Write-Warning "[ECC] Dossier rules introuvable ($src) : règles non copiées."
  }
}

Write-Host ''
Write-Host '[ECC] Terminé. Redémarrez Claude Code, puis vérifiez avec : claude plugin list'
