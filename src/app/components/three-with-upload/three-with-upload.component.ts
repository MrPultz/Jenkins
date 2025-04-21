import { Component, ElementRef, ViewChild, OnInit, Input, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader";

// Define the correct type for transform modes
type TransformControlsMode = 'translate' | 'rotate' | 'scale';

@Component({
  selector: 'app-three-with-upload',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './three-with-upload.component.html',
  styleUrl: './three-with-upload.component.css'
})
export class ThreeWithUploadComponent implements OnInit {

  @ViewChild('rendererContainer', { static: true }) rendererContainer!: ElementRef;

  // Add this to the component class properties
  @Output() switchAgentEvent = new EventEmitter<void>();

  // Input to receive model from previous page
  @Input() baseModelGeometry?: THREE.BufferGeometry;

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
  private boundingBoxHelper?: THREE.LineSegments | THREE.Box3Helper;
  private lastValidTransform = {
    position: new THREE.Vector3(),
    scale: new THREE.Vector3(1, 1, 1),
    rotation: new THREE.Euler()
  };

  constructor() {}

  ngOnInit() {
    this.initScene();
  }

  ngAfterViewInit() {
    setTimeout(() => {
      this.loadBaseModel();
      // Load the unicorn horn after a small delay to ensure scene is ready
      setTimeout(() => {
        this.loadUnicornHorn();
      }, 300);
    }, 100);
  }

  private initScene(): void {
    // Create scene with improved lighting for better visibility
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x2a2a2a);

    // Enhanced lighting setup for better visibility of 3D models
    const ambientLight = new THREE.AmbientLight(0xcccccc, 0.4);
    this.scene.add(ambientLight);

    // Main directional light with shadows
    const mainLight = new THREE.DirectionalLight(0xffffff, 0.8);
    mainLight.position.set(5, 10, 7);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 1024;
    mainLight.shadow.mapSize.height = 1024;
    mainLight.shadow.camera.near = 0.5;
    mainLight.shadow.camera.far = 50;
    mainLight.shadow.bias = -0.001;
    this.scene.add(mainLight);

    // Fill light from opposite direction
    const fillLight = new THREE.DirectionalLight(0xffffcc, 0.5);
    fillLight.position.set(-5, 2, -5);
    this.scene.add(fillLight);

    // Soft spotlight for dramatic effect
    const spotLight = new THREE.SpotLight(0xffffff, 0.5);
    spotLight.position.set(0, 10, 0);
    spotLight.angle = Math.PI / 6;
    spotLight.penumbra = 0.2;
    spotLight.decay = 1;
    spotLight.distance = 30;
    spotLight.castShadow = true;
    this.scene.add(spotLight);

    // Setup camera
    this.camera = new THREE.PerspectiveCamera(
      75,
      this.rendererContainer.nativeElement.clientWidth / this.rendererContainer.nativeElement.clientHeight,
      0.1,
      1000
    );
    this.camera.position.z = 10;

    // Setup renderer with shadow support
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(
      this.rendererContainer.nativeElement.clientWidth,
      this.rendererContainer.nativeElement.clientHeight
    );
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.rendererContainer.nativeElement.appendChild(this.renderer.domElement);

    // Add orbit controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;

    // Add grid
    const gridHelper = new THREE.GridHelper(20, 20);
    this.scene.add(gridHelper);

    // Add event listener for placement
    // Add event listener for placement and clicking on base mesh
    this.renderer.domElement.addEventListener('mousemove', this.onMouseMove.bind(this));
    this.renderer.domElement.addEventListener('click', (event) => {
      // Left click
      if (event.button === 0) {
        // Check if we're using transform controls
        if (this.transformControls && this.transformControls.object === this.placementMesh) {
          // If transform controls are active, handle click on base mesh
          this.onBaseModelClick(event);
        } else if (this.placementMode) {
          // If in placement mode, finalize placement
          this.onMouseClick(event);
        }
      }
    });

    // Start animation loop
    this.animate();

    // Handle window resize
    window.addEventListener('resize', this.onWindowResize.bind(this));

    // Initialize transform controls
    this.transformControls = new TransformControls(this.camera, this.renderer.domElement);
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

    // Add the transform controls to the scene with proper type casting
    this.scene.add(this.transformControls.getHelper());
    this.addKeyboardShortcuts();
  }

  private loadBaseModel(): void {
    // If we received a model from the previous page, use it
    if (this.baseModelGeometry) {
      const material = new THREE.MeshPhysicalMaterial({
        color: 0xAAAAAA,
        metalness: 0.2,
        roughness: 0.5,
        clearcoat: 0.3,
        clearcoatRoughness: 0.25,
        reflectivity: 0.5
      });

      this.baseMesh = new THREE.Mesh(this.baseModelGeometry, material);
      this.baseMesh.castShadow = true;
      this.baseMesh.receiveShadow = true;
      this.scene.add(this.baseMesh);
    } else {
      // Use default cube as base mesh
      const geometry = new THREE.BoxGeometry(5, 1, 5);
      const material = new THREE.MeshPhysicalMaterial({
        color: 0xAAAAAA,
        metalness: 0.2,
        roughness: 0.5,
        clearcoat: 0.3,
        clearcoatRoughness: 0.25,
        reflectivity: 0.5
      });

      this.baseMesh = new THREE.Mesh(geometry, material);
      this.baseMesh.castShadow = true;
      this.baseMesh.receiveShadow = true;
      this.scene.add(this.baseMesh);
    }

    this.updateBaseMeshBoundingBox();
    this.fitCameraToObject(this.baseMesh);
  }

  private loadUnicornHorn(): void {
    const fbxLoader = new FBXLoader();

    // Load the unicorn horn from assets
    fbxLoader.load('assets/previewModel/unicornHorn.fbx', (object) => {
      // Remove previous placement mesh if exists
      if (this.placementMesh) {
        this.scene.remove(this.placementMesh);
        this.transformControls.detach();
      }

      this.placementMesh = object;

      // Apply material with wireframe overlay for better visibility
      const mainMaterial = new THREE.MeshPhysicalMaterial({
        color: 0xFF4000,
        metalness: 0.2,
        roughness: 0.5,
        clearcoat: 0.3,
        clearcoatRoughness: 0.25,
        reflectivity: 0.5,
        transparent: true,
        opacity: 0.8
      });

      // Create a wireframe material
      const wireframeMaterial = new THREE.MeshBasicMaterial({
        color: 0xFFFFFF,
        wireframe: true,
        transparent: true,
        opacity: 0.15
      });

      // Apply materials without creating infinite recursion
      object.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          // Apply main material directly
          child.material = mainMaterial;
          child.castShadow = true;

          // Create a separate wireframe mesh instead of adding as a child
          const wireframe = new THREE.Mesh(child.geometry.clone(), wireframeMaterial);
          wireframe.position.copy(child.position);
          wireframe.rotation.copy(child.rotation);
          wireframe.scale.copy(child.scale);
          object.add(wireframe);
        }
      });

      // Calculate size and bounding box
      const placementBox = new THREE.Box3().setFromObject(this.placementMesh);
      const placementSize = placementBox.getSize(new THREE.Vector3());
      const placementHeight = placementSize.y;

      // Scale the horn to a reasonable size relative to the base
      if (this.baseMesh) {
        const baseBox = new THREE.Box3().setFromObject(this.baseMesh);
        const baseSize = baseBox.getSize(new THREE.Vector3());
        const desiredHornSize = Math.min(baseSize.x, baseSize.z) * 0.3; // 30% of the base dimension

        // Scale the horn
        const scaleFactor = desiredHornSize / Math.max(placementSize.x, placementSize.z);
        object.scale.set(scaleFactor, scaleFactor, scaleFactor);

        // Update bounding box after scaling
        placementBox.setFromObject(this.placementMesh);

        // Position at the center of the base mesh's top face
        this.placementMesh.position.set(
          baseBox.getCenter(new THREE.Vector3()).x,
          baseBox.max.y + (placementBox.getSize(new THREE.Vector3()).y / 2), // Position on top
          baseBox.getCenter(new THREE.Vector3()).z
        );
      } else {
        // Fallback position if no base mesh
        this.placementMesh.position.set(0, placementHeight / 2, 0);
      }

      this.scene.add(this.placementMesh);

      // With these lines
      if (this.placementMesh) {
        this.placementMesh = this.setPivotToBottomCenter(this.placementMesh);

        // Make sure the transform controls are attached after the pivot is set
        if (this.transformControls && this.placementMesh) {
          this.transformControls.attach(this.placementMesh);
        }
      }

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

    }, undefined, (error) => {
      console.error('Error loading unicorn horn:', error);

      // Fallback: create a simple cone as unicorn horn
      const geometry = new THREE.ConeGeometry(0.5, 2, 16);
      const material = new THREE.MeshPhysicalMaterial({
        color: 0xFF4000,
        metalness: 0.2,
        roughness: 0.5
      });

      this.placementMesh = new THREE.Mesh(geometry, material);
      this.placementMesh.castShadow = true;

      // Position on top of base mesh
      if (this.baseMesh) {
        const baseBox = new THREE.Box3().setFromObject(this.baseMesh);
        this.placementMesh.position.set(
          baseBox.getCenter(new THREE.Vector3()).x,
          baseBox.max.y + 1, // Position on top
          baseBox.getCenter(new THREE.Vector3()).z
        );
      }

      this.scene.add(this.placementMesh);
      this.transformControls.attach(this.placementMesh);
      this.placementMode = true;
    });
  }

  private animate(): void {
    requestAnimationFrame(() => this.animate());

    // Set bounding box to render on top of other objects
    if (this.boundingBoxHelper) {
      this.boundingBoxHelper.renderOrder = 999;
    }

    // Continuous boundary check during animation
    if (this.placementMesh && this.transformControls.object === this.placementMesh) {
      this.validatePlacementPosition();
    }

    if (this.transformControls && this.transformControls.object === this.placementMesh) {
      // When transform controls are active, highlight the base mesh
      this.setBaseMeshHighlight(true);
    } else {
      this.setBaseMeshHighlight(false);
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
    const intersects = this.raycaster.intersectObject(this.baseMesh, true);
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

    // Finalize placement
    this.placementMode = false;

    // Change material to indicate it's placed
    const material = new THREE.MeshPhysicalMaterial({
      color: 0x0088ff,
      metalness: 0.2,
      roughness: 0.5,
      clearcoat: 0.3
    });

    this.placementMesh.traverse((child) => {
      if (child instanceof THREE.Mesh &&
        !(child.material instanceof THREE.MeshBasicMaterial && child.material.wireframe)) {
        child.material = material;
      }
    });

    // Attach transform controls to the placement mesh if not already attached
    if (this.transformControls && this.transformControls.object !== this.placementMesh) {
      this.transformControls.attach(this.placementMesh);
    }
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

  togglePlacementMode(): void {
    if (!this.placementMesh) return;
    this.placementMode = !this.placementMode;
  }

  // Add this method to your component
  private setBaseMeshHighlight(highlight: boolean): void {
    if (!this.baseMesh) return;

    this.baseMesh.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        if (highlight) {
          // Add subtle glow or highlight effect
          child.material = new THREE.MeshPhysicalMaterial({
            color: 0xAAAAFF,
            metalness: 0.2,
            roughness: 0.5,
            clearcoat: 0.3,
            clearcoatRoughness: 0.25,
            emissive: 0x222244
          });
        } else {
          // Reset to normal material
          child.material = new THREE.MeshPhysicalMaterial({
            color: 0xAAAAAA,
            metalness: 0.2,
            roughness: 0.5,
            clearcoat: 0.3,
            clearcoatRoughness: 0.25
          });
        }
      }
    });
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
      linewidth: 2
    });

    this.boundingBoxHelper = new THREE.LineSegments(edges, lineMaterial);

    // Position the bounding box on the top face of the base mesh
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

      // Force a render
      this.renderer.render(this.scene, this.camera);
    } else {
      // If no box exists, create one
      this.updateBaseMeshBoundingBox();
    }
  }


// Add this method to the component class
  switchAgent(): void {
    this.switchAgentEvent.emit();
  }

  // Add this method to set the pivot point at the bottom center
  private setPivotToBottomCenter(object: THREE.Object3D): THREE.Group {
    if (!object) {
      // Create and return an empty group as fallback
      const emptyGroup = new THREE.Group();
      this.scene.add(emptyGroup);
      return emptyGroup;
    }

    // Create a bounding box for the object
    const boundingBox = new THREE.Box3().setFromObject(object);
    const center = boundingBox.getCenter(new THREE.Vector3());
    const size = boundingBox.getSize(new THREE.Vector3());

    // Create a pivot group
    const pivotGroup = new THREE.Group();
    this.scene.add(pivotGroup);

    // Store original position
    const originalPosition = object.position.clone();

    // Remove from scene to avoid duplicates
    this.scene.remove(object);

    // Add object to pivot group
    pivotGroup.add(object);

    // Position object within group so its bottom center is at group's origin
    object.position.set(
      0,
      -boundingBox.min.y + originalPosition.y,
      0
    );

    // Position pivot group at the original object position
    pivotGroup.position.copy(originalPosition);

    // Visual indicator for pivot point (optional)
    const pivotMarker = new THREE.Mesh(
      new THREE.SphereGeometry(0.1, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xffff00 })
    );
    pivotGroup.add(pivotMarker);

    return pivotGroup;
  }

  // Add this method to your ThreeWithUploadComponent class
  private onBaseModelClick(event: MouseEvent): void {
    if (!this.baseMesh || !this.placementMesh) return;

    // Calculate mouse position in normalized device coordinates
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    // Update raycaster
    this.raycaster.setFromCamera(this.mouse, this.camera);

    // Check for intersections with base mesh only
    const intersects = this.raycaster.intersectObject(this.baseMesh, true);

    if (intersects.length > 0) {
      const intersect = intersects[0];
      const point = intersect.point;
      const face = intersect.face;

      if (face) {
        // Get the normal of the clicked face
        const normal = face.normal.clone();

        // Transform the normal to world coordinates if necessary
        if (intersect.object.parent) {
          const normalMatrix = new THREE.Matrix3().getNormalMatrix(intersect.object.matrixWorld);
          normal.applyMatrix3(normalMatrix).normalize();
        }

        // Save current position and rotation in case we need to revert
        const oldPosition = this.placementMesh.position.clone();
        const oldQuaternion = this.placementMesh.quaternion.clone();

        // Position the pivot at the intersection point
        this.placementMesh.position.copy(point);

        // Calculate rotation to align with the face normal
        const upVector = new THREE.Vector3(0, 1, 0);

        if (Math.abs(normal.dot(upVector)) > 0.99) {
          // If normal is already parallel to up vector, don't rotate
          this.placementMesh.rotation.set(0, 0, 0);
        } else {
          // Get rotation axis and angle
          const axis = new THREE.Vector3().crossVectors(upVector, normal).normalize();
          const angle = Math.acos(upVector.dot(normal));

          // Convert to quaternion
          const quaternion = new THREE.Quaternion().setFromAxisAngle(axis, angle);
          this.placementMesh.quaternion.copy(quaternion);
        }

        // Check if the new position would be within bounds
        if (!this.isPlacementWithinBaseBounds()) {
          // Revert to the previous position and rotation
          this.placementMesh.position.copy(oldPosition);
          this.placementMesh.quaternion.copy(oldQuaternion);
          console.error("Cannot place object outside the base model boundaries.");

          // Visual feedback - briefly flash the bounding box
          if (this.boundingBoxHelper) {
            const originalMaterial = (this.boundingBoxHelper as THREE.LineSegments).material;
            const flashMaterial = new THREE.LineBasicMaterial({ color: 0xff0000, linewidth: 3 });
            (this.boundingBoxHelper as THREE.LineSegments).material = flashMaterial;

            setTimeout(() => {
              if (this.boundingBoxHelper) {
                (this.boundingBoxHelper as THREE.LineSegments).material = originalMaterial;
              }
            }, 300);
          }
        } else {
          // Save the current position as the last valid one
          this.lastValidTransform.position.copy(this.placementMesh.position);
          this.lastValidTransform.rotation.copy(this.placementMesh.rotation);
        }
      }
    } else {
      console.error("Click on the base model to place the object.");
    }
  }

}
