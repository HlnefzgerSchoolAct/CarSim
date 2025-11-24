/**
 * Car Class
 * Handles car model, physics, and movement
 */
class Car {
    constructor(scene) {
        this.scene = scene;
        
        // Physics properties
        this.position = new THREE.Vector3(0, 0, 0);
        this.rotation = 0; // Y-axis rotation in radians
        this.velocity = 0;
        this.steeringAngle = 0;
        
        // Physics constants
        this.maxSpeed = 50;
        this.maxReverseSpeed = -20;
        this.acceleration = 25;
        this.brakeForce = 35;
        this.friction = 8;
        this.maxSteeringAngle = Math.PI / 6; // 30 degrees
        this.steeringSpeed = 2.5;
        this.steeringReturnSpeed = 4;
        this.wheelBase = 2.5; // Distance between front and rear axles
        
        // Visual properties
        this.mesh = null;
        this.wheels = [];
        
        this.createCarModel();
    }

    createCarModel() {
        // Car group to hold all parts
        this.mesh = new THREE.Group();

        // Car body (main chassis)
        const bodyGeometry = new THREE.BoxGeometry(2, 0.5, 4);
        const bodyMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xff4444,
            metalness: 0.6,
            roughness: 0.4
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = 0.5;
        body.castShadow = true;
        body.receiveShadow = true;
        this.mesh.add(body);

        // Car cabin (top part)
        const cabinGeometry = new THREE.BoxGeometry(1.6, 0.5, 2);
        const cabinMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x333333,
            metalness: 0.3,
            roughness: 0.6
        });
        const cabin = new THREE.Mesh(cabinGeometry, cabinMaterial);
        cabin.position.set(0, 1, -0.3);
        cabin.castShadow = true;
        this.mesh.add(cabin);

        // Windows
        const windowMaterial = new THREE.MeshStandardMaterial({
            color: 0x88ccff,
            metalness: 0.9,
            roughness: 0.1,
            transparent: true,
            opacity: 0.7
        });

        // Front windshield
        const frontWindowGeometry = new THREE.BoxGeometry(1.4, 0.4, 0.1);
        const frontWindow = new THREE.Mesh(frontWindowGeometry, windowMaterial);
        frontWindow.position.set(0, 1, 0.7);
        frontWindow.rotation.x = Math.PI / 8;
        this.mesh.add(frontWindow);

        // Create wheels
        this.createWheels();

        // Headlights
        const headlightGeometry = new THREE.BoxGeometry(0.3, 0.2, 0.1);
        const headlightMaterial = new THREE.MeshStandardMaterial({
            color: 0xffffcc,
            emissive: 0xffffcc,
            emissiveIntensity: 0.5
        });
        
        const leftHeadlight = new THREE.Mesh(headlightGeometry, headlightMaterial);
        leftHeadlight.position.set(-0.6, 0.5, 2);
        this.mesh.add(leftHeadlight);

        const rightHeadlight = new THREE.Mesh(headlightGeometry, headlightMaterial);
        rightHeadlight.position.set(0.6, 0.5, 2);
        this.mesh.add(rightHeadlight);

        // Tail lights
        const taillightMaterial = new THREE.MeshStandardMaterial({
            color: 0xff0000,
            emissive: 0xff0000,
            emissiveIntensity: 0.3
        });

        const leftTaillight = new THREE.Mesh(headlightGeometry, taillightMaterial);
        leftTaillight.position.set(-0.6, 0.5, -2);
        this.mesh.add(leftTaillight);

        const rightTaillight = new THREE.Mesh(headlightGeometry, taillightMaterial);
        rightTaillight.position.set(0.6, 0.5, -2);
        this.mesh.add(rightTaillight);

        this.scene.add(this.mesh);
    }

    createWheels() {
        const wheelGeometry = new THREE.CylinderGeometry(0.35, 0.35, 0.3, 16);
        const wheelMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x222222,
            metalness: 0.3,
            roughness: 0.8
        });

        // Rim material
        const rimGeometry = new THREE.CylinderGeometry(0.2, 0.2, 0.32, 8);
        const rimMaterial = new THREE.MeshStandardMaterial({
            color: 0xcccccc,
            metalness: 0.8,
            roughness: 0.3
        });

        const wheelPositions = [
            { x: -1, y: 0.35, z: 1.3, isFront: true },   // Front left
            { x: 1, y: 0.35, z: 1.3, isFront: true },    // Front right
            { x: -1, y: 0.35, z: -1.3, isFront: false }, // Rear left
            { x: 1, y: 0.35, z: -1.3, isFront: false }   // Rear right
        ];

        wheelPositions.forEach((pos) => {
            const wheelGroup = new THREE.Group();
            
            const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
            wheel.rotation.z = Math.PI / 2;
            wheel.castShadow = true;
            wheelGroup.add(wheel);

            const rim = new THREE.Mesh(rimGeometry, rimMaterial);
            rim.rotation.z = Math.PI / 2;
            wheelGroup.add(rim);

            wheelGroup.position.set(pos.x, pos.y, pos.z);
            
            this.wheels.push({
                mesh: wheelGroup,
                isFront: pos.isFront
            });
            
            this.mesh.add(wheelGroup);
        });
    }

    update(deltaTime, controls) {
        // Handle acceleration and braking
        if (controls.isAccelerating) {
            this.velocity += this.acceleration * deltaTime;
        } else if (controls.isBraking) {
            if (this.velocity > 0) {
                this.velocity -= this.brakeForce * deltaTime;
            } else {
                this.velocity -= this.acceleration * 0.5 * deltaTime; // Reverse
            }
        } else {
            // Apply friction when no input
            if (Math.abs(this.velocity) > 0.1) {
                this.velocity -= Math.sign(this.velocity) * this.friction * deltaTime;
            } else {
                this.velocity = 0;
            }
        }

        // Clamp velocity
        this.velocity = Math.max(this.maxReverseSpeed, Math.min(this.maxSpeed, this.velocity));

        // Handle steering (only when moving)
        const speedFactor = Math.min(Math.abs(this.velocity) / 10, 1);
        
        if (controls.isSteeringLeft) {
            this.steeringAngle += this.steeringSpeed * deltaTime;
        } else if (controls.isSteeringRight) {
            this.steeringAngle -= this.steeringSpeed * deltaTime;
        } else {
            // Return steering to center
            if (Math.abs(this.steeringAngle) > 0.01) {
                this.steeringAngle -= Math.sign(this.steeringAngle) * this.steeringReturnSpeed * deltaTime;
            } else {
                this.steeringAngle = 0;
            }
        }

        // Clamp steering angle
        this.steeringAngle = Math.max(-this.maxSteeringAngle, Math.min(this.maxSteeringAngle, this.steeringAngle));

        // Calculate movement using simple car physics (bicycle model)
        if (Math.abs(this.velocity) > 0.01) {
            // Turning radius based on steering angle and wheelbase
            const turnRadius = this.wheelBase / Math.tan(this.steeringAngle * speedFactor || 0.0001);
            const angularVelocity = this.velocity / turnRadius;
            
            // Update rotation
            this.rotation += angularVelocity * deltaTime;

            // Update position
            this.position.x += Math.sin(this.rotation) * this.velocity * deltaTime;
            this.position.z += Math.cos(this.rotation) * this.velocity * deltaTime;
        }

        // Update mesh position and rotation
        this.mesh.position.copy(this.position);
        this.mesh.rotation.y = this.rotation;

        // Update wheel rotation (visual)
        this.updateWheels(deltaTime);
    }

    updateWheels(deltaTime) {
        const wheelRotationSpeed = this.velocity * 2;
        
        this.wheels.forEach((wheel) => {
            // Rotate wheels based on car speed
            wheel.mesh.children[0].rotation.x += wheelRotationSpeed * deltaTime;
            wheel.mesh.children[1].rotation.x += wheelRotationSpeed * deltaTime;
            
            // Turn front wheels based on steering
            if (wheel.isFront) {
                wheel.mesh.rotation.y = this.steeringAngle;
            }
        });
    }

    getSpeed() {
        // Convert to km/h for display (approximate)
        return Math.abs(Math.round(this.velocity * 3.6));
    }

    getPosition() {
        return this.position.clone();
    }

    getRotation() {
        return this.rotation;
    }
}