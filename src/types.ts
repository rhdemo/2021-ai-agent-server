export namespace MessageType {
  export enum Outgoing {
    Connection = 'connection',
    ShipPositions = 'ship-positions',
    Attack = 'attack'
  }

  export enum Incoming {
    AttackResult = 'attack-result',
    ServerError = 'server-error',
    BadMessageType = 'bad-message-type',
    BadPayload = 'invalid-payload',
    Heartbeat = 'heartbeat',
    Configuration = 'configuration'
  }
}

export enum ShipType {
  Carrier = 'Carrier',
  Battleship = 'Battleship',
  Destroyer = 'Destroyer',
  Submarine = 'Submarine'
}

export type CellPosition = [number, number];

export type ConfigMessagePayload = {
  game: {
    uuid: string;
    date: string;
    state: 'lobby' | 'active' | 'paused' | 'stopped';
  };
  opponent: {
    username: string;
    board: {
      // A ship will be in this object if it has been sunk
      [key in ShipType]?: {
        type: ShipType;
        origin: CellPosition;
        orientation: 'horizontal' | 'vertical';
        cells: {
          origin: CellPosition;
          hit: boolean;
        }[];
      };
    };
  };
  player: {
    uuid: string;
    username: string;
    match?: string;
    board?: {
      valid: boolean;
    };
    attacks: {
      ts: number;
      attack: {
        human: boolean;
        origin: CellPosition;
      };
      results: {
        origin: CellPosition;
        hit: boolean;
        destroyed?: boolean;
        type?: ShipType;
      }[];
    }[];
  };
  match: {
    uuid: string;
    ready: boolean;
    // Changes between the player and opponent UUIDs
    activePlayer: string;
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
