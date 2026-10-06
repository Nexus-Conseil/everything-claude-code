/**
 * Tests for hook scripts
 *
 * Run with: node tests/hooks/hooks.test.js
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execSync, spawn } = require('child_process');

// Test helper
function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    return true;
  } catch (err) {
    console.log(`  ✗ ${name}`);
    console.log(`    Error: ${err.message}`);
    return false;
  }
}

// Async test helper
async function asyncTest(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    return true;
  } catch (err) {
    console.log(`  ✗ ${name}`);
    console.log(`    Error: ${err.message}`);
    return false;
  }
}

// Run a script and capture output
function runScript(scriptPath, input = '', env = {}, cwd = undefined) {
  return new Promise((resolve, reject) => {
    const proc = spawn('node', [scriptPath], {
      env: { ...process.env, ...env },
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', data => stdout += data);
    proc.stderr.on('data', data => stderr += data);

    if (input) {
      proc.stdin.write(input);
    }
    proc.stdin.end();

    proc.on('close', code => {
      resolve({ code, stdout, stderr });
    });

    proc.on('error', reject);
  });
}

// Create a temporary test directory
function createTestDir() {
  const testDir = path.join(os.tmpdir(), `hooks-test-${Date.now()}`);
  fs.mkdirSync(testDir, { recursive: true });
  return testDir;
}

// Clean up test directory
function cleanupTestDir(testDir) {
  fs.rmSync(testDir, { recursive: true, force: true });
}

// Test suite
async function runTests() {
  console.log('\n=== Testing Hook Scripts ===\n');

  let passed = 0;
  let failed = 0;

  const scriptsDir = path.join(__dirname, '..', '..', 'scripts', 'hooks');

  // session-start.js tests
  console.log('session-start.js:');

  if (await asyncTest('runs without error', async () => {
    const result = await runScript(path.join(scriptsDir, 'session-start.js'));
    assert.strictEqual(result.code, 0, `Exit code should be 0, got ${result.code}`);
  })) passed++; else failed++;

  if (await asyncTest('outputs session info to stdout (added to context)', async () => {
    const result = await runScript(path.join(scriptsDir, 'session-start.js'));
    assert.ok(
      result.stdout.includes('[SessionStart]') &&
      result.stdout.includes('Package manager'),
      'Should output session info on stdout'
    );
  })) passed++; else failed++;

  // session-end.js tests
  console.log('\nsession-end.js:');

  if (await asyncTest('runs without error', async () => {
    const result = await runScript(path.join(scriptsDir, 'session-end.js'));
    assert.strictEqual(result.code, 0, `Exit code should be 0, got ${result.code}`);
  })) passed++; else failed++;

  if (await asyncTest('creates or updates session file', async () => {
    // Run the script
    await runScript(path.join(scriptsDir, 'session-end.js'));

    // Check if session file was created
    const sessionsDir = path.join(os.homedir(), '.claude', 'sessions');
    const today = new Date().toISOString().split('T')[0];
    const sessionFile = path.join(sessionsDir, `${today}-session.tmp`);

    assert.ok(fs.existsSync(sessionFile), 'Session file should exist');
  })) passed++; else failed++;

  // pre-compact.js tests
  console.log('\npre-compact.js:');

  if (await asyncTest('runs without error', async () => {
    const result = await runScript(path.join(scriptsDir, 'pre-compact.js'));
    assert.strictEqual(result.code, 0, `Exit code should be 0, got ${result.code}`);
  })) passed++; else failed++;

  if (await asyncTest('outputs PreCompact message', async () => {
    const result = await runScript(path.join(scriptsDir, 'pre-compact.js'));
    assert.ok(result.stderr.includes('[PreCompact]'), 'Should output PreCompact message');
  })) passed++; else failed++;

  if (await asyncTest('creates compaction log', async () => {
    await runScript(path.join(scriptsDir, 'pre-compact.js'));
    const logFile = path.join(os.homedir(), '.claude', 'sessions', 'compaction-log.txt');
    assert.ok(fs.existsSync(logFile), 'Compaction log should exist');
  })) passed++; else failed++;

  // suggest-compact.js tests
  console.log('\nsuggest-compact.js:');

  if (await asyncTest('runs without error', async () => {
    const result = await runScript(path.join(scriptsDir, 'suggest-compact.js'), '', {
      CLAUDE_SESSION_ID: 'test-session-' + Date.now()
    });
    assert.strictEqual(result.code, 0, `Exit code should be 0, got ${result.code}`);
  })) passed++; else failed++;

  if (await asyncTest('increments counter on each call', async () => {
    const sessionId = 'test-counter-' + Date.now();

    // Run multiple times
    for (let i = 0; i < 3; i++) {
      await runScript(path.join(scriptsDir, 'suggest-compact.js'), '', {
        CLAUDE_SESSION_ID: sessionId
      });
    }

    // Check counter file
    const counterFile = path.join(os.tmpdir(), `claude-tool-count-${sessionId}`);
    const count = parseInt(fs.readFileSync(counterFile, 'utf8').trim(), 10);
    assert.strictEqual(count, 3, `Counter should be 3, got ${count}`);

    // Cleanup
    fs.unlinkSync(counterFile);
  })) passed++; else failed++;

  if (await asyncTest('uses session_id from hook input', async () => {
    const sessionId = 'test-stdin-' + Date.now();
    await runScript(
      path.join(scriptsDir, 'suggest-compact.js'),
      JSON.stringify({ session_id: sessionId, tool_name: 'Edit', tool_input: { file_path: 'x.ts' } })
    );
    const counterFile = path.join(os.tmpdir(), `claude-tool-count-${sessionId}`);
    assert.ok(fs.existsSync(counterFile), 'Counter file keyed by session_id should exist');
    fs.unlinkSync(counterFile);
  })) passed++; else failed++;

  if (await asyncTest('suggests compact at threshold', async () => {
    const sessionId = 'test-threshold-' + Date.now();
    const counterFile = path.join(os.tmpdir(), `claude-tool-count-${sessionId}`);

    // Set counter to threshold - 1
    fs.writeFileSync(counterFile, '49');

    const result = await runScript(path.join(scriptsDir, 'suggest-compact.js'), '', {
      CLAUDE_SESSION_ID: sessionId,
      COMPACT_THRESHOLD: '50'
    });

    const out = JSON.parse(result.stdout);
    assert.ok(
      out.systemMessage.includes('50 tool calls reached'),
      'Should suggest compact at threshold as a systemMessage'
    );

    // Cleanup
    fs.unlinkSync(counterFile);
  })) passed++; else failed++;

  // evaluate-session.js tests
  console.log('\nevaluate-session.js:');

  if (await asyncTest('runs without error when no transcript', async () => {
    const result = await runScript(path.join(scriptsDir, 'evaluate-session.js'));
    assert.strictEqual(result.code, 0, `Exit code should be 0, got ${result.code}`);
  })) passed++; else failed++;

  if (await asyncTest('skips short sessions', async () => {
    const testDir = createTestDir();
    const transcriptPath = path.join(testDir, 'transcript.jsonl');

    // Create a short transcript (less than 10 user messages)
    const transcript = Array(5).fill('{"type":"user","content":"test"}\n').join('');
    fs.writeFileSync(transcriptPath, transcript);

    const result = await runScript(path.join(scriptsDir, 'evaluate-session.js'), '', {
      CLAUDE_TRANSCRIPT_PATH: transcriptPath
    });

    assert.ok(
      result.stderr.includes('Session too short'),
      'Should indicate session is too short'
    );

    cleanupTestDir(testDir);
  })) passed++; else failed++;

  if (await asyncTest('processes sessions with enough messages', async () => {
    const testDir = createTestDir();
    const transcriptPath = path.join(testDir, 'transcript.jsonl');

    // Create a longer transcript (more than 10 user messages)
    const transcript = Array(15).fill('{"type":"user","content":"test"}\n').join('');
    fs.writeFileSync(transcriptPath, transcript);

    const result = await runScript(path.join(scriptsDir, 'evaluate-session.js'), '', {
      CLAUDE_TRANSCRIPT_PATH: transcriptPath
    });

    assert.ok(
      result.stderr.includes('15 messages'),
      'Should report message count'
    );

    cleanupTestDir(testDir);
  })) passed++; else failed++;

  if (await asyncTest('reads transcript_path from hook input', async () => {
    const testDir = createTestDir();
    const transcriptPath = path.join(testDir, 'transcript.jsonl');
    const transcript = Array(15).fill('{"type":"user","content":"test"}\n').join('');
    fs.writeFileSync(transcriptPath, transcript);

    const result = await runScript(
      path.join(scriptsDir, 'evaluate-session.js'),
      JSON.stringify({ hook_event_name: 'SessionEnd', transcript_path: transcriptPath }),
      { CLAUDE_TRANSCRIPT_PATH: '' }
    );

    assert.ok(result.stderr.includes('15 messages'), 'Should read transcript_path from stdin');
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  // pre-bash.js tests
  console.log('\npre-bash.js:');

  const localEnv = { TMUX: '', CLAUDE_CODE_REMOTE: '' };
  const bashInput = command => JSON.stringify({ tool_name: 'Bash', tool_input: { command } });

  if (await asyncTest('reminds to review before git push', async () => {
    const result = await runScript(path.join(scriptsDir, 'pre-bash.js'), bashInput('git push origin main'), localEnv);
    assert.strictEqual(result.code, 0, `Exit code should be 0, got ${result.code}`);
    const out = JSON.parse(result.stdout);
    assert.ok(out.systemMessage.includes('before pushing'), 'Should remind to review before pushing');
  })) passed++; else failed++;

  if (await asyncTest('warns about dev servers outside tmux', async () => {
    const result = await runScript(path.join(scriptsDir, 'pre-bash.js'), bashInput('npm run dev'), localEnv);
    assert.ok(JSON.parse(result.stdout).systemMessage.includes('tmux'), 'Should mention tmux');
  })) passed++; else failed++;

  if (await asyncTest('skips tmux reminders in cloud sessions', async () => {
    const result = await runScript(path.join(scriptsDir, 'pre-bash.js'), bashInput('npm run dev'), {
      TMUX: '',
      CLAUDE_CODE_REMOTE: 'true'
    });
    assert.strictEqual(result.stdout.trim(), '', 'Should stay silent in cloud sessions');
  })) passed++; else failed++;

  if (await asyncTest('stays silent for ordinary commands', async () => {
    const result = await runScript(path.join(scriptsDir, 'pre-bash.js'), bashInput('ls -la'), localEnv);
    assert.strictEqual(result.code, 0);
    assert.strictEqual(result.stdout.trim(), '', 'Should not emit anything');
  })) passed++; else failed++;

  // pre-write-doc-guard.js tests
  console.log('\npre-write-doc-guard.js:');

  const writeInput = filePath => JSON.stringify({ tool_name: 'Write', tool_input: { file_path: filePath, content: '' } });

  if (await asyncTest('warns about stray documentation files', async () => {
    const result = await runScript(path.join(scriptsDir, 'pre-write-doc-guard.js'), writeInput('/tmp/project/notes.md'));
    assert.strictEqual(result.code, 0);
    assert.ok(JSON.parse(result.stdout).systemMessage.includes('documentation'), 'Should warn');
  })) passed++; else failed++;

  if (await asyncTest('allows README.md, SKILL.md and docs/', async () => {
    for (const file of ['/tmp/project/README.md', '/tmp/project/skills/x/SKILL.md', '/tmp/project/docs/guide.md', '/tmp/project/src/index.ts']) {
      const result = await runScript(path.join(scriptsDir, 'pre-write-doc-guard.js'), writeInput(file));
      assert.strictEqual(result.stdout.trim(), '', `Should allow ${file}`);
    }
  })) passed++; else failed++;

  // post-bash.js tests
  console.log('\npost-bash.js:');

  if (await asyncTest('reports the PR URL after gh pr create', async () => {
    const result = await runScript(
      path.join(scriptsDir, 'post-bash.js'),
      JSON.stringify({
        tool_name: 'Bash',
        tool_input: { command: 'gh pr create --fill' },
        tool_response: { stdout: 'https://github.com/acme/app/pull/42\n', stderr: '' }
      })
    );
    assert.strictEqual(result.code, 0);
    const out = JSON.parse(result.stdout);
    assert.ok(out.systemMessage.includes('gh pr review 42 --repo acme/app'), 'Should print the review command');
  })) passed++; else failed++;

  if (await asyncTest('ignores other commands', async () => {
    const result = await runScript(
      path.join(scriptsDir, 'post-bash.js'),
      JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'ls' }, tool_response: 'https://github.com/acme/app/pull/42' })
    );
    assert.strictEqual(result.stdout.trim(), '', 'Should stay silent');
  })) passed++; else failed++;

  // post-edit.js tests
  console.log('\npost-edit.js:');

  if (await asyncTest('flags console.log in edited JS files', async () => {
    const testDir = createTestDir();
    const file = path.join(testDir, 'a.js');
    fs.writeFileSync(file, "const x = 1;\nconsole.log('x');\n");
    const result = await runScript(
      path.join(scriptsDir, 'post-edit.js'),
      JSON.stringify({ tool_name: 'Edit', tool_input: { file_path: file } }),
      { ECC_SKIP_PRETTIER: '1', ECC_SKIP_TSC: '1' }
    );
    assert.strictEqual(result.code, 0);
    const out = JSON.parse(result.stdout);
    assert.ok(out.hookSpecificOutput.additionalContext.includes('console.log'), 'Should flag console.log');
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  if (await asyncTest('stays silent for non-source files', async () => {
    const testDir = createTestDir();
    const file = path.join(testDir, 'notes.txt');
    fs.writeFileSync(file, "console.log('x');\n");
    const result = await runScript(
      path.join(scriptsDir, 'post-edit.js'),
      JSON.stringify({ tool_name: 'Write', tool_input: { file_path: file } }),
      { ECC_SKIP_PRETTIER: '1', ECC_SKIP_TSC: '1' }
    );
    assert.strictEqual(result.stdout.trim(), '', 'Should ignore .txt files');
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  // stop-console-check.js tests
  console.log('\nstop-console-check.js:');

  if (await asyncTest('runs without error outside a git repository', async () => {
    const testDir = createTestDir();
    const result = await runScript(path.join(scriptsDir, 'stop-console-check.js'), JSON.stringify({ hook_event_name: 'Stop' }), {}, testDir);
    assert.strictEqual(result.code, 0, `Exit code should be 0, got ${result.code}`);
    assert.strictEqual(result.stdout.trim(), '', 'Should stay silent');
    cleanupTestDir(testDir);
  })) passed++; else failed++;

  if (await asyncTest('does nothing when a Stop hook is already active', async () => {
    const result = await runScript(path.join(scriptsDir, 'stop-console-check.js'), JSON.stringify({ hook_event_name: 'Stop', stop_hook_active: true }));
    assert.strictEqual(result.code, 0);
    assert.strictEqual(result.stdout.trim(), '', 'Should stay silent');
  })) passed++; else failed++;

  // hooks.json validation
  console.log('\nhooks.json Validation:');

  if (test('hooks.json is valid JSON', () => {
    const hooksPath = path.join(__dirname, '..', '..', 'hooks', 'hooks.json');
    const content = fs.readFileSync(hooksPath, 'utf8');
    JSON.parse(content); // Will throw if invalid
  })) passed++; else failed++;

  if (test('hooks.json has required event types', () => {
    const hooksPath = path.join(__dirname, '..', '..', 'hooks', 'hooks.json');
    const hooks = JSON.parse(fs.readFileSync(hooksPath, 'utf8'));

    assert.ok(hooks.hooks.PreToolUse, 'Should have PreToolUse hooks');
    assert.ok(hooks.hooks.PostToolUse, 'Should have PostToolUse hooks');
    assert.ok(hooks.hooks.SessionStart, 'Should have SessionStart hooks');
    assert.ok(hooks.hooks.Stop, 'Should have Stop hooks');
    assert.ok(hooks.hooks.PreCompact, 'Should have PreCompact hooks');
  })) passed++; else failed++;

  if (test('all hook commands use node', () => {
    const hooksPath = path.join(__dirname, '..', '..', 'hooks', 'hooks.json');
    const hooks = JSON.parse(fs.readFileSync(hooksPath, 'utf8'));

    const checkHooks = (hookArray) => {
      for (const entry of hookArray) {
        for (const hook of entry.hooks) {
          if (hook.type === 'command') {
            assert.ok(
              hook.command.startsWith('node'),
              `Hook command should start with 'node': ${hook.command.substring(0, 50)}...`
            );
          }
        }
      }
    };

    for (const [eventType, hookArray] of Object.entries(hooks.hooks)) {
      checkHooks(hookArray);
    }
  })) passed++; else failed++;

  if (test('matchers only use tool names (no expression syntax)', () => {
    const hooksPath = path.join(__dirname, '..', '..', 'hooks', 'hooks.json');
    const hooks = JSON.parse(fs.readFileSync(hooksPath, 'utf8'));
    const allowed = /^(\*|[A-Za-z0-9_|,-]+)$/;

    for (const [eventType, hookArray] of Object.entries(hooks.hooks)) {
      for (const entry of hookArray) {
        if (entry.matcher === undefined) continue;
        assert.ok(allowed.test(entry.matcher), `${eventType} matcher must be a tool name, list or *: ${entry.matcher}`);
        assert.ok(entry.description === undefined, `${eventType} entries must not carry a description key (rejected by Claude Code)`);
      }
    }
  })) passed++; else failed++;

  if (test('script references use CLAUDE_PLUGIN_ROOT variable', () => {
    const hooksPath = path.join(__dirname, '..', '..', 'hooks', 'hooks.json');
    const hooks = JSON.parse(fs.readFileSync(hooksPath, 'utf8'));

    const checkHooks = (hookArray) => {
      for (const entry of hookArray) {
        for (const hook of entry.hooks) {
          if (hook.type === 'command' && hook.command.includes('scripts/hooks/')) {
            // Check for the literal string "${CLAUDE_PLUGIN_ROOT}" in the command
            const hasPluginRoot = hook.command.includes('${CLAUDE_PLUGIN_ROOT}');
            assert.ok(
              hasPluginRoot,
              `Script paths should use CLAUDE_PLUGIN_ROOT: ${hook.command.substring(0, 80)}...`
            );
          }
        }
      }
    };

    for (const [eventType, hookArray] of Object.entries(hooks.hooks)) {
      checkHooks(hookArray);
    }
  })) passed++; else failed++;

  // Summary
  console.log('\n=== Test Results ===');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total:  ${passed + failed}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

runTests();
