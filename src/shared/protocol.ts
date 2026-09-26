// Shared types for Host and Controller

export type PlayerSlot = 0 | 1 | 2 | 3;

export const GameState = {
  MAIN_MENU: 'MAIN_MENU',
  LOBBY: 'LOBBY',
  TRACK_SELECT: 'TRACK_SELECT',
  COUNTDOWN: 'COUNTDOWN',
  RACING: 'RACING',
  RESULTS: 'RESULTS',
} as const;
export type GameState = typeof GameState[keyof typeof GameState];

// Messages from Controller -> Host
export interface MsgInput {
  t: 'in';      // type
  s: number;    // steering -1 to 1
  g: number;    // gas 0 to 1
  b: number;    // brake 0 to 1
  d: number;    // drift 0 or 1
  i: number;    // item used? (sequence number)
  seq: number;  // overall sequence number
}

export interface MsgJoin {
  t: 'join';
  name: string;
  color: string;
  kartStyle: string;
}

export interface MsgReady {
  t: 'ready';
  isReady: boolean;
}

// Messages from Host -> Controller
export interface MsgStateUpdate {
  t: 'state';
  state: GameState;
  slot?: PlayerSlot;
  players?: Array<{ slot: PlayerSlot; name: string; color: string; ready: boolean; isBot?: boolean }>;
  trackIndex?: number;
}

export interface MsgHudUpdate {
  t: 'hud';
  lap: number;
  pos: number;
  item: string | null;
  boost: number;
  entities?: {
    karts: { id: string; x: number; y: number; angle: number; boost: number; invisible?: boolean }[];
    projectiles: { active: boolean; x: number; y: number; vx: number; vy: number; type: string }[];
    mines: { active: boolean; x: number; y: number; type: string }[];
    itemBoxes: { active: boolean }[];
  };
}
