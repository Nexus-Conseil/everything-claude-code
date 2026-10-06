#!/usr/bin/env node
/**
 * Strategic Compact Suggester
 *
 * Cross-platform (Windows, macOS, Linux)
 *
 * Runs on PreToolUse (Edit|MultiEdit|Write) to suggest manual compaction
 * at logical intervals.
 *
 * Why manual over auto-compact:
 * - Auto-compact happens at arbitrary points, often mid-task
 * - Strategic compacting preserves context through logical phases
 * - Compact after exploration, before execution
 * - Compact after completing a milestone, before starting next
 *
 * The counter is keyed by the session_id Claude Code passes on stdin
 * (CLAUDE_SESSION_ID or the parent PID as fallbacks). Suggestions are
 * emitted as a `systemMessage` so the user and Claude both see them.
 */

const path = require('path');
const {
  getTempDir,
  readFile,
  writeFile,
  readStdinJson,
  output
} = require('../lib/utils');

async function main() {
  let input = {};
  try {
    input = await readStdinJson();
  } catch {
    input = {};
  }

  const sessionId = input.session_id || process.env.CLAUDE_SESSION_ID || process.ppid || 'default';
  const counterFile = path.join(getTempDir(), `claude-tool-count-${sessionId}`);
  const threshold = parseInt(process.env.COMPACT_THRESHOLD || '50', 10);

  let count = 1;

  // Read existing count or start at 1
  const existing = readFile(counterFile);
  if (existing) {
    count = parseInt(existing.trim(), 10) + 1;
  }

  // Save updated count
  writeFile(counterFile, String(count));

  let message = null;

  // Suggest compact after threshold tool calls
  if (count === threshold) {
    message = `[StrategicCompact] ${threshold} tool calls reached - consider /compact if transitioning phases`;
  } else if (count > threshold && count % 25 === 0) {
    // Suggest at regular intervals after threshold
    message = `[StrategicCompact] ${count} tool calls - good checkpoint for /compact if context is stale`;
  }

  if (message) {
    output({ systemMessage: message });
  }
}

main().catch(err => {
  console.error('[StrategicCompact] Error:', err.message);
  process.exit(0);
});
