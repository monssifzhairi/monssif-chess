import assert from 'node:assert/strict';
import test from 'node:test';
import {canAccessGameMode, getModeGateMessage} from './accessControl.ts';

test('guests may only play Player vs Bot (ai) and are blocked from local and online multiplayer', () => {
  assert.equal(canAccessGameMode('ai', false), true);
  assert.equal(canAccessGameMode('local', false), false);
  assert.equal(canAccessGameMode('online', false), false);
});

test('authenticated users can access all game modes', () => {
  assert.equal(canAccessGameMode('ai', true), true);
  assert.equal(canAccessGameMode('local', true), true);
  assert.equal(canAccessGameMode('online', true), true);
});

test('gate messages provide clear user guidance for local and online modes', () => {
  assert.match(getModeGateMessage('local'), /Local Pass & Play/i);
  assert.match(getModeGateMessage('online'), /Online Multiplayer/i);
  assert.equal(getModeGateMessage('ai'), '');
});
