# Everything Claude Code

[![Stars](https://img.shields.io/github/stars/affaan-m/everything-claude-code?style=flat)](https://github.com/affaan-m/everything-claude-code/stargazers)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![Shell](https://img.shields.io/badge/-Shell-4EAA25?logo=gnu-bash&logoColor=white)
![TypeScript](https://img.shields.io/badge/-TypeScript-3178C6?logo=typescript&logoColor=white)
![Markdown](https://img.shields.io/badge/-Markdown-000000?logo=markdown&logoColor=white)

**The complete collection of Claude Code configs from an Anthropic hackathon winner.**

Production-ready agents, skills, hooks, commands, rules, and MCP configurations evolved over 10+ months of intensive daily use building real products.

---

## Installation rapide (fork Nexus-Conseil)

Ce fork s'installe comme **plugin Claude Code au scope utilisateur** : une seule installation par machine, valable pour tous les projets et pour tous les comptes Claude utilisés sur cette machine. La configuration `~/.claude/` dépend de la session système, pas du compte Claude : changer de compte avec `/login` ne change rien.

### 1. Sur chaque machine, une seule fois

```bash
git clone https://github.com/Nexus-Conseil/everything-claude-code.git
cd everything-claude-code
./install.sh                                            # macOS, Linux, Git Bash
powershell -ExecutionPolicy Bypass -File .\install.ps1   # Windows PowerShell
```

Le script est idempotent et :

1. enregistre la marketplace `Nexus-Conseil/everything-claude-code` au scope utilisateur ;
2. installe le plugin `everything-claude-code@everything-claude-code` ;
3. active la mise à jour automatique de la marketplace ;
4. copie `rules/*.md` dans `~/.claude/rules/everything-claude-code/`, car un plugin ne peut pas distribuer de règles.

Sans cloner le dépôt, les deux commandes équivalentes sont (aussi disponibles sous la forme `/plugin ...` dans une session) :

```bash
claude plugin marketplace add Nexus-Conseil/everything-claude-code
claude plugin install everything-claude-code@everything-claude-code
```

Redémarrez Claude Code puis vérifiez avec `/plugin list`.

### 2. Sessions cloud (claude.ai/code, application mobile, `claude --cloud`)

Une session cloud démarre dans une machine virtuelle neuve : les plugins installés sur votre ordinateur n'y sont pas. Ajoutez une fois, dans le **script de configuration** de chaque environnement cloud (menu de l'environnement, puis Edit, champ Setup script) :

```bash
claude plugin marketplace add Nexus-Conseil/everything-claude-code --scope user
claude plugin install everything-claude-code@everything-claude-code --scope user
mkdir -p ~/.claude/rules/everything-claude-code && cp ~/.claude/plugins/marketplaces/everything-claude-code/rules/*.md ~/.claude/rules/everything-claude-code/
```

Le résultat est mis en cache par l'environnement (environ sept jours), puis le script est rejoué automatiquement. Chaque compte Claude a ses propres environnements : l'opération se fait une fois par environnement.

### 3. Mise à jour

```bash
./install.sh --update
# ou, sans clone local :
claude plugin marketplace update everything-claude-code
claude plugin update everything-claude-code@everything-claude-code
```

Le plugin n'a pas de champ `version` : chaque commit poussé sur `main` est une nouvelle version. Redémarrez Claude Code pour l'appliquer.

### 4. Contenu confidentiel

Ce dépôt est public : il ne contient que du contenu générique. Les règles propres à une société ou à un client, les configurations MCP avec de vraies valeurs et les instructions internes vont dans le dossier `.claude/` du projet concerné (`.claude/rules/`, `.claude/settings.json`, `.mcp.json`). C'est aussi ce que lisent les sessions cloud.

### 5. Ce que le plugin ne couvre pas

- `rules/` : copiées par le script dans `~/.claude/rules/everything-claude-code/`, ou à committer dans le `.claude/rules/` d'un projet ;
- `contexts/` : à injecter manuellement, par exemple `claude --append-system-prompt-file contexts/dev.md` ;
- `mcp-configs/` : à copier dans le `.mcp.json` d'un projet après remplacement des `YOUR_*_HERE`.

---

## The Guides

This repo is the raw code only. The guides explain everything.

<table>
<tr>
<td width="50%">
<a href="https://x.com/affaanmustafa/status/2012378465664745795">
<img src="https://github.com/user-attachments/assets/1a471488-59cc-425b-8345-5245c7efbcef" alt="The Shorthand Guide to Everything Claude Code" />
</a>
</td>
<td width="50%">
<a href="https://x.com/affaanmustafa/status/2014040193557471352">
<img src="https://github.com/user-attachments/assets/c9ca43bc-b149-427f-b551-af6840c368f0" alt="The Longform Guide to Everything Claude Code" />
</a>
</td>
</tr>
<tr>
<td align="center"><b>Shorthand Guide</b><br/>Setup, foundations, philosophy. <b>Read this first.</b></td>
<td align="center"><b>Longform Guide</b><br/>Token optimization, memory persistence, evals, parallelization.</td>
</tr>
</table>

| Topic | What You'll Learn |
|-------|-------------------|
| Token Optimization | Model selection, system prompt slimming, background processes |
| Memory Persistence | Hooks that save/load context across sessions automatically |
| Continuous Learning | Auto-extract patterns from sessions into reusable skills |
| Verification Loops | Checkpoint vs continuous evals, grader types, pass@k metrics |
| Parallelization | Git worktrees, cascade method, when to scale instances |
| Subagent Orchestration | The context problem, iterative retrieval pattern |

---

## Cross-Platform Support

This plugin now fully supports **Windows, macOS, and Linux**. All hooks and scripts have been rewritten in Node.js for maximum compatibility.

### Package Manager Detection

The plugin automatically detects your preferred package manager (npm, pnpm, yarn, or bun) with the following priority:

1. **Environment variable**: `CLAUDE_PACKAGE_MANAGER`
2. **Project config**: `.claude/package-manager.json`
3. **package.json**: `packageManager` field
4. **Lock file**: Detection from package-lock.json, yarn.lock, pnpm-lock.yaml, or bun.lockb
5. **Global config**: `~/.claude/package-manager.json`
6. **Fallback**: First available package manager

To set your preferred package manager:

```bash
# Via environment variable
export CLAUDE_PACKAGE_MANAGER=pnpm

# Via global config
node scripts/setup-package-manager.js --global pnpm

# Via project config
node scripts/setup-package-manager.js --project bun

# Detect current setting
node scripts/setup-package-manager.js --detect
```

Or use the `/setup-pm` command in Claude Code.

---

## What's Inside

This repo is a **Claude Code plugin** - install it directly or copy components manually.

```
everything-claude-code/
|-- .claude-plugin/   # Plugin and marketplace manifests
|   |-- plugin.json         # Plugin metadata and component paths
|   |-- marketplace.json    # Marketplace catalog for /plugin marketplace add
|
|-- agents/           # Specialized subagents for delegation
|   |-- planner.md           # Feature implementation planning
|   |-- architect.md         # System design decisions
|   |-- tdd-guide.md         # Test-driven development
|   |-- code-reviewer.md     # Quality and security review
|   |-- security-reviewer.md # Vulnerability analysis
|   |-- build-error-resolver.md
|   |-- e2e-runner.md        # Playwright E2E testing
|   |-- refactor-cleaner.md  # Dead code cleanup
|   |-- doc-updater.md       # Documentation sync
|
|-- skills/           # Workflow definitions and domain knowledge
|   |-- coding-standards/           # Language best practices
|   |-- backend-patterns/           # API, database, caching patterns
|   |-- frontend-patterns/          # React, Next.js patterns
|   |-- continuous-learning/        # Auto-extract patterns from sessions (Longform Guide)
|   |-- strategic-compact/          # Manual compaction suggestions (Longform Guide)
|   |-- tdd-workflow/               # TDD methodology
|   |-- security-review/            # Security checklist
|   |-- eval-harness/               # Verification loop evaluation (Longform Guide)
|   |-- verification-loop/          # Continuous verification (Longform Guide)
|
|-- commands/         # Slash commands for quick execution
|   |-- tdd.md              # /tdd - Test-driven development
|   |-- plan.md             # /plan - Implementation planning
|   |-- e2e.md              # /e2e - E2E test generation
|   |-- code-review.md      # /code-review - Quality review
|   |-- build-fix.md        # /build-fix - Fix build errors
|   |-- refactor-clean.md   # /refactor-clean - Dead code removal
|   |-- learn.md            # /learn - Extract patterns mid-session (Longform Guide)
|   |-- checkpoint.md       # /checkpoint - Save verification state (Longform Guide)
|   |-- verify.md           # /verify - Run verification loop (Longform Guide)
|   |-- setup-pm.md         # /setup-pm - Configure package manager (NEW)
|
|-- rules/            # Always-follow guidelines (copy to ~/.claude/rules/)
|   |-- security.md         # Mandatory security checks
|   |-- coding-style.md     # Immutability, file organization
|   |-- testing.md          # TDD, 80% coverage requirement
|   |-- git-workflow.md     # Commit format, PR process
|   |-- agents.md           # When to delegate to subagents
|   |-- performance.md      # Model selection, context management
|   |-- hooks.md            # Hook conventions
|   |-- patterns.md         # Reusable implementation patterns
|
|-- hooks/            # Trigger-based automations
|   |-- hooks.json                # All hooks config (PreToolUse, PostToolUse, Stop, etc.)
|
|-- scripts/          # Cross-platform Node.js scripts (NEW)
|   |-- lib/                     # Shared utilities
|   |   |-- utils.js             # Cross-platform file/path/system utilities
|   |   |-- package-manager.js   # Package manager detection and selection
|   |-- hooks/                   # Hook implementations
|   |   |-- session-start.js     # Load context on session start
|   |   |-- session-end.js       # Save state on session end
|   |   |-- pre-compact.js       # Pre-compaction state saving
|   |   |-- suggest-compact.js   # Strategic compaction suggestions
|   |   |-- evaluate-session.js  # Extract patterns from sessions
|   |   |-- pre-bash.js          # tmux and git push reminders
|   |   |-- pre-write-doc-guard.js # Warn about stray .md/.txt files
|   |   |-- post-bash.js         # Log the PR URL after gh pr create
|   |   |-- post-edit.js         # Prettier, tsc and console.log checks
|   |   |-- stop-console-check.js # console.log audit of modified files
|   |-- setup-package-manager.js # Interactive PM setup
|
|-- tests/            # Test suite (NEW)
|   |-- lib/                     # Library tests
|   |-- hooks/                   # Hook tests
|   |-- run-all.js               # Run all tests
|
|-- contexts/         # Dynamic system prompt injection contexts (Longform Guide)
|   |-- dev.md              # Development mode context
|   |-- review.md           # Code review mode context
|   |-- research.md         # Research/exploration mode context
|
|-- examples/         # Example configurations and sessions
|   |-- CLAUDE.md           # Example project-level config
|   |-- user-CLAUDE.md      # Example user-level config
|
|-- mcp-configs/      # MCP server configurations
|   |-- mcp-servers.json    # GitHub, Supabase, Vercel, Railway, etc.
|
|-- install.sh / install.ps1   # One-time per-machine bootstrap (marketplace, plugin, rules)
```

---

## Installation

### Option 1: Install as Plugin (Recommended)

The easiest way to use this repo - install as a Claude Code plugin (user scope: every project on the machine, whatever Claude account is logged in):

```bash
# Add this repo as a marketplace
/plugin marketplace add Nexus-Conseil/everything-claude-code

# Install the plugin
/plugin install everything-claude-code@everything-claude-code
```

Or run `./install.sh` (`powershell -ExecutionPolicy Bypass -File .\install.ps1` on Windows) from a clone: same commands, plus auto-update and the `rules/` copy.

Or add directly to your `~/.claude/settings.json`:

```json
{
  "extraKnownMarketplaces": {
    "everything-claude-code": {
      "source": {
        "source": "github",
        "repo": "Nexus-Conseil/everything-claude-code"
      },
      "autoUpdate": true
    }
  },
  "enabledPlugins": {
    "everything-claude-code@everything-claude-code": true
  }
}
```

This gives you access to all commands, agents, skills, and hooks. Rules are not a plugin component: copy `rules/*.md` to `~/.claude/rules/` (the install script does it) or commit them to a project's `.claude/rules/`.

---

### Option 2: Manual Installation

If you prefer manual control over what's installed:

```bash
# Clone the repo
git clone https://github.com/Nexus-Conseil/everything-claude-code.git

# Copy agents to your Claude config
cp everything-claude-code/agents/*.md ~/.claude/agents/

# Copy rules
cp everything-claude-code/rules/*.md ~/.claude/rules/

# Copy commands
cp everything-claude-code/commands/*.md ~/.claude/commands/

# Copy skills
cp -r everything-claude-code/skills/* ~/.claude/skills/
```

#### Hooks

Hooks are loaded automatically when the plugin is installed. Do not copy `hooks/hooks.json` into `~/.claude/settings.json` as well: the hooks would run twice. For a manual install without the plugin, copy the entries you want and replace `${CLAUDE_PLUGIN_ROOT}` with the path of your clone.

#### Configure MCPs

Copy desired MCP servers from `mcp-configs/mcp-servers.json` to your `~/.claude.json`.

**Important:** Replace `YOUR_*_HERE` placeholders with your actual API keys.

---

## Key Concepts

### Agents

Subagents handle delegated tasks with limited scope. Example:

```markdown
---
name: code-reviewer
description: Reviews code for quality, security, and maintainability
tools: Read, Grep, Glob, Bash
model: opus
---

You are a senior code reviewer...
```

### Skills

Skills are workflow definitions invoked by commands or agents:

```markdown
# TDD Workflow

1. Define interfaces first
2. Write failing tests (RED)
3. Implement minimal code (GREEN)
4. Refactor (IMPROVE)
5. Verify 80%+ coverage
```

### Hooks

Hooks fire on tool events. Example - warn about console.log:

```json
{
  "matcher": "Edit|MultiEdit|Write",
  "hooks": [{
    "type": "command",
    "command": "node \"${CLAUDE_PLUGIN_ROOT}/scripts/hooks/post-edit.js\""
  }]
}
```

The `matcher` only filters on the tool name (exact name, `A|B` list, `*` or a regex). Argument filtering goes in the script (reads the hook JSON on stdin) or in the optional `if` field, for example `"if": "Edit(*.ts)"`. See `hooks/hooks.json` and `scripts/hooks/` for the full set.

### Rules

Rules are always-follow guidelines. Keep them modular:

```
~/.claude/rules/
  security.md      # No hardcoded secrets
  coding-style.md  # Immutability, file limits
  testing.md       # TDD, coverage requirements
```

---

## Running Tests

The plugin includes a comprehensive test suite:

```bash
# Run all tests
node tests/run-all.js

# Run individual test files
node tests/lib/utils.test.js
node tests/lib/package-manager.test.js
node tests/hooks/hooks.test.js
```

---

## Contributing

**Contributions are welcome and encouraged.**

This repo is meant to be a community resource. If you have:
- Useful agents or skills
- Clever hooks
- Better MCP configurations
- Improved rules

Please contribute! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Ideas for Contributions

- Language-specific skills (Python, Go, Rust patterns)
- Framework-specific configs (Django, Rails, Laravel)
- DevOps agents (Kubernetes, Terraform, AWS)
- Testing strategies (different frameworks)
- Domain-specific knowledge (ML, data engineering, mobile)

---

## Background

I've been using Claude Code since the experimental rollout. Won the Anthropic x Forum Ventures hackathon in Sep 2025 building [zenith.chat](https://zenith.chat) with [@DRodriguezFX](https://x.com/DRodriguezFX) - entirely using Claude Code.

These configs are battle-tested across multiple production applications.

---

## Important Notes

### Context Window Management

**Critical:** Don't enable all MCPs at once. Your 200k context window can shrink to 70k with too many tools enabled.

Rule of thumb:
- Have 20-30 MCPs configured
- Keep under 10 enabled per project
- Under 80 tools active

Use `disabledMcpServers` in project config to disable unused ones.

### Customization

These configs work for my workflow. You should:
1. Start with what resonates
2. Modify for your stack
3. Remove what you don't use
4. Add your own patterns

---

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=affaan-m/everything-claude-code&type=Date)](https://star-history.com/#affaan-m/everything-claude-code&Date)

---

## Links

- **Shorthand Guide (Start Here):** [The Shorthand Guide to Everything Claude Code](https://x.com/affaanmustafa/status/2012378465664745795)
- **Longform Guide (Advanced):** [The Longform Guide to Everything Claude Code](https://x.com/affaanmustafa/status/2014040193557471352)
- **Follow:** [@affaanmustafa](https://x.com/affaanmustafa)
- **zenith.chat:** [zenith.chat](https://zenith.chat)

---

## License

MIT - Use freely, modify as needed, contribute back if you can.

---

**Star this repo if it helps. Read both guides. Build something great.**
