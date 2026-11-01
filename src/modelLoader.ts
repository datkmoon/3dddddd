import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export interface ModelMetadata {
  name: string;
  triangleCount: number;
  vertexCount: number;
  dimensions: { x: number; y: number; z: number };
  hasAnimations: boolean;
  animationCount: number;
}

export class ModelLoaderService {
  private loader: GLTFLoader;

  constructor() {
    this.loader = new GLTFLoader();
  }

  /**
   * Loads a model from a remote or local URL (GLB or GLTF).
   */
  async loadFromUrl(url: string, name = 'Model'): Promise<{ object: THREE.Group; animations: THREE.AnimationClip[]; metadata: ModelMetadata }> {
    return new Promise((resolve, reject) => {
      this.loader.load(
        url,
        (gltf) => {
          const { object, metadata } = this.processGltf(gltf.scene, name, gltf.animations);
          resolve({ object, animations: gltf.animations, metadata });
        },
        undefined,
        (error) => {
          console.error(`Error loading model from ${url}:`, error);
          reject(error);
        }
      );
    });
  }

  /**
   * Loads a model from a user-uploaded File or Blob.
   */
  async loadFromFile(file: File): Promise<{ object: THREE.Group; animations: THREE.AnimationClip[]; metadata: ModelMetadata }> {
    const arrayBuffer = await file.arrayBuffer();
    return new Promise((resolve, reject) => {
      this.loader.parse(
        arrayBuffer,
        '',
        (gltf) => {
          const name = file.name.replace(/\.[^/.]+$/, '');
          const { object, metadata } = this.processGltf(gltf.scene, name, gltf.animations);
          resolve({ object, animations: gltf.animations, metadata });
        },
        (error) => {
          console.error('Failed to parse uploaded GLTF/GLB:', error);
          reject(new Error('Failed to parse 3D file. Please ensure it is a valid .glb or .gltf file.'));
        }
      );
    });
  }

  /**
   * Centers the model, grounds its pivot to bottom-center (Y=0),
   * normalizes scale to realistic AR dimensions (~0.5m - 0.7m max dimension),
   * and extracts statistics.
   */
  private processGltf(scene: THREE.Group, name: string, animations: THREE.AnimationClip[]): { object: THREE.Group; metadata: ModelMetadata } {
    let vertexCount = 0;
    let triangleCount = 0;

    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        if (mesh.geometry) {
          if (!mesh.geometry.attributes.normal) {
            mesh.geometry.computeVertexNormals();
          }
          const geom = mesh.geometry;
          if (geom.index) {
            triangleCount += geom.index.count / 3;
          } else if (geom.attributes.position) {
            triangleCount += geom.attributes.position.count / 3;
          }
          if (geom.attributes.position) {
            vertexCount += geom.attributes.position.count;
          }
        }
      }
    });

    // Compute bounding box
    const box = new THREE.Box3().setFromObject(scene);
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);

    // Normalize scale if too large or too small (ideal AR initial max size is ~0.5m)
    const maxDim = Math.max(size.x, size.y, size.z);
    const targetSize = 0.55;
    const scaleFactor = maxDim > 0 ? targetSize / maxDim : 1;

    const wrapper = new THREE.Group();
    wrapper.name = `${name}_normalized`;

    // Offset original scene so pivot is at bottom center (min.y is at 0)
    scene.position.set(-center.x, -box.min.y, -center.z);
    scene.scale.setScalar(scaleFactor);

    // Recompute final dimensions
    const finalDimensions = {
      x: +(size.x * scaleFactor).toFixed(3),
      y: +(size.y * scaleFactor).toFixed(3),
      z: +(size.z * scaleFactor).toFixed(3),
    };

    wrapper.add(scene);

    const metadata: ModelMetadata = {
      name,
      triangleCount: Math.round(triangleCount),
      vertexCount: Math.round(vertexCount),
      dimensions: finalDimensions,
      hasAnimations: animations && animations.length > 0,
      animationCount: animations ? animations.length : 0,
    };

    return { object: wrapper, metadata };
  }
}
