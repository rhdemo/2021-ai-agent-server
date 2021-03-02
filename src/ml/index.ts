import { AI_SERVER_URL } from '../config';
import log from '../log';
import { CellPosition, ShipType } from '../types';
import http from './http';

const PREDICTION_URL = new URL('/prediction', AI_SERVER_URL).toString();

export enum CellState {
  Hit = 2,
  Miss = 1,
  NotPlayed = -1
}

export type BoardState = [
  [CellState, CellState, CellState, CellState, CellState],
  [CellState, CellState, CellState, CellState, CellState],
  [CellState, CellState, CellState, CellState, CellState],
  [CellState, CellState, CellState, CellState, CellState],
  [CellState, CellState, CellState, CellState, CellState]
];

export type PredictionResponse = {
  prob: [
    [number, number, number, number, number],
    [number, number, number, number, number],
    [number, number, number, number, number],
    [number, number, number, number, number],
    [number, number, number, number, number]
  ];
  x: number;
  y: number;
};

export function generateInitialBoardState(): BoardState {
  return [
    [
      CellState.NotPlayed,
      CellState.NotPlayed,
      CellState.NotPlayed,
      CellState.NotPlayed,
      CellState.NotPlayed
    ],
    [
      CellState.NotPlayed,
      CellState.NotPlayed,
      CellState.NotPlayed,
      CellState.NotPlayed,
      CellState.NotPlayed
    ],
    [
      CellState.NotPlayed,
      CellState.NotPlayed,
      CellState.NotPlayed,
      CellState.NotPlayed,
      CellState.NotPlayed
    ],
    [
      CellState.NotPlayed,
      CellState.NotPlayed,
      CellState.NotPlayed,
      CellState.NotPlayed,
      CellState.NotPlayed
    ],
    [
      CellState.NotPlayed,
      CellState.NotPlayed,
      CellState.NotPlayed,
      CellState.NotPlayed,
      CellState.NotPlayed
    ]
  ];
}

export async function getNextMove(
  boardState: BoardState,
  destroyedShipsData: Array<{ type: ShipType; cells: CellPosition[] }>
): Promise<PredictionResponse> {
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
    return response.body as PredictionResponse;
  } catch (e) {
    throw e;
  }
}
