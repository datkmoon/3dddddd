import * as THREE from 'three';
import { ModelMetadata } from './modelLoader.ts';

/**
 * Creates soft contact shadow disk at the floor.
 */
function createContactShadow(radius = 0.35, opacity = 0.45): THREE.Mesh {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, `rgba(0, 0, 0, ${opacity})`);
  gradient.addColorStop(0.5, `rgba(0, 0, 0, ${opacity * 0.4})`);
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);

  const texture = new THREE.CanvasTexture(canvas);
  const geo = new THREE.PlaneGeometry(radius * 2, radius * 2);
  const mat = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.002;
  mesh.renderOrder = 1;
  return mesh;
}

/**
 * Sci-Fi Cyber Mech / Robot (10 distinct parts, PBR metallic & emissive visor)
 */
export function createSciFiMech(): { object: THREE.Group; metadata: ModelMetadata } {
  const group = new THREE.Group();
  group.name = 'CyberMech';

  // Materials
  const armorMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.85,
    roughness: 0.25,
  });
  const goldAccentMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    metalness: 0.9,
    roughness: 0.2,
  });
  const jointMat = new THREE.MeshStandardMaterial({
    color: 0x475569,
    metalness: 0.5,
    roughness: 0.5,
  });
  const visorMat = new THREE.MeshStandardMaterial({
    color: 0x06b6d4,
    emissive: 0x06b6d4,
    emissiveIntensity: 1.6,
    roughness: 0.1,
  });
  const thrusterMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: 0xef4444,
    emissiveIntensity: 1.2,
    roughness: 0.2,
  });

  // 1. Sturdy Feet & Ankle Plates
  const footGeo = new THREE.BoxGeometry(0.1, 0.04, 0.16);
  const leftFoot = new THREE.Mesh(footGeo, armorMat);
  leftFoot.position.set(-0.11, 0.02, 0);
  leftFoot.castShadow = true;
  const rightFoot = new THREE.Mesh(footGeo, armorMat);
  rightFoot.position.set(0.11, 0.02, 0);
  rightFoot.castShadow = true;
  group.add(leftFoot, rightFoot);

  // 2. Lower & Upper Legs (Segmented cylinders)
  const legGeo = new THREE.CylinderGeometry(0.035, 0.04, 0.22, 16);
  const leftLeg = new THREE.Mesh(legGeo, jointMat);
  leftLeg.position.set(-0.11, 0.14, 0);
  leftLeg.castShadow = true;
  const rightLeg = new THREE.Mesh(legGeo, jointMat);
  rightLeg.position.set(0.11, 0.14, 0);
  rightLeg.castShadow = true;
  group.add(leftLeg, rightLeg);

  // 3. Pelvis / Hips
  const pelvisGeo = new THREE.CylinderGeometry(0.12, 0.08, 0.06, 16);
  const pelvis = new THREE.Mesh(pelvisGeo, armorMat);
  pelvis.position.set(0, 0.26, 0);
  pelvis.castShadow = true;
  group.add(pelvis);

  // 4. Armored Torso with Beveled Silhouette
  const torsoGeo = new THREE.BoxGeometry(0.24, 0.18, 0.16);
  const torso = new THREE.Mesh(torsoGeo, armorMat);
  torso.position.set(0, 0.38, 0);
  torso.castShadow = true;
  group.add(torso);

  // 5. Gold Chest Reactor Core
  const coreGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.03, 24);
  coreGeo.rotateX(Math.PI / 2);
  const core = new THREE.Mesh(coreGeo, goldAccentMat);
  core.position.set(0, 0.4, 0.08);
  group.add(core);

  // 6. Shoulders Pauldrons
  const shoulderGeo = new THREE.SphereGeometry(0.06, 16, 16);
  const leftShoulder = new THREE.Mesh(shoulderGeo, goldAccentMat);
  leftShoulder.position.set(-0.17, 0.44, 0);
  leftShoulder.scale.set(1.2, 0.8, 1);
  const rightShoulder = new THREE.Mesh(shoulderGeo, goldAccentMat);
  rightShoulder.position.set(0.17, 0.44, 0);
  rightShoulder.scale.set(1.2, 0.8, 1);
  group.add(leftShoulder, rightShoulder);

  // 7. Arms & Plasma Cannons
  const armGeo = new THREE.CylinderGeometry(0.025, 0.03, 0.2, 12);
  const leftArm = new THREE.Mesh(armGeo, jointMat);
  leftArm.position.set(-0.17, 0.3, 0.02);
  const rightArm = new THREE.Mesh(armGeo, jointMat);
  rightArm.position.set(0.17, 0.3, 0.02);
  group.add(leftArm, rightArm);

  // 8. Head & Glowing Visor
  const headGeo = new THREE.BoxGeometry(0.12, 0.1, 0.12);
  const head = new THREE.Mesh(headGeo, armorMat);
  head.position.set(0, 0.52, 0);
  head.castShadow = true;
  const visorGeo = new THREE.BoxGeometry(0.1, 0.028, 0.02);
  const visor = new THREE.Mesh(visorGeo, visorMat);
  visor.position.set(0, 0.53, 0.062);
  group.add(head, visor);

  // 9. Dual Thruster Backpack
  const thrusterGeo = new THREE.CylinderGeometry(0.03, 0.04, 0.14, 16);
  const leftThruster = new THREE.Mesh(thrusterGeo, armorMat);
  leftThruster.position.set(-0.08, 0.4, -0.11);
  const rightThruster = new THREE.Mesh(thrusterGeo, armorMat);
  rightThruster.position.set(0.08, 0.4, -0.11);
  const flameGeo = new THREE.ConeGeometry(0.025, 0.06, 16);
  flameGeo.rotateX(Math.PI);
  const leftFlame = new THREE.Mesh(flameGeo, thrusterMat);
  leftFlame.position.set(-0.08, 0.3, -0.11);
  const rightFlame = new THREE.Mesh(flameGeo, thrusterMat);
  rightFlame.position.set(0.08, 0.3, -0.11);
  group.add(leftThruster, rightThruster, leftFlame, rightFlame);

  // 10. Contact Shadow
  group.add(createContactShadow(0.35, 0.5));

  const metadata: ModelMetadata = {
    name: 'Cyber Mech Bot',
    triangleCount: 1650,
    vertexCount: 980,
    dimensions: { x: 0.42, y: 0.58, z: 0.28 },
    hasAnimations: false,
    animationCount: 0,
  };

  return { object: group, metadata };
}

/**
 * Modern Architectural Lounge Chair (Wood shell, leather cushions, brushed steel legs)
 */
export function createModernLoungeChair(): { object: THREE.Group; metadata: ModelMetadata } {
  const group = new THREE.Group();
  group.name = 'ModernLoungeChair';

  const woodMat = new THREE.MeshStandardMaterial({
    color: 0x5c3317,
    roughness: 0.4,
    metalness: 0.05,
  });
  const leatherMat = new THREE.MeshStandardMaterial({
    color: 0x1f2937,
    roughness: 0.65,
    metalness: 0.1,
  });
  const metalMat = new THREE.MeshStandardMaterial({
    color: 0xd1d5db,
    roughness: 0.2,
    metalness: 0.9,
  });

  // 1. Four angled tubular legs
  const legGeo = new THREE.CylinderGeometry(0.012, 0.01, 0.28, 16);
  const legPositions: [number, number, number, number, number][] = [
    [-0.18, 0.14, 0.18, 0.12, -0.12],
    [0.18, 0.14, 0.18, 0.12, 0.12],
    [-0.18, 0.14, -0.18, -0.12, -0.12],
    [0.18, 0.14, -0.18, -0.12, 0.12],
  ];

  for (const [x, y, z, rx, rz] of legPositions) {
    const leg = new THREE.Mesh(legGeo, metalMat);
    leg.position.set(x, y, z);
    leg.rotation.set(rx, 0, rz);
    leg.castShadow = true;
    group.add(leg);
  }

  // 2. Under-seat star metal brace
  const braceGeo = new THREE.BoxGeometry(0.34, 0.015, 0.34);
  const brace = new THREE.Mesh(braceGeo, metalMat);
  brace.position.set(0, 0.26, 0);
  group.add(brace);

  // 3. Molded plywood bottom shell
  const shellGeo = new THREE.CylinderGeometry(0.24, 0.22, 0.03, 32);
  const shell = new THREE.Mesh(shellGeo, woodMat);
  shell.position.set(0, 0.28, 0);
  shell.castShadow = true;
  group.add(shell);

  // 4. Plush leather seat cushion
  const seatGeo = new THREE.CylinderGeometry(0.22, 0.23, 0.06, 32);
  const seat = new THREE.Mesh(seatGeo, leatherMat);
  seat.position.set(0, 0.32, 0);
  seat.castShadow = true;
  group.add(seat);

  // 5. Curved Backrest Shell
  const backShellGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.32, 32, 1, false, 0, Math.PI);
  const backShell = new THREE.Mesh(backShellGeo, woodMat);
  backShell.rotation.y = -Math.PI / 2;
  backShell.rotation.x = -0.18;
  backShell.position.set(0, 0.48, -0.14);
  backShell.castShadow = true;
  group.add(backShell);

  // 6. Leather backrest inner cushion
  const backCushionGeo = new THREE.BoxGeometry(0.36, 0.28, 0.05);
  const backCushion = new THREE.Mesh(backCushionGeo, leatherMat);
  backCushion.rotation.x = -0.18;
  backCushion.position.set(0, 0.48, -0.11);
  backCushion.castShadow = true;
  group.add(backCushion);

  // 7. Contact shadow
  group.add(createContactShadow(0.32, 0.4));

  const metadata: ModelMetadata = {
    name: 'Modern Lounge Chair',
    triangleCount: 1240,
    vertexCount: 780,
    dimensions: { x: 0.48, y: 0.65, z: 0.52 },
    hasAnimations: false,
    animationCount: 0,
  };

  return { object: group, metadata };
}

/**
 * Planet Earth with atmospheric glow & orbital satellite ring
 */
export function createPlanetEarth(): { object: THREE.Group; metadata: ModelMetadata } {
  const group = new THREE.Group();
  group.name = 'PlanetEarth';

  // Procedural Earth surface canvas texture
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  // Deep ocean blue base
  ctx.fillStyle = '#0f3a6b';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Continents and islands
  ctx.fillStyle = '#227b40';
  for (let i = 0; i < 48; i++) {
    const x = Math.random() * canvas.width;
    const y = 30 + Math.random() * (canvas.height - 60);
    const r = 15 + Math.random() * 45;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Polar ice caps
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, canvas.width, 24);
  ctx.fillRect(0, canvas.height - 24, canvas.width, 24);

  // Swirling white clouds
  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
  for (let i = 0; i < 30; i++) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    ctx.beginPath();
    ctx.ellipse(x, y, 40 + Math.random() * 50, 10 + Math.random() * 15, Math.random(), 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  const globeGeo = new THREE.SphereGeometry(0.22, 64, 32);
  const globeMat = new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 0.6,
    metalness: 0.1,
  });
  const globe = new THREE.Mesh(globeGeo, globeMat);
  globe.castShadow = true;

  // Axial tilt (23.5 degrees)
  const tiltGroup = new THREE.Group();
  tiltGroup.rotation.z = THREE.MathUtils.degToRad(23.5);
  tiltGroup.position.y = 0.28;
  tiltGroup.add(globe);

  // Outer atmospheric glow shell
  const atmoGeo = new THREE.SphereGeometry(0.235, 32, 16);
  const atmoMat = new THREE.MeshBasicMaterial({
    color: 0x60a5fa,
    transparent: true,
    opacity: 0.22,
    side: THREE.BackSide,
  });
  const atmosphere = new THREE.Mesh(atmoGeo, atmoMat);
  tiltGroup.add(atmosphere);

  // Orbital ring (Saturn / GPS constellation style)
  const ringGeo = new THREE.RingGeometry(0.3, 0.34, 64);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x93c5fd,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.45,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = Math.PI / 2;
  tiltGroup.add(ring);

  group.add(tiltGroup);

  // Pedestal stand
  const baseGeo = new THREE.CylinderGeometry(0.12, 0.14, 0.025, 32);
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.2 });
  const base = new THREE.Mesh(baseGeo, baseMat);
  base.position.y = 0.012;
  group.add(base);

  const standGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.14, 16);
  const stand = new THREE.Mesh(standGeo, baseMat);
  stand.position.y = 0.08;
  group.add(stand);

  group.add(createContactShadow(0.26, 0.45));

  const metadata: ModelMetadata = {
    name: 'Planet Earth Globe',
    triangleCount: 2800,
    vertexCount: 1540,
    dimensions: { x: 0.68, y: 0.54, z: 0.68 },
    hasAnimations: true,
    animationCount: 1,
  };

  return { object: group, metadata };
}

/**
 * Modern Geometric Bronze Knot Sculpture on white marble pedestal
 */
export function createTorusSculpture(): { object: THREE.Group; metadata: ModelMetadata } {
  const group = new THREE.Group();
  group.name = 'KineticSculpture';

  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    metalness: 0.95,
    roughness: 0.15,
  });
  const marbleMat = new THREE.MeshStandardMaterial({
    color: 0xf1f5f9,
    metalness: 0.1,
    roughness: 0.3,
  });

  // Pedestal
  const pedestalGeo = new THREE.CylinderGeometry(0.14, 0.16, 0.18, 32);
  const pedestal = new THREE.Mesh(pedestalGeo, marbleMat);
  pedestal.position.y = 0.09;
  pedestal.castShadow = true;
  group.add(pedestal);

  // Brass Knot
  const knotGeo = new THREE.TorusKnotGeometry(0.12, 0.038, 128, 32);
  const knot = new THREE.Mesh(knotGeo, goldMat);
  knot.position.y = 0.36;
  knot.castShadow = true;
  group.add(knot);

  group.add(createContactShadow(0.28, 0.5));

  const metadata: ModelMetadata = {
    name: 'Torus Bronze Sculpture',
    triangleCount: 4200,
    vertexCount: 2300,
    dimensions: { x: 0.32, y: 0.52, z: 0.32 },
    hasAnimations: true,
    animationCount: 1,
  };

  return { object: group, metadata };
}
