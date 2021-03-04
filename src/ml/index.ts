import { AI_SERVER_URL } from '../config';
import log from '../log';
import { AI, ShipType, CellPosition } from '../types';
import http from './http';

const PREDICTION_URL = new URL('/prediction', AI_SERVER_URL).toString();

export function generateInitialBoardState(): AI.BoardState {
  return [
    [
      AI.CellState.NotPlayed,
      AI.CellState.NotPlayed,
      AI.CellState.NotPlayed,
      AI.CellState.NotPlayed,
      AI.CellState.NotPlayed
    ],
    [
      AI.CellState.NotPlayed,
      AI.CellState.NotPlayed,
      AI.CellState.NotPlayed,
      AI.CellState.NotPlayed,
      AI.CellState.NotPlayed
    ],
    [
      AI.CellState.NotPlayed,
      AI.CellState.NotPlayed,
      AI.CellState.NotPlayed,
      AI.CellState.NotPlayed,
      AI.CellState.NotPlayed
    ],
    [
      AI.CellState.NotPlayed,
      AI.CellState.NotPlayed,
      AI.CellState.NotPlayed,
      AI.CellState.NotPlayed,
      AI.CellState.NotPlayed
    ],
    [
      AI.CellState.NotPlayed,
      AI.CellState.NotPlayed,
      AI.CellState.NotPlayed,
      AI.CellState.NotPlayed,
      AI.CellState.NotPlayed
    ]
  ];
}

export async function getNextMove(
  boardState: AI.BoardState,
  destroyedShipsData: Array<{ type: ShipType; cells: CellPosition[] }>
): Promise<AI.PredictionResponse | undefined> {
  try {
    const json = {
      board_state: boardState,
      ship_types: destroyedShipsData
    };

    log.trace(`POST request to AI service at ${PREDICTION_URL}: %j`, json);

    const response = await http(PREDICTION_URL, {
      method: 'POST',
      responseType: 'json',
      json
    });

    log.trace(
      `HTTP ${response.statusCode} response, and body: %j`,
      response.body
    );

    // TODO: validation and better error handling
    return response.body as AI.PredictionResponse;
  } catch (e) {
    log.error('failed to obtain prediction for move service:');
    log.error(e);
  }
}
