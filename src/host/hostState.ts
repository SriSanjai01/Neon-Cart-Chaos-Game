import { GameState } from '../shared/protocol';
import type { PlayerSlot, MsgJoin, MsgInput } from '../shared/protocol';

export interface PlayerInfo {
  slot: PlayerSlot;
  clientId: string;
  name: string;
  color: string;
  kartStyle: string;
  ready: boolean;
  connected: boolean;
  isBot?: boolean;
  lastInput?: MsgInput;
}
import { TestTrack } from '../game/track';
import type { TrackData } from '../game/track';

export class HostState {
  state: GameState = GameState.MAIN_MENU;
  roomId: string = '';
  players: PlayerInfo[] = [];
  maxPlayers: number = 4;
  track: TrackData = TestTrack;

  generateRoomId(): string {
    this.roomId = Math.floor(100000 + Math.random() * 900000).toString();
    return this.roomId;
  }

  addPlayer(clientId: string, joinInfo: MsgJoin): PlayerInfo | null {
    if (this.players.length >= this.maxPlayers) return null;
    
    // Check if player already exists (reconnect)
    const existing = this.players.find(p => p.clientId === clientId);
    if (existing) {
      existing.connected = true;
      existing.name = joinInfo.name;
      existing.color = joinInfo.color;
      existing.kartStyle = joinInfo.kartStyle;
      return existing;
    }

    const slot = this.players.length as PlayerSlot;
    const newPlayer: PlayerInfo = {
      slot,
      clientId,
      name: joinInfo.name,
      color: joinInfo.color,
      kartStyle: joinInfo.kartStyle,
      ready: false,
      connected: true,
    };
    
    this.players.push(newPlayer);
    return newPlayer;
  }

  removePlayer(clientId: string) {
    const player = this.players.find(p => p.clientId === clientId);
    if (player) {
      player.connected = false;
      player.ready = false;
    }
  }

  setPlayerReady(clientId: string, isReady: boolean) {
    const player = this.players.find(p => p.clientId === clientId);
    if (player) {
      player.ready = isReady;
    }
  }

  canStartRace(): boolean {
    const connectedPlayers = this.players.filter(p => p.connected && !p.isBot);
    if (connectedPlayers.length < 1) return false;
    return connectedPlayers.every(p => p.ready);
  }
}
