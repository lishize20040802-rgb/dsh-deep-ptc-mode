import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyDiagnosis } from '../lib/preset-health.mjs';
import { deriveDeepPtc, presetDescription, PRESET_META } from '../lib/model.mjs';
import snapshot from '../lib/preset.json' with { type: 'json' };

test('only failed rows count against the preset; waiting rows are kept', () => {
  assert.deepEqual(classifyDiagnosis(undefined), { failed: [], pending: [] });
  const waiting = 'reachability (dsh-deep-ptc-mode/guard): waiting for tools, systemPrompt';
  assert.deepEqual(classifyDiagnosis(waiting), { failed: [], pending: [waiting] });
  const failed = 'tool-jobs (dsh-deep-ptc-mode/jobs-tool): Cannot find module x';
  const never = 'execution (cordis:group): never started';
  assert.deepEqual(classifyDiagnosis(`${failed}\n${waiting}\r\n${never}\n`), { failed: [failed, never], pending: [waiting] });
});

test('the published name and description are language-neutral status text', () => {
  assert.equal(PRESET_META.name, 'Deep PTC');
  assert.equal(presetDescription({ kind: 'environment', environment: 'powershell' }), 'Deep PTC · PowerShell');
  assert.equal(presetDescription({ kind: 'environment', environment: 'wsl', distribution: 'Ubuntu' }), 'Deep PTC · WSL (Ubuntu)');
  assert.equal(presetDescription({ kind: 'environment', environment: 'zsh', distribution: 'Ubuntu' }), 'Deep PTC · Zsh');
  assert.equal(presetDescription({ kind: 'official' }), 'Deep PTC · 官方 Shell Official shell');
  assert.equal(presetDescription({ kind: 'safe' }), 'Deep PTC · 安全模式 Safe mode');
  assert.equal(presetDescription({ kind: 'safe', reason: ' a\n b ' }), 'Deep PTC · 安全模式 Safe mode: a b');
  assert.ok(presetDescription({ kind: 'safe', reason: 'x'.repeat(900) }).length < 450);
});

test('safe mode publishes its reason', () => {
  const { preset } = deriveDeepPtc(snapshot, { environment: 'powershell', safeMode: true, safeModeReason: 'tool-jobs (m): boom' }, 'win32');
  assert.equal(preset.description, 'Deep PTC · 安全模式 Safe mode: tool-jobs (m): boom');
});
