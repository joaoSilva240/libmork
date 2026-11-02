import * as THREE from "three";

export type DieType = 4 | 6 | 8 | 10 | 12 | 20;

export interface DiceRollRequest {
  id: string;
  sides: number;
  result: number;
}

export function parseColor(color: string | number): number {
  if (typeof color === "number") return color;
  if (typeof color === "string") {
    const clean = color.trim().replace(/^#/, "");
    if (/^[0-9a-fA-F]{6}$/.test(clean)) {
      return parseInt(clean, 16);
    }
  }
  return 0x7c3aed;
}

export function createDieGeometry(sides: number, radius = 1): THREE.BufferGeometry {
  switch (sides) {
    case 4:
      return new THREE.TetrahedronGeometry(radius);
    case 6:
      return new THREE.BoxGeometry(radius * 1.4, radius * 1.4, radius * 1.4);
    case 8:
      return new THREE.OctahedronGeometry(radius);
    case 10:
      return new THREE.CylinderGeometry(radius * 0.9, radius * 0.9, radius * 1.3, 5);
    case 12:
      return new THREE.DodecahedronGeometry(radius);
    case 20:
    default:
      return new THREE.IcosahedronGeometry(radius);
  }
}

export function buildDie(
  sides: number,
  primaryColorHex: string,
  textColorHex = "#ffffff",
): THREE.Group {
  const group = new THREE.Group();
  const baseColor = parseColor(primaryColorHex);

  const geometry = createDieGeometry(sides, 1.2);
  const material = new THREE.MeshStandardMaterial({
    color: baseColor,
    roughness: 0.35,
    metalness: 0.15,
  });

  const mainMesh = new THREE.Mesh(geometry, material);
  mainMesh.castShadow = true;
  group.add(mainMesh);

  const wireMat = new THREE.LineBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.25,
  });
  const wireGeo = new THREE.WireframeGeometry(geometry);
  const wireframe = new THREE.LineSegments(wireGeo, wireMat);
  group.add(wireframe);

  const labelCanvas = document.createElement("canvas");
  labelCanvas.width = 128;
  labelCanvas.height = 128;
  const labelTexture = new THREE.CanvasTexture(labelCanvas);
  const spriteMat = new THREE.SpriteMaterial({ map: labelTexture, transparent: true });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.scale.set(1.5, 1.5, 1.5);
  sprite.position.set(0, 0.4, 0);
  sprite.name = "result-sprite";
  group.add(sprite);

  group.userData = {
    sides,
    labelCanvas,
    labelTexture,
    textColorHex,
    targetFace: 1,
  };

  return group;
}

export function updateDieFace(dieGroup: THREE.Group, faceValue: number, color = "#ffffff") {
  const canvas = dieGroup.userData.labelCanvas as HTMLCanvasElement;
  const texture = dieGroup.userData.labelTexture as THREE.CanvasTexture;
  if (!canvas || !texture) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.clearRect(0, 0, 128, 128);
  ctx.font = "900 68px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = color;
  ctx.shadowColor = "rgba(0,0,0,0.95)";
  ctx.shadowBlur = 10;
  ctx.fillText(String(faceValue), 64, 64);
  texture.needsUpdate = true;
}
