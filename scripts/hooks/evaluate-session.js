#!/usr/bin/env node
/**
 * Continuous Learning - Session Evaluator
 *
 * Cross-platform (Windows, macOS, Linux)
 *
 * Runs on the SessionEnd hook to extract reusable patterns from Claude Code sessions
 *
 * Why SessionEnd instead of UserPromptSubmit:
 * - SessionEnd runs once at session end (lightweight)
 * - UserPromptSubmit runs every message (heavy, adds latency)
 */

const path = require('path');
const fs = require('fs');
const {
  getLearnedSkillsDir,
  ensureDir,
  readFile,
  countInFile,
  readStdinJson,
  log
} = require('../lib/utils');

async function main() {
  // Get script directory to find config
  const scriptDir = __dirname;
  const configFile = path.join(scriptDir, '..', '..', 'skills', 'continuous-learning', 'config.json');

  // Default configuration
  let minSessionLength = 10;
  let learnedSkillsPath = getLearnedSkillsDir();

  // Load config if exists
  const configContent = readFile(configFile);
  if (configContent) {
    try {
      const config = JSON.parse(configContent);
      minSessionLength = config.min_session_length || 10;

      if (config.learned_skills_path) {
        // Handle ~ in path
        learnedSkillsPath = config.learned_skills_path.replace(/^~/, require('os').homedir());
      }
    } catch {
      // Invalid config, use defaults
    }
  }

  // Ensure learned skills directory exists
  ensureDir(learnedSkillsPath);

  // Claude Code passes the transcript path on stdin (hook input JSON);
  // CLAUDE_TRANSCRIPT_PATH is kept as a manual override.
  let input = {};
  try {
    input = await readStdinJson();
  } catch {
    input = {};
  }
  const transcriptPath = process.env.CLAUDE_TRANSCRIPT_PATH || input.transcript_path;

  if (!transcriptPath || !fs.existsSync(transcriptPath)) {
    process.exit(0);
  }

  // Count user messages in session
  const messageCount = countInFile(transcriptPath, /"type":"user"/g);

  // Skip short sessions
  if (messageCount < minSessionLength) {
    log(`[ContinuousLearning] Session too short (${messageCount} messages), skipping`);
    process.exit(0);
  }

  // Signal to Claude that session should be evaluated for extractable patterns
  log(`[ContinuousLearning] Session has ${messageCount} messages - evaluate for extractable patterns`);
  log(`[ContinuousLearning] Save learned skills to: ${learnedSkillsPath}`);

  process.exit(0);
}

main().catch(err => {
  console.error('[ContinuousLearning] Error:', err.message);
  process.exit(0);
});
