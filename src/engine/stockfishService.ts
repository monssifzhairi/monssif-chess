import { getDifficultyConfig } from '../chess/rules';
import type { AIDifficulty, EngineEval, PieceColor } from '../types/chess';

export interface BestMoveResponse {
  from: string;
  to: string;
  promotion?: 'q' | 'r' | 'b' | 'n';
  eval: EngineEval;
}

class StockfishEngineService {
  private worker: Worker | null = null;
  private ready = false;
  private initPromise: Promise<void> | null = null;
  private activeJobReject: ((err: Error) => void) | null = null;
  private queue: Promise<void> = Promise.resolve();
  private lastEval: EngineEval = { cp: 0, mate: null, depth: 0 };

  private ensureWorker(): Promise<void> {
    if (this.ready && this.worker) {
      return Promise.resolve();
    }
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = new Promise<void>((resolve, reject) => {
      try {
        const worker = new Worker('/engine/stockfish-19-lite-single.js');
        this.worker = worker;

        let uciOk = false;
        const timeout = window.setTimeout(() => {
          if (!this.ready) {
            reject(new Error('Stockfish engine initialization timed out.'));
            this.dispose();
          }
        }, 12000);

        const onInitMessage = (event: MessageEvent<string>) => {
          const line = typeof event.data === 'string' ? event.data.trim() : '';
          if (!line) return;
          if (line === 'uciok' && !uciOk) {
            uciOk = true;
            worker.postMessage('isready');
          } else if (line === 'readyok') {
            window.clearTimeout(timeout);
            worker.removeEventListener('message', onInitMessage);
            this.ready = true;
            resolve();
          }
        };

        worker.addEventListener('message', onInitMessage);
        worker.addEventListener('error', (err) => {
          window.clearTimeout(timeout);
          this.dispose();
          reject(new Error(err.message || 'Stockfish worker failed to load.'));
        });

        worker.postMessage('uci');
      } catch (err) {
        this.dispose();
        reject(err instanceof Error ? err : new Error('Failed to start Stockfish worker.'));
      }
    });

    return this.initPromise;
  }

  public async newGame(): Promise<void> {
    await this.ensureWorker();
    if (!this.worker) return;
    this.lastEval = { cp: 0, mate: null, depth: 0 };
    this.worker.postMessage('stop');
    this.worker.postMessage('ucinewgame');
    this.worker.postMessage('isready');
  }

  public stop(): void {
    if (this.worker) {
      this.worker.postMessage('stop');
    }
    if (this.activeJobReject) {
      this.activeJobReject(new Error('Search cancelled'));
      this.activeJobReject = null;
    }
  }

  public getLastEval(): EngineEval {
    return this.lastEval;
  }

  public requestBestMove(
    fen: string,
    difficulty: AIDifficulty,
    turn: PieceColor,
    onEvalUpdate?: (ev: EngineEval) => void
  ): Promise<BestMoveResponse> {
    const task = this.queue.then(() => this.runSearch(fen, difficulty, turn, onEvalUpdate));
    this.queue = task.then(
      () => undefined,
      () => undefined
    );
    return task;
  }

  public async evaluatePosition(
    fen: string,
    turn: PieceColor,
    depth = 10
  ): Promise<EngineEval> {
    const task = this.queue.then(async () => {
      await this.ensureWorker();
      const worker = this.worker;
      if (!worker) throw new Error('Engine unavailable');

      return new Promise<EngineEval>((resolve, reject) => {
        let currentEval: EngineEval = { cp: 0, mate: null, depth: 0 };
        const timeout = window.setTimeout(() => {
          cleanup();
          resolve(currentEval);
        }, 4500);

        const cleanup = () => {
          window.clearTimeout(timeout);
          worker.removeEventListener('message', onMessage);
          this.activeJobReject = null;
        };

        this.activeJobReject = (err) => {
          cleanup();
          reject(err);
        };

        const onMessage = (event: MessageEvent<string>) => {
          const line = typeof event.data === 'string' ? event.data.trim() : '';
          if (!line) return;

          if (line.startsWith('info ')) {
            const parsed = parseUciInfo(line, turn);
            if (parsed) {
              currentEval = parsed;
              this.lastEval = parsed;
            }
          } else if (line.startsWith('bestmove ')) {
            const bestMoveUci = line.split(/\s+/)[1];
            currentEval.bestMoveUci = bestMoveUci;
            cleanup();
            resolve(currentEval);
          }
        };

        worker.addEventListener('message', onMessage);
        worker.postMessage('setoption name UCI_LimitStrength value false');
        worker.postMessage('setoption name Skill Level value 20');
        worker.postMessage(`position fen ${fen}`);
        worker.postMessage(`go depth ${depth} movetime 450`);
      });
    });

    this.queue = task.then(
      () => undefined,
      () => undefined
    );
    return task;
  }

  private async runSearch(
    fen: string,
    difficulty: AIDifficulty,
    turn: PieceColor,
    onEvalUpdate?: (ev: EngineEval) => void
  ): Promise<BestMoveResponse> {
    await this.ensureWorker();
    const worker = this.worker;
    if (!worker) throw new Error('Stockfish worker not initialized');

    const profile = getDifficultyConfig(difficulty);

    return new Promise<BestMoveResponse>((resolve, reject) => {
      let currentEval: EngineEval = { ...this.lastEval };
      const timeout = window.setTimeout(() => {
        worker.postMessage('stop');
      }, profile.moveTimeMs + 3500);

      const cleanup = () => {
        window.clearTimeout(timeout);
        worker.removeEventListener('message', onMessage);
        this.activeJobReject = null;
      };

      this.activeJobReject = (err) => {
        cleanup();
        reject(err);
      };

      const onMessage = (event: MessageEvent<string>) => {
        const line = typeof event.data === 'string' ? event.data.trim() : '';
        if (!line) return;

        if (line.startsWith('info ')) {
          const parsed = parseUciInfo(line, turn);
          if (parsed) {
            currentEval = parsed;
            this.lastEval = parsed;
            onEvalUpdate?.(parsed);
          }
        } else if (line.startsWith('bestmove ')) {
          const parts = line.split(/\s+/);
          const uciMove = parts[1];
          cleanup();
          if (!uciMove || uciMove === '(none)') {
            reject(new Error('Stockfish returned no legal move.'));
            return;
          }
          const from = uciMove.slice(0, 2);
          const to = uciMove.slice(2, 4);
          const promoChar = uciMove.length >= 5 ? uciMove[4] : undefined;
          const promotion =
            promoChar === 'q' || promoChar === 'r' || promoChar === 'b' || promoChar === 'n'
              ? promoChar
              : undefined;

          currentEval.bestMoveUci = uciMove;
          resolve({
            from,
            to,
            promotion,
            eval: currentEval,
          });
        }
      };

      worker.addEventListener('message', onMessage);
      worker.postMessage(
        `setoption name UCI_LimitStrength value ${profile.limitStrength ? 'true' : 'false'}`
      );
      if (profile.limitStrength) {
        worker.postMessage(`setoption name UCI_Elo value ${profile.uciElo}`);
      }
      worker.postMessage(`setoption name Skill Level value ${profile.skillLevel}`);
      worker.postMessage(`position fen ${fen}`);
      worker.postMessage(`go depth ${profile.depth} movetime ${profile.moveTimeMs}`);
    });
  }

  public dispose(): void {
    if (this.activeJobReject) {
      this.activeJobReject(new Error('Engine disposed'));
      this.activeJobReject = null;
    }
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.ready = false;
    this.initPromise = null;
  }
}

function parseUciInfo(line: string, turn: PieceColor): EngineEval | null {
  const depthMatch = line.match(/\bdepth\s+(\d+)/);
  const cpMatch = line.match(/\bscore\s+cp\s+(-?\d+)/);
  const mateMatch = line.match(/\bscore\s+mate\s+(-?\d+)/);
  if (!cpMatch && !mateMatch) return null;

  const depth = depthMatch ? Number(depthMatch[1]) : 0;
  // UCI scores are from the side-to-move's perspective; normalize to White's perspective.
  const sign = turn === 'w' ? 1 : -1;

  if (mateMatch) {
    const mateVal = Number(mateMatch[1]) * sign;
    return { cp: null, mate: mateVal, depth };
  }

  const cpVal = cpMatch ? Number(cpMatch[1]) * sign : 0;
  return { cp: cpVal, mate: null, depth };
}

export const stockfishService = new StockfishEngineService();
