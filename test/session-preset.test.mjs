import test from 'node:test';
import assert from 'node:assert/strict';
import { isDeepPtcSession } from '../lib/session-preset.mjs';

test('the current host selection takes precedence over the creation header', () => {
  const session = { header: Object.freeze({ agentPreset: 'standard' }) };
  let selected = 'deep-ptc';
  const ctx = { get: name => name === 'agentPresets' ? { presetForSession: () => selected } : undefined };
  assert.equal(isDeepPtcSession(ctx, session), true);
  for (selected of ['ptc', 'standard', 'cordis', null, undefined]) assert.equal(isDeepPtcSession(ctx, session), false);
  assert.equal(session.header.agentPreset, 'standard');
});

test('older hosts use the recorded header when the selection API is unavailable', () => {
  assert.equal(isDeepPtcSession({}, { header: { agentPreset: 'deep-ptc' } }), true);
  assert.equal(isDeepPtcSession({}, { header: { agentPreset: 'standard' } }), false);
  assert.equal(isDeepPtcSession({}, undefined), false);
});
