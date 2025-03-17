import {AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild} from '@angular/core';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader";

@Component({
  selector: 'app-threed-viewer',
  standalone: true,
  imports: [],
  templateUrl: './threed-viewer.component.html',
  styleUrl: './threed-viewer.component.css'
})
export class ThreedViewerComponent implements OnInit, AfterViewInit, OnDestroy{
    @ViewChild('mainCanvas') mainCanvasRef!: ElementRef<HTMLCanvasElement>;
    @ViewChild('miniViewport') miniViewportRef!: ElementRef<HTMLDivElement>;

    // Main scene
    private scene!: THREE.Scene;
    private camera!: THREE.PerspectiveCamera;
    private renderer!: THREE.WebGLRenderer;
    private controls!: OrbitControls;

    // Mini scene (cube in corner)
    private miniScene!: THREE.Scene;
    private miniCamera!: THREE.PerspectiveCamera;
    private miniRenderer!: THREE.WebGLRenderer;
    private miniCube!: THREE.Mesh;

    // Animation
    private animationFrameId: number = 0;

    constructor() {}

  ngOnInit(): void {}

  ngAfterViewInit() {
    this.initMainScene();
    this.initMiniScene();
    this.animate();
    this.handleResize();
  }

  ngOnDestroy() {
      if(this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
      }
        this.disposeRenderer(this.renderer);
        this.disposeRenderer(this.miniRenderer);
  }

  private initMainScene() {
      const scene = new THREE.Scene()
      scene.add(new THREE.AxesHelper(5))

    const light = new THREE.PointLight(0xffffff, 50)
    light.position.set(0.8, 1.4, 1.0)
    scene.add(light)

    const ambientLight = new THREE.AmbientLight()
    scene.add(ambientLight)

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
    camera.position.set(0.8, 1.4, 1.0)

    const renderer = new THREE.WebGLRenderer({ canvas: this.mainCanvasRef.nativeElement })
    renderer.setSize(window.innerWidth, window.innerHeight)
    document.body.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.target.set(0,1,0)

    const material = new THREE.MeshNormalMaterial()

    const fbxLoader = new FBXLoader()
    fbxLoader.load(
      'assets/previewModel/KEYBOARD.fbx',
      (object) => {
        object.traverse((child) => {
          if(child instanceof THREE.Mesh) {
            child.material = material
          }
        })
        scene.add(object)
      },
      (xhr) => {
        console.log((xhr.loaded / xhr.total) * 100 + '% loaded')
      },
      (error) => {
        console.error('An error happened', error)
      }
    )

    // Add Grid helper
    const gridHelper = new THREE.GridHelper(10,10);
    this.scene.add(gridHelper);

  }

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
  } */

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
  }


}
