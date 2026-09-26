export interface TransportMessage {
  type: string;
  data: any;
  clientId: string;
}

export interface Transport {
  connect(isHost: boolean, clientId?: string): Promise<void>;
  joinRoom(roomId: string): Promise<void>;
  send(type: string, data: any): void;
  onMessage(callback: (msg: TransportMessage) => void): void;
  onPresence(callback: (event: 'enter' | 'leave', clientId: string) => void): void;
  disconnect(): void;
  getClientId(): string;
}
