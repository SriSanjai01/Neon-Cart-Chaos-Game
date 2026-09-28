import * as THREE from 'three';
import type { IRenderState } from './renderState';

export class Renderer {
  private canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderState: IRenderState;

  private kartMeshes: Map<string, THREE.Object3D> = new Map();
  private cameraStates: Map<string, { pos: THREE.Vector3, lookAt: THREE.Vector3 }> = new Map();
  private itemBoxMeshes: THREE.Mesh[] = [];
  
  private vfxGroup: THREE.Group = new THREE.Group();
  private missileMeshes: THREE.Mesh[] = [];
  private mineMeshes: THREE.Mesh[] = [];
  private boostMeshes: THREE.Mesh[] = [];

  constructor(canvas: HTMLCanvasElement, renderState: IRenderState) {
    this.canvas = canvas;
    this.renderState = renderState;

    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x111122);
    this.scene.fog = new THREE.Fog(0x111122, 500, 2500);

    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 5000);

    this.initScene();
    this.scene.add(this.vfxGroup);

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  private resize() {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  private initScene() {
    const gridHelper = new THREE.GridHelper(6000, 100, 0x444466, 0x222244);
    gridHelper.position.y = -1;
    this.scene.add(gridHelper);

    const leftBorder: THREE.Vector3[] = [];
    const rightBorder: THREE.Vector3[] = [];
    
    for (let i = 0; i < this.renderState.track.centerline.length; i++) {
        const pt = this.renderState.track.centerline[i];
        const next = this.renderState.track.centerline[(i + 1) % this.renderState.track.centerline.length];
        const dx = next.x - pt.x;
        const dy = next.y - pt.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist === 0) continue;
        const nx = -dy / dist;
        const ny = dx / dist;
        const halfWidth = this.renderState.track.width / 2;
        leftBorder.push(new THREE.Vector3(pt.x + nx * halfWidth, 0, pt.y + ny * halfWidth));
        rightBorder.push(new THREE.Vector3(pt.x - nx * halfWidth, 0, pt.y - ny * halfWidth));
    }

    const trackMat = new THREE.LineBasicMaterial({ color: 0x00ffff, linewidth: 2 });
    this.scene.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(leftBorder), trackMat));
    this.scene.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(rightBorder), trackMat));
    
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.5);
    dirLight.position.set(0, 1000, 0);
    this.scene.add(dirLight);

    // Finish Line
    const cp = this.renderState.track.checkpoints[0];
    const dxCP = cp.p2.x - cp.p1.x;
    const dyCP = cp.p2.y - cp.p1.y;
    const finishLen = Math.sqrt(dxCP*dxCP + dyCP*dyCP);
    const finishGeo = new THREE.PlaneGeometry(finishLen, 40);
    
    // Create a simple procedural checkerboard texture using a canvas
    const finishCanvas = document.createElement('canvas');
    finishCanvas.width = 128;
    finishCanvas.height = 128;
    const fctx = finishCanvas.getContext('2d')!;
    fctx.fillStyle = '#fff';
    fctx.fillRect(0,0,128,128);
    fctx.fillStyle = '#000';
    fctx.fillRect(0,0,64,64);
    fctx.fillRect(64,64,64,64);
    const finishTex = new THREE.CanvasTexture(finishCanvas);
    finishTex.wrapS = THREE.RepeatWrapping;
    finishTex.wrapT = THREE.RepeatWrapping;
    finishTex.repeat.set(finishLen/40, 1);
    
    const finishMat = new THREE.MeshLambertMaterial({ map: finishTex, side: THREE.DoubleSide });
    const finishMesh = new THREE.Mesh(finishGeo, finishMat);
    finishMesh.position.set((cp.p1.x + cp.p2.x)/2, 1, (cp.p1.y + cp.p2.y)/2);
    finishMesh.rotation.x = -Math.PI / 2;
    finishMesh.rotation.z = Math.atan2(dyCP, dxCP);
    this.scene.add(finishMesh);

    // Item Boxes
    const boxGeo = new THREE.BoxGeometry(20, 20, 20);
    const boxMat = new THREE.MeshLambertMaterial({ color: 0xff00ff, transparent: true, opacity: 0.8 });
    const boxEdgeMat = new THREE.LineBasicMaterial({ color: 0xffffff });
    const boxEdgeGeo = new THREE.EdgesGeometry(boxGeo);
    
    for (let i = 0; i < this.renderState.track.itemBoxes.length; i++) {
        const mesh = new THREE.Mesh(boxGeo, boxMat);
        const edges = new THREE.LineSegments(boxEdgeGeo, boxEdgeMat);
        mesh.add(edges);
        
        mesh.position.set(this.renderState.track.itemBoxes[i].x, 15, this.renderState.track.itemBoxes[i].y);
        this.scene.add(mesh);
        this.itemBoxMeshes.push(mesh);
    }
  }

  public render() {
    this.updateSceneObjects();

    const humanPlayers = this.renderState.players.filter(p => !p.isBot && this.renderState.karts.has(p.clientId));
    const w = window.innerWidth;
    const h = window.innerHeight;

    this.renderer.setScissorTest(true);

    if (humanPlayers.length === 0) {
      const karts = Array.from(this.renderState.karts.values());
      if (karts.length > 0) {
          let avgX = 0, avgY = 0;
          for (const k of karts) { avgX += k.x; avgY += k.y; }
          avgX /= karts.length; avgY /= karts.length;
          this.renderViewport(0, 0, w, h, 'spectator', avgX, avgY, 0);
      } else {
          this.renderViewport(0, 0, w, h, 'spectator', 1000, 0, 0);
      }
    } else if (humanPlayers.length === 1) {
      const k = this.renderState.karts.get(humanPlayers[0].clientId)!;
      this.renderViewport(0, 0, w, h, humanPlayers[0].clientId, k.x, k.y, k.angle);
    } else if (humanPlayers.length === 2) {
      const k1 = this.renderState.karts.get(humanPlayers[0].clientId)!;
      const k2 = this.renderState.karts.get(humanPlayers[1].clientId)!;
      // WebGL uses bottom-left origin for viewports
      this.renderViewport(0, 0, w / 2, h, humanPlayers[0].clientId, k1.x, k1.y, k1.angle);
      this.renderViewport(w / 2, 0, w / 2, h, humanPlayers[1].clientId, k2.x, k2.y, k2.angle);
    } else {
      const layout = [
        { x: 0, y: h / 2, w: w / 2, h: h / 2 },
        { x: w / 2, y: h / 2, w: w / 2, h: h / 2 },
        { x: 0, y: 0, w: w / 2, h: h / 2 },
        { x: w / 2, y: 0, w: w / 2, h: h / 2 }
      ];
      for (let i = 0; i < humanPlayers.length && i < 4; i++) {
        const k = this.renderState.karts.get(humanPlayers[i].clientId)!;
        this.renderViewport(layout[i].x, layout[i].y, layout[i].w, layout[i].h, humanPlayers[i].clientId, k.x, k.y, k.angle);
      }
    }
  }

  private renderViewport(vx: number, vy: number, vw: number, vh: number, viewId: string, kX: number, kY: number, kAngle: number) {
    this.renderer.setViewport(vx, vy, vw, vh);
    this.renderer.setScissor(vx, vy, vw, vh);

    this.camera.aspect = vw / vh;
    this.camera.updateProjectionMatrix();

    const camDist = 200;
    const camHeight = 80;
    const lookAhead = 100;

    const targetPos = new THREE.Vector3(kX - Math.cos(kAngle) * camDist, camHeight, kY - Math.sin(kAngle) * camDist);
    const targetLook = new THREE.Vector3(kX + Math.cos(kAngle) * lookAhead, 20, kY + Math.sin(kAngle) * lookAhead);

    let state = this.cameraStates.get(viewId);
    if (!state) {
      state = { pos: targetPos.clone(), lookAt: targetLook.clone() };
      this.cameraStates.set(viewId, state);
    } else {
      // Smooth interpolation
      state.pos.lerp(targetPos, 0.1);
      state.lookAt.lerp(targetLook, 0.2);
    }

    this.camera.position.copy(state.pos);
    this.camera.lookAt(state.lookAt);

    this.renderer.render(this.scene, this.camera);
  }

  private updateSceneObjects() {
    for (const player of this.renderState.players) {
        if (!player.connected && !player.isBot) continue;
        const kart = this.renderState.karts.get(player.clientId);
        if (!kart) continue;

        let mesh = this.kartMeshes.get(player.clientId);
        if (!mesh) {
            mesh = new THREE.Group();
            
            // Chassis
            const geo = new THREE.BoxGeometry(30, 10, 16);
            const mat = new THREE.MeshLambertMaterial({ color: player.color });
            const chassis = new THREE.Mesh(geo, mat);
            chassis.position.y = 5;
            const edgeGeo = new THREE.EdgesGeometry(geo);
            const edgeMat = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2 });
            chassis.add(new THREE.LineSegments(edgeGeo, edgeMat));
            mesh.add(chassis);
            
            // Spoiler
            const spoilerGeo = new THREE.BoxGeometry(5, 12, 16);
            const spoiler = new THREE.Mesh(spoilerGeo, mat);
            spoiler.position.set(-12, 12, 0);
            const sEdgeGeo = new THREE.EdgesGeometry(spoilerGeo);
            spoiler.add(new THREE.LineSegments(sEdgeGeo, edgeMat));
            mesh.add(spoiler);
            
            // Front Nose
            const noseGeo = new THREE.BoxGeometry(10, 6, 12);
            const nose = new THREE.Mesh(noseGeo, mat);
            nose.position.set(15, 3, 0);
            const nEdgeGeo = new THREE.EdgesGeometry(noseGeo);
            nose.add(new THREE.LineSegments(nEdgeGeo, edgeMat));
            mesh.add(nose);
            
            // Wheels
            const wheelGeo = new THREE.CylinderGeometry(5, 5, 4, 16);
            const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
            const wheelEdgeMat = new THREE.LineBasicMaterial({ color: player.color, linewidth: 2 });
            const addWheel = (parentMesh: THREE.Object3D, x: number, z: number) => {
               const w = new THREE.Mesh(wheelGeo, wheelMat);
               w.rotation.x = Math.PI/2;
               w.position.set(x, 5, z);
               const wEdge = new THREE.EdgesGeometry(wheelGeo);
               w.add(new THREE.LineSegments(wEdge, wheelEdgeMat));
               parentMesh.add(w);
            };
            addWheel(mesh, 12, 10);
            addWheel(mesh, 12, -10);
            addWheel(mesh, -10, 10);
            addWheel(mesh, -10, -10);

            // Add a point light to the kart to illuminate it and the track around it
            const kartLight = new THREE.PointLight(player.color, 2, 200);
            kartLight.position.set(0, 20, 0);
            mesh.add(kartLight);

            this.scene.add(mesh);
            this.kartMeshes.set(player.clientId, mesh);
        }

        // Handle transparency for invincibility (Warp Speed)
        mesh.children.forEach(child => {
           if (child instanceof THREE.Mesh) {
              const mat = child.material as THREE.MeshLambertMaterial;
              if (mat) {
                 mat.transparent = true;
                 mat.opacity = kart.invisible ? 0.3 : 1.0;
              }
           }
        });

        mesh.position.set(kart.x, 10, kart.y);
        mesh.rotation.y = -kart.angle; 
    }

    for (const [clientId, mesh] of this.kartMeshes.entries()) {
        if (!this.renderState.karts.has(clientId)) {
            this.scene.remove(mesh);
            this.kartMeshes.delete(clientId);
        }
    }

    // Update Item Boxes
    const time = Date.now() * 0.002;
    for (let i = 0; i < this.itemBoxMeshes.length; i++) {
        const mesh = this.itemBoxMeshes[i];
        const boxState = this.renderState.itemBoxes[i];
        if (boxState) {
            mesh.visible = boxState.active;
            mesh.rotation.x = time;
            mesh.rotation.y = time * 1.5;
        }
    }

    // --- Update VFX ---
    // 1. Projectiles (Missiles, Fireballs, Tornados)
    const activeProjectiles = this.renderState.projectiles.filter(p => p.active);
    while (this.missileMeshes.length < activeProjectiles.length) {
        const mesh = new THREE.Mesh();
        this.vfxGroup.add(mesh);
        this.missileMeshes.push(mesh);
    }
    const missileGeo = new THREE.CylinderGeometry(5, 5, 30).rotateZ(Math.PI / 2);
    const fireballGeo = new THREE.SphereGeometry(15, 16, 16);
    const tornadoGeo = new THREE.ConeGeometry(20, 40, 16).translate(0, 20, 0);
    const matRed = new THREE.MeshBasicMaterial({ color: 0xff2222 });
    const matOrange = new THREE.MeshBasicMaterial({ color: 0xff8800 });
    const matGrey = new THREE.MeshBasicMaterial({ color: 0x888888, transparent: true, opacity: 0.8 });
    
    for (let i = 0; i < this.missileMeshes.length; i++) {
        const mesh = this.missileMeshes[i];
        if (i < activeProjectiles.length) {
            mesh.visible = true;
            const p = activeProjectiles[i];
            mesh.position.set(p.x, 10, p.y);
            
            if (p.type === 'FIREBALL') {
                mesh.geometry = fireballGeo;
                mesh.material = matOrange;
                mesh.rotation.x = time * 2;
                mesh.rotation.y = time * 2;
            } else if (p.type === 'TORNADO') {
                mesh.geometry = tornadoGeo;
                mesh.material = matGrey;
                mesh.rotation.y = time * 5; // fast spin
                mesh.position.y = 0; // base on ground
            } else {
                mesh.geometry = missileGeo;
                mesh.material = matRed;
                mesh.rotation.y = -Math.atan2(p.vy, p.vx);
            }
        } else {
            mesh.visible = false;
        }
    }

    // 2. Mines & Hazards (Mine, Fake Box, Oil Slick)
    const activeMines = this.renderState.mines.filter(m => m.active);
    while (this.mineMeshes.length < activeMines.length) {
        const mesh = new THREE.Mesh();
        this.vfxGroup.add(mesh);
        this.mineMeshes.push(mesh);
    }
    const mineGeo = new THREE.BoxGeometry(15, 15, 15);
    const oilGeo = new THREE.PlaneGeometry(40, 40).rotateX(-Math.PI / 2);
    const matBlue = new THREE.MeshBasicMaterial({ color: 0x0088ff });
    const matBlack = new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.9 });
    
    for (let i = 0; i < this.mineMeshes.length; i++) {
        const mesh = this.mineMeshes[i];
        if (i < activeMines.length) {
            const m = activeMines[i];
            mesh.visible = true;
            mesh.position.set(m.x, 7.5, m.y);
            
            if (m.type === 'OIL_SLICK') {
                mesh.geometry = oilGeo;
                mesh.material = matBlack;
                mesh.position.y = 1; // slightly above ground
                mesh.rotation.set(0, 0, 0); // flat
            } else if (m.type === 'FAKE_BOX') {
                mesh.geometry = mineGeo;
                mesh.material = matBlue; // Looks like an item box somewhat
                mesh.rotation.x = time;
                mesh.rotation.y = time;
            } else {
                mesh.geometry = mineGeo;
                mesh.material = matOrange;
                mesh.rotation.x = time;
                mesh.rotation.y = time;
            }
        } else {
            mesh.visible = false;
        }
    }

    // 3. Boost Trails
    const boostingKarts = Array.from(this.renderState.karts.values()).filter(k => k.boost > 0);
    while (this.boostMeshes.length < boostingKarts.length) {
        const geo = new THREE.PlaneGeometry(30, 20);
        geo.rotateX(-Math.PI / 2); // Lay flat
        const mat = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.8, side: THREE.DoubleSide });
        const mesh = new THREE.Mesh(geo, mat);
        this.vfxGroup.add(mesh);
        this.boostMeshes.push(mesh);
    }
    for (let i = 0; i < this.boostMeshes.length; i++) {
        const mesh = this.boostMeshes[i];
        if (i < boostingKarts.length) {
            const kart = boostingKarts[i];
            mesh.visible = true;
            mesh.position.set(kart.x - Math.cos(kart.angle) * 30, 2, kart.y - Math.sin(kart.angle) * 30);
            mesh.rotation.y = -kart.angle;
            // Flicker effect
            mesh.scale.setScalar(0.8 + Math.random() * 0.4);
        } else {
            mesh.visible = false;
        }
    }
  }
}
