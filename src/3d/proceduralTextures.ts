import * as THREE from 'three';

// Procedural Knit Sweater Texture
export function createKnitTexture(colorHex: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = colorHex;
  ctx.fillRect(0, 0, 256, 256);

  // Subtle rib knit weave
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
  ctx.lineWidth = 2;
  for (let x = 0; x < 256; x += 8) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 256);
    ctx.stroke();
  }

  // Cross stitch highlights
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 1.5;
  for (let y = 0; y < 256; y += 8) {
    for (let x = 0; x < 256; x += 16) {
      ctx.beginPath();
      ctx.arc(x + 4, y + 4, 2, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Procedural Wood Floor Texture
export function createWoodFloorTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Warm oak base
  ctx.fillStyle = '#61472e';
  ctx.fillRect(0, 0, 512, 512);

  // Wood planks lines
  for (let y = 0; y < 512; y += 64) {
    ctx.fillStyle = y % 128 === 0 ? '#543b24' : '#6b4f34';
    ctx.fillRect(0, y, 512, 62);

    // Subtle grain lines
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(0, y + 10 + i * 14);
      ctx.bezierCurveTo(150, y + 12 + i * 14, 350, y + 8 + i * 14, 512, y + 11 + i * 14);
      ctx.stroke();
    }
  }

  // Plank vertical joint seams
  ctx.strokeStyle = '#2b1b10';
  ctx.lineWidth = 2.5;
  for (let y = 0; y < 512; y += 64) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 3);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Procedural Armchair Fabric Texture
export function createFabricTexture(colorHex: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = colorHex;
  ctx.fillRect(0, 0, 128, 128);

  ctx.fillStyle = 'rgba(0,0,0,0.06)';
  for (let i = 0; i < 128; i += 4) {
    for (let j = 0; j < 128; j += 4) {
      if ((i + j) % 8 === 0) {
        ctx.fillRect(i, j, 2, 2);
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(6, 6);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
