import {Component, ElementRef, ViewChild, OnInit, Input, EventEmitter, Output, SimpleChanges, OnChanges} from '@angular/core';
import { CommonModule } from '@angular/common';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader";
import { MovementResponse } from '../../services/base-movement-agent.service';
import {StlToGcodeService} from "../../services/stl-to-gcode.service";

// Define the correct type for transform modes
type TransformControlsMode = 'translate' | 'rotate' | 'scale';

@Component({
  selector: 'app-three-with-upload',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './three-with-upload.component.html',
  styleUrl: './three-with-upload.component.css'
})
export class ThreeWithUploadComponent implements OnInit, OnChanges {
  @ViewChild('rendererContainer', { static: true }) rendererContainer!: ElementRef;

  // Add this to the component class properties
  @Output() switchAgentEvent = new EventEmitter<void>();

  // Input to receive model from previous page
  @Input() baseModelGeometry?: THREE.BufferGeometry;
  @Input() stlData: ArrayBuffer | null = null;
  @Input() set movementAction(action: MovementResponse | null) {
    if (!action) return;

    if (this.placementMesh) {
      switch (action.action) {
        case 'position':
          this.placementMesh.position.x += action.values[0];
          this.placementMesh.position.y += action.values[1];
          this.placementMesh.position.z += action.values[2];
          break;

        case 'rotation':
          this.placementMesh.rotation.x += action.values[0];
          this.placementMesh.rotation.y += action.values[1];
          this.placementMesh.rotation.z += action.values[2];
          break;

        case 'scale':
          this.placementMesh.scale.x *= action.values[0];
          this.placementMesh.scale.y *= action.values[1];
          this.placementMesh.scale.z *= action.values[2];
          break;
      }

      // Update the scene
      this.render();
    }
  }

  // Add this render method to the component
  private render(): void {
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private controls!: OrbitControls;
  private transformControls!: TransformControls;

  private buttonExclusionZones: THREE.Box3[] = [];

  private baseMesh?: THREE.Mesh | THREE.Group;
  private placementMesh?: THREE.Mesh | THREE.Group;
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private placementMode = false;
  private baseMeshBoundingBox: THREE.Box3 | null = null;
  private boundingBoxHelpers: THREE.LineSegments[] = [];
  private boundingBoxHelper?: THREE.LineSegments;
  private lastValidTransform = {
    position: new THREE.Vector3(),
    scale: new THREE.Vector3(1, 1, 1),
    rotation: new THREE.Euler()
  };
  private validPlacementAreas: THREE.Mesh[] = [];
  private validPlacementHelper?: THREE.Group;
  private validPlacementZones: THREE.Box3[] = [];

  //To fix mouse not being able to press
  private isOrbitControlActive = false;
  private lastMouseDownTime = 0;
  private readonly ORBIT_CONTROL_COOLDOWN = 300;

  constructor(private stlToGcodeService: StlToGcodeService) {}

  ngOnInit() {
    this.initScene();

    // If we already have STL data, try to load it
    if (this.stlData) {
      setTimeout(() => {
        this.loadStlFromData(this.stlData as ArrayBuffer);
      }, 100);
    }
  }

  ngAfterViewInit() {
    // Create a ResizeObserver to detect container size changes
    const resizeObserver = new ResizeObserver(() => {
      this.onWindowResize();
    });

    // Observe the container element
    if (this.rendererContainer && this.rendererContainer.nativeElement) {
      resizeObserver.observe(this.rendererContainer.nativeElement);
    }

    // Load models after a small delay to ensure DOM is ready
    setTimeout(() => {
      this.loadBaseModel();
      setTimeout(() => {
        this.loadUnicornHorn();
      }, 300);
    }, 100);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['stlData'] && changes['stlData'].currentValue) {
      this.loadStlFromData(changes['stlData'].currentValue);
    }
  }

  private loadStlFromData(buffer: ArrayBuffer): void {
    if (!this.scene) {
      // Existing code for delayed loading
      setTimeout(() => {
        if (this.scene) {
          this.loadStlFromData(buffer);
        } else {
          // Existing code
        }
      }, 300);
      return;
    }

    console.log('Loading STL from provided data buffer...');

    const loader = new STLLoader();
    const geometry = loader.parse(buffer);
    const material = new THREE.MeshStandardMaterial({
      color: 0xaaaaaa,
      metalness: 0.25,
      roughness: 0.1,
      transparent: true,
      opacity: 0.95
    });

    // Create mesh and add to scene
    const mesh = new THREE.Mesh(geometry, material);

    // Center the mesh
    const box = new THREE.Box3().setFromObject(mesh);
    const center = box.getCenter(new THREE.Vector3());
    mesh.position.sub(center);

    // Clear existing objects if needed
    this.clearExistingModel();

    // Add to scene
    this.scene.add(mesh);

    // Store as base mesh
    this.baseMesh = mesh;

    // Focus camera on the newly loaded object and update the grid
    this.fitCameraToObject(mesh);
    this.updateGridToFitObject(mesh);

    // Update bounding box for the new object
    this.updateBaseMeshBoundingBox();

    // Force render
    this.renderer.render(this.scene, this.camera);
  }

  // Method to set exclusion zones where buttons are located
  setButtonExclusionZones(buttonCoordinates: { position: THREE.Vector3, size: THREE.Vector3 }[]): void {
    // Clear existing exclusion zones
    this.buttonExclusionZones = [];

    // Create box zones for each button
    buttonCoordinates.forEach(button => {
      const halfSize = button.size.clone().multiplyScalar(0.5);
      const min = button.position.clone().sub(halfSize);
      const max = button.position.clone().add(halfSize);

      const exclusionZone = new THREE.Box3(min, max);
      this.buttonExclusionZones.push(exclusionZone);

      // Optional: Visualize exclusion zones
      this.visualizeExclusionZone(exclusionZone);
    });

    // Update valid placement areas
    this.updateValidPlacementAreas();
  }

  private updateValidPlacementAreas(): void {
    if (!this.baseMesh) return;

    // Clear existing placement zones
    this.clearBoundingBoxHelpers();

    // Recalculate placement zones
    const rawBox = new THREE.Box3().setFromObject(this.baseMesh);
    const center = rawBox.getCenter(new THREE.Vector3());
    const size = rawBox.getSize(new THREE.Vector3());

    this.createAllSidePlacementZones(rawBox, size, center);

    // Update visualization
    this.renderer.render(this.scene, this.camera);
  }

  // Helper to visualize exclusion zones
  private visualizeExclusionZone(zone: THREE.Box3): void {
    const size = zone.getSize(new THREE.Vector3());
    const center = zone.getCenter(new THREE.Vector3());

    const geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
    const material = new THREE.MeshBasicMaterial({
      color: 0xff0000,
      transparent: true,
      opacity: 0.3,
      wireframe: true
    });

    const visualMesh = new THREE.Mesh(geometry, material);
    visualMesh.position.copy(center);
    this.scene.add(visualMesh);
  }

// Add a new method to adjust grid to fit the loaded object
  private updateGridToFitObject(object: THREE.Object3D): void {
    // Remove existing grid
    this.scene.children.forEach(child => {
      if (child instanceof THREE.GridHelper) {
        this.scene.remove(child);
      }
    });

    // Calculate appropriate grid size based on object dimensions
    const boundingBox = new THREE.Box3().setFromObject(object);
    const size = boundingBox.getSize(new THREE.Vector3());

    // Make grid at least 3x the largest dimension of the object
    const gridSize = Math.max(size.x, size.z) * 3;

    // Ensure grid has enough divisions for detail without being too dense
    const divisions = Math.max(10, Math.min(20, Math.floor(gridSize / 2)));

    // Create and add new grid helper
    const gridHelper = new THREE.GridHelper(gridSize, divisions, 0x888888, 0x444444);

    // Position grid at the bottom of the object
    gridHelper.position.y = boundingBox.min.y;

    this.scene.add(gridHelper);
  }

  clearExistingModel(): void {
    // Remove any existing models from the scene
    // Implementation depends on how you're tracking models in your scene
    this.scene.children.forEach(child => {
      if (child instanceof THREE.Mesh) {
        this.scene.remove(child);
      }
    });
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

    // Replace your orbit control setup with this simplified version
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;

// Simple variables to track dragging
    let isDragging = false;
    let dragStartTime = 0;

// Track when user starts dragging
    this.renderer.domElement.addEventListener('mousedown', () => {
      isDragging = true;
      dragStartTime = Date.now();
    });

// Track when user stops dragging
    this.renderer.domElement.addEventListener('mouseup', () => {
      isDragging = false;
    });

// Add a simple click event handler
    this.renderer.domElement.addEventListener('click', (event) => {
      // If this is a quick click (less than 200ms between mousedown and click)
      // and we're not dragging, process it as a valid click
      const clickDuration = Date.now() - dragStartTime;

      if (clickDuration < 200 && !this.isOrbitControlActive) {
        if (event.button === 0) { // Left click
          if (this.transformControls && this.transformControls.object === this.placementMesh) {
            this.onBaseModelClick(event);
          } else if (this.placementMode) {
            this.onMouseClick(event);
          }
        }
      }
    });

// Use orbit control events simply
    this.controls.addEventListener('start', () => {
      this.isOrbitControlActive = true;
    });

    this.controls.addEventListener('end', () => {
      setTimeout(() => {
        this.isOrbitControlActive = false;
      }, 50); // Small delay to prevent accidental clicks
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

      // Update bounding box and fit camera
      this.updateBaseMeshBoundingBox();
      this.fitCameraToObject(this.baseMesh);

      // Add this line to update the grid
      this.updateGridToFitObject(this.baseMesh);
    }

    // Generate valid placement areas
    setTimeout(() => this.generateValidPlacementAreas(), 500);
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

      // Scale the horn to a reasonable size
      const scaleFactor = 0.5;
      object.scale.set(scaleFactor, scaleFactor, scaleFactor);

      // Add to scene first so we can calculate its bounds
      this.scene.add(this.placementMesh);

      // Find a good position on the base model's surface
      if (this.baseMesh) {
        this.placeObjectOnSurface(this.placementMesh, this.baseMesh);
      } else {
        // Fallback position if no base mesh
        const placementBox = new THREE.Box3().setFromObject(this.placementMesh);
        const placementHeight = placementBox.getSize(new THREE.Vector3()).y;
        this.placementMesh.position.set(0, placementHeight / 2, 0);

        // Add a ground plane for reference
        const groundGeometry = new THREE.PlaneGeometry(20, 20);
        const groundMaterial = new THREE.MeshStandardMaterial({
          color: 0x333333,
          roughness: 0.8,
          metalness: 0.2
        });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2; // Rotate to be horizontal
        ground.position.y = -0.01; // Slightly below the origin
        ground.receiveShadow = true;
        this.scene.add(ground);
      }

      // Set pivot to bottom center after positioning
      if (this.placementMesh) {
        this.placementMesh = this.setPivotToBottomCenter(this.placementMesh);
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
      // Fallback code remains the same
    });
  }

  // Add this helper method to find a good surface point
  private placeObjectOnSurface(objectToPlace: THREE.Object3D, targetObject: THREE.Object3D): void {
    // Get the bounding box of both objects
    const baseBox = new THREE.Box3().setFromObject(targetObject);
    const placeBox = new THREE.Box3().setFromObject(objectToPlace);

    // Calculate dimensions
    const baseSize = baseBox.getSize(new THREE.Vector3());
    const placeSize = placeBox.getSize(new THREE.Vector3());

    // Create raycaster to find surface points
    const raycaster = new THREE.Raycaster();

    // Try several positions on the top surface first
    const topY = baseBox.max.y;
    const possiblePoints = [
      new THREE.Vector3(baseBox.getCenter(new THREE.Vector3()).x, topY + 10, baseBox.getCenter(new THREE.Vector3()).z), // Top center
      new THREE.Vector3(baseBox.min.x + baseSize.x * 0.25, topY + 10, baseBox.min.z + baseSize.z * 0.25), // Top front-left
      new THREE.Vector3(baseBox.max.x - baseSize.x * 0.25, topY + 10, baseBox.min.z + baseSize.z * 0.25), // Top front-right
      new THREE.Vector3(baseBox.min.x + baseSize.x * 0.25, topY + 10, baseBox.max.z - baseSize.z * 0.25), // Top back-left
      new THREE.Vector3(baseBox.max.x - baseSize.x * 0.25, topY + 10, baseBox.max.z - baseSize.z * 0.25)  // Top back-right
    ];

    // Direction to cast ray (downward)
    const direction = new THREE.Vector3(0, -1, 0);

    // Try each point until we find a good hit
    for (const point of possiblePoints) {
      raycaster.set(point, direction);
      const intersects = raycaster.intersectObject(targetObject, true);

      if (intersects.length > 0) {
        // Found intersection point on surface
        const intersectPoint = intersects[0].point;
        const normal = intersects[0].face?.normal.clone() || new THREE.Vector3(0, 1, 0);

        // Transform normal to world space if needed
        if (intersects[0].object.parent) {
          normal.transformDirection(intersects[0].object.matrixWorld);
        }

        // Position object at intersection point
        objectToPlace.position.copy(intersectPoint);

        // Orient the object to point outward from the surface
        if (normal) {
          // Get the camera position to face towards
          const cameraDirection = this.camera.position.clone().sub(intersectPoint).normalize();

          // Calculate how aligned the normal is with the camera direction
          // We want to preserve the normal's direction but make it face somewhat towards the camera
          const alignment = normal.dot(cameraDirection);

          // If normal is pointing too much away from camera, adjust it
          let adjustedNormal = normal.clone();
          if (alignment < 0) {
            // Normal is facing away from camera - rotate it
            adjustedNormal.negate();
          }

          // Create a rotation that aligns the object's up vector with the adjusted normal
          const upVector = new THREE.Vector3(0, 1, 0);
          const quaternion = new THREE.Quaternion();
          quaternion.setFromUnitVectors(upVector, adjustedNormal);

          // Apply the rotation to the object
          objectToPlace.quaternion.copy(quaternion);
        }

        // Add small offset to prevent z-fighting
        objectToPlace.position.add(normal.multiplyScalar(0.05)); // Slightly larger offset for visibility

        // Check if this would place the object inside any exclusion zone
        const placementValid = !this.buttonExclusionZones.some(zone => {
          const newBox = new THREE.Box3().setFromObject(objectToPlace);
          return newBox.intersectsBox(zone);
        });

        if (placementValid) {
          return; // Found a valid position
        }
      }
    }

    // If no valid position found on top, try sides
    const sideDirections = [
      new THREE.Vector3(1, 0, 0),   // Right
      new THREE.Vector3(-1, 0, 0),  // Left
      new THREE.Vector3(0, 0, 1),   // Front
      new THREE.Vector3(0, 0, -1)   // Back
    ];

    for (const dir of sideDirections) {
      // Cast ray from outside the object inward
      const origin = baseBox.getCenter(new THREE.Vector3()).clone();
      origin.add(dir.clone().multiplyScalar(baseSize.length()));

      raycaster.set(origin, dir.clone().negate());
      const intersects = raycaster.intersectObject(targetObject, true);

      if (intersects.length > 0) {
        const intersectPoint = intersects[0].point;
        objectToPlace.position.copy(intersectPoint);

        // Point outward from the surface - reverse the ray direction to point outward
        const outwardDirection = dir.clone();

        // Create a rotation that aligns the object's up vector with the outward direction
        const upVector = new THREE.Vector3(0, 1, 0);
        const quaternion = new THREE.Quaternion();
        quaternion.setFromUnitVectors(upVector, outwardDirection);

        // Apply the rotation
        objectToPlace.quaternion.copy(quaternion);

        // Add small offset to prevent z-fighting
        objectToPlace.position.add(dir.clone().multiplyScalar(0.05));
        return;
      }
    }

    // Fallback: place on top center if nothing else worked
    objectToPlace.position.set(
      baseBox.getCenter(new THREE.Vector3()).x,
      baseBox.max.y + placeSize.y/2 + 0.05,  // Add small offset
      baseBox.getCenter(new THREE.Vector3()).z
    );

    // Reset rotation to default upright position for fallback
    objectToPlace.rotation.set(0, 0, 0);
  }

  private animate(): void {
    requestAnimationFrame(() => this.animate());

    // Set bounding box to render on top of other objects
    if (this.boundingBoxHelper) {
      this.boundingBoxHelper.renderOrder = 999;
    }

    // Also ensure all other bounding box helpers render on top
    if (this.boundingBoxHelpers) {
      this.boundingBoxHelpers.forEach(helper => {
        helper.renderOrder = 999;
      });
    }

    // Continuous boundary check during animation
    if (this.placementMesh && this.transformControls.object === this.placementMesh) {
      this.validatePlacementPosition();
    }

    // Rest of your animate code...
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  private onWindowResize(): void {
    // Get actual container dimensions
    const width = this.rendererContainer.nativeElement.clientWidth;
    const height = this.rendererContainer.nativeElement.clientHeight;

    // Update camera aspect ratio
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    // Update renderer size
    this.renderer.setSize(width, height);

    // Force render to update view
    this.renderer.render(this.scene, this.camera);
  }

// Enhance fitCameraToObject for better focus
  private fitCameraToObject(object: THREE.Object3D): void {
    const boundingBox = new THREE.Box3().setFromObject(object);
    const center = boundingBox.getCenter(new THREE.Vector3());
    const size = boundingBox.getSize(new THREE.Vector3());

    // Calculate maximum dimension for proper framing
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = this.camera.fov * (Math.PI / 180);

    // Calculate ideal camera distance based on object size
    let cameraDistance = Math.abs(maxDim / Math.sin(fov / 2));

    // Apply a slight offset for better view (1.2x)
    cameraDistance *= 1.2;

    // Position camera at an angle for better perspective
    const theta = Math.PI / 4; // 45 degrees
    const phi = Math.PI / 6;   // 30 degrees

    this.camera.position.x = center.x + cameraDistance * Math.sin(theta) * Math.cos(phi);
    this.camera.position.y = center.y + cameraDistance * Math.sin(phi);
    this.camera.position.z = center.z + cameraDistance * Math.cos(theta) * Math.cos(phi);

    // Look at the center of the object
    this.camera.lookAt(center);

    // Update orbit controls
    this.controls.target.copy(center);
    this.controls.update();

    // Force a render to update the view
    this.renderer.render(this.scene, this.camera);
  }

  private onMouseMove(event: MouseEvent): void {
    // Skip if orbit controls are active
    if (this.isOrbitControlActive ||
      this.transformControls.object === this.placementMesh ||
      !this.placementMode || !this.placementMesh || !this.baseMesh) return;

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

      // Check if the active element is an input or textarea
      const activeElement = document.activeElement;
      const isTypingInInput =
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        activeElement?.getAttribute('contenteditable') === 'true';

      // Only process keyboard shortcuts when not typing in an input
      if (!isTypingInInput) {
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
      }
    });
  }

  // Method to update the bounding box based on button locations
  private updateBaseMeshBoundingBox(): void {
    this.clearBoundingBoxHelpers();

    if (!this.baseMesh) {
      this.baseMeshBoundingBox = null;
      if (this.boundingBoxHelper) {
        this.scene.remove(this.boundingBoxHelper);
        this.boundingBoxHelper = undefined;
      }
      return;
    }

    // Calculate base mesh bounding box
    const rawBox = new THREE.Box3().setFromObject(this.baseMesh);
    const center = rawBox.getCenter(new THREE.Vector3());
    const size = rawBox.getSize(new THREE.Vector3());

    // Create placement zones for all sides of the object
    this.createAllSidePlacementZones(rawBox, size, center);

    // If there are no exclusion zones yet, create default ones
    // (assuming buttons are on top surface)
    if (this.buttonExclusionZones.length === 0) {
      // Create a default exclusion zone for the top buttons area
      const buttonHeight = size.y * 0.3; // Top 30% is button area
      const buttonZone = new THREE.Box3(
        new THREE.Vector3(
          rawBox.min.x,
          rawBox.max.y - buttonHeight,
          rawBox.min.z
        ),
        new THREE.Vector3(
          rawBox.max.x,
          rawBox.max.y,
          rawBox.max.z
        )
      );
      this.buttonExclusionZones.push(buttonZone);
      this.visualizeExclusionZone(buttonZone);
    }
  }

  // Method to add additional placement zones on the sides
  private createAllSidePlacementZones(rawBox: THREE.Box3, size: THREE.Vector3, center: THREE.Vector3): void {
    this.validPlacementZones = [];

    // Define all six faces with a slight inset (90% of full size)
    const insetFactor = 0.9;

    // Bottom face
    this.createPlacementZone(
      new THREE.Vector3(
        center.x,
        rawBox.min.y,
        center.z
      ),
      new THREE.Vector3(
        size.x * insetFactor,
        0.01, // Very thin box
        size.z * insetFactor
      ),
      0x00ff00
    );

    // Left face
    this.createPlacementZone(
      new THREE.Vector3(
        rawBox.min.x,
        center.y,
        center.z
      ),
      new THREE.Vector3(
        0.01, // Very thin box
        size.y * insetFactor,
        size.z * insetFactor
      ),
      0x00ffff
    );

    // Right face
    this.createPlacementZone(
      new THREE.Vector3(
        rawBox.max.x,
        center.y,
        center.z
      ),
      new THREE.Vector3(
        0.01,
        size.y * insetFactor,
        size.z * insetFactor
      ),
      0x00ffff
    );

    // Front face
    this.createPlacementZone(
      new THREE.Vector3(
        center.x,
        center.y,
        rawBox.min.z
      ),
      new THREE.Vector3(
        size.x * insetFactor,
        size.y * insetFactor,
        0.01
      ),
      0xff00ff
    );

    // Back face
    this.createPlacementZone(
      new THREE.Vector3(
        center.x,
        center.y,
        rawBox.max.z
      ),
      new THREE.Vector3(
        size.x * insetFactor,
        size.y * insetFactor,
        0.01
      ),
      0xff00ff
    );

    // Top face - only if not fully excluded by buttons
    if (this.buttonExclusionZones.length === 0) {
      this.createPlacementZone(
        new THREE.Vector3(
          center.x,
          rawBox.max.y,
          center.z
        ),
        new THREE.Vector3(
          size.x * insetFactor,
          0.01,
          size.z * insetFactor
        ),
        0x00ff00
      );
    }
  }

  private createPlacementZone(position: THREE.Vector3, size: THREE.Vector3, color: number): void {
    // Create box for the zone
    const boxGeometry = new THREE.BoxGeometry(size.x, size.y, size.z);
    const edges = new THREE.EdgesGeometry(boxGeometry);
    const lineMaterial = new THREE.LineBasicMaterial({
      color: color,
      linewidth: 2
    });

    const boxHelper = new THREE.LineSegments(edges, lineMaterial);
    boxHelper.position.copy(position);
    boxHelper.renderOrder = 999;
    this.scene.add(boxHelper);
    this.boundingBoxHelpers.push(boxHelper);

    // Store corresponding bounding box for validation
    const halfSize = size.clone().multiplyScalar(0.5);
    const min = position.clone().sub(halfSize);
    const max = position.clone().add(halfSize);

    this.validPlacementZones.push(new THREE.Box3(min, max));
  }


  private isPlacementWithinBaseBounds(): boolean {
    if (!this.placementMesh) return false;

    // Create bounding box for the placement mesh
    const placementBox = new THREE.Box3().setFromObject(this.placementMesh);

    // Check if placement intersects with any button exclusion zones
    for (const zone of this.buttonExclusionZones) {
      if (placementBox.intersectsBox(zone)) {
        return false; // Placement overlaps with a button area
      }
    }

    // Check if placement is within any valid placement zone
    for (const zone of this.validPlacementZones) {
      // Only require that the placement box intersects with a valid zone
      // This allows placement at edges between zones
      if (placementBox.intersectsBox(zone)) {
        return true;
      }
    }

    return false;
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

  private isPlacementValid(position: THREE.Vector3): boolean {
    if (!this.placementMesh || this.validPlacementAreas.length === 0) {
      return this.isPlacementWithinBaseBounds(); // Fall back to old method
    }

    // Ray cast from the placement position to find the closest valid surface
    const raycaster = new THREE.Raycaster();

    // Cast in 6 directions to find closest surface
    const directions = [
      new THREE.Vector3(0, -1, 0), // Down
      new THREE.Vector3(0, 1, 0),  // Up
      new THREE.Vector3(1, 0, 0),  // Right
      new THREE.Vector3(-1, 0, 0), // Left
      new THREE.Vector3(0, 0, 1),  // Forward
      new THREE.Vector3(0, 0, -1)  // Back
    ];

    for (const direction of directions) {
      raycaster.set(position, direction);
      const intersects = raycaster.intersectObjects(this.validPlacementAreas);

      if (intersects.length > 0 && intersects[0].distance < 1.0) {
        return true; // Close to a valid placement area
      }
    }

    return false;
  }

  // Toggle visibility of valid placement areas
  private showValidPlacementAreas(show: boolean): void {
    this.validPlacementAreas.forEach(area => {
      area.visible = show;
    });
  }

  toggleBoundingBoxVisibility(): void {
    if (this.boundingBoxHelper) {
      const visible = !this.boundingBoxHelper.visible;

      // Toggle main bounding box
      this.boundingBoxHelper.visible = visible;

      // Toggle all additional bounding boxes
      if (this.boundingBoxHelpers) {
        this.boundingBoxHelpers.forEach(helper => {
          helper.visible = visible;
        });
      }

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
    if (!this.baseMesh || !this.placementMesh || this.isOrbitControlActive) return;

    // Calculate mouse position in normalized device coordinates
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    // Update raycaster
    this.raycaster.setFromCamera(this.mouse, this.camera);

    // Check for intersections with base mesh only
    const intersects = this.raycaster.intersectObject(this.baseMesh, true);

    if (intersects.length > 0) {
      // Store previous position and rotation for reverting if needed
      const oldPosition = this.placementMesh.position.clone();
      const oldQuaternion = this.placementMesh.quaternion.clone();

      // Get intersection point and normal
      const intersectPoint = intersects[0].point;
      const normal = intersects[0].face?.normal.clone() || new THREE.Vector3();

      if (intersects[0].face) {
        // Ensure normal is in world space
        normal.transformDirection(this.baseMesh instanceof THREE.Mesh ?
          this.baseMesh.matrixWorld :
          (intersects[0].object as THREE.Mesh).matrixWorld);

        // Create rotation to align with surface normal
        const alignQuaternion = new THREE.Quaternion();
        const upVector = new THREE.Vector3(0, 1, 0);
        alignQuaternion.setFromUnitVectors(upVector, normal);

        // Apply position and rotation
        this.placementMesh.position.copy(intersectPoint);
        this.placementMesh.quaternion.copy(alignQuaternion);

        // Move object slightly out from surface to prevent z-fighting
        const offset = 0.01;
        this.placementMesh.position.add(normal.multiplyScalar(offset));

        // Check if the new position is valid
        if (!this.isPlacementWithinBaseBounds()) {
          // Revert to previous position and rotation
          this.placementMesh.position.copy(oldPosition);
          this.placementMesh.quaternion.copy(oldQuaternion);
          console.log("Cannot place object on button area or outside valid placement zones.");
        } else {
          // Update the last valid transform
          this.lastValidTransform.position.copy(this.placementMesh.position);
          this.lastValidTransform.rotation.copy(this.placementMesh.rotation);
        }
      }
    }
  }

  // Add this method to detect and create valid placement areas
  private generateValidPlacementAreas(): void {
    if (!this.baseMesh) return;

    // Clear any existing placement areas
    this.validPlacementAreas.forEach(area => this.scene.remove(area));
    this.validPlacementAreas = [];

    // First, analyze the base mesh to identify buttons/protrusions
    const baseBox = new THREE.Box3().setFromObject(this.baseMesh);
    const baseSize = baseBox.getSize(new THREE.Vector3());
    const baseCenter = baseBox.getCenter(new THREE.Vector3());

    // Create a raycaster to detect surface features
    const raycaster = new THREE.Raycaster();
    const directions = [
      new THREE.Vector3(0, 1, 0),  // Top
      new THREE.Vector3(0, -1, 0), // Bottom
      new THREE.Vector3(1, 0, 0),  // Right
      new THREE.Vector3(-1, 0, 0), // Left
      new THREE.Vector3(0, 0, 1),  // Front
      new THREE.Vector3(0, 0, -1)  // Back
    ];

    // Sample points on each face to detect buttons
    const resolution = 20; // Higher value = more accurate detection but slower
    const stepX = baseSize.x / resolution;
    const stepY = baseSize.y / resolution;
    const stepZ = baseSize.z / resolution;

    // Process each face to create placement areas
    directions.forEach(direction => {
      // Skip bottom face if we don't want placement there
      if (direction.y < 0) return;

      // Create a grid of points for this face
      const points: THREE.Vector3[] = [];
      const normal = direction.clone();

      // Create sampling points based on the face
      if (Math.abs(direction.y) > 0.5) {
        // Top/bottom face
        const y = direction.y > 0 ? baseBox.max.y : baseBox.min.y;
        for (let x = baseBox.min.x; x <= baseBox.max.x; x += stepX) {
          for (let z = baseBox.min.z; z <= baseBox.max.z; z += stepZ) {
            points.push(new THREE.Vector3(x, y, z));
          }
        }
      } else if (Math.abs(direction.x) > 0.5) {
        // Left/right face
        const x = direction.x > 0 ? baseBox.max.x : baseBox.min.x;
        for (let y = baseBox.min.y; y <= baseBox.max.y; y += stepY) {
          for (let z = baseBox.min.z; z <= baseBox.max.z; z += stepZ) {
            points.push(new THREE.Vector3(x, y, z));
          }
        }
      } else {
        // Front/back face
        const z = direction.z > 0 ? baseBox.max.z : baseBox.min.z;
        for (let x = baseBox.min.x; x <= baseBox.max.x; x += stepX) {
          for (let y = baseBox.min.y; y <= baseBox.max.y; y += stepY) {
            points.push(new THREE.Vector3(x, y, z));
          }
        }
      }

      // Create placement map for this face
      const facePlacementMap: boolean[][] = Array(resolution)
        .fill(null)
        .map(() => Array(resolution).fill(true));

      // Raycast from each point to detect buttons
      points.forEach((point, index) => {
        // Calculate grid coordinates
        const gridX = Math.floor(index / resolution) % resolution;
        const gridY = index % resolution;

        // Cast ray from outside inward
        const rayOrigin = point.clone().add(direction.clone().multiplyScalar(baseSize.length()));
        raycaster.set(rayOrigin, direction.clone().negate());

        const intersects = raycaster.intersectObject(this.baseMesh!, true);
        if (intersects.length > 0) {
          const hitPoint = intersects[0].point;

          // If hit point is significantly different from expected point, mark as invalid
          const expectedDist = point.distanceTo(baseCenter);
          const actualDist = hitPoint.distanceTo(baseCenter);

          // Detect irregularities that could indicate buttons
          if (Math.abs(expectedDist - actualDist) > baseSize.length() * 0.02) { // 2% tolerance
            facePlacementMap[gridX][gridY] = false;
          }
        }
      });

      // Create a placement surface based on valid areas
      this.createPlacementSurface(facePlacementMap, direction, baseBox);
    });
  }


  private clearBoundingBoxHelpers(): void {
    // Clear additional bounding box helpers
    if (this.boundingBoxHelpers) {
      for (const helper of this.boundingBoxHelpers) {
        this.scene.remove(helper);
      }
      this.boundingBoxHelpers = [];
      this.validPlacementZones = [];
    }
  }


// Create visual representation of valid placement areas
  private createPlacementSurface(placementMap: boolean[][], direction: THREE.Vector3, baseBox: THREE.Box3): void {
    const baseSize = baseBox.getSize(new THREE.Vector3());

    // Create a shape representing valid placement areas
    const shape = new THREE.Shape();

    // Convert placement map to a shape
    const resolution = placementMap.length;
    let started = false;

    // Find valid regions (this is simplified - for a real app, you'd want connected component analysis)
    // For now, create a simple rectangular valid region based on largest continuous area

    // Dummy implementation - create a plane offset from the face
    let planeWidth, planeHeight, planeGeometry;
    const offset = baseSize.length() * 0.001; // Tiny offset to avoid z-fighting

    if (Math.abs(direction.y) > 0.5) {
      // Top/bottom face
      planeGeometry = new THREE.PlaneGeometry(baseSize.x * 0.8, baseSize.z * 0.8);
      const y = direction.y > 0 ? baseBox.max.y + offset : baseBox.min.y - offset;
      const validSurface = new THREE.Mesh(
        planeGeometry,
        new THREE.MeshBasicMaterial({
          color: 0x88ff88,
          transparent: true,
          opacity: 0.3,
          side: THREE.DoubleSide
        })
      );
      validSurface.position.set(baseBox.getCenter(new THREE.Vector3()).x, y, baseBox.getCenter(new THREE.Vector3()).z);
      validSurface.rotation.x = Math.PI / 2;
      validSurface.visible = false; // Hidden by default, toggle with a UI control

      this.scene.add(validSurface);
      this.validPlacementAreas.push(validSurface);
    }
    // Similar cases for other directions
  }

  // Identify flat surfaces on the base model
  private identifyFlatSurfaces(): void {
    if (!this.baseMesh) return;

    // Create a simplified version of the mesh for analysis
    const simplifiedGeometry = this.baseMesh instanceof THREE.Mesh ?
      this.baseMesh.geometry.clone() : new THREE.BufferGeometry();

    // Get normals
    const normals = simplifiedGeometry.getAttribute('normal');
    const positions = simplifiedGeometry.getAttribute('position');

    if (!normals || !positions) {
      console.error("Geometry doesn't have normal or position attributes");
      return;
    }

    // Create a helper to visualize normals
    const helper = new THREE.Group();
    const upThreshold = 0.9; // Cos of about 25 degrees

    // Identify areas with up-facing normals
    const upFacingPositions: THREE.Vector3[] = [];

    for (let i = 0; i < normals.count; i++) {
      const nx = normals.getX(i);
      const ny = normals.getY(i);
      const nz = normals.getZ(i);

      // Check if normal is pointing up (Y+)
      if (ny > upThreshold) {
        const px = positions.getX(i);
        const py = positions.getY(i);
        const pz = positions.getZ(i);

        upFacingPositions.push(new THREE.Vector3(px, py, pz));
      }
    }

    // Create a heat map of valid placement areas
    const material = new THREE.MeshBasicMaterial({
      color: 0x00ff00,
      transparent: true,
      opacity: 0.5
    });

    upFacingPositions.forEach(pos => {
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(0.05),
        material
      );
      dot.position.copy(pos);
      helper.add(dot);
    });

    this.scene.add(helper);
    helper.visible = false; // Hide by default

    // Store the helper for later use
    this.validPlacementHelper = helper;
  }

// Add a toggle method
  toggleValidPlacementAreas(): void {
    if (this.validPlacementHelper) {
      this.validPlacementHelper.visible = !this.validPlacementHelper.visible;
    } else {
      this.identifyFlatSurfaces();
    }
  }

  submitToBackend(): void {
    if (!this.baseMesh) {
      console.error('Cannot submit: Missing base mesh');
      return;
    }

    // Create a new exporter
    const exporter = new STLExporter();

    // Create a group and add the meshes (same as in exportCombined)
    const group = new THREE.Group();
    group.add(this.baseMesh.clone());

    if (this.placementMesh) {
      group.add(this.placementMesh.clone());
    }

    // Export the combined STL to binary format
    const stlData = exporter.parse(group, { binary: true });

    // Create a blob from the STL data
    const blob = new Blob([stlData], { type: 'application/octet-stream' });

    // Use the service to convert STL to GCode
    this.stlToGcodeService.convertStlToGcode(blob).subscribe({
      next: (response: Blob) => {
        console.log('Successfully converted to gcode');
        // Create a URL for the blob and download it
        const url = URL.createObjectURL(response);
        this.downloadFile(url, 'model.gcode');
        // Clean up the URL object after download
        setTimeout(() => URL.revokeObjectURL(url), 100);
      },
      error: (error) => {
        console.error('Error converting to gcode:', error);
      }
    });
  }

  // Add this method if it doesn't exist already
  private downloadFile(url: string, filename: string): void {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

}
