import { AblyTransport } from '../net/ablyTransport';
import { HostState } from './hostState';
import { GameState } from '../shared/protocol';
import { PLAYER_COLORS } from '../shared/constants';
import { GameEngine } from '../game/engine';
import { Renderer } from '../render/renderer';
import { AudioEngine } from '../audio/audioEngine';
import { TRACKS } from '../game/track';
import QRCode from 'qrcode';
import '../style.css';

const transport = new AblyTransport();
const state = new HostState();
const audio = new AudioEngine();

async function init() {
  const app = document.getElementById('app');
  if (!app) return;

  renderMainMenu(app);
}

function renderMainMenu(app: HTMLElement) {
  state.state = GameState.MAIN_MENU;
  app.innerHTML = `
    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%;">
      <h1 class="neon-text-blue" style="font-size: 5rem; margin-bottom: 0;">NEON KART</h1>
      <h1 class="neon-text-blue" style="font-size: 5rem; margin-top: -1rem;">CHAOS</h1>
      <p style="font-size: 1.5rem; margin-bottom: 3rem;">A wild local-multiplayer kart racer</p>
      
      <div class="glass-panel" style="padding: 2rem; display: flex; flex-direction: column; align-items: center; width: 600px;">
        <h2>Create a Room</h2>
        <div style="display: flex; gap: 1rem; margin-top: 1rem;">
          <button id="btn-2p" class="glass-btn" style="padding: 1rem 2rem; font-size: 1.5rem;">2 Players</button>
          <button id="btn-3p" class="glass-btn" style="padding: 1rem 2rem; font-size: 1.5rem;">3 Players</button>
          <button id="btn-4p" class="glass-btn" style="padding: 1rem 2rem; font-size: 1.5rem;">4 Players</button>
        </div>
      </div>
      
      <button id="btn-dashboard" class="glass-btn" style="margin-top: 3rem; padding: 0.5rem 1rem; font-size: 1rem; background: rgba(255,255,255,0.1);">📊 View Live Dashboard</button>
    </div>
    <style>
      .btn {
        background: #3b82f6; color: white; border: none; padding: 1rem 2rem;
        font-size: 1.2rem; font-family: inherit; border-radius: 0.5rem;
        cursor: pointer; font-weight: bold; transition: all 0.2s;
      }
      .btn:hover { background: #2563eb; transform: scale(1.05); }
    </style>
  `;

  document.getElementById('btn-2p')?.addEventListener('click', () => startLobby(2, app));
  document.getElementById('btn-3p')?.addEventListener('click', () => startLobby(3, app));
  document.getElementById('btn-4p')?.addEventListener('click', () => startLobby(4, app));
  
  document.getElementById('btn-dashboard')?.addEventListener('click', () => {
      window.open('/play/#dashboard', '_blank');
  });
}

async function startLobby(maxPlayers: number, app: HTMLElement) {
  state.maxPlayers = maxPlayers;
  state.generateRoomId();
  state.state = GameState.LOBBY;
  
  app.innerHTML = `<h2>Connecting...</h2>`;

  try {
    await transport.connect(true);
    await transport.joinRoom(state.roomId);
    
    // Log host joining for the private dashboard
    fetch('/api/log-player', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Host (Creator)', room: state.roomId, role: 'Host', clientId: transport.getClientId() })
    }).catch(console.error);

    await transport.joinGlobalLobby({
      name: 'Host',
      role: 'Host',
      room: state.roomId,
      device: 'Desktop'
    }, () => {});
    
    setupTransportListeners(app);
    renderLobby(app);
  } catch (e) {
    app.innerHTML = `<h2>Connection failed. Please refresh.</h2>`;
    console.error(e);
  }
}

function setupTransportListeners(app: HTMLElement) {
  transport.onPresence((event, clientId) => {
    if (event === 'leave') {
      state.removePlayer(clientId);
      if (state.state === GameState.LOBBY) renderLobby(app);
    }
  });

  transport.onMessage((msg) => {
    if (msg.type === 'join') {
      const takenColors = state.players.map(p => p.color);
      if (takenColors.includes(msg.data.color)) {
         msg.data.color = PLAYER_COLORS.find(c => !takenColors.includes(c)) || PLAYER_COLORS[0];
      }
      state.addPlayer(msg.clientId, msg.data);
      broadcastState();
      if (state.state === GameState.LOBBY) renderLobby(app);
    } else if (msg.type === 'changeColor') {
      const p = state.players.find(p => p.clientId === msg.clientId);
      if (p) {
         const takenColors = state.players.map(p => p.color);
         if (!takenColors.includes(msg.data.color) && PLAYER_COLORS.includes(msg.data.color)) {
            p.color = msg.data.color;
            broadcastState();
            if (state.state === GameState.LOBBY) renderLobby(app);
         }
      }
    } else if (msg.type === 'ready') {
      state.setPlayerReady(msg.clientId, msg.data.isReady);
      broadcastState();
      if (state.state === GameState.LOBBY) renderLobby(app);
    } else if (msg.type === 'in') {
      const p = state.players.find(p => p.clientId === msg.clientId);
      if (p) {
        p.lastInput = msg.data;
        updateDebugOverlay();
      }
    }
  });
}

function broadcastState() {
  transport.send('state', {
    state: state.state,
    players: state.players.map(p => ({
      slot: p.slot,
      name: p.name,
      color: p.color,
      ready: p.ready,
      isBot: p.isBot
    })),
    trackIndex: TRACKS.indexOf(state.track)
  });
}

async function renderLobby(app: HTMLElement) {
  // Generate QR
  const joinUrl = `${window.location.origin}/play/?room=${state.roomId}&remote=true`;
  const qrDataUrl = await QRCode.toDataURL(joinUrl, { width: 250, margin: 2, color: { dark: '#000', light: '#fff' } });

  let slotsHtml = '';
  for (const slot of [0,1,2,3]) {
    if (slot < state.maxPlayers) {
       const p = state.players.find(x => x.slot === slot);
       if (p) {
         slotsHtml += `<div class="glass-panel" style="padding: 1rem; flex: 1; text-align: center;">
            <div style="width: 20px; height: 20px; border-radius: 50%; background: ${p.color}; margin: 0 auto 0.5rem;"></div>
            <h3>${p.name}</h3>
            <div>${p.ready ? '✅ Ready' : '⏳ Waiting...'}</div>
         </div>`;
       } else {
         slotsHtml += `<div class="glass-panel" style="padding: 1rem; flex: 1; text-align: center; opacity: 0.5;">
            <h3>Waiting for Player ${slot + 1}...</h3>
         </div>`;
       }
    }
  }

  const allReady = state.canStartRace();

  app.innerHTML = `
    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; width: 100%;">
      <div style="display: flex; gap: 2rem; width: 80%; max-width: 1000px; align-items: center;">
        
        <!-- Left: QR Code -->
        <div class="glass-panel" style="padding: 2rem; display: flex; flex-direction: column; align-items: center;">
          <h2>Join with Phone Gamepad</h2>
          <img src="${qrDataUrl}" alt="QR Code" style="border-radius: 1rem; margin-top: 1rem;" />
          <h2 style="margin-top: 1rem;">Code: <span class="neon-text-blue">${state.roomId}</span></h2>
        </div>
        
        <!-- Right: Player Slots -->
        <div style="flex: 1; display: flex; flex-direction: column; gap: 1rem;">
          ${slotsHtml}
        </div>
      </div>
      
      <button id="btn-start" class="glass-btn" style="margin-top: 3rem; padding: 1.5rem 4rem; font-size: 2rem; background: rgba(34, 197, 94, 0.2);" ${!allReady ? 'disabled' : ''}>
        ${allReady ? 'START RACE' : 'Waiting for everyone to be ready...'}
      </button>
    </div>
  `;

  document.getElementById('btn-start')?.addEventListener('click', () => {
    if (allReady) {
      audio.init();
      
      // Auto-fill remaining slots with bots
      let botCount = 1;
      while (state.players.length < state.maxPlayers) {
         state.players.push({
           slot: state.players.length as any,
           clientId: 'bot_' + botCount,
           name: 'Bot ' + botCount,
           color: PLAYER_COLORS[state.players.length % PLAYER_COLORS.length],
           kartStyle: 'Classic',
           ready: true,
           connected: true,
           isBot: true
         });
         botCount++;
      }

      state.state = GameState.COUNTDOWN; 
      state.track = TRACKS[Math.floor(Math.random() * TRACKS.length)];
      broadcastState();
      
      app.innerHTML = `
        <div style="position: absolute; top:0; left:0; right:0; bottom:0; display:flex; justify-content:center; align-items:center; z-index: 10;">
          <h1 id="countdown-text" style="font-size: 15rem; font-weight: bold; text-shadow: 0 0 50px #fff;">3</h1>
        </div>
        <canvas id="game-canvas"></canvas>
      `;
      
      const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
      const engine = new GameEngine(state, audio);
      const getRenderState = () => ({
        track: state.track,
        players: state.players,
        karts: engine.karts,
        projectiles: engine.projectiles,
        mines: engine.mines,
        itemBoxes: engine.activeItemBoxes
      });
      const renderer = new Renderer(canvas, getRenderState());
      
      engine.onRender = () => {
        renderer.render();
      };
      
      engine.start();
      
      // Countdown Sequence
      let count = 3;
      audio.playCountdown();
      const countInterval = setInterval(() => {
        count--;
        const el = document.getElementById('countdown-text');
        if (el) {
          if (count > 0) {
            el.innerText = count.toString();
            audio.playCountdown();
          } else if (count === 0) {
            el.innerText = 'GO!';
            el.style.color = '#22c55e';
            audio.playGo();
            state.state = GameState.RACING;
            engine.raceManager.startRace();
            broadcastState();
          } else {
            el.remove();
            clearInterval(countInterval);
          }
        }
      }, 1000);

      // Broadcast HUD at 10Hz
      setInterval(() => {
        if (state.state === GameState.RACING) {
           let allFinished = true;
           for (const p of state.players) {
             const prog = engine.raceManager.progress.get(p.clientId);
             const kart = engine.karts.get(p.clientId);
             if (prog && kart) {
               transport.send('hud', {
                 lap: prog.lap,
                 pos: prog.racePosition,
                 item: kart.heldItem,
                 boost: kart.boost,
                 entities: {
                   karts: Array.from(engine.karts.entries()).map(([id, k]) => ({ id, x: k.x, y: k.y, angle: k.angle, boost: k.boost, invisible: k.invisible })),
                   projectiles: engine.projectiles.map(p => ({ active: p.active, x: p.x, y: p.y, vx: p.vx, vy: p.vy, type: p.type })),
                   mines: engine.mines.map(m => ({ active: m.active, x: m.x, y: m.y, type: m.type })),
                   itemBoxes: engine.activeItemBoxes.map(ib => ({ active: ib.active }))
                 },
                 clientId: p.clientId
               });
               if (!prog.finished) allFinished = false;
             }
           }
           
           if (allFinished && state.players.length > 0) {
              state.state = GameState.RESULTS;
              broadcastState();
              showResults(engine);
           }
        }
      }, 100);
    }
  });
}

function showResults(engine: GameEngine) {
  const app = document.getElementById('app');
  if (!app) return;
  
  engine.stop();
  
  let resHtml = '';
  const rankings = Array.from(engine.raceManager.progress.entries())
    .sort((a, b) => a[1].racePosition - b[1].racePosition);
    
  rankings.forEach(([clientId, prog]) => {
     const p = state.players.find(p => p.clientId === clientId);
     if (p) {
       resHtml += `
         <div style="display: flex; justify-content: space-between; align-items: center; font-size: 1.5rem;">
           <div style="display: flex; align-items: center; gap: 1rem;">
             <span style="font-weight: bold; color: ${p.color};">#${prog.racePosition}</span>
             <span>${p.name}</span>
           </div>
           <span>${prog.finishTime ? (prog.finishTime / 1000).toFixed(2) + 's' : 'DNF'}</span>
         </div>
       `;
     }
  });

  app.innerHTML = `
    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; width: 100%; background: #0f172a;">
      <h1 class="neon-text-blue" style="font-size: 6rem; margin-bottom: 2rem;">RACE FINISHED!</h1>
      <div class="glass-panel" style="padding: 2rem; min-width: 400px; display: flex; flex-direction: column; gap: 1rem;">
        ${resHtml}
      </div>
      <button onclick="location.reload()" class="glass-btn" style="margin-top: 3rem; font-size: 1.5rem; padding: 1rem 2rem;">
        NEW RACE
      </button>
    </div>
  `;
}

// --- Debug Overlay ---
let debugEnabled = false;
const debugEl = document.createElement('div');
debugEl.style.cssText = 'position: absolute; top: 0; left: 0; background: rgba(0,0,0,0.8); color: #0f0; font-family: monospace; padding: 1rem; display: none; z-index: 1000; pointer-events: none;';
document.body.appendChild(debugEl);

window.addEventListener('keydown', (e) => {
  if (e.key === '\`') {
    debugEnabled = !debugEnabled;
    debugEl.style.display = debugEnabled ? 'block' : 'none';
    updateDebugOverlay();
  }
});

function updateDebugOverlay() {
  if (!debugEnabled) return;
  let html = '<h3>Debug Overlay (Press \` to toggle)</h3>';
  html += `State: ${state.state}<br>`;
  html += `Players: ${state.players.length}<br><br>`;
  
  state.players.forEach(p => {
    html += `<strong style="color:${p.color}">Slot ${p.slot}: ${p.name}</strong> (${p.connected ? 'Online' : 'Offline'})<br>`;
    if (p.lastInput) {
      const i = p.lastInput;
      html += `  In: seq=${i.seq} S=${i.s.toFixed(2)} G=${i.g} B=${i.b} D=${i.d} I=${i.i}<br>`;
    }
  });
  
  debugEl.innerHTML = html;
}

init();
