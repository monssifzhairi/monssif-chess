import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { AuthPersistenceStore, computeUserStats } from './authStore.ts';
import { SlidingWindowRateLimiter } from './rateLimiter.ts';

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'monssif-auth-test-'));
}

test('registration validates input, hashes passwords, and rejects duplicates', () => {
  const dir = makeTempDir();
  try {
    const store = new AuthPersistenceStore({ dataDir: dir, secret: 'test-secret-0123456789abcdef' });

    const badEmail = store.registerUser({
      email: 'not-an-email',
      username: 'monssif',
      password: 'password123',
    });
    assert.equal(badEmail.ok, false);

    const shortPw = store.registerUser({
      email: 'player@monssif.dev',
      username: 'monssif',
      password: '123',
    });
    assert.equal(shortPw.ok, false);

    const created = store.registerUser({
      email: 'Player@Monssif.dev',
      username: 'grandmaster_1',
      displayName: 'Monssif Z.',
      password: 'StrongPassword99!',
    });
    assert.equal(created.ok, true);
    if (created.ok) {
      assert.equal(created.user.email, 'player@monssif.dev');
      assert.equal(created.user.displayName, 'Monssif Z.');
      assert.equal('passwordHash' in created.user, false);
    }

    const dupEmail = store.registerUser({
      email: 'player@monssif.dev',
      username: 'another_user',
      password: 'StrongPassword99!',
    });
    assert.equal(dupEmail.ok, false);
    if (!dupEmail.ok) assert.equal(dupEmail.status, 409);

    const dupUser = store.registerUser({
      email: 'other@monssif.dev',
      username: 'GRANDMASTER_1',
      password: 'StrongPassword99!',
    });
    assert.equal(dupUser.ok, false);
    if (!dupUser.ok) assert.equal(dupUser.status, 409);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('authentication, signed session tokens, and persistence across reloads work securely', () => {
  const dir = makeTempDir();
  try {
    const store1 = new AuthPersistenceStore({ dataDir: dir });
    const reg = store1.registerUser({
      email: 'tactician@monssif.dev',
      username: 'tactician',
      password: 'MyChessPassword!22',
    });
    assert.equal(reg.ok, true);
    if (!reg.ok) return;

    const badLogin = store1.authenticateUser({ identifier: 'tactician', password: 'wrong' });
    assert.equal(badLogin.ok, false);

    const goodLogin = store1.authenticateUser({
      identifier: 'tactician@monssif.dev',
      password: 'MyChessPassword!22',
    });
    assert.equal(goodLogin.ok, true);

    const token = store1.createSessionToken(reg.user.id);
    assert.equal(store1.verifySessionToken(token), reg.user.id);
    assert.equal(store1.verifySessionToken(`${token}tampered`), null);

    // Reload from disk with a new store instance
    const store2 = new AuthPersistenceStore({ dataDir: dir });
    assert.equal(store2.verifySessionToken(token), reg.user.id);
    const loadedUser = store2.getUserById(reg.user.id);
    assert.ok(loadedUser);
    assert.equal(loadedUser.username, 'tactician');

    const profUpdate = store2.updateProfile(reg.user.id, {
      displayName: 'IM Monssif',
      bio: 'Sicilian Najdorf specialist',
      preferredSide: 'w',
      titleBadge: 'Candidate Master',
    });
    assert.equal(profUpdate.ok, true);

    const settingsUpdate = store2.updateSettings(reg.user.id, {
      defaultTimeId: 'blitz-3-2',
      soundEnabled: false,
      currentPassword: 'MyChessPassword!22',
      newPassword: 'UpdatedPassword!88',
    });
    assert.equal(settingsUpdate.ok, true);

    const relogin = store2.authenticateUser({
      identifier: 'tactician',
      password: 'UpdatedPassword!88',
    });
    assert.equal(relogin.ok, true);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('match history persistence and computed player statistics are accurate', () => {
  const dir = makeTempDir();
  try {
    const store = new AuthPersistenceStore({ dataDir: dir, secret: 'secret-0123456789abcdef' });
    const reg = store.registerUser({
      email: 'stats@monssif.dev',
      username: 'stats_user',
      password: 'Password1234',
    });
    assert.equal(reg.ok, true);
    if (!reg.ok) return;

    store.saveUserMatch(reg.user.id, {
      timestamp: 1000,
      mode: 'ai',
      difficulty: 'medium',
      whiteName: 'stats_user',
      blackName: 'Stockfish 19',
      playerColor: 'w',
      winner: 'w',
      termination: 'checkmate',
      reasonLabel: 'Checkmate',
      totalPlies: 20,
      timeControlLabel: '10 + 0',
      pgn: '1. e4 e5',
      finalFen: '8/8/8/8/8/8/8/8 w - - 0 1',
    });

    const saved2 = store.saveUserMatch(reg.user.id, {
      timestamp: 2000,
      mode: 'ai',
      difficulty: 'hard',
      whiteName: 'Stockfish 19',
      blackName: 'stats_user',
      playerColor: 'b',
      winner: 'draw',
      termination: 'stalemate',
      reasonLabel: 'Draw by Stalemate',
      totalPlies: 40,
      timeControlLabel: '5 + 0',
      pgn: '1. d4 d5',
      finalFen: '8/8/8/8/8/8/8/8 w - - 0 1',
    });

    assert.equal(saved2.ok, true);
    if (saved2.ok) {
      assert.equal(saved2.stats.totalGames, 2);
      assert.equal(saved2.stats.wins, 1);
      assert.equal(saved2.stats.draws, 1);
      assert.equal(saved2.stats.losses, 0);
      assert.equal(saved2.stats.winRatePct, 50);
      assert.equal(saved2.stats.avgMoves, 15);
      assert.equal(saved2.stats.favoriteMode, 'ai');
    }

    assert.deepEqual(computeUserStats([]), {
      totalGames: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      winRatePct: 0,
      avgMoves: 0,
      favoriteMode: null,
    });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('password change and explicit logout revoke prior session tokens and reject malformed matches', () => {
  const dir = makeTempDir();
  try {
    const store = new AuthPersistenceStore({ dataDir: dir, secret: 'secret-0123456789abcdef' });
    const reg = store.registerUser({
      email: 'revoke@monssif.dev',
      username: 'revoke_user',
      password: 'InitialPassword1!',
    });
    assert.equal(reg.ok, true);
    if (!reg.ok) return;

    const token1 = store.createSessionToken(reg.user.id);
    assert.equal(store.verifySessionToken(token1), reg.user.id);

    // Changing password invalidates token1
    const pwChange = store.updateSettings(reg.user.id, {
      currentPassword: 'InitialPassword1!',
      newPassword: 'RotatedPassword2!',
    });
    assert.equal(pwChange.ok, true);
    assert.equal(store.verifySessionToken(token1), null);

    const token2 = store.createSessionToken(reg.user.id);
    assert.equal(store.verifySessionToken(token2), reg.user.id);

    // Explicit logout revocation invalidates token2
    store.revokeUserSessions(reg.user.id);
    assert.equal(store.verifySessionToken(token2), null);

    // Password > 128 chars rejected without CPU DoS
    const hugePw = store.registerUser({
      email: 'dos@monssif.dev',
      username: 'dos_tester',
      password: 'x'.repeat(200),
    });
    assert.equal(hugePw.ok, false);

    // Invalid match winner/mode rejected
    const badMatch = store.saveUserMatch(reg.user.id, {
      timestamp: Date.now(),
      mode: 'invalid_mode' as unknown as 'ai',
      whiteName: 'A',
      blackName: 'B',
      winner: 'w',
      termination: 'checkmate',
      reasonLabel: 'Checkmate',
      totalPlies: 10,
      timeControlLabel: '10 + 0',
      pgn: '1. e4 e5',
      finalFen: '8/8/8/8/8/8/8/8 w - - 0 1',
    });
    assert.equal(badMatch.ok, false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('sliding window rate limiter enforces request caps and recovers after window expires', () => {
  const limiter = new SlidingWindowRateLimiter({ maxRequests: 3, windowMs: 10_000 });
  const t0 = 1_000_000;

  assert.equal(limiter.consume('127.0.0.1', t0).allowed, true);
  assert.equal(limiter.consume('127.0.0.1', t0 + 100).allowed, true);
  assert.equal(limiter.consume('127.0.0.1', t0 + 200).allowed, true);

  const blocked = limiter.consume('127.0.0.1', t0 + 300);
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfterSec >= 9);

  // Separate client IP unaffected
  assert.equal(limiter.consume('10.0.0.2', t0 + 300).allowed, true);

  // Recovers once window passes
  const recovered = limiter.consume('127.0.0.1', t0 + 10_500);
  assert.equal(recovered.allowed, true);
});
