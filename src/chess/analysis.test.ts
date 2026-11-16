import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import {
  analyzeGameWithEvaluator,
  classifyMoveLoss,
  computeAccuracyFromFrames,
  computeCpLossForMove,
  evalToWhiteCp,
  uciMoveToSan,
} from './analysis';
import { executeChessMove } from './rules';
import type { MoveRecord } from '../types/chess';

test('classifyMoveLoss distinguishes best, good, inaccuracy, mistake, and blunder thresholds', () => {
  assert.equal(classifyMoveLoss(0, true), 'best');
  assert.equal(classifyMoveLoss(15, false), 'best');
  assert.equal(classifyMoveLoss(45, false), 'good');
  assert.equal(classifyMoveLoss(95, false), 'inaccuracy');
  assert.equal(classifyMoveLoss(180, false), 'mistake');
  assert.equal(classifyMoveLoss(340, false), 'blunder');
});

test('computeCpLossForMove normalizes White and Black perspectives accurately', () => {
  // White drops from +120cp to -180cp => 300cp loss
  assert.equal(
    computeCpLossForMove('w', { cp: 120, mate: null }, { cp: -180, mate: null }),
    300
  );
  // Black drops from -150cp (Black winning) to +50cp (White better) => 200cp loss for Black
  assert.equal(
    computeCpLossForMove('b', { cp: -150, mate: null }, { cp: 50, mate: null }),
    200
  );
  // Improving or maintaining eval => 0 loss
  assert.equal(
    computeCpLossForMove('w', { cp: 30, mate: null }, { cp: 70, mate: null }),
    0
  );
});

test('uciMoveToSan converts UCI engine suggestions into SAN in the given position', () => {
  const startFen = new Chess().fen();
  assert.equal(uciMoveToSan(startFen, 'g1f3'), 'Nf3');
  assert.equal(uciMoveToSan(startFen, 'e2e4'), 'e4');
  assert.equal(uciMoveToSan('4k3/P7/8/8/8/8/8/4K3 w - - 0 1', 'a7a8q'), 'a8=Q+');
});

test('analyzeGameWithEvaluator produces move classifications, accuracy, and eval series', async () => {
  const chess = new Chess();
  const moves: MoveRecord[] = [];
  for (const [from, to] of [
    ['f2', 'f3'],
    ['e7', 'e5'],
    ['g2', 'g4'],
    ['d8', 'h4'],
  ]) {
    const res = executeChessMove(chess, from, to);
    assert.ok(res);
    moves.push(res.record);
  }

  // Deterministic evaluator stub modeling Fool's Mate eval swing
  const evalMap = new Map<number, { cp: number | null; mate: number | null; bestMoveUci?: string }>([
    [0, { cp: 20, mate: null, bestMoveUci: 'e2e4' }],
    [1, { cp: -70, mate: null, bestMoveUci: 'e7e5' }],
    [2, { cp: -65, mate: null, bestMoveUci: 'e2e4' }],
    [3, { cp: null, mate: -1, bestMoveUci: 'd8h4' }],
  ]);

  let idx = 0;
  const progressCalls: [number, number][] = [];
  const report = await analyzeGameWithEvaluator(
    moves,
    async (_fen, _turn, depth) => {
      const entry = evalMap.get(idx++) || { cp: 0, mate: null };
      return { ...entry, depth };
    },
    {
      depth: 8,
      onProgress: (done, total) => progressCalls.push([done, total]),
    }
  );

  assert.equal(report.frames.length, 4);
  assert.equal(report.evalSeries.length, 5);
  assert.equal(report.frames[0].bestMoveSan, 'e4');
  assert.equal(report.frames[2].classification, 'blunder');
  assert.equal(report.counts.w.blunder >= 1, true);
  assert.equal(report.frames[3].classification, 'best');
  assert.equal(progressCalls[progressCalls.length - 1][0], 5);
  assert.equal(progressCalls[progressCalls.length - 1][1], 5);
  assert.ok(evalToWhiteCp(null, 1) > 1000);
  assert.ok(computeAccuracyFromFrames(report.frames, 'b') > computeAccuracyFromFrames(report.frames, 'w'));
});
