/**
 * Main Game Controller
 * Initializes and runs the car driving simulator
 */
class Game {
    constructor() {
        // Core Three.js components
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        
        // Game components
        this.car = null;
        this.world = null;
        this.controls = null;
        
        // Camera settings
        this.cameraOffset = new THREE.Vector3(0, 5, -10);
        this.cameraLookOffset = new THREE.Vector3(0, 1, 5);
        this.cameraLerpFactor = 0.05;
        
        // Time tracking
        this.clock = new THREE.Clock();
        this.lastTime = 0;
        
        // UI Elements
        this.speedElement = document.getElementById('speed-value');
        
        this.init();
    }

    init() {
        this.createScene();
        this.createCamera();
        this.createRenderer();
        this.createGameObjects();
        this.setupEventListeners();
        this.animate();
    }

    createScene() {
        this.scene = new THREE.Scene();
    }

    createCamera() {
        const aspect = window.innerWidth / window.innerHeight;
        this.camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 1000);
        this.camera.position.set(0, 5, -10);
    }

    createRenderer() {
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        
        const container = document.getElementById('game-container');
        container.appendChild(this.renderer.domElement);
    }

    createGameObjects() {
        // Create input controls
        this.controls = new InputControls();
        
        // Create world environment
        this.world = new World(this.scene);
        
        // Create player car
        this.car = new Car(this.scene);
    }

    setupEventListeners() {
        window.addEventListener('resize', () => this.onWindowResize());
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    updateCamera() {
        const carPosition = this.car.getPosition();
        const carRotation = this.car.getRotation();

        // Calculate desired camera position (behind the car)
        const offsetX = this.cameraOffset.x * Math.cos(carRotation) - this.cameraOffset.z * Math.sin(carRotation);
        const offsetZ = this.cameraOffset.x * Math.sin(carRotation) + this.cameraOffset.z * Math.cos(carRotation);
        
        const desiredPosition = new THREE.Vector3(
            carPosition.x + offsetX,
            carPosition.y + this.cameraOffset.y,
            carPosition.z + offsetZ
        );

        // Smoothly interpolate camera position
        this.camera.position.lerp(desiredPosition, this.cameraLerpFactor);

        // Calculate look-at point (in front of the car)
        const lookX = this.cameraLookOffset.z * Math.sin(carRotation);
        const lookZ = this.cameraLookOffset.z * Math.cos(carRotation);
        
        const lookAtPoint = new THREE.Vector3(
            carPosition.x + lookX,
            carPosition.y + this.cameraLookOffset.y,
            carPosition.z + lookZ
        );

        this.camera.lookAt(lookAtPoint);
    }

    updateHUD() {
        const speed = this.car.getSpeed();
        this.speedElement.textContent = speed;
    }

    checkCollisions() {
        const carPos = this.car.getPosition();
        const obstacles = this.world.getObstacles();
        const carRadius = 2;

        for (const obstacle of obstacles) {
            const distance = carPos.distanceTo(obstacle.position);
            if (distance < carRadius + obstacle.radius) {
                // Simple collision response - stop the car
                this.car.velocity *= -0.5;
                
                // Push car away from obstacle
                const pushDir = new THREE.Vector3()
                    .subVectors(carPos, obstacle.position)
                    .normalize();
                this.car.position.add(pushDir.multiplyScalar(0.5));
            }
        }
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        // Calculate delta time
        const currentTime = this.clock.getElapsedTime();
        const deltaTime = Math.min(currentTime - this.lastTime, 0.1); // Cap delta time
        this.lastTime = currentTime;

        // Update game objects
        this.car.update(deltaTime, this.controls);
        this.checkCollisions();
        this.updateCamera();
        this.updateHUD();

        // Render
        this.renderer.render(this.scene, this.camera);
    }
}

// Start the game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new Game();
});