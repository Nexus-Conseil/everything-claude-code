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
 * Patterns are matched at command position only (start of the line or
 * after ; & | or an opening parenthesis, optional VAR=value prefixes) and
 * quoted strings are ignored, so `git commit -m "make tests pass"` or
 * `cat playwright.config.ts` do not trigger anything.
 *
 * The reminders are emitted as a `systemMessage` (shown to the user and
 * added to Claude's context). The hook never blocks the command.
 * tmux reminders are skipped in cloud sessions (CLAUDE_CODE_REMOTE=true)
 * and when the session already runs inside tmux (TMUX is set).
 */

const { readStdinJson, output } = require('../lib/utils');

const AT_COMMAND = '(?:^|[;&|(])\\s*(?:\\w+=\\S*\\s+)*';
const DEV_SERVER = new RegExp(`${AT_COMMAND}(?:npm run dev|pnpm(?: run)? dev|yarn(?: run)? dev|bun(?: run)? dev)\\b`);
const LONG_RUNNING = new RegExp(
  `${AT_COMMAND}(?:npm (?:install|ci|test)|pnpm (?:install|test)|yarn (?:install|test|build)|bun (?:install|test)|cargo (?:build|test)|make(?=\\s|$)|docker (?:build|run|compose)|pytest|vitest|playwright test)\\b`
);
const GIT_PUSH = new RegExp(`${AT_COMMAND}git push\\b`);

/**
 * Remove quoted strings so words inside messages or paths are not matched.
 */
function stripQuoted(command) {
  return command.replace(/"(?:[^"\\]|\\.)*"|'[^']*'/g, '""');
}

function buildMessages(command, env = process.env) {
  const messages = [];
  const text = stripQuoted(command);
  const tmuxRelevant = !env.TMUX && env.CLAUDE_CODE_REMOTE !== 'true';

  if (tmuxRelevant && DEV_SERVER.test(text)) {
    messages.push(
      '[Hook] Dev server started outside tmux: its logs will not be reachable later. ' +
        'Prefer: tmux new-session -d -s dev "<command>" then tmux attach -t dev'
    );
  } else if (tmuxRelevant && LONG_RUNNING.test(text)) {
    messages.push(
      '[Hook] Consider running long commands in tmux for session persistence: ' +
        'tmux new -s dev | tmux attach -t dev'
    );
  }

  if (GIT_PUSH.test(text)) {
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

module.exports = { buildMessages, stripQuoted, DEV_SERVER, LONG_RUNNING, GIT_PUSH };
