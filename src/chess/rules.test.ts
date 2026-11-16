import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import {
  applyClockIncrement,
  computeMaterialState,
  evaluateGameOver,
  executeChessMove,
  formatClockMs,
  formatEvalDisplay,
  getDifficultyConfig,
  getKingInCheckSquare,
  getLegalTargets,
  getOrderedSquares,
  isDarkSquare,
  isPromotionMove,
  pairMoveHistory,
} from './rules';

test('square ordering and square colors match standard chessboard geometry', () => {
  const whiteView = getOrderedSquares(false);
  assert.equal(whiteView.length, 64);
  assert.equal(whiteView[0], 'a8');
  assert.equal(whiteView[7], 'h8');
  assert.equal(whiteView[56], 'a1');
  assert.equal(whiteView[63], 'h1');

  const blackView = getOrderedSquares(true);
  assert.equal(blackView[0], 'h1');
  assert.equal(blackView[63], 'a8');

  assert.equal(isDarkSquare('a1'), true);
  assert.equal(isDarkSquare('h1'), false);
  assert.equal(isDarkSquare('a8'), false);
  assert.equal(isDarkSquare('h8'), true);
  assert.equal(isDarkSquare('e4'), false);
  assert.equal(isDarkSquare('d4'), true);
});

test('legal moves, castling, en passant, and pawn promotion work accurately', () => {
  // Castling kingside and queenside
  const castleFen = 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1';
  const kingTargets = getLegalTargets(castleFen, 'e1').map((t) => t.to);
  assert.ok(kingTargets.includes('g1'));
  assert.ok(kingTargets.includes('c1'));

  const chessCastle = new Chess(castleFen);
  const castled = executeChessMove(chessCastle, 'e1', 'g1');
  assert.ok(castled);
  assert.equal(castled.record.san, 'O-O');

  // En passant
  const epChess = new Chess('rnbqkbnr/ppp1pppp/8/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 2');
  const epTargets = getLegalTargets(epChess.fen(), 'e5');
  const d6Target = epTargets.find((t) => t.to === 'd6');
  assert.ok(d6Target);
  assert.equal(d6Target.isCapture, true);
  const epMove = executeChessMove(epChess, 'e5', 'd6');
  assert.ok(epMove);
  assert.equal(epMove.record.san, 'exd6');

  // Promotion
  const promoFen = '4k3/P7/8/8/8/8/8/4K3 w - - 0 1';
  assert.equal(isPromotionMove(promoFen, 'a7', 'a8'), true);
  const promoChess = new Chess(promoFen);
  const promoMove = executeChessMove(promoChess, 'a7', 'a8', 'q');
  assert.ok(promoMove);
  assert.equal(promoMove.record.san, 'a8=Q+');
  assert.equal(getKingInCheckSquare(promoMove.fen), 'e8');
});

test('checkmate and stalemate detection', () => {
  // Scholar's mate
  const chess = new Chess();
  executeChessMove(chess, 'e2', 'e4');
  executeChessMove(chess, 'e7', 'e5');
  executeChessMove(chess, 'd1', 'h5');
  executeChessMove(chess, 'b8', 'c6');
  executeChessMove(chess, 'f1', 'c4');
  executeChessMove(chess, 'g8', 'f6');
  executeChessMove(chess, 'h5', 'f7');

  const mateResult = evaluateGameOver(chess);
  assert.equal(mateResult.isOver, true);
  assert.equal(mateResult.winner, 'w');
  assert.equal(mateResult.termination, 'checkmate');
  assert.equal(getKingInCheckSquare(chess.fen()), 'e8');

  // Stalemate: Black king on h8, White queen on g6, White king on f7
  const stalemateChess = new Chess('7k/5K2/6Q1/8/8/8/8/8 b - - 0 1');
  const stalemateResult = evaluateGameOver(stalemateChess);
  assert.equal(stalemateResult.isOver, true);
  assert.equal(stalemateResult.winner, 'draw');
  assert.equal(stalemateResult.termination, 'stalemate');
});

test('captured pieces, material advantage, and move pairing', () => {
  // Missing Black Queen and Black Pawn -> White captured q, p (+10)
  const fen = 'rnb1kbnr/pppp1ppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const mat = computeMaterialState(fen);
  assert.deepEqual(mat.capturedByWhite, ['q', 'p']);
  assert.deepEqual(mat.capturedByBlack, []);
  assert.equal(mat.whiteAdvantage, 10);

  const chess = new Chess();
  const r1 = executeChessMove(chess, 'e2', 'e4')!;
  const r2 = executeChessMove(chess, 'e7', 'e5')!;
  const r3 = executeChessMove(chess, 'g1', 'f3')!;
  const pairs = pairMoveHistory([r1.record, r2.record, r3.record]);
  assert.equal(pairs.length, 2);
  assert.equal(pairs[0].moveNumber, 1);
  assert.equal(pairs[0].white?.san, 'e4');
  assert.equal(pairs[0].black?.san, 'e5');
  assert.equal(pairs[1].moveNumber, 2);
  assert.equal(pairs[1].white?.san, 'Nf3');
  assert.equal(pairs[1].black, undefined);
});

test('clock formatting, evaluation formatting, and distinct difficulty tiers', () => {
  assert.equal(formatClockMs(600_000), '10:00');
  assert.equal(formatClockMs(30_000), '00:30');
  assert.equal(formatClockMs(12_400), '00:12.4');
  assert.equal(formatClockMs(0), '00:00');

  assert.equal(formatEvalDisplay(142, null), '+1.4');
  assert.equal(formatEvalDisplay(-86, null), '-0.9');
  assert.equal(formatEvalDisplay(null, 3), '+M3');
  assert.equal(formatEvalDisplay(null, -2), '-M2');

  const easy = getDifficultyConfig('easy');
  const med = getDifficultyConfig('medium');
  const hard = getDifficultyConfig('hard');
  const expert = getDifficultyConfig('expert');
  assert.ok(easy.skillLevel < med.skillLevel);
  assert.ok(med.skillLevel < hard.skillLevel);
  assert.ok(hard.skillLevel < expert.skillLevel);
  assert.ok(easy.depth < med.depth);
  assert.ok(med.depth < hard.depth);
  assert.ok(hard.depth < expert.depth);
  assert.equal(expert.limitStrength, false);
});

test('both White and Black receive time increment on every move including White move 1', () => {
  // 3+2 Blitz: 180_000ms start, 2_000ms increment
  const initial = { w: 180_000, b: 180_000 };
  const afterWhiteMove1 = applyClockIncrement(initial, 'w', 2_000, false);
  assert.equal(afterWhiteMove1.w, 182_000);
  assert.equal(afterWhiteMove1.b, 180_000);

  const afterBlackMove1 = applyClockIncrement(afterWhiteMove1, 'b', 2_000, false);
  assert.equal(afterBlackMove1.w, 182_000);
  assert.equal(afterBlackMove1.b, 182_000);

  const untimed = applyClockIncrement({ w: 0, b: 0 }, 'w', 2_000, true);
  assert.equal(untimed.w, 0);
  assert.equal(untimed.b, 0);
});
