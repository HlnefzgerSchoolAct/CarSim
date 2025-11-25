/**
 * Car Class
 * Handles car model, physics, movement, and crash deformation
 */
class Car {
    constructor(scene) {
        this.scene = scene;
        
        // Physics properties
        this.position = new THREE.Vector3(0, 0, 0);
        this.rotation = 0; // Y-axis rotation in radians
        this.velocity = 0;
        this.velocityX = 0; // Lateral velocity for drift
        this.velocityZ = 0; // Longitudinal velocity for drift
        this.angularVelocity = 0;
        this.steeringAngle = 0;
        
        // Base physics constants (from PHYSICS spec)
        this.CAR_MASS = 1400;              // kg
        this.WHEELBASE = 2.7;              // m
        this.TRACK_WIDTH = 1.6;            // m
        this.CG_HEIGHT = 0.5;              // m
        
        // Engine properties
        this.MAX_TORQUE = 400;             // Nm
        this.MAX_POWER = 220;              // kW
        this.IDLE_RPM = 800;
        this.REDLINE = 7500;
        this.currentRPM = 800;
        this.currentGear = 1;
        this.gearRatios = [0, 3.5, 2.5, 1.8, 1.4, 1.1, 0.9]; // Neutral + 6 gears
        this.finalDrive = 3.7;
        
        // Tire properties
        this.TIRE_RADIUS = 0.33;           // m
        this.GRIP_COEFFICIENT = 1.0;
        this.HANDBRAKE_GRIP = 0.4;
        
        // Suspension properties
        this.SPRING_RATE = 35000;          // N/m
        this.DAMPING = 3500;               // Ns/m
        this.suspensionCompression = [0, 0, 0, 0]; // Per wheel
        
        // Aerodynamics
        this.DRAG_COEFF = 0.32;
        this.FRONTAL_AREA = 2.2;           // m²
        this.AIR_DENSITY = 1.225;          // kg/m³
        
        // Damage properties
        this.DEFORM_RESISTANCE = 50000;    // N/m
        this.DAMAGE_THRESHOLD = 15;        // m/s impact for damage
        
        // Base physics constants
        this.baseMaxSpeed = 50;
        this.maxSpeed = 50;
        this.maxReverseSpeed = -20;
        this.baseAcceleration = 25;
        this.acceleration = 25;
        this.brakeForce = 35;
        this.friction = 8;
        this.maxSteeringAngle = Math.PI / 6; // 30 degrees
        this.steeringSpeed = 2.5;
        this.steeringReturnSpeed = 4;
        this.wheelBase = this.WHEELBASE;
        
        // Drift Physics Constants
        this.GRIP_FRONT = 1.0;           // Front tire grip coefficient
        this.GRIP_REAR_NORMAL = 0.95;    // Rear tire grip (normal)
        this.GRIP_REAR_HANDBRAKE = this.HANDBRAKE_GRIP;
        this.DRIFT_THRESHOLD = 0.15;     // Slip angle threshold for drift (radians)
        this.COUNTER_STEER_FACTOR = 1.5; // Counter-steering effectiveness
        
        // Crash Physics Constants
        this.RESTITUTION = 0.3;          // Bounce coefficient
        this.MAX_DAMAGE = 100;           // Maximum damage value
        
        // Wheel Position Constants
        this.WHEEL_X_OFFSET = this.TRACK_WIDTH / 2;
        this.REAR_WHEEL_Z_OFFSET = -this.WHEELBASE / 2;
        
        // Damage System
        this.damage = 0;
        this.health = 100;
        
        // Damage zones for deformation
        this.damageZones = {
            front: { integrity: 100, crumpleDepth: 0 },
            rear: { integrity: 100, crumpleDepth: 0 },
            left: { integrity: 100, crumpleDepth: 0 },
            right: { integrity: 100, crumpleDepth: 0 },
            roof: { integrity: 100, crumpleDepth: 0 }
        };
        
        // Mechanical damage effects
        this.mechanicalDamage = {
            engine: 0,        // Reduces power, causes misfires
            steering: 0,      // Pulls to side, reduced response
            suspension: 0,    // Uneven ride height
            brakes: 0         // Increased stopping distance
        };
        
        // Weight transfer
        this.wheelLoads = {
            frontLeft: this.CAR_MASS / 4,
            frontRight: this.CAR_MASS / 4,
            rearLeft: this.CAR_MASS / 4,
            rearRight: this.CAR_MASS / 4
        };
        
        // Drift State
        this.isDrifting = false;
        this.slipAngle = 0;
        this.driftScore = 0;
        this.currentDriftScore = 0;
        this.driftCombo = 1;
        this.driftDuration = 0;
        this.rearGrip = this.GRIP_REAR_NORMAL;
        
        // Particle Systems
        this.smokeParticles = [];
        this.sparkParticles = [];
        this.debrisParticles = [];
        this.maxSmokeParticles = 50;
        this.maxSparkParticles = 30;
        this.maxDebrisParticles = 20;
        
        // Visual properties
        this.mesh = null;
        this.wheels = [];
        this.bodyMesh = null;
        this.bodyMaterial = null;
        this.originalBodyColor = 0xff4444;
        this.originalPositions = null; // Store original vertex positions for deformation
        
        this.createCarModel();
        this.createParticleSystems();
    }
    
    createParticleSystems() {
        // Smoke particle material for drift/damage
        this.smokeMaterial = new THREE.PointsMaterial({
            color: 0xaaaaaa,
            size: 0.5,
            transparent: true,
            opacity: 0.6,
            blending: THREE.AdditiveBlending
        });
        
        // Spark particle material for collisions
        this.sparkMaterial = new THREE.PointsMaterial({
            color: 0xffaa00,
            size: 0.3,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending
        });
    }

    createCarModel() {
        // Car group to hold all parts
        this.mesh = new THREE.Group();

        // Car body (main chassis) - Using subdivided geometry for deformation
        const bodyGeometry = new THREE.BoxGeometry(2, 0.5, 4, 8, 2, 16);
        this.bodyMaterial = new THREE.MeshStandardMaterial({ 
            color: this.originalBodyColor,
            metalness: 0.6,
            roughness: 0.4,
            flatShading: false
        });
        this.bodyMesh = new THREE.Mesh(bodyGeometry, this.bodyMaterial);
        this.bodyMesh.position.y = 0.5;
        this.bodyMesh.castShadow = true;
        this.bodyMesh.receiveShadow = true;
        this.mesh.add(this.bodyMesh);
        
        // Store original vertex positions for deformation reference
        this.storeOriginalPositions();

        // Car cabin (top part)
        const cabinGeometry = new THREE.BoxGeometry(1.6, 0.5, 2, 4, 2, 8);
        this.cabinMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x333333,
            metalness: 0.3,
            roughness: 0.6
        });
        this.cabinMesh = new THREE.Mesh(cabinGeometry, this.cabinMaterial);
        this.cabinMesh.position.set(0, 1, -0.3);
        this.cabinMesh.castShadow = true;
        this.mesh.add(this.cabinMesh);

        // Windows
        this.windowMaterial = new THREE.MeshStandardMaterial({
            color: 0x88ccff,
            metalness: 0.9,
            roughness: 0.1,
            transparent: true,
            opacity: 0.7
        });

        // Front windshield
        const frontWindowGeometry = new THREE.BoxGeometry(1.4, 0.4, 0.1);
        this.frontWindow = new THREE.Mesh(frontWindowGeometry, this.windowMaterial);
        this.frontWindow.position.set(0, 1, 0.7);
        this.frontWindow.rotation.x = Math.PI / 8;
        this.mesh.add(this.frontWindow);
        
        // Glass crack overlay (hidden by default)
        this.glassCrackOverlay = this.createGlassCrackOverlay();
        this.glassCrackOverlay.visible = false;
        this.mesh.add(this.glassCrackOverlay);

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
    
    createGlassCrackOverlay() {
        // Create a simple crack pattern overlay for windshield
        const crackGeometry = new THREE.PlaneGeometry(1.4, 0.4);
        const crackMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        const crackMesh = new THREE.Mesh(crackGeometry, crackMaterial);
        crackMesh.position.set(0, 1, 0.75);
        crackMesh.rotation.x = Math.PI / 8;
        return crackMesh;
    }
    
    storeOriginalPositions() {
        // Store original vertex positions for the body mesh
        const geometry = this.bodyMesh.geometry;
        const positions = geometry.attributes.position;
        this.originalPositions = new Float32Array(positions.array.length);
        this.originalPositions.set(positions.array);
    }
    
    deformOnImpact(impactPoint, impactForce, impactDirection) {
        if (!this.bodyMesh || !this.originalPositions) return;
        
        const geometry = this.bodyMesh.geometry;
        const positions = geometry.attributes.position;
        
        // Calculate deformation radius based on impact force
        const deformRadius = Math.sqrt(impactForce / this.DEFORM_RESISTANCE) * 2;
        const maxDeform = Math.min(impactForce / 100000, 0.4);
        
        // Get the local impact point relative to the body mesh
        const localImpact = impactPoint.clone();
        this.bodyMesh.worldToLocal(localImpact);
        
        let verticesDeformed = 0;
        
        for (let i = 0; i < positions.count; i++) {
            const vertex = new THREE.Vector3(
                positions.getX(i),
                positions.getY(i),
                positions.getZ(i)
            );
            
            const distance = vertex.distanceTo(localImpact);
            
            if (distance < deformRadius) {
                // Inverse square falloff for realistic crumple effect
                const falloff = Math.pow(1 - distance / deformRadius, 2);
                const deformAmount = maxDeform * falloff;
                
                // Displace vertex along impact direction (in local space)
                const localDirection = impactDirection.clone();
                // Transform direction to local space
                const inverseMatrix = new THREE.Matrix4();
                inverseMatrix.copy(this.bodyMesh.matrixWorld).invert();
                localDirection.transformDirection(inverseMatrix);
                
                const displacement = localDirection.clone().multiplyScalar(-deformAmount);
                
                // Add some random noise for more realistic deformation
                displacement.x += (Math.random() - 0.5) * deformAmount * 0.3;
                displacement.y += (Math.random() - 0.5) * deformAmount * 0.2;
                displacement.z += (Math.random() - 0.5) * deformAmount * 0.3;
                
                vertex.add(displacement);
                
                positions.setXYZ(i, vertex.x, vertex.y, vertex.z);
                verticesDeformed++;
            }
        }
        
        if (verticesDeformed > 0) {
            positions.needsUpdate = true;
            geometry.computeVertexNormals();
        }
        
        // Determine which damage zone was hit
        this.updateDamageZone(localImpact, impactForce);
    }
    
    updateDamageZone(localImpact, impactForce) {
        const damageAmount = Math.min(impactForce / 1000, 30);
        
        // Determine zone based on local impact position
        if (localImpact.z > 1) {
            // Front impact
            this.damageZones.front.integrity = Math.max(0, this.damageZones.front.integrity - damageAmount);
            this.damageZones.front.crumpleDepth += damageAmount * 0.01;
            this.mechanicalDamage.engine += damageAmount * 0.5;
        } else if (localImpact.z < -1) {
            // Rear impact
            this.damageZones.rear.integrity = Math.max(0, this.damageZones.rear.integrity - damageAmount);
            this.damageZones.rear.crumpleDepth += damageAmount * 0.01;
        }
        
        if (localImpact.x > 0.5) {
            // Right side impact
            this.damageZones.right.integrity = Math.max(0, this.damageZones.right.integrity - damageAmount);
            this.damageZones.right.crumpleDepth += damageAmount * 0.01;
            this.mechanicalDamage.steering += damageAmount * 0.3;
        } else if (localImpact.x < -0.5) {
            // Left side impact
            this.damageZones.left.integrity = Math.max(0, this.damageZones.left.integrity - damageAmount);
            this.damageZones.left.crumpleDepth += damageAmount * 0.01;
            this.mechanicalDamage.steering += damageAmount * 0.3;
        }
        
        // Update glass crack visibility based on front damage
        if (this.damageZones.front.integrity < 70) {
            this.glassCrackOverlay.visible = true;
            this.glassCrackOverlay.material.opacity = Math.min(0.6, (100 - this.damageZones.front.integrity) / 100);
        }
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
        // Apply damage-based performance degradation
        this.applyDamageEffects();
        
        // Handle handbrake for drift
        if (controls.isHandbrake) {
            this.rearGrip = this.GRIP_REAR_HANDBRAKE;
        } else {
            this.rearGrip = this.GRIP_REAR_NORMAL;
        }
        
        // Update engine simulation
        this.updateEngine(deltaTime, controls);
        
        // Calculate weight transfer
        this.calculateWeightTransfer(deltaTime);
        
        // Calculate aerodynamic forces
        const aeroForce = this.calculateAerodynamics();
        
        // Handle acceleration and braking with engine torque
        const enginePowerMultiplier = 1 - (this.mechanicalDamage.engine / 100) * 0.5;
        const brakeMultiplier = 1 - (this.mechanicalDamage.brakes / 100) * 0.4;
        
        if (controls.isAccelerating) {
            // Engine acceleration with misfire effect at high damage
            let accel = this.acceleration * enginePowerMultiplier;
            if (this.mechanicalDamage.engine > 50 && Math.random() < 0.1) {
                accel *= 0.3; // Engine misfire
            }
            this.velocity += accel * deltaTime;
        } else if (controls.isBraking) {
            if (this.velocity > 0) {
                this.velocity -= this.brakeForce * brakeMultiplier * deltaTime;
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
        
        // Apply aerodynamic drag
        this.velocity -= Math.sign(this.velocity) * aeroForce * deltaTime / this.CAR_MASS;

        // Clamp velocity
        this.velocity = Math.max(this.maxReverseSpeed, Math.min(this.maxSpeed, this.velocity));

        // Handle steering with damage impairment
        const steeringDamageMultiplier = 1 - (this.mechanicalDamage.steering / 100) * 0.4;
        const steeringMultiplier = (this.damage > 70 ? 0.6 : (this.damage > 40 ? 0.8 : 1.0)) * steeringDamageMultiplier;
        const effectiveSteeringSpeed = this.steeringSpeed * steeringMultiplier;
        
        const speedFactor = Math.min(Math.abs(this.velocity) / 10, 1);
        
        // Apply steering pull from damage
        const steeringPull = (this.mechanicalDamage.steering / 100) * 0.3 * 
            (this.damageZones.left.crumpleDepth - this.damageZones.right.crumpleDepth);
        
        if (controls.isSteeringLeft) {
            this.steeringAngle += effectiveSteeringSpeed * deltaTime;
        } else if (controls.isSteeringRight) {
            this.steeringAngle -= effectiveSteeringSpeed * deltaTime;
        } else {
            // Return steering to center (with damage pull)
            if (Math.abs(this.steeringAngle - steeringPull) > 0.01) {
                this.steeringAngle -= Math.sign(this.steeringAngle - steeringPull) * this.steeringReturnSpeed * deltaTime;
            } else {
                this.steeringAngle = steeringPull;
            }
        }

        // Clamp steering angle
        this.steeringAngle = Math.max(-this.maxSteeringAngle, Math.min(this.maxSteeringAngle, this.steeringAngle));

        // Calculate slip angle and drift physics
        this.calculateDriftPhysics(deltaTime, controls);

        // Calculate movement using enhanced car physics
        if (Math.abs(this.velocity) > 0.01) {
            // Turning radius based on steering angle and wheelbase
            const turnRadius = this.wheelBase / Math.tan(this.steeringAngle * speedFactor || 0.0001);
            let angularVelocity = this.velocity / turnRadius;
            
            // Apply drift angular momentum
            if (this.isDrifting) {
                // Counter-steering effectiveness during drift
                const counterSteer = -this.steeringAngle * this.COUNTER_STEER_FACTOR;
                angularVelocity += this.angularVelocity * 0.95 + counterSteer * deltaTime;
            }
            
            // Update rotation
            this.rotation += angularVelocity * deltaTime;

            // Update position with drift slide
            const forwardX = Math.sin(this.rotation);
            const forwardZ = Math.cos(this.rotation);
            const lateralX = Math.cos(this.rotation);
            const lateralZ = -Math.sin(this.rotation);
            
            // Mix forward velocity with lateral drift
            const driftSlide = this.isDrifting ? Math.sin(this.slipAngle) * this.velocity * 0.3 : 0;
            
            this.position.x += forwardX * this.velocity * deltaTime + lateralX * driftSlide * deltaTime;
            this.position.z += forwardZ * this.velocity * deltaTime + lateralZ * driftSlide * deltaTime;
        }

        // Update mesh position and rotation
        this.mesh.position.copy(this.position);
        this.mesh.rotation.y = this.rotation;

        // Update wheel rotation (visual)
        this.updateWheels(deltaTime);
        
        // Update particles
        this.updateParticles(deltaTime);
        
        // Update drift scoring
        this.updateDriftScore(deltaTime);
        
        // Update visual damage
        this.updateDamageVisual();
        
        // Emit smoke if damaged
        if (this.damage > 30) {
            this.emitDamageSmoke();
        }
    }
    
    updateEngine(deltaTime, controls) {
        // Simple engine RPM simulation
        const speedKmh = Math.abs(this.velocity * 3.6);
        const wheelRPM = (this.velocity / (2 * Math.PI * this.TIRE_RADIUS)) * 60;
        
        // Calculate engine RPM based on gear and wheel speed
        const gearRatio = this.gearRatios[this.currentGear] || 1;
        let targetRPM = Math.abs(wheelRPM * gearRatio * this.finalDrive);
        
        // Engine idle and acceleration
        if (controls.isAccelerating) {
            targetRPM = Math.max(targetRPM, this.IDLE_RPM + 2000);
        }
        
        // Clamp to idle/redline
        targetRPM = Math.max(this.IDLE_RPM, Math.min(this.REDLINE, targetRPM));
        
        // Smooth RPM change
        this.currentRPM += (targetRPM - this.currentRPM) * deltaTime * 5;
        
        // Auto-shift (simple implementation)
        if (this.currentRPM > this.REDLINE * 0.95 && this.currentGear < 6) {
            this.currentGear++;
        } else if (this.currentRPM < this.IDLE_RPM * 1.5 && this.currentGear > 1 && this.velocity > 0) {
            this.currentGear--;
        }
        
        // Neutral in reverse
        if (this.velocity < 0) {
            this.currentGear = 0;
        } else if (this.currentGear === 0 && this.velocity > 0) {
            this.currentGear = 1;
        }
    }
    
    calculateWeightTransfer(deltaTime) {
        // Simplified weight transfer calculation
        const baseLoad = (this.CAR_MASS * 9.81) / 4; // Base load per wheel
        
        // Longitudinal weight transfer during acceleration/braking
        const accelForce = this.velocity * deltaTime * 10; // Approximate acceleration
        const longitudinalTransfer = (this.CAR_MASS * accelForce * this.CG_HEIGHT) / this.WHEELBASE;
        
        // Lateral weight transfer during cornering
        const lateralAccel = this.angularVelocity * this.velocity;
        const lateralTransfer = (this.CAR_MASS * Math.abs(lateralAccel) * this.CG_HEIGHT) / this.TRACK_WIDTH;
        
        // Apply to individual wheels
        const lateralDir = Math.sign(this.steeringAngle);
        
        this.wheelLoads.frontLeft = baseLoad - longitudinalTransfer/2 + lateralDir * lateralTransfer/2;
        this.wheelLoads.frontRight = baseLoad - longitudinalTransfer/2 - lateralDir * lateralTransfer/2;
        this.wheelLoads.rearLeft = baseLoad + longitudinalTransfer/2 + lateralDir * lateralTransfer/2;
        this.wheelLoads.rearRight = baseLoad + longitudinalTransfer/2 - lateralDir * lateralTransfer/2;
        
        // Clamp to positive values
        for (const key in this.wheelLoads) {
            this.wheelLoads[key] = Math.max(100, this.wheelLoads[key]);
        }
    }
    
    calculateAerodynamics() {
        // Drag force: F = 0.5 * rho * Cd * A * v²
        const speed = Math.abs(this.velocity);
        const dragForce = 0.5 * this.AIR_DENSITY * this.DRAG_COEFF * this.FRONTAL_AREA * speed * speed;
        return dragForce;
    }
    
    calculateDriftPhysics(deltaTime, controls) {
        // Calculate velocity direction vs heading
        const speed = Math.abs(this.velocity);
        
        if (speed < 5) {
            this.isDrifting = false;
            this.slipAngle = 0;
            this.angularVelocity *= 0.9;
            return;
        }
        
        // Calculate slip angle based on velocity direction vs car heading
        const velocityAngle = Math.atan2(this.velocityX, this.velocityZ);
        this.slipAngle = this.rotation - velocityAngle;
        
        // Normalize slip angle to -PI to PI
        while (this.slipAngle > Math.PI) this.slipAngle -= Math.PI * 2;
        while (this.slipAngle < -Math.PI) this.slipAngle += Math.PI * 2;
        
        // Pacejka-inspired simplified tire model
        const frontGrip = this.GRIP_FRONT * this.pacejkaGrip(this.slipAngle * 0.5);
        const rearGrip = this.rearGrip * this.pacejkaGrip(this.slipAngle);
        
        // Determine if drifting based on slip angle and rear grip
        const wasDrifting = this.isDrifting;
        this.isDrifting = Math.abs(this.slipAngle) > this.DRIFT_THRESHOLD && 
                         (controls.isHandbrake || Math.abs(this.steeringAngle) > 0.2);
        
        if (this.isDrifting && !wasDrifting) {
            // Drift just started
            this.driftDuration = 0;
            this.currentDriftScore = 0;
        }
        
        // Apply lateral forces based on grip
        if (this.isDrifting) {
            // Reduced lateral grip allows sliding
            const lateralForce = -Math.sin(this.slipAngle) * rearGrip * speed * deltaTime;
            this.angularVelocity += lateralForce * 0.1;
            
            // Dampen angular velocity
            this.angularVelocity *= 0.95;
        } else {
            this.angularVelocity *= 0.8;
        }
        
        // Update velocity components for next frame
        this.velocityX = Math.sin(this.rotation) * this.velocity;
        this.velocityZ = Math.cos(this.rotation) * this.velocity;
    }
    
    pacejkaGrip(slipAngle) {
        // Simplified Pacejka magic formula for tire grip
        // Returns grip coefficient 0-1 based on slip angle
        const B = 10;  // Stiffness factor
        const C = 1.5; // Shape factor
        const D = 1.0; // Peak value
        const E = -0.5; // Curvature factor
        
        const slip = Math.abs(slipAngle);
        const grip = D * Math.sin(C * Math.atan(B * slip - E * (B * slip - Math.atan(B * slip))));
        
        return Math.max(0, Math.min(1, grip));
    }
    
    applyDamageEffects() {
        // Performance degradation based on damage
        const damageRatio = this.damage / this.MAX_DAMAGE;
        
        // Clamp mechanical damage values
        this.mechanicalDamage.engine = Math.min(100, this.mechanicalDamage.engine);
        this.mechanicalDamage.steering = Math.min(100, this.mechanicalDamage.steering);
        this.mechanicalDamage.suspension = Math.min(100, this.mechanicalDamage.suspension);
        this.mechanicalDamage.brakes = Math.min(100, this.mechanicalDamage.brakes);
        
        // Engine damage reduces max speed
        const engineFactor = 1 - (this.mechanicalDamage.engine / 100) * 0.4;
        this.maxSpeed = this.baseMaxSpeed * (1 - damageRatio * 0.4) * engineFactor;
        
        // Reduce acceleration based on damage and engine damage
        const accelFactor = 1 - (this.mechanicalDamage.engine / 100) * 0.5;
        this.acceleration = this.baseAcceleration * (1 - damageRatio * 0.5) * accelFactor;
        
        // Update health
        this.health = Math.max(0, 100 - this.damage);
    }
    
    updateDriftScore(deltaTime) {
        if (this.isDrifting) {
            this.driftDuration += deltaTime;
            
            // Score based on slip angle, speed, and duration
            const angleScore = Math.abs(this.slipAngle) * 100;
            const speedScore = Math.abs(this.velocity) * 2;
            const durationBonus = Math.min(this.driftDuration * 0.5, 2); // Max 2x bonus
            
            // Accumulate drift score
            const frameScore = (angleScore + speedScore) * durationBonus * deltaTime;
            this.currentDriftScore += frameScore;
            
            // Increase combo based on duration
            this.driftCombo = 1 + Math.floor(this.driftDuration / 2) * 0.5;
        } else if (this.currentDriftScore > 0) {
            // Drift ended, add to total score with combo
            this.driftScore += Math.round(this.currentDriftScore * this.driftCombo);
            this.currentDriftScore = 0;
            this.driftCombo = 1;
            this.driftDuration = 0;
        }
    }
    
    updateDamageVisual() {
        if (!this.bodyMaterial) return;
        
        // Change car color based on damage level
        const damageRatio = this.damage / this.MAX_DAMAGE;
        
        // Increase roughness with damage (scratches)
        this.bodyMaterial.roughness = 0.4 + damageRatio * 0.5;
        
        if (damageRatio > 0.7) {
            // Heavily damaged - dark red/brown
            this.bodyMaterial.color.setHex(0x4a1010);
        } else if (damageRatio > 0.4) {
            // Moderately damaged - darker red
            this.bodyMaterial.color.setHex(0x8a2020);
        } else if (damageRatio > 0.1) {
            // Lightly damaged - slightly darker
            this.bodyMaterial.color.setHex(0xcc3333);
        } else {
            // No damage - original color
            this.bodyMaterial.color.setHex(this.originalBodyColor);
        }
    }
    
    applyCollisionDamage(impactForce, impactPoint, impactDirection) {
        // Calculate damage based on impact force
        const speedMs = Math.abs(this.velocity);
        
        if (speedMs > this.DAMAGE_THRESHOLD) {
            // Damage scales with impact speed above threshold
            const damageAmount = (speedMs - this.DAMAGE_THRESHOLD) * 3;
            this.damage = Math.min(this.MAX_DAMAGE, this.damage + damageAmount);
            
            // Apply mesh deformation if impact is significant
            if (impactPoint && impactDirection && impactForce > 5) {
                this.deformOnImpact(impactPoint, impactForce * 1000, impactDirection);
            }
            
            // Spawn sparks at impact point
            this.emitSparks(impactPoint);
            
            // Emit debris at high impacts
            if (impactForce > 10) {
                this.emitDebris(impactPoint);
            }
            
            return damageAmount;
        }
        return 0;
    }
    
    applyCollisionResponse(obstacle, pushDir) {
        // Calculate impact velocity (relative to obstacle)
        const impactSpeed = Math.abs(this.velocity);
        
        // Apply bounce with restitution
        this.velocity *= -this.RESTITUTION;
        
        // Push car away from obstacle
        const pushForce = Math.max(0.5, impactSpeed * 0.1);
        this.position.add(pushDir.clone().multiplyScalar(pushForce));
        
        // Apply angular momentum based on impact offset
        const impactOffset = new THREE.Vector3()
            .subVectors(obstacle.position, this.position);
        
        // Calculate perpendicular force for spin
        const spinForce = (pushDir.x * impactOffset.z - pushDir.z * impactOffset.x) * 0.05;
        this.angularVelocity += spinForce * impactSpeed;
        
        // Return impact force for screen shake calculation
        return impactSpeed * this.CAR_MASS / 1000; // Simplified impact force
    }
    
    emitDebris(position) {
        // Create debris particles at collision point
        const numDebris = 5;
        for (let i = 0; i < numDebris && this.debrisParticles.length < this.maxDebrisParticles; i++) {
            const debris = {
                position: position ? position.clone() : this.position.clone(),
                velocity: new THREE.Vector3(
                    (Math.random() - 0.5) * 8,
                    Math.random() * 4 + 2,
                    (Math.random() - 0.5) * 8
                ),
                rotation: new THREE.Euler(
                    Math.random() * Math.PI * 2,
                    Math.random() * Math.PI * 2,
                    Math.random() * Math.PI * 2
                ),
                angularVel: new THREE.Vector3(
                    (Math.random() - 0.5) * 10,
                    (Math.random() - 0.5) * 10,
                    (Math.random() - 0.5) * 10
                ),
                life: 1.5 + Math.random(),
                mesh: null
            };
            
            // Create debris mesh (small irregular shape)
            const debrisGeometry = new THREE.BoxGeometry(
                0.1 + Math.random() * 0.15,
                0.05 + Math.random() * 0.1,
                0.1 + Math.random() * 0.15
            );
            const debrisMaterial = new THREE.MeshStandardMaterial({
                color: Math.random() > 0.5 ? 0x444444 : this.originalBodyColor,
                metalness: 0.5,
                roughness: 0.7
            });
            debris.mesh = new THREE.Mesh(debrisGeometry, debrisMaterial);
            debris.mesh.position.copy(debris.position);
            debris.mesh.rotation.copy(debris.rotation);
            debris.mesh.castShadow = true;
            this.scene.add(debris.mesh);
            
            this.debrisParticles.push(debris);
        }
    }
    
    emitSparks(position) {
        // Create spark particles at collision point
        const numSparks = 10;
        for (let i = 0; i < numSparks && this.sparkParticles.length < this.maxSparkParticles; i++) {
            const spark = {
                position: position ? position.clone() : this.position.clone(),
                velocity: new THREE.Vector3(
                    (Math.random() - 0.5) * 10,
                    Math.random() * 5 + 2,
                    (Math.random() - 0.5) * 10
                ),
                life: 0.5 + Math.random() * 0.5,
                mesh: null
            };
            
            // Create spark mesh
            const sparkGeometry = new THREE.SphereGeometry(0.05, 4, 4);
            const sparkMaterial = new THREE.MeshBasicMaterial({
                color: 0xffaa00,
                transparent: true,
                opacity: 1
            });
            spark.mesh = new THREE.Mesh(sparkGeometry, sparkMaterial);
            spark.mesh.position.copy(spark.position);
            this.scene.add(spark.mesh);
            
            this.sparkParticles.push(spark);
        }
    }
    
    emitDamageSmoke() {
        // Emit smoke from hood when damaged
        if (this.smokeParticles.length >= this.maxSmokeParticles) return;
        
        const smokePos = this.position.clone();
        smokePos.y += 0.8;
        smokePos.x += Math.sin(this.rotation) * 1.5;
        smokePos.z += Math.cos(this.rotation) * 1.5;
        
        const smoke = {
            position: smokePos,
            velocity: new THREE.Vector3(
                (Math.random() - 0.5) * 0.5,
                Math.random() * 2 + 1,
                (Math.random() - 0.5) * 0.5
            ),
            life: 1 + Math.random(),
            maxLife: 2,
            mesh: null
        };
        
        const smokeGeometry = new THREE.SphereGeometry(0.2, 6, 6);
        const smokeMaterial = new THREE.MeshBasicMaterial({
            color: 0x555555,
            transparent: true,
            opacity: 0.4
        });
        smoke.mesh = new THREE.Mesh(smokeGeometry, smokeMaterial);
        smoke.mesh.position.copy(smoke.position);
        this.scene.add(smoke.mesh);
        
        this.smokeParticles.push(smoke);
    }
    
    emitDriftSmoke() {
        // Emit tire smoke during drift
        if (!this.isDrifting || this.smokeParticles.length >= this.maxSmokeParticles) return;
        
        // Emit from rear wheels using wheel position constants
        const rearLeft = this.position.clone();
        rearLeft.x += Math.cos(this.rotation) * -this.WHEEL_X_OFFSET + Math.sin(this.rotation) * this.REAR_WHEEL_Z_OFFSET;
        rearLeft.z += -Math.sin(this.rotation) * -this.WHEEL_X_OFFSET + Math.cos(this.rotation) * this.REAR_WHEEL_Z_OFFSET;
        rearLeft.y = 0.1;
        
        const smoke = {
            position: rearLeft,
            velocity: new THREE.Vector3(
                (Math.random() - 0.5) * 0.3,
                Math.random() * 0.5 + 0.2,
                (Math.random() - 0.5) * 0.3
            ),
            life: 0.8 + Math.random() * 0.5,
            maxLife: 1.5,
            mesh: null
        };
        
        const smokeGeometry = new THREE.SphereGeometry(0.15, 4, 4);
        const smokeMaterial = new THREE.MeshBasicMaterial({
            color: 0xcccccc,
            transparent: true,
            opacity: 0.3
        });
        smoke.mesh = new THREE.Mesh(smokeGeometry, smokeMaterial);
        smoke.mesh.position.copy(smoke.position);
        this.scene.add(smoke.mesh);
        
        this.smokeParticles.push(smoke);
    }
    
    updateParticles(deltaTime) {
        // Update and remove dead spark particles
        for (let i = this.sparkParticles.length - 1; i >= 0; i--) {
            const spark = this.sparkParticles[i];
            spark.life -= deltaTime;
            
            if (spark.life <= 0) {
                this.scene.remove(spark.mesh);
                spark.mesh.geometry.dispose();
                spark.mesh.material.dispose();
                this.sparkParticles.splice(i, 1);
            } else {
                // Update position
                spark.velocity.y -= 9.8 * deltaTime; // Gravity
                spark.position.add(spark.velocity.clone().multiplyScalar(deltaTime));
                spark.mesh.position.copy(spark.position);
                spark.mesh.material.opacity = spark.life;
            }
        }
        
        // Update and remove dead smoke particles
        for (let i = this.smokeParticles.length - 1; i >= 0; i--) {
            const smoke = this.smokeParticles[i];
            smoke.life -= deltaTime;
            
            if (smoke.life <= 0) {
                this.scene.remove(smoke.mesh);
                smoke.mesh.geometry.dispose();
                smoke.mesh.material.dispose();
                this.smokeParticles.splice(i, 1);
            } else {
                // Update position
                smoke.position.add(smoke.velocity.clone().multiplyScalar(deltaTime));
                smoke.mesh.position.copy(smoke.position);
                smoke.mesh.scale.setScalar(1 + (smoke.maxLife - smoke.life) * 0.5);
                smoke.mesh.material.opacity = smoke.life / smoke.maxLife * 0.4;
            }
        }
        
        // Update and remove dead debris particles
        for (let i = this.debrisParticles.length - 1; i >= 0; i--) {
            const debris = this.debrisParticles[i];
            debris.life -= deltaTime;
            
            if (debris.life <= 0) {
                this.scene.remove(debris.mesh);
                debris.mesh.geometry.dispose();
                debris.mesh.material.dispose();
                this.debrisParticles.splice(i, 1);
            } else {
                // Update position with gravity
                debris.velocity.y -= 9.8 * deltaTime;
                debris.position.add(debris.velocity.clone().multiplyScalar(deltaTime));
                debris.mesh.position.copy(debris.position);
                
                // Update rotation
                debris.mesh.rotation.x += debris.angularVel.x * deltaTime;
                debris.mesh.rotation.y += debris.angularVel.y * deltaTime;
                debris.mesh.rotation.z += debris.angularVel.z * deltaTime;
                
                // Bounce off ground
                if (debris.position.y < 0.1) {
                    debris.position.y = 0.1;
                    debris.velocity.y *= -0.3;
                    debris.velocity.x *= 0.7;
                    debris.velocity.z *= 0.7;
                    debris.angularVel.multiplyScalar(0.5);
                }
            }
        }
        
        // Emit drift smoke
        if (this.isDrifting && Math.random() < 0.3) {
            this.emitDriftSmoke();
        }
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
    
    getDamage() {
        return this.damage;
    }
    
    getHealth() {
        return this.health;
    }
    
    getDriftScore() {
        return Math.round(this.driftScore);
    }
    
    getCurrentDriftScore() {
        return Math.round(this.currentDriftScore * this.driftCombo);
    }
    
    getDriftCombo() {
        return this.driftCombo;
    }
    
    getIsDrifting() {
        return this.isDrifting;
    }
    
    getSlipAngle() {
        return this.slipAngle;
    }
    
    getRPM() {
        return Math.round(this.currentRPM);
    }
    
    getGear() {
        return this.currentGear;
    }
    
    getDriftAngleDegrees() {
        return Math.round(Math.abs(this.slipAngle) * (180 / Math.PI));
    }
    
    // Get tire positions for tire marks
    getRearWheelPositions() {
        const positions = [];
        const cos = Math.cos(this.rotation);
        const sin = Math.sin(this.rotation);
        
        // Rear left wheel - using wheel position constants
        const rlX = this.position.x + cos * -this.WHEEL_X_OFFSET + sin * this.REAR_WHEEL_Z_OFFSET;
        const rlZ = this.position.z + -sin * -this.WHEEL_X_OFFSET + cos * this.REAR_WHEEL_Z_OFFSET;
        positions.push(new THREE.Vector3(rlX, 0.01, rlZ));
        
        // Rear right wheel - using wheel position constants
        const rrX = this.position.x + cos * this.WHEEL_X_OFFSET + sin * this.REAR_WHEEL_Z_OFFSET;
        const rrZ = this.position.z + -sin * this.WHEEL_X_OFFSET + cos * this.REAR_WHEEL_Z_OFFSET;
        positions.push(new THREE.Vector3(rrX, 0.01, rrZ));
        
        return positions;
    }
    
    // Reset car position and state
    reset() {
        this.position.set(0, 0, 0);
        this.rotation = 0;
        this.velocity = 0;
        this.velocityX = 0;
        this.velocityZ = 0;
        this.angularVelocity = 0;
        this.steeringAngle = 0;
        
        // Reset damage
        this.damage = 0;
        this.health = 100;
        
        // Reset damage zones
        for (const zone in this.damageZones) {
            this.damageZones[zone].integrity = 100;
            this.damageZones[zone].crumpleDepth = 0;
        }
        
        // Reset mechanical damage
        for (const damage in this.mechanicalDamage) {
            this.mechanicalDamage[damage] = 0;
        }
        
        // Reset drift state
        this.isDrifting = false;
        this.slipAngle = 0;
        this.currentDriftScore = 0;
        this.driftCombo = 1;
        this.driftDuration = 0;
        
        // Reset engine
        this.currentRPM = this.IDLE_RPM;
        this.currentGear = 1;
        
        // Reset mesh deformation
        if (this.bodyMesh && this.originalPositions) {
            const geometry = this.bodyMesh.geometry;
            const positions = geometry.attributes.position;
            positions.array.set(this.originalPositions);
            positions.needsUpdate = true;
            geometry.computeVertexNormals();
        }
        
        // Hide glass crack overlay
        if (this.glassCrackOverlay) {
            this.glassCrackOverlay.visible = false;
            this.glassCrackOverlay.material.opacity = 0;
        }
        
        // Reset body material
        if (this.bodyMaterial) {
            this.bodyMaterial.color.setHex(this.originalBodyColor);
            this.bodyMaterial.roughness = 0.4;
        }
        
        // Update mesh position
        this.mesh.position.copy(this.position);
        this.mesh.rotation.y = this.rotation;
    }
}