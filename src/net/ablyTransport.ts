import Ably from 'ably';
import type { Transport, TransportMessage } from './transport';

export class AblyTransport implements Transport {
  private client: Ably.Realtime | null = null;
  private channel: Ably.RealtimeChannel | null = null;
  private globalChannel: Ably.RealtimeChannel | null = null;
  private messageCallback: ((msg: TransportMessage) => void) | null = null;
  private presenceCallback: ((event: 'enter' | 'leave', clientId: string) => void) | null = null;
  async connect(_isHost: boolean, clientId?: string): Promise<void> {
    
    // We use the Vercel serverless function to get an auth token
    this.client = new Ably.Realtime({
      authUrl: `/api/ably-token?clientId=${clientId || 'host_' + Math.random().toString(36).substring(2, 9)}`,
    });

    return new Promise((resolve, reject) => {
      this.client!.connection.once('connected', () => resolve());
      this.client!.connection.once('failed', (err) => reject(err));
    });
  }

  async joinRoom(roomId: string): Promise<void> {
    if (!this.client) throw new Error('Not connected');
    this.channel = this.client.channels.get(`room:${roomId}`);

    this.channel.subscribe((message) => {
      if (this.messageCallback) {
        this.messageCallback({
          type: message.name || '',
          data: message.data,
          clientId: message.clientId || '',
        });
      }
    });

    this.channel.presence.subscribe('enter', (member) => {
      if (this.presenceCallback) this.presenceCallback('enter', member.clientId);
    });

    this.channel.presence.subscribe('leave', (member) => {
      if (this.presenceCallback) this.presenceCallback('leave', member.clientId);
    });

    await this.channel.presence.enter();
  }

  async joinGlobalLobby(playerData: any, onPresenceUpdate: (players: any[]) => void): Promise<void> {
    if (!this.client) throw new Error('Not connected');
    this.globalChannel = this.client.channels.get('global-lobby');
    
    const updatePresence = async () => {
      const presenceSet = await this.globalChannel!.presence.get();
      const players = presenceSet.map(p => ({
        clientId: p.clientId,
        ...p.data
      }));
      onPresenceUpdate(players);
    };

    this.globalChannel.presence.subscribe('enter', updatePresence);
    this.globalChannel.presence.subscribe('leave', updatePresence);
    this.globalChannel.presence.subscribe('update', updatePresence);
    
    await this.globalChannel.presence.enter(playerData);
    await updatePresence();
  }

  send(type: string, data: any): void {
    if (!this.channel) return;
    this.channel.publish(type, data);
  }

  onMessage(callback: (msg: TransportMessage) => void): void {
    this.messageCallback = callback;
  }

  onPresence(callback: (event: 'enter' | 'leave', clientId: string) => void): void {
    this.presenceCallback = callback;
  }

  disconnect(): void {
    if (this.channel) {
      this.channel.presence.leave();
      this.channel.detach();
    }
    if (this.client) {
      this.client.close();
    }
  }

  getClientId(): string {
    return this.client?.auth.clientId || '';
  }
}
