import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createWoodFloorTexture, createFabricTexture } from './proceduralTextures';
import { MayaCharacter } from './MayaCharacter';

export class MayaRoomScene {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  public maya: MayaCharacter;
  private animFrameId: number = 0;
  private isDestroyed: boolean = false;
  private clock: THREE.Clock;

  constructor(container: HTMLDivElement) {
    this.clock = new THREE.Clock();
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x111622);

    const width = container.clientWidth || 600;
    const height = container.clientHeight || 700;

    // Camera framed on Maya in her armchair
    this.camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 50);
    this.camera.position.set(0.0, 1.55, 3.2);
    this.camera.lookAt(0.0, 1.35, 0.0);

    // Modern WebGL Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      alpha: true,
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.appendChild(this.renderer.domElement);

    // Procedural Studio Environment Map
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    // 1. Build Room Interior
    this.buildRoom();

    // 2. Build Armchair
    this.buildArmchair();

    // 3. Add 3D Maya Character
    this.maya = new MayaCharacter();
    this.maya.group.position.set(0, 0.35, 0); // Positioned sitting in armchair
    this.scene.add(this.maya.group);

    // 4. Setup Lighting Rig
    this.setupLighting();

    // Start render loop
    this.animate();
  }

  private buildRoom() {
    // Wood Floor
    const floorGeo = new THREE.PlaneGeometry(8, 8);
    floorGeo.rotateX(-Math.PI / 2);
    const floorMat = new THREE.MeshStandardMaterial({
      map: createWoodFloorTexture(),
      roughness: 0.6,
      metalness: 0.05,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Back Wall
    const backWallGeo = new THREE.PlaneGeometry(8, 5);
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x1c212d,
      roughness: 0.9,
      metalness: 0.0,
    });
    const backWall = new THREE.Mesh(backWallGeo, wallMat);
    backWall.position.set(0, 2.5, -2.2);
    backWall.receiveShadow = true;
    this.scene.add(backWall);

    // Bookshelf on Back Wall
    const shelfGroup = new THREE.Group();
    shelfGroup.position.set(-1.4, 1.8, -2.1);

    const shelfPlankGeo = new THREE.BoxGeometry(1.6, 0.05, 0.3);
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x5a3e26, roughness: 0.7 });
    const shelf1 = new THREE.Mesh(shelfPlankGeo, woodMat);
    const shelf2 = new THREE.Mesh(shelfPlankGeo, woodMat);
    shelf2.position.y = 0.55;
    shelfGroup.add(shelf1, shelf2);

    // Colorful 3D Books on shelf
    const bookColors = [0x9333ea, 0x0284c7, 0x16a34a, 0xe11d48, 0xd97706];
    bookColors.forEach((color, i) => {
      const bookGeo = new THREE.BoxGeometry(0.06, 0.35 + (i % 2) * 0.05, 0.22);
      const bookMat = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
      const book = new THREE.Mesh(bookGeo, bookMat);
      book.position.set(-0.6 + i * 0.09, 0.2, 0);
      shelfGroup.add(book);
    });

    this.scene.add(shelfGroup);

    // Potted Monstera / Ficus Plant
    const plantGroup = new THREE.Group();
    plantGroup.position.set(1.5, 0, -1.4);

    const potGeo = new THREE.CylinderGeometry(0.24, 0.18, 0.5, 16);
    const potMat = new THREE.MeshStandardMaterial({ color: 0xba6046, roughness: 0.8 });
    const pot = new THREE.Mesh(potGeo, potMat);
    pot.position.y = 0.25;
    pot.castShadow = true;
    plantGroup.add(pot);

    const leafMat = new THREE.MeshStandardMaterial({ color: 0x1f5c35, roughness: 0.45 });
    for (let i = 0; i < 6; i++) {
      const leafGeo = new THREE.SphereGeometry(0.25, 8, 8);
      leafGeo.scale(0.8, 0.1, 1.4);
      const leaf = new THREE.Mesh(leafGeo, leafMat);
      leaf.position.set(
        Math.cos(i * 1.05) * 0.25,
        0.5 + i * 0.12,
        Math.sin(i * 1.05) * 0.25
      );
      leaf.rotation.set(0.3, i * 1.05, 0.4);
      leaf.castShadow = true;
      plantGroup.add(leaf);
    }
    this.scene.add(plantGroup);

    // Warm Brass Floor Lamp
    const lampGroup = new THREE.Group();
    lampGroup.position.set(-1.6, 0, -0.6);

    const baseGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.04, 16);
    const brassMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.85, roughness: 0.2 });
    const lampBase = new THREE.Mesh(baseGeo, brassMat);
    lampBase.position.y = 0.02;
    lampGroup.add(lampBase);

    const poleGeo = new THREE.CylinderGeometry(0.02, 0.02, 2.2, 12);
    const pole = new THREE.Mesh(poleGeo, brassMat);
    pole.position.y = 1.1;
    lampGroup.add(pole);

    const shadeGeo = new THREE.ConeGeometry(0.25, 0.35, 16, 1, true);
    const shadeMat = new THREE.MeshStandardMaterial({ color: 0xfbf8ee, roughness: 0.5, side: THREE.DoubleSide });
    const shade = new THREE.Mesh(shadeGeo, shadeMat);
    shade.position.y = 2.15;
    lampGroup.add(shade);

    // Warm bulb glow
    const lampLight = new THREE.PointLight(0xffecd1, 1.8, 4.5);
    lampLight.position.set(-1.6, 2.1, -0.6);
    lampLight.castShadow = true;
    this.scene.add(lampLight);

    this.scene.add(lampGroup);
  }

  private buildArmchair() {
    const chairGroup = new THREE.Group();
    chairGroup.position.set(0, 0, 0);

    const fabricMat = new THREE.MeshStandardMaterial({
      map: createFabricTexture('#4a3b2c'),
      roughness: 0.88,
      metalness: 0.02,
    });

    // Seat cushion
    const seatGeo = new THREE.BoxGeometry(0.95, 0.22, 0.85);
    const seat = new THREE.Mesh(seatGeo, fabricMat);
    seat.position.set(0, 0.48, 0.05);
    seat.castShadow = true;
    seat.receiveShadow = true;
    chairGroup.add(seat);

    // Backrest (high wingback)
    const backGeo = new THREE.BoxGeometry(0.92, 1.25, 0.18);
    const back = new THREE.Mesh(backGeo, fabricMat);
    back.position.set(0, 1.12, -0.32);
    back.rotation.x = -0.1;
    back.castShadow = true;
    chairGroup.add(back);

    // Left Armrest
    const armrestGeo = new THREE.BoxGeometry(0.18, 0.45, 0.8);
    const leftArm = new THREE.Mesh(armrestGeo, fabricMat);
    leftArm.position.set(-0.52, 0.65, 0.02);
    leftArm.castShadow = true;
    chairGroup.add(leftArm);

    // Right Armrest
    const rightArm = new THREE.Mesh(armrestGeo, fabricMat);
    rightArm.position.set(0.52, 0.65, 0.02);
    rightArm.castShadow = true;
    chairGroup.add(rightArm);

    // Wooden Legs
    const woodLegMat = new THREE.MeshStandardMaterial({ color: 0x3d2314, roughness: 0.65 });
    const legGeo = new THREE.CylinderGeometry(0.035, 0.02, 0.42, 8);
    const legPositions = [
      [-0.42, 0.2, 0.35],
      [0.42, 0.2, 0.35],
      [-0.42, 0.2, -0.28],
      [0.42, 0.2, -0.28],
    ];

    legPositions.forEach(([x, y, z]) => {
      const leg = new THREE.Mesh(legGeo, woodLegMat);
      leg.position.set(x, y, z);
      leg.rotation.z = x > 0 ? -0.15 : 0.15;
      leg.rotation.x = z > 0 ? 0.15 : -0.15;
      leg.castShadow = true;
      chairGroup.add(leg);
    });

    this.scene.add(chairGroup);
  }

  private setupLighting() {
    // 1. Warm Directional Key Light (Sunlight/Window Light)
    const keyLight = new THREE.DirectionalLight(0xfff7ed, 1.8);
    keyLight.position.set(2.4, 3.5, 2.5);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    this.scene.add(keyLight);

    // 2. Cool Ambient / Sky Fill
    const hemiLight = new THREE.HemisphereLight(0xe2e8f0, 0x1e293b, 0.9);
    this.scene.add(hemiLight);

    // 3. Subtle Rim Light (edge definition on Maya's hair and shoulders)
    const rimLight = new THREE.DirectionalLight(0x7dd3fc, 0.8);
    rimLight.position.set(-2.5, 2.8, -2.0);
    this.scene.add(rimLight);
  }

  public resize(width: number, height: number) {
    if (!this.renderer || !this.camera) return;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  private animate = () => {
    if (this.isDestroyed) return;
    this.animFrameId = requestAnimationFrame(this.animate);

    const delta = Math.min(this.clock.getDelta(), 0.1);

    // Update Maya's animation (pass speaking state and audio amplitude)
    if (this.maya) {
      this.maya.update(delta, (window as any).__mayaIsSpeaking ?? false, (window as any).__mayaAudioPulse ?? 0);
    }

    this.renderer.render(this.scene, this.camera);
  };

  public destroy() {
    this.isDestroyed = true;
    cancelAnimationFrame(this.animFrameId);
    if (this.renderer) {
      if (this.renderer.domElement && this.renderer.domElement.parentElement) {
        this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
      }
      this.renderer.dispose();
    }
  }
}
