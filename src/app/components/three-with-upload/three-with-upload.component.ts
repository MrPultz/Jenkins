import { Component, ElementRef, ViewChild, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

// Define the correct type for transform modes
type TransformControlsMode = 'translate' | 'rotate' | 'scale';



@Component({
  selector: 'app-three-with-upload',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './three-with-upload.component.html',
  styleUrl: './three-with-upload.component.css'
})
export class ThreeWithUploadComponent implements OnInit{

  @ViewChild('rendererContainer',{static: true}) rendererContainer!: ElementRef;

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private controls!: OrbitControls;
  private transformControls!: TransformControls;

  private baseMesh?: THREE.Mesh | THREE.Group;
  private placementMesh?: THREE.Mesh | THREE.Group;
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private placementMode = false;
  private baseMeshBoundingBox: THREE.Box3 | null = null;
  private boundingBoxHelper?: THREE.LineSegments |THREE.Box3Helper;
  private lastValidTransform = {
    position: new THREE.Vector3(),
    scale: new THREE.Vector3(1,1,1),
    rotation: new THREE.Euler()
  };


  constructor() {
  }

  ngOnInit() {
    // Just initialize the scene here
    this.initScene();
  }

  ngAfterViewInit() {
    // Delay loading the default model slightly to ensure scene is ready
    setTimeout(() => {
      this.loadDefaultModel();
    }, 100);
  }

  private initScene(): void {
    // Create scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x2a2a2a);



    // Add lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(1, 1, 1);
    this.scene.add(directionalLight);

    // Setup camera
    this.camera = new THREE.PerspectiveCamera(
      75,
      this.rendererContainer.nativeElement.clientWidth / this.rendererContainer.nativeElement.clientHeight,
      0.1,
      1000
    );
    this.camera.position.z = 10;

    // Setup renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(
      this.rendererContainer.nativeElement.clientWidth,
      this.rendererContainer.nativeElement.clientHeight
    );
    this.rendererContainer.nativeElement.appendChild(this.renderer.domElement);

    // Add orbit controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;

    // Add  grid
    const gridHelper = new THREE.GridHelper(20,20);
    this.scene.add(gridHelper);

    // Add event listener for placement
    this.renderer.domElement.addEventListener('mousemove', this.onMouseMove.bind(this));
    this.renderer.domElement.addEventListener('click', this.onMouseClick.bind(this));


    // Start animation loop
    this.animate();

    // Handle window resize
    window.addEventListener('resize', this.onWindowResize.bind(this));

    // Initialize transform controls
    this.transformControls = new TransformControls(this.camera, this.renderer.domElement);

    // Make controls more responsive
    this.transformControls.setSize(1.2); // Slightly larger controls

    // Add change listener
    this.transformControls.addEventListener('change', () => {
      if (this.placementMesh) {
        this.validatePlacementPosition();
      }
    });

    // Disable orbit when using transform controls
    this.transformControls.addEventListener('dragging-changed', (event) => {
      this.controls.enabled = !event.value;
    });

    this.scene.add(this.transformControls.getHelper());
    this.addKeyboardShortcuts();
  }

  private animate(): void {
    requestAnimationFrame(() => this.animate());

    // Set bounding box to render on top of other objects (if it exists)
    if (this.boundingBoxHelper) {
      this.boundingBoxHelper.renderOrder = 999;
    }

    // Continuous boundary check during animation
    if (this.placementMesh && this.transformControls.object === this.placementMesh) {
      this.validatePlacementPosition();
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  private onWindowResize(): void {
    this.camera.aspect = this.rendererContainer.nativeElement.clientWidth / this.rendererContainer.nativeElement.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(
      this.rendererContainer.nativeElement.clientWidth,
      this.rendererContainer.nativeElement.clientHeight
    );
  }

  private loadDefaultModel(): void {
    // Load default cube as base mesh
    const geometry = new THREE.BoxGeometry(5, 1, 5);
    const material = new THREE.MeshStandardMaterial({ color: 0x808080 });
    this.baseMesh = new THREE.Mesh(geometry, material);
    this.scene.add(this.baseMesh);

    this.updateBaseMeshBoundingBox();

    // Center camera on object
    this.fitCameraToObject(this.baseMesh);
  }

  private fitCameraToObject(object: THREE.Object3D): void {
    const boundingBox = new THREE.Box3().setFromObject(object);
    const center = boundingBox.getCenter(new THREE.Vector3());
    const size = boundingBox.getSize(new THREE.Vector3());

    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = this.camera.fov * (Math.PI / 180);
    let cameraZ = Math.abs(maxDim / Math.sin(fov / 2));

    this.camera.position.z = cameraZ * 1.5;
    this.camera.lookAt(center);
    this.controls.target.copy(center);
    this.controls.update();
  }

  private setMaterial(object: THREE.Mesh | THREE.Group, material: THREE.Material): void {
    if (object instanceof THREE.Mesh) {
      object.material = material;
    } else if (object instanceof THREE.Group) {
      object.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.material = material;
        }
      });
    }
  }

  uploadBaseSTL(event: Event): void {
    const input = event.target as HTMLInputElement;
    if(!input.files || input.files.length === 0) return;

    const file = input.files[0];
    this.loadModel(file, (mesh) => {
      // remove previous base mesh if exists
      if(this.baseMesh) {
        this.scene.remove(this.baseMesh);
      }

      this.baseMesh = mesh;
      // Update bounding box whenbase mesh changes
      this.updateBaseMeshBoundingBox();

      const material = new THREE.MeshStandardMaterial({
        color: 0x808080,
        side: THREE.DoubleSide
      });
      this.setMaterial(this.baseMesh, material);

      this.scene.add(this.baseMesh);
      this.fitCameraToObject(this.baseMesh);
    });
  }

  uploadPlacementSTL(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    this.loadModel(file, (mesh) => {
      // Remove previous placement mesh if exists
      if (this.placementMesh) {
        this.scene.remove(this.placementMesh);
        this.transformControls.detach();
      }

      this.placementMesh = mesh;
      const material = new THREE.MeshStandardMaterial({
        color: 0xff4000,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.7
      });
      this.setMaterial(this.placementMesh, material);

      // Calculate the size of the placement mesh
      const placementBox = new THREE.Box3().setFromObject(this.placementMesh);
      const placementSize = placementBox.getSize(new THREE.Vector3());
      const placementHeight = placementSize.y;

      // Position directly on top of the base mesh
      if (this.baseMesh) {
        const baseBox = new THREE.Box3().setFromObject(this.baseMesh);
        // Position at the center of the base mesh's top face
        this.placementMesh.position.set(
          baseBox.getCenter(new THREE.Vector3()).x,
          baseBox.max.y + placementHeight/2, // Position exactly on top
          baseBox.getCenter(new THREE.Vector3()).z
        );
      } else {
        // Fallback position if no base mesh
        this.placementMesh.position.set(0, placementHeight/2, 0);
      }

      this.scene.add(this.placementMesh);

      // Initialize the last valid transform
      this.lastValidTransform.position.copy(this.placementMesh.position);
      this.lastValidTransform.scale.copy(this.placementMesh.scale);
      this.lastValidTransform.rotation.copy(this.placementMesh.rotation);

      // Attach transform controls to the placement mesh
      this.transformControls.attach(this.placementMesh);

      // Enable placement mode
      this.placementMode = true;

      // Set transform mode to translate by default
      this.transformControls.setMode('translate');

      // Only adjust if needed AFTER initial placement
      if (!this.isPlacementWithinBaseBounds()) {
        console.log('Warning: Object is larger than bounding box. Starting in invalid position.');
        // Don't auto-scale here - let the user handle it by moving/scaling manually
      }
    });
  }

  private loadModel(file: File, callback: (mesh: THREE.Mesh | THREE.Group) => void): void {
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        if (fileExtension === 'stl') {
          const loader = new STLLoader();
          const geometry = loader.parse(e.target?.result as ArrayBuffer);

          // Center geometry at origin
          geometry.computeBoundingBox();
          const boundingBox = geometry.boundingBox as THREE.Box3;
          const center = boundingBox.getCenter(new THREE.Vector3());
          geometry.translate(-center.x, -center.y, -center.z);

          const mesh = new THREE.Mesh(geometry);
          callback(mesh);
        }
        else if (fileExtension === 'fbx') {
          const loader = new FBXLoader();

          // FBXLoader.parse() expects only 2 arguments in newer versions
          const object = loader.parse(e.target?.result as ArrayBuffer, '');

          // Center the object
          const box = new THREE.Box3().setFromObject(object);
          const center = box.getCenter(new THREE.Vector3());
          object.position.sub(center);

          // FBX often needs scaling
          const scale = 0.01; // Adjust scale as needed
          object.scale.set(scale, scale, scale);

          callback(object);
        }
      } catch (error) {
        console.error('Error loading model:', error);
      }
    };

    reader.readAsArrayBuffer(file);
  }

  private onMouseMove(event: MouseEvent): void {
    // Skip if transform controls are active or no placement mode
    if (this.transformControls.object === this.placementMesh ||
      !this.placementMode || !this.placementMesh || !this.baseMesh) return;

    // Calculate mouse position in normalized device coordinates
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    // Update raycaster
    this.raycaster.setFromCamera(this.mouse, this.camera);

    // Check for intersections with base mesh
    const intersects = this.raycaster.intersectObject(this.baseMesh);
    if (intersects.length > 0) {
      const point = intersects[0].point;
      const oldPos = this.placementMesh.position.clone();

      // Try to move to new position
      this.placementMesh.position.copy(point);

      // Calculate the placement mesh's bounding box
      const placementBoundingBox = new THREE.Box3().setFromObject(this.placementMesh);
      const height = placementBoundingBox.getSize(new THREE.Vector3()).y;

      // Adjust y position to place object on surface
      this.placementMesh.position.y += height / 2;

      // If not valid, revert
      if (!this.isPlacementWithinBaseBounds()) {
        this.placementMesh.position.copy(oldPos);
      } else {
        // Save valid position
        this.lastValidTransform.position.copy(this.placementMesh.position);
      }
    }
  }

  private onMouseClick(event: MouseEvent): void {
    if (!this.placementMode || !this.placementMesh) return;

    // If not using transform controls, handle as before
    if (!this.transformControls.object) {
      // Finalize placement
      this.placementMode = false;

      // Change material to indicate it's placed
      const material = new THREE.MeshStandardMaterial({
        color: 0x0088ff,
        opacity: 1.0,
        transparent: false
      });
      this.setMaterial(this.placementMesh, material);
    }
  }

  togglePlacementMode(): void {
    if (!this.placementMesh) return;
    this.placementMode = !this.placementMode;
  }

  exportCombined(): void {
    if (!this.baseMesh) return;

    const exporter = new STLExporter();

    // Clone the base mesh and placement mesh to a new group
    const group = new THREE.Group();

    if (this.baseMesh) {
      group.add(this.baseMesh.clone());
    }

    if (this.placementMesh) {
      group.add(this.placementMesh.clone());
    }

    // Export the combined STL
    const stlString = exporter.parse(group, { binary: true });
    this.saveArrayBuffer(stlString, 'combined-model.stl');
  }

  private saveArrayBuffer(buffer: DataView, fileName: string): void {
    const blob = new Blob([buffer], { type: 'application/octet-stream' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    link.click();
  }

  setTransformMode(mode: TransformControlsMode): void {
    if (this.transformControls) {
      this.transformControls.setMode(mode);
    }
  }

  private addKeyboardShortcuts(): void {
    window.addEventListener('keydown', (event) => {
      if (!this.placementMesh) return;

      switch (event.key.toLowerCase()) {
        case 'w':
          this.transformControls.setMode('translate');
          break;
        case 'e':
          this.transformControls.setMode('scale');
          break;
        case 'r':
          this.transformControls.setMode('rotate');
          break;
      }
    });
  }

  private updateBaseMeshBoundingBox(): void {
    if(!this.baseMesh) {
      this.baseMeshBoundingBox = null;
      if(this.boundingBoxHelper) {
        this.scene.remove(this.boundingBoxHelper);
        this.boundingBoxHelper = undefined;
      }
      return;
    }

    // Remove previous helper
    if (this.boundingBoxHelper) {
      this.scene.remove(this.boundingBoxHelper);
    }

    // Calculate base mesh bounding box
    const rawBox = new THREE.Box3().setFromObject(this.baseMesh);
    const center = rawBox.getCenter(new THREE.Vector3());
    const size = rawBox.getSize(new THREE.Vector3());
    const scaleFactor = 0.9; // 90% of original size

    // Create the custom bounding box
    this.baseMeshBoundingBox = new THREE.Box3(
      new THREE.Vector3(
        center.x - size.x * scaleFactor/2,
        center.y - size.y * scaleFactor/2,
        center.z - size.z * scaleFactor/2
      ),
      new THREE.Vector3(
        center.x + size.x * scaleFactor/2,
        center.y + size.y * scaleFactor/2,
        center.z + size.z * scaleFactor/2
      )
    );

    // Create visible wireframe bounding box
    const boxGeometry = new THREE.BoxGeometry(
      size.x * scaleFactor,
      size.y * scaleFactor,
      size.z * scaleFactor
    );

    const edges = new THREE.EdgesGeometry(boxGeometry);
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0xff0000, // Bright red for visibility
      linewidth: 3
    });

    this.boundingBoxHelper = new THREE.LineSegments(edges, lineMaterial);

    // Position the bounding box on the top face of the base mesh
    // For your default box that's 1 unit tall, this would put it 0.5 + 0.05 = 0.55 units above center
    const yOffset = size.y * 0.55; // Position slightly above top face
    this.boundingBoxHelper.position.set(
      center.x,
      center.y + yOffset,
      center.z
    );

    // Set high renderOrder to ensure it's drawn over other objects
    this.boundingBoxHelper.renderOrder = 999;
    this.boundingBoxHelper.visible = true;
    this.scene.add(this.boundingBoxHelper);

    // Log the position for debugging
    console.log('Custom Bounding Box created at:',
      `x: ${this.boundingBoxHelper.position.x}, ` +
      `y: ${this.boundingBoxHelper.position.y}, ` +
      `z: ${this.boundingBoxHelper.position.z}`);
    console.log('Base mesh height:', size.y);
  }

  private isPlacementWithinBaseBounds(): boolean {
    if(!this.placementMesh || !this.baseMeshBoundingBox) return false;

    // Create bounding box for the placement mesh
    const placementBox = new THREE.Box3().setFromObject(this.placementMesh);

    // Only check X and Z coordinates
    return (
      placementBox.min.x >= this.baseMeshBoundingBox.min.x &&
      placementBox.max.x <= this.baseMeshBoundingBox.max.x &&
      placementBox.min.z >= this.baseMeshBoundingBox.min.z &&
      placementBox.max.z <= this.baseMeshBoundingBox.max.z
    );
  }

  private validatePlacementPosition() {
    if(!this.placementMesh) return;

    if(this.isPlacementWithinBaseBounds()) {
      // Save the current valid transform
      this.lastValidTransform.position.copy(this.placementMesh.position);
      this.lastValidTransform.scale.copy(this.placementMesh.scale);
      this.lastValidTransform.rotation.copy(this.placementMesh.rotation);
    } else {
      // Reset to last valid position
      this.placementMesh.position.copy(this.lastValidTransform.position);
      this.placementMesh.scale.copy(this.lastValidTransform.scale);
      this.placementMesh.rotation.copy(this.lastValidTransform.rotation);
    }
  }

  toggleBoundingBoxVisibility(): void {
    if (this.boundingBoxHelper) {
      this.boundingBoxHelper.visible = !this.boundingBoxHelper.visible;
      console.log('Bounding box visibility:', this.boundingBoxHelper.visible);

      // Force a render
      this.renderer.render(this.scene, this.camera);
    } else {
      // If no box exists, create one
      this.updateBaseMeshBoundingBox();
      console.log('Created new bounding box');
    }
  }

}
