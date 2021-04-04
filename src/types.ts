export namespace MessageType {
  export enum Outgoing {
    Connection = 'connection',
    ShipPositions = 'ship-positions',
    Attack = 'attack',
    Bonus = 'bonus'
  }

  export enum Incoming {
    AttackResult = 'attack-result',
    BonusResult = 'bonus-result',
    ServerError = 'server-error',
    BadMessageType = 'bad-message-type',
    BadPayload = 'invalid-payload',
    Heartbeat = 'heartbeat',
    Configuration = 'configuration',
    ScoreUpdate = 'score-update'
  }
}

export namespace AI {
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

  export type ProbabilityMatrix = [
    [number, number, number, number, number],
    [number, number, number, number, number],
    [number, number, number, number, number],
    [number, number, number, number, number],
    [number, number, number, number, number]
  ];

  export type PredictionResponse = {
    prob: ProbabilityMatrix;
    x: number;
    y: number;
  };
}

export type OutgoingAttack = {
  type: string;
  origin: CellPosition;
  prediction?: AI.PredictionResponse;
};

export enum ShipType {
  Carrier = 'Carrier',
  Battleship = 'Battleship',
  Destroyer = 'Destroyer',
  Submarine = 'Submarine'
}

export type CellPosition = [number, number];

export type ShipPositionData = {
  origin: CellPosition;
  orientation: 'horizontal' | 'vertical';
};

export type ShipsLayoutData = {
  [key in ShipType]: ShipPositionData;
};

export type ShipStateData = {
  // A ship will be in this object if it has been sunk
  [key in ShipType]: {
    type: ShipType;
    cells: {
      origin: CellPosition;
      hit: boolean;
    }[];
  } & ShipPositionData;
};

export type TurnState = {
  phase: MatchPhase;

  // The player whose UUID is set here is allowed to attack
  activePlayer: string;
  // If the bonus is set to a ship type then the client will
  // trigger a bonus round attack against that ship
  bonus?: ShipType;
};

export enum MatchPhase {
  NotReady = 'not-ready',
  Attack = 'attack',
  Bonus = 'bonus',
  Finished = 'finished'
}

export type ConfigMessagePayload = {
  game: {
    uuid: string;
    date: string;
    state: 'lobby' | 'active' | 'paused' | 'stopped';
  };
  opponent: {
    username: string;
    board: { valid: boolean; positions: ShipStateData };
  };
  player: {
    uuid: string;
    username: string;
    match?: string;
    board?: {
      valid: boolean;
      positions: ShipStateData;
    };
    attacks: {
      ts: number;
      attack: {
        human: boolean;
        origin: CellPosition;
      };
      result: {
        origin: CellPosition;
        hit: boolean;
        destroyed?: boolean;
        type?: ShipType;
      };
    }[];
  };
  match: {
    uuid: string;
    ready: boolean;
    // Changes between the player and opponent UUIDs
    state: TurnState;
    // Eventually gets set to the player or opponent UUID
    winner?: string;
  };
};

export type AttackMessagePayload = {
  // If type = AttackResult then attacker and result are defined
  attacker: string;
  result: {
    origin: CellPosition;
    hit: boolean;
    destroyed?: boolean;
    type?: ShipType;
  }[];
};

export interface IncomingMessageStruct<T> {
  type: MessageType.Incoming;
  data: unknown & T;
}
