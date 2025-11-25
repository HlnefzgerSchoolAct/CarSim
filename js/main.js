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
        
        // Screen shake settings
        this.screenShake = {
            intensity: 0,
            duration: 0,
            decay: 5
        };
        
        // Time tracking
        this.clock = new THREE.Clock();
        this.lastTime = 0;
        
        // UI Elements
        this.speedElement = document.getElementById('speed-value');
        this.damageElement = null;
        this.driftScoreElement = null;
        this.driftCurrentElement = null;
        this.driftComboElement = null;
        this.gameContainer = null;
        
        this.init();
    }

    init() {
        this.createScene();
        this.createCamera();
        this.createRenderer();
        this.createGameObjects();
        this.setupEventListeners();
        this.setupHUDElements();
        this.animate();
    }
    
    setupHUDElements() {
        this.damageElement = document.getElementById('damage-fill');
        this.driftScoreElement = document.getElementById('drift-total');
        this.driftCurrentElement = document.getElementById('drift-current');
        this.driftComboElement = document.getElementById('drift-combo');
        this.gameContainer = document.getElementById('game-container');
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

    updateCamera(deltaTime) {
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
        
        // Apply screen shake
        if (this.screenShake.intensity > 0) {
            const shakeX = (Math.random() - 0.5) * this.screenShake.intensity;
            const shakeY = (Math.random() - 0.5) * this.screenShake.intensity;
            const shakeZ = (Math.random() - 0.5) * this.screenShake.intensity;
            
            this.camera.position.x += shakeX;
            this.camera.position.y += shakeY;
            this.camera.position.z += shakeZ;
            
            // Decay screen shake
            this.screenShake.intensity -= this.screenShake.decay * deltaTime;
            if (this.screenShake.intensity < 0) {
                this.screenShake.intensity = 0;
            }
        }
        
        // Add subtle camera shake during aggressive drifts
        if (this.car.getIsDrifting() && Math.abs(this.car.getSlipAngle()) > 0.3) {
            const driftShake = Math.abs(this.car.getSlipAngle()) * 0.1;
            this.camera.position.x += (Math.random() - 0.5) * driftShake;
            this.camera.position.y += (Math.random() - 0.5) * driftShake * 0.5;
        }

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
    
    triggerScreenShake(intensity) {
        this.screenShake.intensity = Math.max(this.screenShake.intensity, intensity);
    }

    updateHUD() {
        // Update speedometer
        const speed = this.car.getSpeed();
        this.speedElement.textContent = speed;
        
        // Update damage indicator
        if (this.damageElement) {
            const damage = this.car.getDamage();
            this.damageElement.style.width = `${damage}%`;
            
            // Change color based on damage level
            if (damage > 70) {
                this.damageElement.style.backgroundColor = '#ff0000';
            } else if (damage > 40) {
                this.damageElement.style.backgroundColor = '#ff6600';
            } else {
                this.damageElement.style.backgroundColor = '#ffcc00';
            }
        }
        
        // Update drift score
        if (this.driftScoreElement) {
            this.driftScoreElement.textContent = this.car.getDriftScore();
        }
        
        if (this.driftCurrentElement) {
            const currentScore = this.car.getCurrentDriftScore();
            if (currentScore > 0) {
                this.driftCurrentElement.textContent = `+${currentScore}`;
                this.driftCurrentElement.style.display = 'block';
            } else {
                this.driftCurrentElement.style.display = 'none';
            }
        }
        
        if (this.driftComboElement) {
            const combo = this.car.getDriftCombo();
            if (combo > 1) {
                this.driftComboElement.textContent = `x${combo.toFixed(1)}`;
                this.driftComboElement.style.display = 'block';
            } else {
                this.driftComboElement.style.display = 'none';
            }
        }
    }

    checkCollisions() {
        const carPos = this.car.getPosition();
        const obstacles = this.world.getObstacles();
        const carRadius = 2;

        for (const obstacle of obstacles) {
            const distance = carPos.distanceTo(obstacle.position);
            if (distance < carRadius + obstacle.radius) {
                // Calculate push direction
                const pushDir = new THREE.Vector3()
                    .subVectors(carPos, obstacle.position)
                    .normalize();
                
                // Calculate impact point (for sparks)
                const impactPoint = new THREE.Vector3()
                    .addVectors(obstacle.position, pushDir.clone().multiplyScalar(obstacle.radius));
                
                // Apply collision response and get impact force
                const impactForce = this.car.applyCollisionResponse(obstacle, pushDir);
                
                // Apply damage based on impact
                const damageDealt = this.car.applyCollisionDamage(impactForce, impactPoint);
                
                // Trigger screen shake based on impact force
                if (impactForce > 2) {
                    this.triggerScreenShake(Math.min(impactForce * 0.3, 2));
                }
            }
        }
    }
    
    updateTireMarks(deltaTime) {
        // Add tire marks when drifting
        if (this.car.getIsDrifting()) {
            const wheelPositions = this.car.getRearWheelPositions();
            this.world.addTireMarks(wheelPositions, Math.abs(this.car.getSlipAngle()));
        }
        
        // Fade existing tire marks over time
        this.world.updateTireMarks(deltaTime);
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
        this.updateTireMarks(deltaTime);
        this.updateCamera(deltaTime);
        this.updateHUD();

        // Render
        this.renderer.render(this.scene, this.camera);
    }
}

// Start the game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new Game();
});