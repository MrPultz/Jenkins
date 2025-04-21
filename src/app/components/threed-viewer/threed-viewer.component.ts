import {
  AfterViewInit,
  Component,
  Input,
  ElementRef,
  HostListener,
  OnDestroy,
  SimpleChanges,
  OnInit,
  ViewChild,
  Output,
  EventEmitter,
} from '@angular/core';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader";
import {Router} from "@angular/router";

@Component({
  selector: 'app-threed-viewer',
  standalone: true,
  imports: [],
  templateUrl: './threed-viewer.component.html',
  styleUrl: './threed-viewer.component.css'
})
export class ThreedViewerComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input() modelUrl: string | null = null;
  @Output() switchModelEvent = new EventEmitter<void>();

  @ViewChild('mainCanvas') mainCanvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('miniViewport') miniViewportRef!: ElementRef<HTMLDivElement>;

  // Main scene
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private controls!: OrbitControls;
  private model!: THREE.Object3D;

  // Mini scene (navigation cube)
  private miniScene!: THREE.Scene;
  private miniCamera!: THREE.PerspectiveCamera;
  private miniRenderer!: THREE.WebGLRenderer;
  private miniCube!: THREE.Mesh;
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();

  // Camera positions
  private cameraPositions = {
    front: new THREE.Vector3(0, 0, 5),
    back: new THREE.Vector3(0, 0, -5),
    left: new THREE.Vector3(-5, 0, 0),
    right: new THREE.Vector3(5, 0, 0),
    top: new THREE.Vector3(0, 5, 0),
    bottom: new THREE.Vector3(0, -5, 0),
    frontTopRight: new THREE.Vector3(3, 3, 3),
    frontTopLeft: new THREE.Vector3(-3, 3, 3),
    frontBottomRight: new THREE.Vector3(3, -3, 3),
    frontBottomLeft: new THREE.Vector3(-3, -3, 3),
    backTopRight: new THREE.Vector3(3, 3, -3),
    backTopLeft: new THREE.Vector3(-3, 3, -3),
    backBottomRight: new THREE.Vector3(3, -3, -3),
    backBottomLeft: new THREE.Vector3(-3, -3, -3)
  };

  // Animation
  private animationFrameId: number = 0;

  constructor(private router: Router) {}

  ngOnInit(): void {
    // Add a CSS check to make sure component is visible
    setTimeout(() => {
      const element = this.mainCanvasRef?.nativeElement;
      if (element) {
        const styles = window.getComputedStyle(element);
        console.log('Canvas computed styles:', {
          width: styles.width,
          height: styles.height,
          display: styles.display,
          visibility: styles.visibility
        });

        // If the height is 0, log a warning
        if (parseInt(styles.height) === 0) {
          console.warn('Canvas height is 0! The 3D viewer needs a defined height to display properly.');
        }
      }
    }, 100);
  }

  navigateToScadEditor(): void {
    this.router.navigate(['/threeupload']);
  }

  switchToModelEditor(): void {
    this.switchModelEvent.emit();
  }


  ngAfterViewInit() {
    // Add debug log for canvas dimensions
    console.log('Canvas dimensions:', {
      width: this.mainCanvasRef.nativeElement.clientWidth,
      height: this.mainCanvasRef.nativeElement.clientHeight
    });


    this.initMainScene();
    this.initMiniScene();

    // Don't load the default STL model if we have a custom URL
    if (!this.modelUrl) {
      this.loadSTLModel();
    }

    this.animate();
    // Force resize with delay to ensure DOM is fully rendered
    setTimeout(() => {
      this.handleResize();

      // Force another update after a short delay
      setTimeout(() => {
        this.handleResize();
      }, 300);
    }, 100);
  }

  ngOnDestroy() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    this.disposeRenderer(this.renderer);
    this.disposeRenderer(this.miniRenderer);
  }

  private initMainScene() {
    // Create scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x282828);

    // Add lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(1, 1, 1);
    directionalLight.castShadow = true;
    this.scene.add(directionalLight);

    const pointLight = new THREE.PointLight(0xffffff, 0.5);
    pointLight.position.set(-2, 3, -2);
    this.scene.add(pointLight);

    // Create camera
    const canvas = this.mainCanvasRef.nativeElement;
    const aspectRatio = canvas.clientWidth / canvas.clientHeight;
    this.camera = new THREE.PerspectiveCamera(75, aspectRatio, 0.1, 1000);
    this.camera.position.copy(this.cameraPositions.frontTopRight);

    // Create renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true
    });
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;

    // Add controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;

    // Add Grid helper
    const gridHelper = new THREE.GridHelper(10, 10);
    this.scene.add(gridHelper);
  }

  private loadSTLModel() {
    // Use the provided modelUrl if available, otherwise use default
    const modelPath = this.modelUrl || 'assets/previewModel/keyboard.stl';
    console.log('Loading STL model from:', modelPath);

    const stlLoader = new STLLoader();

    // Handle blob URLs differently than asset paths
    if (modelPath.startsWith('blob:')) {
      // For blob URLs, we need to fetch the data first
      fetch(modelPath)
        .then(response => response.blob())
        .then(blob => {
          // Create a FileReader to read the blob
          const reader = new FileReader();
          reader.addEventListener('load', (event) => {
            if (event.target?.result) {
              // Parse the ArrayBuffer
              const geometry = stlLoader.parse(event.target.result as ArrayBuffer);
              this.createModelFromGeometry(geometry);
            }
          });
          reader.readAsArrayBuffer(blob);
        })
        .catch(error => {
          console.error('Error loading STL from blob:', error);
        });
    } else {
      // For regular paths, use the normal loading method
      stlLoader.load(
        modelPath,
        (geometry) => {
          this.createModelFromGeometry(geometry);
        },
        (xhr) => {
          console.log((xhr.loaded / xhr.total) * 100 + '% loaded');
        },
        (error) => {
          console.error('Error loading STL model:', error);
        }
      );

      setTimeout(() => {
        this.handleResize();
      }, 100);
    }
  }

  private createModelFromGeometry(geometry: THREE.BufferGeometry) {
    // Create material for the STL model
    const mainMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xAAAAAA,
      metalness: 0.2,
      roughness: 0.5,
      clearcoat: 0.3,
      clearcoatRoughness: 0.25,
      reflectivity: 0.5
    });

    // Create a wireframe material to overlay
    const wireframeMaterial = new THREE.MeshBasicMaterial({
      color: 0xFFFFFF,
      wireframe: true,
      transparent: true,
      opacity: 0.15
    });

    // Create mesh with loaded geometry and material
    const mesh = new THREE.Mesh(geometry, mainMaterial);
    const wireframe = new THREE.Mesh(geometry, wireframeMaterial);

    mesh.castShadow = true;
    mesh.receiveShadow = true;

    // Calculate proper positioning
    geometry.computeBoundingBox();
    const box = geometry.boundingBox!;
    const center = new THREE.Vector3();
    box.getCenter(center);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);

    // Calculate scale first
    let scale = 1;
    if (maxDim > 5) {
      scale = 5 / maxDim;
      mesh.scale.set(scale, scale, scale);
    }

    // Apply position, accounting for scaling
    mesh.position.set(
      -center.x * scale,
      -box.min.y * scale,
      -center.z * scale
    );

    // Remove existing model if any
    if (this.model && this.scene.getObjectById(this.model.id)) {
      this.scene.remove(this.model);
    }

    // Add to scene
    this.model = mesh;
    this.scene.add(mesh);

    this.enhanceLighting();

    // Add debugging information
    console.log('Model added to scene successfully');
    console.log('Model position:', mesh.position);
    console.log('Model scale:', mesh.scale);
    console.log('Model dimensions:', {
      width: geometry.boundingBox!.max.x - geometry.boundingBox!.min.x,
      height: geometry.boundingBox!.max.y - geometry.boundingBox!.min.y,
      depth: geometry.boundingBox!.max.z - geometry.boundingBox!.min.z
    });
    console.log('Camera position:', this.camera.position);

    // Force a camera reset to ensure model is visible
    this.resetCameraView();

    // Point the camera and controls at the object
    this.controls.target.copy(new THREE.Vector3(0, 0, 0));
    this.controls.update();
  }

  private enhanceLighting() {
    // Remove existing lights
    this.scene.children.forEach(child => {
      if (child instanceof THREE.Light) {
        this.scene.remove(child);
      }
    });

    // Add enhanced lighting setup
    // Ambient light for base illumination
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

    // Enable shadow mapping on renderer
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  }

// Add this new method to reset the camera view
  private resetCameraView() {
    // Reset to a good viewing position
    this.camera.position.set(5, 5, 5);
    this.camera.lookAt(0, 0, 0);

    // Update camera and controls
    this.camera.updateProjectionMatrix();
    this.controls.update();

    // Force render to update the view
    this.renderer.render(this.scene, this.camera);
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['modelUrl'] && changes['modelUrl'].currentValue) {
      console.log('Model URL changed, loading new STL model:', this.modelUrl);
      // Clear any existing model
      if (this.model && this.scene) {
        this.scene.remove(this.model);
      }
      // Load the new model
      this.loadSTLModel();
    }
  }

  private loadFBXModel() {
    const fbxLoader = new FBXLoader();
    fbxLoader.load(
      'assets/previewModel/KEYBOARD.fbx',
      (object) => {
        // Set up model
        object.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        // Center the model
        const box = new THREE.Box3().setFromObject(object);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());

        // Scale model to reasonable size if needed
        const maxDim = Math.max(size.x, size.y, size.z);
        if (maxDim > 5) {
          const scale = 5 / maxDim;
          object.scale.set(scale, scale, scale);
        }

        // Center model in scene
        object.position.sub(center);

        this.model = object;
        this.scene.add(object);

        // Point the camera and controls at the object
        this.controls.target.copy(new THREE.Vector3(0, 0, 0));
        this.controls.update();
      },
      (xhr) => {
        console.log((xhr.loaded / xhr.total) * 100 + '% loaded');
      },
      (error) => {
        console.error('Error loading FBX model:', error);
      }
    );
  }

  private initMiniScene() {
    // Create mini scene with ambient light for better visibility
    this.miniScene = new THREE.Scene();
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    this.miniScene.add(ambientLight);

    // Mini camera with perspective for better depth perception
    this.miniCamera = new THREE.PerspectiveCamera(70, 1, 0.1, 10);
    this.miniCamera.position.set(1.8, 1.8, 1.8);
    this.miniCamera.lookAt(0, 0, 0);

    // Mini renderer with improved settings
    const container = this.miniViewportRef.nativeElement;
    this.miniRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.miniRenderer.setSize(120, 120);
    this.miniRenderer.setClearColor(0x000000, 0.1);
    container.appendChild(this.miniRenderer.domElement);

    // Add event listener for navigation cube
    this.miniRenderer.domElement.addEventListener('click', (event) => this.onNavCubeClick(event));

    // Create ViewCube components
    this.createViewCube();
  }

  private createViewCube() {
    // Create a group to hold the cube and allow it to be rotated as a unit
    const cubeGroup = new THREE.Group();

    // 1. Main cube
    const cubeGeometry = new THREE.BoxGeometry(1, 1, 1);
    const cubeMaterials = [
      this.createFaceMaterial('right', 0xcccccc, 'RIGHT'),
      this.createFaceMaterial('left', 0xcccccc, 'LEFT'),
      this.createFaceMaterial('top', 0xcccccc, 'TOP'),
      this.createFaceMaterial('bottom', 0xcccccc, 'BOTTOM'),
      this.createFaceMaterial('front', 0xcccccc, 'FRONT'),
      this.createFaceMaterial('back', 0xcccccc, 'BACK')
    ];
    this.miniCube = new THREE.Mesh(cubeGeometry, cubeMaterials);
    cubeGroup.add(this.miniCube);

    // 2. Add edge highlighting (12 edges)
    this.addEdges(cubeGroup);

    // 3. Add corner highlighting (8 corners)
    this.addCorners(cubeGroup);

    // 4. Add triad axes for orientation
    this.addOrientationTriad(cubeGroup);

    // Add the complete cube assembly to the scene
    this.miniScene.add(cubeGroup);

    // Set initial orientation - this will be updated by updateMiniCubeOrientation
    cubeGroup.rotation.set(Math.PI/12, Math.PI/6, 0);
  }

  private addEdges(cubeGroup: THREE.Group) {
    const edgeGeometry = new THREE.BoxGeometry(1.01, 0.05, 0.05);
    const edgeMaterial = new THREE.MeshBasicMaterial({ color: 0x555555 });

    // Create the 12 edges of the cube
    const edges = [
      // X-aligned edges (4)
      { pos: [0, 0.5, 0.5], rot: [0, 0, 0] },
      { pos: [0, 0.5, -0.5], rot: [0, 0, 0] },
      { pos: [0, -0.5, 0.5], rot: [0, 0, 0] },
      { pos: [0, -0.5, -0.5], rot: [0, 0, 0] },

      // Y-aligned edges (4)
      { pos: [0.5, 0, 0.5], rot: [0, 0, Math.PI/2] },
      { pos: [0.5, 0, -0.5], rot: [0, 0, Math.PI/2] },
      { pos: [-0.5, 0, 0.5], rot: [0, 0, Math.PI/2] },
      { pos: [-0.5, 0, -0.5], rot: [0, 0, Math.PI/2] },

      // Z-aligned edges (4)
      { pos: [0.5, 0.5, 0], rot: [0, Math.PI/2, 0] },
      { pos: [0.5, -0.5, 0], rot: [0, Math.PI/2, 0] },
      { pos: [-0.5, 0.5, 0], rot: [0, Math.PI/2, 0] },
      { pos: [-0.5, -0.5, 0], rot: [0, Math.PI/2, 0] }
    ];

    edges.forEach(edge => {
      const edgeMesh = new THREE.Mesh(edgeGeometry, edgeMaterial);
      edgeMesh.position.set(edge.pos[0], edge.pos[1], edge.pos[2]);
      edgeMesh.rotation.set(edge.rot[0], edge.rot[1], edge.rot[2]);
      cubeGroup.add(edgeMesh);
    });
  }

  private addCorners(cubeGroup: THREE.Group) {
    const cornerGeometry = new THREE.SphereGeometry(0.08, 16, 16);
    const cornerMaterial = new THREE.MeshBasicMaterial({ color: 0x333333 });

    // Create the 8 corners of the cube
    const cornerPositions = [
      [0.5, 0.5, 0.5], [0.5, 0.5, -0.5], [0.5, -0.5, 0.5], [0.5, -0.5, -0.5],
      [-0.5, 0.5, 0.5], [-0.5, 0.5, -0.5], [-0.5, -0.5, 0.5], [-0.5, -0.5, -0.5]
    ];

    cornerPositions.forEach(pos => {
      const corner = new THREE.Mesh(cornerGeometry, cornerMaterial);
      corner.position.set(pos[0], pos[1], pos[2]);

      // Give corner a name for click detection
      let name = '';
      name += pos[0] > 0 ? 'right' : 'left';
      name += pos[1] > 0 ? 'Top' : 'Bottom';
      name += pos[2] > 0 ? 'Front' : 'Back';
      corner.name = name;

      cubeGroup.add(corner);
    });
  }

  private addOrientationTriad(cubeGroup: THREE.Group) {
    // Add small XYZ axis indicator at the corner (like in SolidWorks)
    const axisLength = 0.3;
    const axisWidth = 0.03;

    // X-axis (red)
    const xAxisGeometry = new THREE.CylinderGeometry(axisWidth, axisWidth, axisLength);
    const xAxisMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const xAxis = new THREE.Mesh(xAxisGeometry, xAxisMaterial);
    xAxis.rotation.z = -Math.PI/2;
    xAxis.position.set(axisLength/2, -0.6, -0.6);
    cubeGroup.add(xAxis);

    // Y-axis (green)
    const yAxisGeometry = new THREE.CylinderGeometry(axisWidth, axisWidth, axisLength);
    const yAxisMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const yAxis = new THREE.Mesh(yAxisGeometry, yAxisMaterial);
    yAxis.position.set(-0.6, axisLength/2, -0.6);
    cubeGroup.add(yAxis);

    // Z-axis (blue)
    const zAxisGeometry = new THREE.CylinderGeometry(axisWidth, axisWidth, axisLength);
    const zAxisMaterial = new THREE.MeshBasicMaterial({ color: 0x0000ff });
    const zAxis = new THREE.Mesh(zAxisGeometry, zAxisMaterial);
    zAxis.rotation.x = Math.PI/2;
    zAxis.position.set(-0.6, -0.6, axisLength/2);
    cubeGroup.add(zAxis);

    // Add cones for arrow tips
    const coneHeight = 0.1;
    const coneRadius = 0.06;

    // X arrow tip
    const xConeGeometry = new THREE.ConeGeometry(coneRadius, coneHeight);
    const xCone = new THREE.Mesh(xConeGeometry, xAxisMaterial);
    xCone.rotation.z = -Math.PI/2;
    xCone.position.set(axisLength, -0.6, -0.6);
    cubeGroup.add(xCone);

    // Y arrow tip
    const yConeGeometry = new THREE.ConeGeometry(coneRadius, coneHeight);
    const yCone = new THREE.Mesh(yConeGeometry, yAxisMaterial);
    yCone.position.set(-0.6, axisLength, -0.6);
    cubeGroup.add(yCone);

    // Z arrow tip
    const zConeGeometry = new THREE.ConeGeometry(coneRadius, coneHeight);
    const zCone = new THREE.Mesh(zConeGeometry, zAxisMaterial);
    zCone.rotation.x = Math.PI/2;
    zCone.position.set(-0.6, -0.6, axisLength);
    cubeGroup.add(zCone);
  }

  private createFaceMaterial(name: string, color: number, label: string): THREE.MeshBasicMaterial {
    // Create canvas for the texture
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const context = canvas.getContext('2d');
    if (context) {
      // Fill background with slightly transparent white
      context.fillStyle = '#' + color.toString(16).padStart(6, '0');
      context.fillRect(0, 0, 256, 256);

      // Add gradient highlight to simulate lighting
      const gradient = context.createRadialGradient(128, 128, 20, 128, 128, 160);
      gradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
      context.fillStyle = gradient;
      context.fillRect(0, 0, 256, 256);

      // Add face label
      context.font = 'bold 40px Arial';
      context.fillStyle = '#333333';
      context.textAlign = 'center';
      context.textBaseline = 'middle';

      // Use initial letter for shorter labels (SolidWorks style)
      const shortLabel = label.charAt(0);
      context.fillText(shortLabel, 128, 128);

      // Add thin border
      context.strokeStyle = '#999999';
      context.lineWidth = 2;
      context.strokeRect(4, 4, 248, 248);
    }

    const texture = new THREE.CanvasTexture(canvas);
    return new THREE.MeshBasicMaterial({
      map: texture,
      name: name,
      transparent: true,
      opacity: 0.95
    });
  }

  private onNavCubeClick(event: MouseEvent) {
    // Get mouse position relative to the renderer's canvas
    const rect = this.miniRenderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    // Set up raycaster
    this.raycaster.setFromCamera(this.mouse, this.miniCamera);

    // Check for intersections with all objects in the scene
    const intersects = this.raycaster.intersectObjects(this.miniScene.children, true);

    if (intersects.length > 0) {
      const obj = intersects[0].object;

      // Handle corner clicks (they have specific names)
      if (obj.name.includes('Top') || obj.name.includes('Bottom') ||
        obj.name.includes('Front') || obj.name.includes('Back') ||
        obj.name.includes('right') || obj.name.includes('left')) {
        this.moveCamera(obj.name);
        return;
      }

      // Handle face clicks
      if (obj === this.miniCube) {
        const faceIndex = Math.floor(intersects[0].faceIndex! / 2);
        const materialName = (this.miniCube.material as THREE.MeshBasicMaterial[])[faceIndex].name;
        this.moveCamera(materialName);
      }
    }
  }

  private moveCamera(position: string) {
    // Determine target position based on clicked face or corner
    const targetPosition = this.getCameraPositionByFace(position);
    const startPosition = this.camera.position.clone();
    const startTarget = this.controls.target.clone();
    const duration = 1000; // milliseconds
    const startTime = performance.now();

    const animateCamera = (currentTime: number) => {
      const elapsedTime = currentTime - startTime;
      const progress = Math.min(elapsedTime / duration, 1);

      // Use easing function for smoother transition
      const t = this.easeInOutCubic(progress);

      // Interpolate position
      this.camera.position.lerpVectors(startPosition, targetPosition, t);

      // Animate look target to origin if needed
      if (progress < 1) {
        requestAnimationFrame(animateCamera);
      } else {
        // Make sure camera looks at the center
        this.controls.target.set(0, 0, 0);
        this.controls.update();

        // Force update of mini cube orientation after camera movement completes
        this.updateMiniCubeOrientation();
      }
    };

    requestAnimationFrame(animateCamera);
  }

  private getCameraPositionByFace(face: string): THREE.Vector3 {
    // Handle both direct face names and corner names
    if (face === 'front') return this.cameraPositions.front.clone();
    if (face === 'back') return this.cameraPositions.back.clone();
    if (face === 'left') return this.cameraPositions.left.clone();
    if (face === 'right') return this.cameraPositions.right.clone();
    if (face === 'top') return this.cameraPositions.top.clone();
    if (face === 'bottom') return this.cameraPositions.bottom.clone();

    // Handle corner positions
    if (face === 'rightTopFront') return this.cameraPositions.frontTopRight.clone();
    if (face === 'rightTopBack') return this.cameraPositions.backTopRight.clone();
    if (face === 'rightBottomFront') return this.cameraPositions.frontBottomRight.clone();
    if (face === 'rightBottomBack') return this.cameraPositions.backBottomRight.clone();
    if (face === 'leftTopFront') return this.cameraPositions.frontTopLeft.clone();
    if (face === 'leftTopBack') return this.cameraPositions.backTopLeft.clone();
    if (face === 'leftBottomFront') return this.cameraPositions.frontBottomLeft.clone();
    if (face === 'leftBottomBack') return this.cameraPositions.backBottomLeft.clone();

    // Default position if no match is found
    return this.cameraPositions.frontTopRight.clone();
  }

// Easing function for smoother camera transitions
  private easeInOutCubic(t: number): number {
    return t < 0.5
      ? 4 * t * t * t
      : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  private animate() {
    this.animationFrameId = requestAnimationFrame(() => this.animate());

    // Update controls
    this.controls.update();

    // Update mini cube orientation to reflect the main camera's view
    this.updateMiniCubeOrientation();

    // Render scenes
    this.renderer.render(this.scene, this.camera);
    this.miniRenderer.render(this.miniScene, this.miniCamera);
  }

  private updateMiniCubeOrientation() {
    if (!this.miniScene || !this.miniCube) return;

    // Find the cube group (parent of the miniCube)
    const cubeGroup = this.miniCube.parent;
    if (!cubeGroup) return;

    // Calculate the direction vector from camera to the origin
    const cameraDirection = new THREE.Vector3();
    this.camera.getWorldDirection(cameraDirection);
    cameraDirection.normalize();

    // Create a quaternion that represents the rotation needed
    // to align the cube with the main camera's perspective
    const quaternion = new THREE.Quaternion();

    // Calculate rotation based on the camera's position relative to the center
    const cameraPosition = this.camera.position.clone().normalize();

    // Using lookAt to compute the rotation
    const tempMatrix = new THREE.Matrix4();
    tempMatrix.lookAt(cameraPosition, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0));
    quaternion.setFromRotationMatrix(tempMatrix);

    // Apply the rotation with a slight offset for better visibility
    // The offset ensures you can always see at least three faces of the cube
    const offsetRotation = new THREE.Euler(Math.PI/12, Math.PI/12, 0);
    const offsetQuaternion = new THREE.Quaternion().setFromEuler(offsetRotation);
    quaternion.multiply(offsetQuaternion);

    // Apply the rotation to the cube group with smooth interpolation
    cubeGroup.quaternion.slerp(quaternion, 0.1); // Use slerp for smooth transition
  }



  @HostListener('window:resize')
  private handleResize() {
    if (this.mainCanvasRef && this.renderer) {
      const canvas = this.mainCanvasRef.nativeElement;
      this.camera.aspect = canvas.clientWidth / canvas.clientHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    }

    // Ensure mini viewport maintains proper size
    if (this.miniViewportRef && this.miniRenderer) {
      this.miniRenderer.setSize(120, 120);
    }
  }

  private disposeRenderer(renderer: THREE.WebGLRenderer) {
    if (renderer) {
      renderer.dispose();
      renderer.forceContextLoss();
      const gl = renderer.getContext();
      if (gl) {
        const extension = gl.getExtension('WEBGL_lose_context');
        if (extension) extension.loseContext();
      }
    }
  }

  //OLD CODE!
  /*private initMainScene() {
      // Creates the scene
      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(0x282828);

      // Add lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
        directionalLight.position.set(1, 1, 1);
        this.scene.add(directionalLight);

    // Add camera
    const canvas = this.mainCanvasRef.nativeElement;
    const aspectRatio = canvas.clientWidth / canvas.clientHeight;
    this.camera = new THREE.PerspectiveCamera(75, aspectRatio, 0.1, 1000);
    this.camera.position.z = 5;

    // Add renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true
    });
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);

    // Add controls
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;

    // Add example mesh (a torus knot)
    const geometry = new THREE.TorusKnotGeometry(1, 0.3, 100, 16);
    const material = new THREE.MeshStandardMaterial({
      color: 0x049ef4,
        roughness: 0.5,
        metalness: 0.7
    });
    const torusKnot = new THREE.Mesh(geometry, material);
    this.scene.add(torusKnot);

    // Add Grid helper
    const gridHelper = new THREE.GridHelper(10,10);
    this.scene.add(gridHelper);
  }

  private initMiniScene() {
    // Create mini scene
    this.miniScene = new THREE.Scene();

    // Mini camera
    this.miniCamera = new THREE.PerspectiveCamera(50, 1, 0.1, 10);
    this.miniCamera.position.z = 2;

    // Mini renderer
    const container = this.miniViewportRef.nativeElement;
    this.miniRenderer = new THREE.WebGLRenderer({antialias: true, alpha: true});
    this.miniRenderer.setSize(80, 80);
    this.miniRenderer.setClearColor(0x000000, 0.3);
    container.appendChild(this.miniRenderer.domElement);

    // Create cube
    const cubeGeometry = new THREE.BoxGeometry(1, 1, 1);
    const cubeMaterial = [
    new THREE.MeshBasicMaterial({color: 0xff0000}), // Right - red
      new THREE.MeshBasicMaterial({color: 0x00ff00}), // Left - green
      new THREE.MeshBasicMaterial({color: 0x0000ff}), // Top - blue
      new THREE.MeshBasicMaterial({color: 0xffff00}), // Bottom - yellow
      new THREE.MeshBasicMaterial({color: 0xff00ff}), // Front - magenta
        new THREE.MeshBasicMaterial({color: 0x00ffff}) // Back - cyan
    ];
    this.miniCube = new THREE.Mesh(cubeGeometry, cubeMaterial);
    this.miniScene.add(this.miniCube);
  }

  private animate() {
      this.animationFrameId = requestAnimationFrame(() => this.animate());

      // Update main controls
        this.controls.update();

        // Rotate mini cube to match main camera orientation
    this.miniCube.rotation.copy(this.camera.rotation);

    // Render scenes
    this.renderer.render(this.scene, this.camera);
    this.miniRenderer.render(this.miniScene, this.miniCamera);
  }

  private handleResize() {
      window.addEventListener('resize', () => {
        if(this.mainCanvasRef && this.renderer) {
          const canvas = this.mainCanvasRef.nativeElement;
          this.camera.aspect = canvas.clientWidth / canvas.clientHeight;
          this.camera.updateProjectionMatrix();
          this.renderer.setSize(canvas.clientWidth, canvas.clientHeight);
        }
      });
  }

  private disposeRenderer(renderer: THREE.WebGLRenderer) {
      if(renderer) {
        renderer.dispose();
        renderer.forceContextLoss();
      }
  }*/


}
