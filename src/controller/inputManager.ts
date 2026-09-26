import type { MsgInput } from '../shared/protocol';

export class InputManager {
  private inputState: MsgInput = {
    t: 'in',
    s: 0,
    g: 0,
    b: 0,
    d: 0,
    i: 0,
    seq: 0,
  };
  
  private onInputChanged: (input: MsgInput) => void;
  private itemUses = 0;
  private lastSendTime = 0;
  private sendTimeout: ReturnType<typeof setTimeout> | null = null;
  
  constructor(onInputChanged: (input: MsgInput) => void) {
    this.onInputChanged = onInputChanged;
  }

  setSteering(s: number) {
    s = Math.max(-1, Math.min(1, s));
    if (this.inputState.s !== s) {
      this.inputState.s = s;
      this.throttleSend();
    }
  }

  setGas(g: number) {
    if (this.inputState.g !== g) {
      this.inputState.g = g;
      this.checkAndSend();
    }
  }

  setBrake(b: number) {
    if (this.inputState.b !== b) {
      this.inputState.b = b;
      this.checkAndSend();
    }
  }

  setDrift(d: number) {
    if (this.inputState.d !== d) {
      this.inputState.d = d;
      this.checkAndSend();
    }
  }

  useItem() {
    this.itemUses++;
    this.inputState.i = this.itemUses;
    this.checkAndSend();
  }

  private checkAndSend() {
    this.inputState.seq++;
    this.lastSendTime = Date.now();
    this.onInputChanged({ ...this.inputState });
  }

  private throttleSend() {
    const now = Date.now();
    if (now - this.lastSendTime > 40) {
       if (this.sendTimeout) {
         clearTimeout(this.sendTimeout);
         this.sendTimeout = null;
       }
       this.checkAndSend();
    } else if (!this.sendTimeout) {
       this.sendTimeout = setTimeout(() => {
         this.sendTimeout = null;
         this.checkAndSend();
       }, 40 - (now - this.lastSendTime));
    }
  }

  // Called 2-5 times per second as keep-alive
  sendKeepAlive() {
    this.inputState.seq++;
    this.onInputChanged({ ...this.inputState });
  }
}
