import * as THREE from 'three';
import { createKnitTexture } from './proceduralTextures';

export interface OutfitOption {
  id: 'cashmere' | 'sage' | 'terracotta' | 'indigo' | 'emerald';
  name: string;
  color: string;
  style: string;
  texturePattern: string;
}

export const OUTFIT_OPTIONS: OutfitOption[] = [
  { id: 'cashmere', name: 'Cozy Cashmere', color: '#eae4d8', style: 'Soft cream wool sweater', texturePattern: 'Ribbed Knit' },
  { id: 'sage', name: 'Sage Studio', color: '#8ca391', style: 'Relaxed sage green crewneck', texturePattern: 'Fine Weave' },
  { id: 'terracotta', name: 'Terracotta Wrap', color: '#ba6046', style: 'Warm terracotta silk blouse', texturePattern: 'Smooth Satin' },
  { id: 'indigo', name: 'Midnight Velvet', color: '#27324b', style: 'Deep indigo evening top', texturePattern: 'Soft Velvet' },
  { id: 'emerald', name: 'Emerald Cardigan', color: '#285e45', style: 'Forest green knit cardigan', texturePattern: 'Chunky Knit' },
];

export class MayaCharacter {
  public group: THREE.Group;
  public headGroup: THREE.Group;
  public jawGroup: THREE.Group;
  public leftEyelid: THREE.Mesh;
  public rightEyelid: THREE.Mesh;
  public torsoMesh: THREE.Mesh;
  public collarMesh: THREE.Mesh;
  public rightArmGroup: THREE.Group;
  public leftArmGroup: THREE.Group;

  private currentOutfit: OutfitOption = OUTFIT_OPTIONS[0];
  private dressMaterial: THREE.MeshStandardMaterial;
  private skinMaterial: THREE.MeshStandardMaterial;
  private hairMaterial: THREE.MeshStandardMaterial;
  private lipMaterial: THREE.MeshStandardMaterial;

  private blinkTimer: number = 0;
  private isBlinking: boolean = false;
  private animTime: number = 0;

  constructor() {
    this.group = new THREE.Group();

    // High quality PBR Skin Material
    this.skinMaterial = new THREE.MeshStandardMaterial({
      color: 0xf5cfb8,
      roughness: 0.58,
      metalness: 0.04,
    });

    // Warm Brunette Hair Material
    this.hairMaterial = new THREE.MeshStandardMaterial({
      color: 0x3d2719,
      roughness: 0.78,
      metalness: 0.08,
    });

    // Delicate Lip Material
    this.lipMaterial = new THREE.MeshStandardMaterial({
      color: 0xc9756b,
      roughness: 0.45,
      metalness: 0.05,
    });

    // PBR Dress Material with procedural knit texture
    const knitTex = createKnitTexture(this.currentOutfit.color);
    this.dressMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(this.currentOutfit.color),
      map: knitTex,
      roughness: 0.85,
      metalness: 0.02,
    });

    // 1. Torso & Shoulders
    const torsoGeo = new THREE.CylinderGeometry(0.34, 0.38, 0.85, 24);
    this.torsoMesh = new THREE.Mesh(torsoGeo, this.dressMaterial);
    this.torsoMesh.position.y = 0.95;
    this.torsoMesh.castShadow = true;
    this.group.add(this.torsoMesh);

    // Knit Collar
    const collarGeo = new THREE.TorusGeometry(0.18, 0.05, 16, 24);
    collarGeo.rotateX(Math.PI / 2);
    this.collarMesh = new THREE.Mesh(collarGeo, this.dressMaterial);
    this.collarMesh.position.set(0, 1.4, 0);
    this.group.add(this.collarMesh);

    // 2. Neck
    const neckGeo = new THREE.CylinderGeometry(0.12, 0.14, 0.28, 16);
    const neck = new THREE.Mesh(neckGeo, this.skinMaterial);
    neck.position.set(0, 1.48, 0.02);
    this.group.add(neck);

    // 3. Head Group (Rotates and gestures)
    this.headGroup = new THREE.Group();
    this.headGroup.position.set(0, 1.72, 0.04);
    this.group.add(this.headGroup);

    // Cranium / Face
    const faceGeo = new THREE.SphereGeometry(0.24, 24, 24);
    faceGeo.scale(1.0, 1.15, 1.05);
    const face = new THREE.Mesh(faceGeo, this.skinMaterial);
    face.castShadow = true;
    this.headGroup.add(face);

    // Hair Top Bun
    const bunGeo = new THREE.SphereGeometry(0.16, 20, 20);
    bunGeo.scale(1.1, 1.25, 1.1);
    const bun = new THREE.Mesh(bunGeo, this.hairMaterial);
    bun.position.set(0, 0.32, -0.06);
    this.headGroup.add(bun);

    // Hair crown & bangs
    const hairCrownGeo = new THREE.SphereGeometry(0.26, 20, 20, 0, Math.PI * 2, 0, Math.PI * 0.55);
    const hairCrown = new THREE.Mesh(hairCrownGeo, this.hairMaterial);
    hairCrown.position.set(0, 0.06, -0.04);
    this.headGroup.add(hairCrown);

    // Side loose strands
    const strandGeo = new THREE.CylinderGeometry(0.015, 0.008, 0.22, 8);
    const leftStrand = new THREE.Mesh(strandGeo, this.hairMaterial);
    leftStrand.position.set(-0.23, -0.05, 0.08);
    leftStrand.rotation.z = -0.15;
    this.headGroup.add(leftStrand);

    const rightStrand = new THREE.Mesh(strandGeo, this.hairMaterial);
    rightStrand.position.set(0.23, -0.05, 0.08);
    rightStrand.rotation.z = 0.15;
    this.headGroup.add(rightStrand);

    // Eyes
    const eyeGeo = new THREE.SphereGeometry(0.038, 16, 16);
    const eyeWhiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const irisMat = new THREE.MeshBasicMaterial({ color: 0x4a3221 });

    // Left Eye
    const leftEye = new THREE.Mesh(eyeGeo, eyeWhiteMat);
    leftEye.position.set(-0.085, 0.04, 0.2);
    const leftIris = new THREE.Mesh(new THREE.CircleGeometry(0.02, 16), irisMat);
    leftIris.position.set(0, 0, 0.038);
    leftEye.add(leftIris);
    this.headGroup.add(leftEye);

    // Right Eye
    const rightEye = new THREE.Mesh(eyeGeo, eyeWhiteMat);
    rightEye.position.set(0.085, 0.04, 0.2);
    const rightIris = new THREE.Mesh(new THREE.CircleGeometry(0.02, 16), irisMat);
    rightIris.position.set(0, 0, 0.038);
    rightEye.add(rightIris);
    this.headGroup.add(rightEye);

    // Eyelids (Blink animation)
    const eyelidGeo = new THREE.SphereGeometry(0.041, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.5);
    this.leftEyelid = new THREE.Mesh(eyelidGeo, this.skinMaterial);
    this.leftEyelid.position.copy(leftEye.position);
    this.leftEyelid.scale.set(1, 0.01, 1);
    this.headGroup.add(this.leftEyelid);

    this.rightEyelid = new THREE.Mesh(eyelidGeo, this.skinMaterial);
    this.rightEyelid.position.copy(rightEye.position);
    this.rightEyelid.scale.set(1, 0.01, 1);
    this.headGroup.add(this.rightEyelid);

    // Nose
    const noseGeo = new THREE.ConeGeometry(0.03, 0.08, 8);
    noseGeo.rotateX(Math.PI / 2);
    const nose = new THREE.Mesh(noseGeo, this.skinMaterial);
    nose.position.set(0, -0.02, 0.24);
    this.headGroup.add(nose);

    // Upper Lip
    const upperLipGeo = new THREE.CylinderGeometry(0.01, 0.015, 0.07, 8);
    upperLipGeo.rotateZ(Math.PI / 2);
    const upperLip = new THREE.Mesh(upperLipGeo, this.lipMaterial);
    upperLip.position.set(0, -0.09, 0.22);
    this.headGroup.add(upperLip);

    // Articulated Jaw & Lower Lip for Speaking Animation
    this.jawGroup = new THREE.Group();
    this.jawGroup.position.set(0, -0.1, 0.18);
    this.headGroup.add(this.jawGroup);

    const lowerLipGeo = new THREE.CylinderGeometry(0.012, 0.016, 0.065, 8);
    lowerLipGeo.rotateZ(Math.PI / 2);
    const lowerLip = new THREE.Mesh(lowerLipGeo, this.lipMaterial);
    lowerLip.position.set(0, -0.015, 0.038);
    this.jawGroup.add(lowerLip);

    // Chin
    const chinGeo = new THREE.SphereGeometry(0.06, 12, 12);
    chinGeo.scale(1, 0.8, 1);
    const chin = new THREE.Mesh(chinGeo, this.skinMaterial);
    chin.position.set(0, -0.06, 0.02);
    this.jawGroup.add(chin);

    // 4. Arms & Hands
    this.rightArmGroup = new THREE.Group();
    this.rightArmGroup.position.set(0.42, 1.25, 0.0);
    this.group.add(this.rightArmGroup);

    const armGeo = new THREE.CylinderGeometry(0.08, 0.07, 0.55, 12);
    const rightArm = new THREE.Mesh(armGeo, this.dressMaterial);
    rightArm.position.y = -0.25;
    this.rightArmGroup.add(rightArm);

    const handGeo = new THREE.SphereGeometry(0.065, 12, 12);
    handGeo.scale(1, 1.4, 0.7);
    const rightHand = new THREE.Mesh(handGeo, this.skinMaterial);
    rightHand.position.set(0, -0.55, 0.12);
    this.rightArmGroup.add(rightHand);

    this.leftArmGroup = new THREE.Group();
    this.leftArmGroup.position.set(-0.42, 1.25, 0.0);
    this.group.add(this.leftArmGroup);

    const leftArm = new THREE.Mesh(armGeo, this.dressMaterial);
    leftArm.position.y = -0.25;
    this.leftArmGroup.add(leftArm);

    const leftHand = new THREE.Mesh(handGeo, this.skinMaterial);
    leftHand.position.set(0, -0.55, 0.12);
    this.leftArmGroup.add(leftHand);

    // Sitting pose slight arm rests
    this.leftArmGroup.rotation.x = 0.35;
    this.leftArmGroup.rotation.z = -0.1;
    this.rightArmGroup.rotation.x = 0.35;
    this.rightArmGroup.rotation.z = 0.1;
  }

  // Outfit Change Method
  public setOutfit(outfitId: OutfitOption['id']) {
    const found = OUTFIT_OPTIONS.find((o) => o.id === outfitId);
    if (!found) return;
    this.currentOutfit = found;

    const newTex = createKnitTexture(found.color);
    this.dressMaterial.color.set(found.color);
    this.dressMaterial.map = newTex;
    this.dressMaterial.needsUpdate = true;
  }

  public getCurrentOutfit(): OutfitOption {
    return this.currentOutfit;
  }

  // Animation loop: Breathing, realistic eye blinking & speech mouth articulation
  public update(delta: number, isSpeaking: boolean, audioSpeechPulse: number = 0) {
    this.animTime += delta;

    // 1. Natural Sinusoidal Breathing Cycle (chest expands and rises gently)
    const breath = Math.sin(this.animTime * 1.6);
    this.torsoMesh.scale.set(1.0 + breath * 0.015, 1.0 + breath * 0.01, 1.0 + breath * 0.02);
    this.collarMesh.position.y = 1.4 + breath * 0.008;

    // 2. Periodic Natural Eye Blinking (every 3.8 to 5 seconds)
    this.blinkTimer += delta;
    if (this.blinkTimer > 4.2) {
      this.isBlinking = true;
      this.blinkTimer = 0;
    }
    if (this.isBlinking) {
      this.leftEyelid.scale.y = 1.0;
      this.rightEyelid.scale.y = 1.0;
      if (this.blinkTimer > 0.14) {
        this.isBlinking = false;
        this.leftEyelid.scale.y = 0.01;
        this.rightEyelid.scale.y = 0.01;
      }
    }

    // 3. Talking Animation: Jaw & Mouth Lip-Sync Movement
    if (isSpeaking) {
      // High-speed natural syllabic speech articulation
      const syllable = Math.sin(this.animTime * 18) * 0.5 + Math.sin(this.animTime * 28) * 0.3;
      const mouthOpen = Math.max(0, syllable * 0.045 + audioSpeechPulse * 0.04);

      // Jaw drops open and closes in sync with words
      this.jawGroup.position.y = -0.1 - mouthOpen;
      this.jawGroup.rotation.x = mouthOpen * 2.2;

      // Conversational head micro-tilt and nod
      this.headGroup.rotation.x = Math.sin(this.animTime * 3.5) * 0.04 + breath * 0.02;
      this.headGroup.rotation.y = Math.sin(this.animTime * 2.2) * 0.05;
      this.headGroup.rotation.z = Math.cos(this.animTime * 2.8) * 0.025;

      // Right arm gentle communicative gesture
      this.rightArmGroup.rotation.x = 0.4 + Math.sin(this.animTime * 4.0) * 0.08;
      this.rightArmGroup.rotation.y = Math.sin(this.animTime * 3.0) * 0.05;
    } else {
      // Smoothly settle back to gentle listening posture
      this.jawGroup.position.y = THREE.MathUtils.damp(this.jawGroup.position.y, -0.1, 8, delta);
      this.jawGroup.rotation.x = THREE.MathUtils.damp(this.jawGroup.rotation.x, 0, 8, delta);

      this.headGroup.rotation.x = THREE.MathUtils.damp(this.headGroup.rotation.x, breath * 0.02, 4, delta);
      this.headGroup.rotation.y = THREE.MathUtils.damp(this.headGroup.rotation.y, 0, 4, delta);
      this.headGroup.rotation.z = THREE.MathUtils.damp(this.headGroup.rotation.z, 0, 4, delta);

      this.rightArmGroup.rotation.x = THREE.MathUtils.damp(this.rightArmGroup.rotation.x, 0.35, 4, delta);
      this.rightArmGroup.rotation.y = THREE.MathUtils.damp(this.rightArmGroup.rotation.y, 0, 4, delta);
    }
  }
}
