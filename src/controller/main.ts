import { AblyTransport } from '../net/ablyTransport';
import { GameState } from '../shared/protocol';
import { PLAYER_COLORS } from '../shared/constants';
import { InputManager } from './inputManager';
import { Renderer } from '../render/renderer';
import { TRACKS } from '../game/track';

import '../style.css';

const transport = new AblyTransport();
let isReady = false;

let isRemote = false;

let inputManager: InputManager | null = null;
let lastKnownState: any = null;
let clientRenderState: any = null;

async function init() {
  const app = document.getElementById('app');
  if (!app) return;

  const urlParams = new URLSearchParams(window.location.search);
  const roomCode = urlParams.get('room');
  const isRemoteUrl = urlParams.get('remote') === 'true';

  if (window.location.hash === '#dashboard') {
    renderDashboard(app);
    return;
  }

  if (roomCode) {
    if (isRemoteUrl) {
      isRemote = true;
      renderMobileJoinForm(app, roomCode);
    } else {
      renderJoinForm(app, roomCode);
    }
  } else {
    renderRoomInput(app);
  }
}

async function performJoin(app: HTMLElement, roomCode: string, name: string) {
  app.innerHTML = `<h2>Connecting...</h2>`;
  try {
    await transport.connect(false);
    await transport.joinRoom(roomCode);
    
    // Log player joining for the private dashboard
    fetch('/api/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'log', name: name, room: roomCode, role: isRemote ? 'Mobile Gamepad' : 'Online Player', clientId: transport.getClientId() })
    });
    transport.joinGlobalLobby({
      name,
      role: 'Player',
      room: roomCode,
      device: isRemote ? 'Mobile Gamepad' : 'Web Client'
    }, () => {});

    transport.send('join', {
      name,
      color: PLAYER_COLORS[Math.floor(Math.random() * PLAYER_COLORS.length)],
      kartStyle: 'Classic'
    });
    
    if (isRemote) {
        isReady = true;
        transport.send('ready', { isReady: true });
    }
    
    setupTransportListeners(app);
    renderLobby(app);
  } catch (e) {
    app.innerHTML = `<h2>Failed to join.</h2><button onclick="location.reload()">Retry</button>`;
  }
}

function renderRoomInput(app: HTMLElement) {
  app.innerHTML = `
    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; padding: 2rem;">
      <div class="glass-panel" style="padding: 2rem; display: flex; flex-direction: column; align-items: center;">
        <h1 class="neon-text-pink" style="font-size: 2.5rem; text-align: center; margin-top: 0;">Enter Room Code</h1>
        <input type="text" id="room-input" style="font-size: 3rem; text-align: center; width: 200px; padding: 1rem; border-radius: 1rem; border: none; outline: none; margin-bottom: 2rem; text-transform: uppercase; background: rgba(255,255,255,0.9); color: #000;" maxlength="6" />
        <button id="btn-next" class="glass-btn" style="font-size: 2rem; padding: 1rem 3rem;">NEXT</button>
      </div>
    </div>
  `;

  document.getElementById('btn-next')?.addEventListener('click', () => {
    const code = (document.getElementById('room-input') as HTMLInputElement).value;
    if (code.length === 6) {
      renderJoinForm(app, code);
    }
  });
}

function renderJoinForm(app: HTMLElement, roomCode: string) {
  app.innerHTML = `
    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; padding: 2rem; box-sizing: border-box;">
      <div class="glass-panel" style="padding: 2rem; display: flex; flex-direction: column; align-items: center; width: 90%; max-width: 400px;">
        <h2 class="neon-text-blue" style="margin-top: 0; font-size: 2rem;">Room: ${roomCode}</h2>
        <input type="text" id="name-input" placeholder="Your Name" style="font-size: 2rem; text-align: center; width: 100%; padding: 1rem; border-radius: 1rem; border: none; outline: none; margin-bottom: 1rem; background: rgba(255,255,255,0.9); color: #000; box-sizing: border-box;" maxlength="12" />
        


        <div style="margin-bottom: 2rem; width: 100%;">
          <p style="font-size: 1.2rem; text-align: center; margin-bottom: 0.5rem;">How are you playing?</p>
          <div style="display: flex; gap: 0.5rem;">
            <button id="btn-local" class="glass-btn" style="flex: 1; padding: 0.5rem; background: rgba(59, 130, 246, 0.4); border: 2px solid #3b82f6;">Local (Same Room)</button>
            <button id="btn-remote" class="glass-btn" style="flex: 1; padding: 0.5rem; background: rgba(255, 255, 255, 0.1); border: 2px solid transparent;">Remote (Gamepad)</button>
          </div>
        </div>

        <button id="btn-join" class="glass-btn" style="font-size: 2rem; padding: 1rem 3rem; background: rgba(34, 197, 94, 0.4); width: 100%;">JOIN</button>
      </div>
    </div>
  `;



  const btnLocal = document.getElementById('btn-local');
  const btnRemote = document.getElementById('btn-remote');

  if (btnLocal && btnRemote) {
    btnLocal.addEventListener('click', () => {
      isRemote = false;
      btnLocal.style.background = 'rgba(59, 130, 246, 0.4)';
      btnLocal.style.border = '2px solid #3b82f6';
      btnRemote.style.background = 'rgba(255, 255, 255, 0.1)';
      btnRemote.style.border = '2px solid transparent';
    });

    btnRemote.addEventListener('click', () => {
      isRemote = true;
      btnRemote.style.background = 'rgba(168, 85, 247, 0.4)';
      btnRemote.style.border = '2px solid #a855f7';
      btnLocal.style.background = 'rgba(255, 255, 255, 0.1)';
      btnLocal.style.border = '2px solid transparent';
    });
  }

  document.getElementById('btn-join')?.addEventListener('click', async () => {
    const name = (document.getElementById('name-input') as HTMLInputElement).value || 'Racer';
    localStorage.setItem('neon_racer_name', name);
    await performJoin(app, roomCode, name);
  });
}

function renderMobileJoinForm(app: HTMLElement, roomCode: string) {
  const savedName = localStorage.getItem('neon_racer_name') || '';
  app.innerHTML = `
    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; padding: 2rem; box-sizing: border-box;">
      <div class="glass-panel" style="padding: 2rem; display: flex; flex-direction: column; align-items: center; width: 90%; max-width: 400px;">
        <h1 class="neon-text-blue" style="margin-top: 0; font-size: 2.5rem; text-align: center;">Gamepad Mode</h1>
        <p style="font-size: 1.2rem; margin-bottom: 2rem;">Room: ${roomCode}</p>
        
        <input type="text" id="mobile-name-input" placeholder="Your Name" value="${savedName}" style="font-size: 2rem; text-align: center; width: 100%; padding: 1rem; border-radius: 1rem; border: none; outline: none; margin-bottom: 2rem; background: rgba(255,255,255,0.9); color: #000; box-sizing: border-box;" maxlength="12" />
        
        <button id="btn-mobile-join" class="glass-btn" style="font-size: 2rem; padding: 1rem 3rem; background: rgba(34, 197, 94, 0.4); width: 100%;">JOIN</button>
      </div>
    </div>
  `;

  document.getElementById('btn-mobile-join')?.addEventListener('click', async () => {
    const name = (document.getElementById('mobile-name-input') as HTMLInputElement).value || 'Racer';
    localStorage.setItem('neon_racer_name', name);
    await performJoin(app, roomCode, name);
  });
}

function setupTransportListeners(app: HTMLElement) {
  transport.onMessage((msg) => {
    if (msg.type === 'state') {
      const stateData = msg.data;
      if (stateData.state === GameState.COUNTDOWN || stateData.state === GameState.RACING) {
         lastKnownState = stateData;
         if (!document.getElementById('hud-lap')) {
             renderController(app);
         }
      } else if (stateData.state === GameState.LOBBY) {
         lastKnownState = stateData;
         renderLobby(app, stateData);
      }
    } else if (msg.type === 'hud') {
      if (msg.data.clientId === transport.getClientId() || !msg.data.clientId /* fallback for simple test */) {
         const lapEl = document.getElementById('hud-lap');
         const posEl = document.getElementById('hud-pos');
         const itemBtn = document.getElementById('btn-item');
         if (lapEl) lapEl.innerText = `LAP ${msg.data.lap} / 3`;
         if (posEl) {
             const p = msg.data.pos;
             posEl.innerText = p === 1 ? '1st' : p === 2 ? '2nd' : p === 3 ? '3rd' : p + 'th';
         }
         if (itemBtn) {
             itemBtn.innerText = msg.data.item ? msg.data.item : 'ITEM';
             itemBtn.style.background = msg.data.item ? '#a855f7' : '#3b82f6';
         }
         
         if (msg.data.entities && clientRenderState) {
             // Update the clientRenderState with network data
             // Convert array back to Map for karts
             const kartsMap = new Map();
             for (const k of msg.data.entities.karts) {
                 kartsMap.set(k.id, k);
             }
             clientRenderState.karts = kartsMap;
             clientRenderState.projectiles = msg.data.entities.projectiles;
             clientRenderState.mines = msg.data.entities.mines;
             clientRenderState.itemBoxes = msg.data.entities.itemBoxes;
         }
      }
    }
  });
}

let myColor = '';

function renderLobby(app: HTMLElement, stateData?: any) {
  const takenColors = stateData?.players ? stateData.players.map((p: any) => p.color) : [];
  
  // My current color from server (if available)
  const myPlayer = stateData?.players?.find((p: any) => p.clientId === transport.getClientId());
  if (myPlayer) myColor = myPlayer.color;

  // If already rendered, just update the color buttons
  if (document.getElementById('color-picker')) {
    PLAYER_COLORS.forEach((color, i) => {
      const btn = document.getElementById(`color-btn-${i}`);
      if (btn) {
        // If taken by someone else
        if (takenColors.includes(color) && color !== myColor) {
          btn.style.opacity = '0.2';
          btn.style.pointerEvents = 'none';
        } else {
          btn.style.opacity = '1';
          btn.style.pointerEvents = 'auto';
        }
        // Highlight if mine
        if (color === myColor) {
          btn.style.border = '4px solid white';
        } else {
          btn.style.border = '2px solid transparent';
        }
      }
    });
    return; // just updated existing UI
  }

  // Initial render
  let colorsHtml = '<div id="color-picker" style="display: flex; gap: 1rem; margin-bottom: 2rem; flex-wrap: wrap; justify-content: center;">';
  PLAYER_COLORS.forEach((color, i) => {
     colorsHtml += `<div id="color-btn-${i}" style="width: 50px; height: 50px; border-radius: 50%; background: ${color}; cursor: pointer; border: 2px solid transparent;"></div>`;
  });
  colorsHtml += '</div>';

  app.innerHTML = `
    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%;">
      <h1 class="neon-text-blue" style="font-size: 2rem; text-align: center; margin-bottom: 1rem;">Choose Your Color</h1>
      ${colorsHtml}
      <button id="btn-ready" class="glass-btn" style="font-size: 3rem; padding: 2rem 4rem; background: ${isReady ? 'rgba(34,197,94,0.4)' : 'rgba(234, 179, 8, 0.4)'};">
        ${isReady ? '✅ READY!' : 'READY UP'}
      </button>
    </div>
  `;
  
  PLAYER_COLORS.forEach((color, i) => {
     document.getElementById(`color-btn-${i}`)?.addEventListener('click', () => {
         myColor = color;
         transport.send('changeColor', { color });
         renderLobby(app, stateData);
     });
  });

  const btnReady = document.getElementById('btn-ready');
  btnReady?.addEventListener('click', () => {
    isReady = !isReady;
    transport.send('ready', { isReady });
    if (btnReady) {
      btnReady.style.background = isReady ? 'rgba(34,197,94,0.4)' : 'rgba(234, 179, 8, 0.4)';
      btnReady.innerHTML = isReady ? '✅ READY!' : 'READY UP';
    }
  });
  
  // Update color highlights initially
  if (stateData) {
      PLAYER_COLORS.forEach((color, i) => {
          const btn = document.getElementById(`color-btn-${i}`);
          if (btn) {
              if (takenColors.includes(color) && color !== myColor) {
                  btn.style.opacity = '0.2';
                  btn.style.pointerEvents = 'none';
              }
              if (color === myColor) {
                  btn.style.border = '4px solid white';
              }
          }
      });
  }
}

function renderController(app: HTMLElement) {
  if (!inputManager) {
    inputManager = new InputManager((inputState) => {
      transport.send('in', inputState);
    });
    
    setInterval(() => {
      inputManager?.sendKeepAlive();
    }, 400); // ~2.5 times per sec
  }

  app.innerHTML = `
    <div style="position: relative; width: 100%; height: 100%;">
      ${!isRemote ? '<div style="position: absolute; inset: 0; z-index: 1;"><canvas id="client-canvas" style="width: 100%; height: 100%; display: block;"></canvas></div>' : ''}
      <div style="position: absolute; inset: 0; z-index: 2; display: flex; user-select: none; touch-action: none; pointer-events: none;">
        <!-- Left side: Steer Left -->
        <div id="zone-left" style="flex: 1; display: flex; align-items: center; justify-content: center; z-index: 10; ${isRemote ? 'pointer-events: auto; border-right: 2px solid rgba(255,255,255,0.1);' : ''}">
           <div style="font-size: ${isRemote ? '5rem' : '3rem'}; opacity: ${isRemote ? '0.5' : '0'}; pointer-events: none;">⬅️</div>
        </div>
        
        <!-- Right side: Steer Right -->
        <div id="zone-right" style="flex: 1; display: flex; align-items: center; justify-content: center; z-index: 10; ${isRemote ? 'pointer-events: auto;' : ''}">
           <div style="font-size: ${isRemote ? '5rem' : '3rem'}; opacity: ${isRemote ? '0.5' : '0'}; pointer-events: none;">➡️</div>
        </div>
        <!-- Center HUD -->
        <div style="position: absolute; top: 0; bottom: 0; left: 50%; width: 140px; margin-left: -70px; display: flex; flex-direction: column; justify-content: space-between; align-items: center; padding: 20px 0; pointer-events: none; z-index: 20;">
           <button id="btn-item" class="ctrl-btn" style="width: 80px; height: 80px; background: #3b82f6; font-size: 1.2rem; pointer-events: auto; border-radius: 50%;">ITEM</button>
           <button id="btn-brake" class="ctrl-btn" style="width: 120px; height: 100px; background: #ef4444; font-size: 1.5rem; pointer-events: auto; border-radius: 20px;">BRAKE / DRIFT</button>
        </div>
        
        <div id="rotate-warning" style="display: none; position: absolute; inset: 0; background: #000; z-index: 100; align-items: center; justify-content: center; flex-direction: column;">
          <div style="font-size: 4rem;">📱↻</div>
          <h2 style="margin-top: 1rem;">Rotate your phone</h2>
        </div>

        <!-- HUD Overlay -->
        <div style="position: absolute; top: 10px; left: 20px; font-size: 1.5rem; font-weight: bold; pointer-events: none; text-shadow: 2px 2px 4px #000; z-index: 30;">
          <div id="hud-pos" class="neon-text-pink" style="font-size: 2.5rem;">1st</div>
          <div id="hud-lap" class="neon-text-blue">LAP 1 / 3</div>
        </div>
        
        <!-- Controls Toggle -->
        <button id="btn-tilt-toggle" class="glass-btn" style="position: absolute; top: 10px; right: 20px; padding: 10px 20px; font-size: 1rem; z-index: 40; pointer-events: auto;">
          TILT CONTROLS
        </button>
      </div>
    </div>
  `;

  if (!isRemote && lastKnownState && lastKnownState.trackIndex !== undefined) {
      if (!clientRenderState) {
          const track = TRACKS[lastKnownState.trackIndex];
          const players = (lastKnownState.players || []).map((p: any) => ({
              ...p,
              isBot: p.clientId !== transport.getClientId()
          }));

          clientRenderState = {
              track,
              players,
              karts: new Map(),
              projectiles: [],
              mines: [],
              itemBoxes: track.itemBoxes.map(() => ({ active: true }))
          };
      }
      const canvas = document.getElementById('client-canvas') as HTMLCanvasElement;
      if (canvas) {
          const renderer = new Renderer(canvas, clientRenderState);
          const renderLoop = () => {
              if (document.getElementById('client-canvas')) {
                  renderer.render();
                  requestAnimationFrame(renderLoop);
              }
          };
          requestAnimationFrame(renderLoop);
      }
  }

  // Force landscape warning
  const checkOrientation = () => {
    const warning = document.getElementById('rotate-warning');
    if (warning) {
      warning.style.display = window.innerHeight > window.innerWidth ? 'flex' : 'none';
    }
  };
  window.addEventListener('resize', checkOrientation);
  checkOrientation();

  // Steering Zone touch handling
  let steerLeft = 0;
  let steerRight = 0;
  
  const updateSteering = () => {
    inputManager?.setSteering(steerRight - steerLeft);
  };
  
  const bindZone = (id: string, onDown: () => void, onUp: () => void) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('pointerdown', (e) => { 
      el.setPointerCapture(e.pointerId); 
      onDown(); 
    });
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    el.addEventListener('lostpointercapture', onUp);
  };

  bindZone('zone-left', () => { steerLeft = 1; updateSteering(); }, () => { steerLeft = 0; updateSteering(); });
  bindZone('zone-right', () => { steerRight = 1; updateSteering(); }, () => { steerRight = 0; updateSteering(); });

  // Tilt handling
  let isTiltEnabled = false;
  
  const handleOrientation = (event: DeviceOrientationEvent) => {
    if (!isTiltEnabled) return;
    
    // We assume the phone is held in landscape mode.
    // In landscape, tilting like a steering wheel usually changes the 'beta' or 'gamma' depending on OS/Browser.
    // Typically in landscape (home button to the right):
    // beta represents front-to-back tilt, gamma represents left-to-right (steering).
    // Let's use event.beta if portrait-locked, but if actual landscape, it varies.
    // A robust way for landscape steering is event.beta (which ranges -90 to 90).
    
    let tilt = 0;
    if (window.orientation === 90 || window.orientation === -90) {
       // Landscape: beta is usually the steering wheel rotation (-90 to 90)
       tilt = event.beta || 0;
    } else {
       // Portrait (or unsupported window.orientation): gamma is left-to-right tilt
       tilt = event.gamma || 0;
    }
    
    // Normalize tilt: clamp between -45 and 45 degrees
    tilt = Math.max(-45, Math.min(45, tilt));
    const steer = tilt / 45; // -1 to 1
    inputManager?.setSteering(steer);
  };

  const btnTiltToggle = document.getElementById('btn-tilt-toggle');
  btnTiltToggle?.addEventListener('click', async () => {
    if (!isTiltEnabled) {
      // Request permission for iOS 13+ devices
      if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
        try {
          const permissionState = await (DeviceOrientationEvent as any).requestPermission();
          if (permissionState !== 'granted') {
            alert('Tilt permission denied');
            return;
          }
        } catch (e) {
          console.error(e);
        }
      }
      
      isTiltEnabled = true;
      btnTiltToggle.innerText = 'TILT CONTROLS';
      window.addEventListener('deviceorientation', handleOrientation);
      
      // Hide touch zones visually
      document.getElementById('zone-left')!.style.opacity = '0';
      document.getElementById('zone-right')!.style.opacity = '0';
    } else {
      isTiltEnabled = false;
      btnTiltToggle.innerText = 'TOUCH CONTROLS';
      window.removeEventListener('deviceorientation', handleOrientation);
      
      // Reset steering
      inputManager?.setSteering(0);
      
      // Show touch zones visually
      document.getElementById('zone-left')!.style.opacity = '1';
      document.getElementById('zone-right')!.style.opacity = '1';
    }
  });

  // Button handling
  const bindBtn = (id: string, onDown: () => void, onUp: () => void) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('pointerdown', (e) => { 
      el.setPointerCapture(e.pointerId); 
      onDown(); 
      try { navigator.vibrate?.(10); } catch (e) {} 
    });
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    el.addEventListener('lostpointercapture', onUp);
  };

  // Brake doubles as drift button
  bindBtn('btn-brake', () => {
    inputManager?.setBrake(1);
    inputManager?.setDrift(1);
  }, () => {
    inputManager?.setBrake(0);
    inputManager?.setDrift(0);
  });
  
  bindBtn('btn-item', () => inputManager?.useItem(), () => {});

  // --- Keyboard Controls for Desktop Players ---
  const keys = { left: false, right: false, up: false, down: false };
  const updateKeyboardSteering = () => {
     if (isTiltEnabled) return; // Don't override tilt
     if (keys.left && !keys.right) inputManager?.setSteering(-1);
     else if (keys.right && !keys.left) inputManager?.setSteering(1);
     else inputManager?.setSteering(0);
     
     if (keys.down) {
         inputManager?.setBrake(1);
         inputManager?.setDrift(1);
     } else {
         inputManager?.setBrake(0);
         inputManager?.setDrift(0);
     }
  };

  window.addEventListener('keydown', (e) => {
     const k = e.key.toLowerCase();
     if (k === 'arrowleft' || k === 'a') keys.left = true;
     if (k === 'arrowright' || k === 'd') keys.right = true;
     if (k === 'arrowdown' || k === 's') keys.down = true;
     if (k === ' ' || k === 'shift') {
         inputManager?.useItem();
         // visual feedback
         const btn = document.getElementById('btn-item');
         if (btn) btn.style.transform = 'scale(0.9)';
     }
     updateKeyboardSteering();
  });

  window.addEventListener('keyup', (e) => {
     const k = e.key.toLowerCase();
     if (k === 'arrowleft' || k === 'a') keys.left = false;
     if (k === 'arrowright' || k === 'd') keys.right = false;
     if (k === 'arrowdown' || k === 's') keys.down = false;
     if (k === ' ' || k === 'shift') {
         const btn = document.getElementById('btn-item');
         if (btn) btn.style.transform = 'scale(1)';
     }
     updateKeyboardSteering();
  });
}

function renderDashboard(app: HTMLElement) {
  app.innerHTML = `
    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100%; background: #000; color: #fff;">
      <h1 class="neon-text-pink" style="font-size: 3rem; margin-bottom: 2rem;">Private Dashboard Log</h1>
      <div class="glass-panel" style="padding: 2rem; display: flex; flex-direction: column; gap: 1rem; align-items: center;">
        <input type="password" id="dash-password" placeholder="Enter Password" style="padding: 1rem; font-size: 1.5rem; border-radius: 0.5rem; border: none; outline: none; background: rgba(255,255,255,0.1); color: white;" />
        <button id="btn-dash-login" class="glass-btn" style="padding: 1rem 2rem; font-size: 1.5rem;">Access Logs</button>
      </div>
      <div id="dash-error" style="color: red; margin-top: 1rem;"></div>
    </div>
  `;

  document.getElementById('btn-dash-login')?.addEventListener('click', async () => {
    const pw = (document.getElementById('dash-password') as HTMLInputElement).value;
    const btn = document.getElementById('btn-dash-login') as HTMLButtonElement;
    btn.innerText = 'Loading...';
    btn.disabled = true;

    try {
      const res = await fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get', password: pw })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        document.getElementById('dash-error')!.innerText = data.error || 'Authentication Failed';
        btn.innerText = 'Access Logs';
        btn.disabled = false;
        return;
      }

      const logs = data.logs || [];
      
      let warningHtml = '';
      if (data.warning) {
          warningHtml = `<div style="background: rgba(255,0,0,0.2); padding: 1rem; border-radius: 0.5rem; margin-bottom: 1rem; color: #ffaaaa;">WARNING: ${data.warning} Please configure Vercel KV in your Vercel dashboard.</div>`;
      }

      app.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; min-height: 100%; padding: 2rem; background: #000; color: #fff;">
          <h1 class="neon-text-pink" style="font-size: 3rem; margin-bottom: 1rem;">Historical Player Logs</h1>
          ${warningHtml}
          <h2 style="font-size: 1.5rem; margin-bottom: 2rem;">Total Logins: <span class="neon-text-blue">${logs.length}</span></h2>
          <div style="width: 100%; max-width: 800px; background: rgba(255,255,255,0.05); border-radius: 1rem; padding: 1rem; overflow-y: auto; max-height: 70vh;">
            <table style="width: 100%; text-align: left; border-collapse: collapse;">
              <thead>
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.2);">
                  <th style="padding: 1rem;">Time</th>
                  <th style="padding: 1rem;">Name</th>
                  <th style="padding: 1rem;">Role</th>
                  <th style="padding: 1rem;">Room</th>
                </tr>
              </thead>
              <tbody>
                ${logs.map((p: any) => `
                  <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);">
                    <td style="padding: 1rem;">${new Date(p.timestamp).toLocaleString()}</td>
                    <td style="padding: 1rem;">${p.name || 'Unknown'}</td>
                    <td style="padding: 1rem;">${p.role || '-'}</td>
                    <td style="padding: 1rem;" class="neon-text-blue">${p.room || '-'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    } catch (err: any) {
      document.getElementById('dash-error')!.innerText = err.message;
      btn.innerText = 'Access Logs';
      btn.disabled = false;
    }
  });
}

init();
