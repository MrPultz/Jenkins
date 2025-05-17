import {Component, ElementRef, ViewChild, OnInit, Input, EventEmitter, Output, SimpleChanges, OnChanges} from '@angular/core';
import { CommonModule } from '@angular/common';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
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
  @Input() buttonLayout: number[][] | null = null;

  // Input to receive model from previous page
  @Input() baseModelGeometry?: THREE.BufferGeometry;
  @Input() stlData: ArrayBuffer | null = null;

  private isFirstLoad = true;

  @Input() set movementAction(action: MovementResponse | null) {
    if (action) {
      this.applyMovementAction(action);
    }
  }

  // Add to your component properties
  public availableModels = [
    { id: 'unicornHorn', name: 'Unicorn Horn', path: 'assets/previewModel/unicornHorn.fbx' },
    { id: 'flower', name: 'flower', path: 'assets/previewModel/flower.fbx' },
    { id: 'duck', name: 'duck', path: 'assets/previewModel/duck.fbx' },
    { id: 'head', name: 'head', path: 'assets/previewModel/head.fbx' }
  ];
  public currentModelId = 'unicornHorn';
  public isModelSelectorOpen = false;

  hasBaseMesh(): boolean {
    return !!this.baseMesh;
  }

  // Add this method to show the model selector popup
  showModelSelector(): void {
    this.isModelSelectorOpen = true;
  }

  handleImageError(event: any): void {
    // Set a fallback image when loading fails
    event.target.src = '/assets/images/thumbnails/placeholder.png';
    // If the placeholder also fails, show a colored div instead
    event.target.onerror = () => {
      event.target.style.display = 'none';
      event.target.parentElement.classList.add('placeholder-thumbnail');
    }
  }

  // Add this method to select a model and close the popup
  selectModel(modelId: string): void {
    if (this.currentModelId !== modelId) {
      this.currentModelId = modelId;

      // Remove existing placement mesh
      if (this.placementMesh) {
        // Detach from transform controls first
        if (this.transformControls && this.transformControls.object === this.placementMesh) {
          this.transformControls.detach();
        }

        this.scene.remove(this.placementMesh);
        this.placementMesh = undefined;
      }

      // Load the selected model
      const selectedModel = this.availableModels.find(model => model.id === modelId);
      if (selectedModel) {
        this.loadModel(selectedModel.path);
      }
    }

    this.isModelSelectorOpen = false;
  }

// Add this method to close the popup without selecting
  closeModelSelector(): void {
    this.isModelSelectorOpen = false;
  }

  private loadModel(modelPath: string): void {
    const fbxLoader = new FBXLoader();

    fbxLoader.load(modelPath, (object) => {
      // Set up materials
      object.traverse(child => {
        if (child instanceof THREE.Mesh) {
          child.material = new THREE.MeshPhysicalMaterial({
            color: 0xffffff,
            metalness: 0.3,
            roughness: 0.4,
            clearcoat: 0.5
          });
          child.castShadow = true;
        }
      });

      // Create a pivot group
      const pivotGroup = new THREE.Group();

      // Get the model's bounding box
      const modelBox = new THREE.Box3().setFromObject(object);

      // Fix the pivot point - adjust position so bottom is at origin
      object.position.y = -modelBox.min.y;

      // Add to pivot group
      pivotGroup.add(object);
      this.scene.add(pivotGroup);

      // Set reference and scale
      this.placementMesh = pivotGroup;
      const scaleFactor = 0.5;
      this.placementMesh.scale.set(scaleFactor, scaleFactor, scaleFactor);

      if (this.baseMesh) {
        // Place model on top center of base model
        this.placeHornOnTop();

        // Attach to transform controls
        this.transformControls.attach(this.placementMesh);
        this.transformControls.setMode('translate');

        // Store valid state
        this.lastValidTransform.position.copy(this.placementMesh.position);
        this.lastValidTransform.rotation.copy(this.placementMesh.rotation);
        this.lastValidTransform.scale.copy(this.placementMesh.scale);
      }

      // Force render update
      this.renderer.render(this.scene, this.camera);
    }, undefined, (error) => {
      console.error('Error loading model:', error);
    });
  }

// Public method to get model context
  getModelContext(): any {
    if (!this.baseMesh) return null;

    const baseBox = new THREE.Box3().setFromObject(this.baseMesh);
    const baseSize = baseBox.getSize(new THREE.Vector3());
    const baseCenter = baseBox.getCenter(new THREE.Vector3());

    return {
      dimensions: {
        width: baseSize.x,
        height: baseSize.y,
        depth: baseSize.z
      },
      center: {
        x: baseCenter.x,
        y: baseCenter.y,
        z: baseCenter.z
      },
      boundingBox: {
        min: {
          x: baseBox.min.x,
          y: baseBox.min.y,
          z: baseBox.min.z
        },
        max: {
          x: baseBox.max.x,
          y: baseBox.max.y,
          z: baseBox.max.z
        }
      }
    };
  }

// Method to apply movement actions received from agent
  applyMovementAction(action: MovementResponse): void {
    if (!this.placementMesh) return;

    if (action.action === 'position') {
      this.placementMesh.position.set(
        action.values[0],
        action.values[1],
        action.values[2]
      );
    } else if (action.action === 'rotation') {
      this.placementMesh.rotation.set(
        action.values[0],
        action.values[1],
        action.values[2]
      );
    } else if (action.action === 'scale') {
      this.placementMesh.scale.set(
        action.values[0],
        action.values[1],
        action.values[2]
      );
    }

    // Update the scene
    this.renderer.render(this.scene, this.camera);

    // Check if placement is valid
    this.validatePlacementPosition();
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
    // Initialize the scene
    this.initScene();

    // First load the base model
    // If we already have STL data, try to load it
    if (this.stlData) {
      setTimeout(() => {
        this.loadStlFromData(this.stlData as ArrayBuffer);
      }, 100);
    }

    // Then show model selector for the decoration on first load
    if (this.isFirstLoad) {
      // Show model selector after base model is loaded
      setTimeout(() => this.showModelSelector(), 500);
      this.isFirstLoad = false;
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
    if (changes['buttonLayout'] && changes['buttonLayout'].currentValue) {
      // Wait for base model to be loaded before setting buttons
      if (this.baseMesh) {
        this.setButtonsFromLayout(changes['buttonLayout'].currentValue);
      } else {
        // If base mesh isn't loaded yet, store the layout for later
        const checkInterval = setInterval(() => {
          if (this.baseMesh) {
            this.setButtonsFromLayout(this.buttonLayout!);
            clearInterval(checkInterval);
          }
        }, 200);

        // Clear interval after a timeout to avoid infinite checking
        setTimeout(() => clearInterval(checkInterval), 5000);
      }
    }
  }

  // Add to the ThreeWithUploadComponent class
  setButtonLayoutFromInput(layout: number[][]): void {
    if (layout && layout.length > 0) {
      console.log('Setting button layout:', layout);
      this.buttonExclusionZones = []; // Clear existing zones first
      this.setButtonsFromLayout(layout);
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

    // Add rotation correction - rotate 90 degrees around X-axis
    mesh.rotation.x = -Math.PI/2;

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

    // Add debugging information
    console.log('Model added to scene successfully');
    console.log('Model position:', mesh.position);
    console.log('Model scale:', mesh.scale);
    console.log('Model rotation:', mesh.rotation);
    console.log('Camera position:', this.camera.position);
  }

  // Modify the setButtonsFromLayout method to better align with the model's orientation
  // Modify the setButtonsFromLayout method to properly align buttons to the top surface
  setButtonsFromLayout(buttonLayout: number[][]): void {
    if (!buttonLayout || !buttonLayout.length || !this.baseMesh) return;

    // Clear existing exclusion zones
    this.buttonExclusionZones = [];

    // Remove any previous button visualizations
    this.scene.children.forEach(child => {
      if (child.userData && child.userData['isButton']) {
        this.scene.remove(child);
      }
    });

    // Get base dimensions but don't visualize anything
    const baseBox = new THREE.Box3().setFromObject(this.baseMesh);

    // Store button information for internal use only without creating visual elements
    buttonLayout.forEach(button => {
      if (button.length >= 3) {
        // Just parse the button data but don't create visual elements
        const [x, y, text] = button;
        // Process button data only for logical/functional aspects
      }
    });

    // Render scene
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
    // Do nothing - no visualization
    this.renderer.render(this.scene, this.camera);
  }

// Add this method to ensure thorough cleanup of all helpers
  private clearBoundingBoxHelpers(): void {
    // Remove existing bounding box helpers
    this.boundingBoxHelpers.forEach(helper => {
      this.scene.remove(helper);
    });
    this.boundingBoxHelpers = [];

    // Also remove the main bounding box helper if it exists
    if (this.boundingBoxHelper) {
      this.scene.remove(this.boundingBoxHelper);
      this.boundingBoxHelper = undefined;
    }

    // Remove any valid placement visualizations
    if (this.validPlacementHelper) {
      this.scene.remove(this.validPlacementHelper);
      this.validPlacementHelper = undefined;
    }

    // Also look for any mesh with a material that might be a visualization
    this.scene.children.forEach(child => {
      if (child instanceof THREE.Mesh &&
        child.material instanceof THREE.MeshBasicMaterial &&
        child.material.wireframe === true) {
        // This is likely a visualization mesh
        this.scene.remove(child);
      }
    });
  }

  // Helper method to add a valid placement zone without visual representation
  private addValidPlacementZone(position: THREE.Vector3, size: THREE.Vector3): void {
    // Store corresponding bounding box for validation
    const halfSize = size.clone().multiplyScalar(0.5);
    const min = position.clone().sub(halfSize);
    const max = position.clone().add(halfSize);

    this.validPlacementZones.push(new THREE.Box3(min, max));
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

      // Add rotation correction
      this.baseMesh.rotation.x = -Math.PI/2;

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

  // Replace the loadUnicornHorn method with this
  private loadUnicornHorn(): void {
    const initialModel = this.availableModels.find(model => model.id === 'unicornHorn');
    if (initialModel) {
      this.loadModel(initialModel.path);
    }
  }


  // Add a dedicated method for placing the horn on a surface
  private placeHornOnSurface(): void {
    if (!this.baseMesh || !this.placementMesh) return;

    // Get base model bounding box
    const baseBox = new THREE.Box3().setFromObject(this.baseMesh);
    const baseCenter = baseBox.getCenter(new THREE.Vector3());

    // Create raycaster
    const raycaster = new THREE.Raycaster();

    // Start position above the model
    const startPosition = new THREE.Vector3(
      baseCenter.x,
      baseBox.max.y + 10,
      baseCenter.z
    );

    // Direction pointing down
    const direction = new THREE.Vector3(0, -1, 0);

    // Cast ray downward
    raycaster.set(startPosition, direction);
    const intersects = raycaster.intersectObject(this.baseMesh, true);

    if (intersects.length > 0) {
      // Found a surface point - place horn exactly at this point
      // The pivot is already at the bottom of the horn
      this.placementMesh.position.copy(intersects[0].point);

      // Align with surface normal if available
      if (intersects[0].face && intersects[0].face.normal) {
        const normal = intersects[0].face.normal.clone();
        // Transform normal to world space
        if (intersects[0].object.parent) {
          const normalMatrix = new THREE.Matrix3().getNormalMatrix(
            intersects[0].object.matrixWorld
          );
          normal.applyMatrix3(normalMatrix).normalize();
        }

        // Create rotation to align with normal
        const upVector = new THREE.Vector3(0, 1, 0);
        const quaternion = new THREE.Quaternion();
        quaternion.setFromUnitVectors(upVector, normal);
        this.placementMesh.quaternion.copy(quaternion);
      }

      // Check if this position is valid (outside button zones)
      if (this.isInExclusionZone(this.placementMesh)) {
        // If in exclusion zone, try to find another position
        // For simplicity, just move to a different spot on top
        this.placementMesh.position.set(
          baseCenter.x + (Math.random() - 0.5) * baseBox.getSize(new THREE.Vector3()).x * 0.5,
          baseBox.max.y,
          baseCenter.z + (Math.random() - 0.5) * baseBox.getSize(new THREE.Vector3()).z * 0.5
        );
        this.placementMesh.rotation.set(0, 0, 0);
      }
    } else {
      // Fallback: place on top center
      this.placementMesh.position.set(
        baseCenter.x,
        baseBox.max.y,
        baseCenter.z
      );
      this.placementMesh.rotation.set(0, 0, 0);
    }
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

    // Make sure we avoid button exclusion zones
    const possiblePoints = [];

    // Generate several possible placement points, prioritizing non-button areas
    // Try points along the model's surface
    const samples = 15; // Increase this number for more placement candidates

    for (let i = 0; i < samples; i++) {
      for (let j = 0; j < samples; j++) {
        // Calculate positions around the model
        const x = baseBox.min.x + (baseSize.x * i) / (samples - 1);
        const z = baseBox.min.z + (baseSize.z * j) / (samples - 1);

        // Add points at different heights
        possiblePoints.push(new THREE.Vector3(x, baseBox.max.y + 2, z)); // Top
        possiblePoints.push(new THREE.Vector3(x, baseBox.min.y - 2, z)); // Bottom
      }

      // Add points on sides as well
      const t = i / (samples - 1);
      possiblePoints.push(new THREE.Vector3(baseBox.min.x - 2, baseBox.min.y + baseSize.y * t, baseBox.min.z + baseSize.z * t)); // Left
      possiblePoints.push(new THREE.Vector3(baseBox.max.x + 2, baseBox.min.y + baseSize.y * t, baseBox.min.z + baseSize.z * t)); // Right
      possiblePoints.push(new THREE.Vector3(baseBox.min.x + baseSize.x * t, baseBox.min.y + baseSize.y * t, baseBox.min.z - 2)); // Front
      possiblePoints.push(new THREE.Vector3(baseBox.min.x + baseSize.x * t, baseBox.min.y + baseSize.y * t, baseBox.max.z + 2)); // Back
    }

    // Shuffle array to randomize placement attempts
    possiblePoints.sort(() => Math.random() - 0.5);

    // Try each point until we find a valid placement
    for (const point of possiblePoints) {
      // Determine direction toward the model
      const direction = new THREE.Vector3().subVectors(baseBox.getCenter(new THREE.Vector3()), point).normalize();

      // Cast ray toward the model
      raycaster.set(point, direction);
      const intersects = raycaster.intersectObject(targetObject, true);

      if (intersects.length > 0) {
        // Found intersection point on surface
        const intersectPoint = intersects[0].point;
        const normal = intersects[0].face?.normal.clone() || new THREE.Vector3(0, 1, 0);

        // Transform normal to world space
        if (intersects[0].object.parent) {
          const normalMatrix = new THREE.Matrix3().getNormalMatrix(
            intersects[0].object.matrixWorld
          );
          normal.applyMatrix3(normalMatrix).normalize();
        }

        // Position object at intersection point (exactly on the surface)
        objectToPlace.position.copy(intersectPoint);

        // Create a rotation to align the horn with the surface normal
        const upVector = new THREE.Vector3(0, 1, 0);
        const quaternion = new THREE.Quaternion();
        quaternion.setFromUnitVectors(upVector, normal);
        objectToPlace.quaternion.copy(quaternion);

        // Since the pivot is now at the bottom of the horn,
        // we don't need to add additional offset from the surface

        // Check if this is a valid placement (not in button exclusion zone)
        const placementValid = !this.isInExclusionZone(objectToPlace);

        if (placementValid) {
          return; // Found valid placement
        }
      }
    }

    // Fallback: place on top center if nothing else worked
    objectToPlace.position.set(
      baseBox.getCenter(new THREE.Vector3()).x,
      baseBox.max.y,  // No offset needed as pivot is at bottom
      baseBox.getCenter(new THREE.Vector3()).z
    );

    // Reset rotation to default upright position for fallback
    objectToPlace.rotation.set(0, 0, 0);
  }

  // Helper method to check if an object intersects with any exclusion zone
  private isInExclusionZone(object: THREE.Object3D): boolean {
    const objectBox = new THREE.Box3().setFromObject(object);
    const objectCenter = objectBox.getCenter(new THREE.Vector3());

    for (const zone of this.buttonExclusionZones) {
      if (objectBox.intersectsBox(zone)) {
        // For more accurate circular detection, calculate distance to button center
        const zoneCenter = zone.getCenter(new THREE.Vector3());
        const zoneSize = zone.getSize(new THREE.Vector3());

        // XY distance (ignoring Z)
        const dx = objectCenter.x - zoneCenter.x;
        const dy = objectCenter.y - zoneCenter.y;
        const distance = Math.sqrt(dx*dx + dy*dy);

        // Consider the radius (half the width of the zone)
        const buttonRadius = Math.max(zoneSize.x, zoneSize.y) / 2;

        // For objects with significant size, add half the object's width
        const objectSize = objectBox.getSize(new THREE.Vector3());
        const objectRadius = Math.max(objectSize.x, objectSize.y) / 2;

        // If the distance between centers is less than the sum of radii, they intersect
        if (distance < (buttonRadius + objectRadius * 0.8)) {
          return true;
        }
      }
    }

    return false;
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
  // Disable the bounding box visualization functionality
  private updateBaseMeshBoundingBox(): void {
    // Don't create any bounding box visualization
    // Just calculate the base mesh bounding box for internal use
    if (!this.baseMesh) return;

    // Calculate base mesh bounding box
    const rawBox = new THREE.Box3().setFromObject(this.baseMesh);
    const center = rawBox.getCenter(new THREE.Vector3());
    const size = rawBox.getSize(new THREE.Vector3());

    // Store for internal use (without visualizing)
    this.baseMeshBoundingBox = rawBox;
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
    // Store corresponding bounding box for validation only, no visual representation
    const halfSize = size.clone().multiplyScalar(0.5);
    const min = position.clone().sub(halfSize);
    const max = position.clone().add(halfSize);

    this.validPlacementZones.push(new THREE.Box3(min, max));
  }

// Add a new method to place horn on top
  private placeHornOnTop(): void {
    if (!this.baseMesh || !this.placementMesh) return;

    // Get base model bounding box
    const baseBox = new THREE.Box3().setFromObject(this.baseMesh);

    // Position at top center
    this.placementMesh.position.set(
      baseBox.getCenter(new THREE.Vector3()).x,
      baseBox.max.y,  // Top of the box
      baseBox.getCenter(new THREE.Vector3()).z
    );

    // Reset rotation to default upright position
    this.placementMesh.rotation.set(0, 0, 0);
  }


  private isPlacementWithinBaseBounds(): boolean {
    if (!this.placementMesh) return false;

    // Create bounding box for the placement mesh
    const placementBox = new THREE.Box3().setFromObject(this.placementMesh);

    // First check: must not intersect with button exclusion zones
    for (const zone of this.buttonExclusionZones) {
      if (placementBox.intersectsBox(zone)) {
        return false; // Placement overlaps with a button area
      }
    }

    // Second check: must be near or on the model surface
    // Simplify by just checking if it overlaps with the expanded model zone
    for (const zone of this.validPlacementZones) {
      if (placementBox.intersectsBox(zone)) {
        return true; // Within valid zone
      }
    }

    // If no valid zones (shouldn't happen), allow placement
    return this.validPlacementZones.length === 0;
  }

  private validatePlacementPosition(): void {
    if (!this.placementMesh) return;

    // Store current position as valid without any validation
    this.lastValidTransform.position.copy(this.placementMesh.position);
    this.lastValidTransform.scale.copy(this.placementMesh.scale);
    this.lastValidTransform.rotation.copy(this.placementMesh.rotation);
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
    // No-op - we don't want to show bounding boxes
    return;
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
      // Get intersection point and normal
      const intersectPoint = intersects[0].point;
      const normal = intersects[0].face?.normal.clone() || new THREE.Vector3(0, 1, 0);

      if (intersects[0].face) {
        // Transform normal to world space
        if (intersects[0].object.parent) {
          const normalMatrix = new THREE.Matrix3().getNormalMatrix(
            intersects[0].object.matrixWorld
          );
          normal.applyMatrix3(normalMatrix).normalize();
        }

        // Calculate position on the surface with slight offset
        const surfacePoint = intersectPoint.clone().add(normal.clone().multiplyScalar(0.05));

        // Create rotation to align with surface normal
        const alignQuaternion = new THREE.Quaternion();
        const upVector = new THREE.Vector3(0, 1, 0);
        alignQuaternion.setFromUnitVectors(upVector, normal);

        // Apply position and rotation
        this.placementMesh.position.copy(surfacePoint);
        this.placementMesh.quaternion.copy(alignQuaternion);

        // Update last valid transform
        this.lastValidTransform.position.copy(this.placementMesh.position);
        this.lastValidTransform.rotation.copy(this.placementMesh.rotation);
        this.lastValidTransform.scale.copy(this.placementMesh.scale);
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
