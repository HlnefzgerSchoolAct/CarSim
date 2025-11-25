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
        this.velocityX = 0; // Lateral velocity for drift
        this.velocityZ = 0; // Longitudinal velocity for drift
        this.angularVelocity = 0;
        this.steeringAngle = 0;
        
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
        this.wheelBase = 2.5; // Distance between front and rear axles
        
        // Drift Physics Constants
        this.GRIP_FRONT = 1.0;           // Front tire grip coefficient
        this.GRIP_REAR_NORMAL = 0.95;    // Rear tire grip (normal)
        this.GRIP_REAR_HANDBRAKE = 0.4;  // Rear tire grip (handbrake)
        this.DRIFT_THRESHOLD = 0.15;     // Slip angle threshold for drift (radians)
        this.COUNTER_STEER_FACTOR = 1.5; // Counter-steering effectiveness
        
        // Crash Physics Constants
        this.CAR_MASS = 1200;            // kg
        this.RESTITUTION = 0.3;          // Bounce coefficient
        this.DAMAGE_THRESHOLD = 5;       // m/s impact speed for damage
        this.MAX_DAMAGE = 100;           // Maximum damage value
        
        // Damage System
        this.damage = 0;
        this.health = 100;
        
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
        this.maxSmokeParticles = 50;
        this.maxSparkParticles = 30;
        
        // Visual properties
        this.mesh = null;
        this.wheels = [];
        this.bodyMaterial = null;
        this.originalBodyColor = 0xff4444;
        
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

        // Car body (main chassis)
        const bodyGeometry = new THREE.BoxGeometry(2, 0.5, 4);
        this.bodyMaterial = new THREE.MeshStandardMaterial({ 
            color: this.originalBodyColor,
            metalness: 0.6,
            roughness: 0.4
        });
        const body = new THREE.Mesh(bodyGeometry, this.bodyMaterial);
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
        // Apply damage-based performance degradation
        this.applyDamageEffects();
        
        // Handle handbrake for drift
        if (controls.isHandbrake) {
            this.rearGrip = this.GRIP_REAR_HANDBRAKE;
        } else {
            this.rearGrip = this.GRIP_REAR_NORMAL;
        }
        
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

        // Handle steering with damage impairment
        const steeringMultiplier = this.damage > 70 ? 0.6 : (this.damage > 40 ? 0.8 : 1.0);
        const effectiveSteeringSpeed = this.steeringSpeed * steeringMultiplier;
        
        const speedFactor = Math.min(Math.abs(this.velocity) / 10, 1);
        
        if (controls.isSteeringLeft) {
            this.steeringAngle += effectiveSteeringSpeed * deltaTime;
        } else if (controls.isSteeringRight) {
            this.steeringAngle -= effectiveSteeringSpeed * deltaTime;
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
        
        // Reduce max speed (up to 40% reduction at max damage)
        this.maxSpeed = this.baseMaxSpeed * (1 - damageRatio * 0.4);
        
        // Reduce acceleration (up to 50% reduction at max damage)
        this.acceleration = this.baseAcceleration * (1 - damageRatio * 0.5);
        
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
    
    applyCollisionDamage(impactForce, impactPoint) {
        // Calculate damage based on impact force
        const speedMs = Math.abs(this.velocity);
        
        if (speedMs > this.DAMAGE_THRESHOLD) {
            // Damage scales with impact speed above threshold
            const damageAmount = (speedMs - this.DAMAGE_THRESHOLD) * 3;
            this.damage = Math.min(this.MAX_DAMAGE, this.damage + damageAmount);
            
            // Spawn sparks at impact point
            this.emitSparks(impactPoint);
            
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
        
        // Emit from rear wheels
        const rearLeft = this.position.clone();
        rearLeft.x += Math.cos(this.rotation) * -1 + Math.sin(this.rotation) * -1.3;
        rearLeft.z += -Math.sin(this.rotation) * -1 + Math.cos(this.rotation) * -1.3;
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
    
    // Get tire positions for tire marks
    getRearWheelPositions() {
        const positions = [];
        const cos = Math.cos(this.rotation);
        const sin = Math.sin(this.rotation);
        
        // Rear left wheel
        const rlX = this.position.x + cos * -1 + sin * -1.3;
        const rlZ = this.position.z + -sin * -1 + cos * -1.3;
        positions.push(new THREE.Vector3(rlX, 0.01, rlZ));
        
        // Rear right wheel
        const rrX = this.position.x + cos * 1 + sin * -1.3;
        const rrZ = this.position.z + -sin * 1 + cos * -1.3;
        positions.push(new THREE.Vector3(rrX, 0.01, rrZ));
        
        return positions;
    }
}