#!/usr/bin/env node
/**
 * PreToolUse (Bash) hook - non-blocking reminders
 *
 * Cross-platform (Windows, macOS, Linux)
 *
 * - dev servers should run inside tmux so their logs stay reachable
 * - long-running commands (install, test, build) benefit from tmux
 * - review changes before `git push`
 *
 * The reminders are emitted as a `systemMessage` (shown to the user and
 * added to Claude's context). The hook never blocks the command.
 * tmux reminders are skipped in cloud sessions (CLAUDE_CODE_REMOTE=true)
 * and when the session already runs inside tmux (TMUX is set).
 */

const { readStdinJson, output } = require('../lib/utils');

const DEV_SERVER = /\b(npm run dev|pnpm( run)? dev|yarn dev|bun run dev)\b/;
const LONG_RUNNING =
  /\b(npm (install|test)|pnpm (install|test)|yarn( install| test)?|bun (install|test)|cargo build|make|docker|pytest|vitest|playwright)\b/;
const GIT_PUSH = /\bgit push\b/;

function buildMessages(command, env = process.env) {
  const messages = [];
  const tmuxRelevant = !env.TMUX && env.CLAUDE_CODE_REMOTE !== 'true';

  if (tmuxRelevant && DEV_SERVER.test(command)) {
    messages.push(
      '[Hook] Dev server started outside tmux: its logs will not be reachable later. ' +
        'Prefer: tmux new-session -d -s dev "<command>" then tmux attach -t dev'
    );
  } else if (tmuxRelevant && LONG_RUNNING.test(command)) {
    messages.push(
      '[Hook] Consider running long commands in tmux for session persistence: ' +
        'tmux new -s dev | tmux attach -t dev'
    );
  }

  if (GIT_PUSH.test(command)) {
    messages.push('[Hook] Review the changes (git diff, git log) before pushing.');
  }

  return messages;
}

async function main() {
  let input = {};
  try {
    input = await readStdinJson();
  } catch {
    return;
  }

  const command = (input.tool_input && input.tool_input.command) || '';
  if (!command) return;

  const messages = buildMessages(command);
  if (messages.length > 0) {
    output({ systemMessage: messages.join('\n') });
  }
}

if (require.main === module) {
  main().catch(() => process.exit(0));
}

module.exports = { buildMessages, DEV_SERVER, LONG_RUNNING, GIT_PUSH };
