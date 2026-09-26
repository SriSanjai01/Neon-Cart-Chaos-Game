import type { TrackData } from '../game/track';

export interface RenderKart {
  x: number;
  y: number;
  angle: number;
  boost: number;
  invisible?: boolean;
}

export interface RenderProjectile {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: string;
}

export interface RenderMine {
  active: boolean;
  x: number;
  y: number;
  type: string;
}

export interface RenderItemBox {
  active: boolean;
}

export interface RenderPlayer {
  clientId: string;
  name: string;
  color: string;
  isBot?: boolean;
  connected: boolean;
}

export interface IRenderState {
  track: TrackData;
  players: RenderPlayer[];
  karts: Map<string, RenderKart>;
  projectiles: RenderProjectile[];
  mines: RenderMine[];
  itemBoxes: RenderItemBox[];
}
