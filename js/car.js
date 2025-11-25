/**
 * Car Class
 * Advanced car physics with realistic tire model, damage system, and deformation
 * Inspired by BeamNG.drive physics
 */
class Car {
    constructor() {
        // Position and rotation
        this.position = new Vector2(0, 0);
        this.angle = 0; // Radians
        this.velocity = new Vector2(0, 0);
        this.angularVelocity = 0;
        
        // Physical properties
        this.mass = 1500; // kg
        this.inertia = 2500; // Moment of inertia
        this.wheelbase = 2.6; // m - distance between axles
        this.trackWidth = 1.8; // m - distance between left/right wheels
        this.cgHeight = 0.5; // Center of gravity height
        
        // Dimensions (for rendering and collision)
        this.width = 40; // pixels
        this.length = 80; // pixels
        
        // Engine properties
        this.engineRPM = 800;
        this.idleRPM = 800;
        this.maxRPM = 7500;
        this.redlineRPM = 7000;
        this.maxPower = 300; // HP
        this.maxTorque = 400; // Nm
        
        // Transmission
        this.gear = 1;
        this.gearRatios = [0, 3.5, 2.5, 1.8, 1.3, 1.0, 0.8]; // 0 is neutral, then 1-6
        this.reverseRatio = -3.2;
        this.finalDrive = 3.7;
        this.clutch = 1.0; // 0-1, 1 = fully engaged
        
        // Physics constants
        this.dragCoefficient = 0.35;
        this.frontalArea = 2.2; // m²
        this.rollingResistance = 0.015;
        this.downforceCoefficient = 0.3;
        
        // Steering
        this.steerAngle = 0;
        this.maxSteerAngle = Math.PI / 5; // 36 degrees
        this.steerSpeed = 3.0;
        this.steerReturnSpeed = 4.5;
        
        // Brakes
        this.brakeTorque = 3000; // Nm
        this.handbrakeForce = 0.8;
        
        // Wheels (front-left, front-right, rear-left, rear-right)
        this.wheels = [
            new Wheel(new Vector2(-this.trackWidth/2, this.wheelbase/2), true, true),
            new Wheel(new Vector2(this.trackWidth/2, this.wheelbase/2), true, false),
            new Wheel(new Vector2(-this.trackWidth/2, -this.wheelbase/2), false, true),
            new Wheel(new Vector2(this.trackWidth/2, -this.wheelbase/2), false, false)
        ];
        
        // Damage system
        this.damage = {
            front: 0,
            rear: 0,
            left: 0,
            right: 0,
            engine: 0,
            total: 0
        };
        
        // Body deformation points (relative to center)
        this.bodyPoints = this.initBodyPoints();
        this.originalBodyPoints = this.initBodyPoints();
        
        // Visual state
        this.bodyRoll = 0;
        this.bodyPitch = 0;
        this.headlightsOn = true;
        this.brakeLightsOn = false;
        
        // Drift state
        this.driftAngle = 0;
        this.isDrifting = false;
        this.driftScore = 0;
        this.currentDriftScore = 0;
        this.driftCombo = 1;
        this.driftTimer = 0;
        this.bestDrift = 0;
        
        // G-forces
        this.gForce = new Vector2(0, 0);
        this.maxGForce = 0;
        
        // Physics engine reference
        this.physics = new PhysicsEngine();
        this.tirePhysics = new TirePhysics();
        
        // Surface currently on
        this.currentSurface = SurfaceType.ASPHALT;
        
        // Particle effects
        this.smokeIntensity = 0;
        this.sparkTimer = 0;
    }

    initBodyPoints() {
        // Define car body shape with deformable points
        const hw = this.width / 2;
        const hl = this.length / 2;
        
        return {
            // Front
            frontLeft: new Vector2(-hw, hl),
            frontCenter: new Vector2(0, hl + 5),
            frontRight: new Vector2(hw, hl),
            // Sides
            sideFL: new Vector2(-hw - 2, hl * 0.6),
            sideBL: new Vector2(-hw - 2, -hl * 0.6),
            sideFR: new Vector2(hw + 2, hl * 0.6),
            sideBR: new Vector2(hw + 2, -hl * 0.6),
            // Rear
            rearLeft: new Vector2(-hw, -hl),
            rearCenter: new Vector2(0, -hl - 3),
            rearRight: new Vector2(hw, -hl)
        };
    }

    /**
     * Get car's forward direction vector
     */
    getForward() {
        return new Vector2(Math.sin(this.angle), Math.cos(this.angle));
    }

    /**
     * Get car's right direction vector
     */
    getRight() {
        return new Vector2(Math.cos(this.angle), -Math.sin(this.angle));
    }

    /**
     * Get current speed in m/s
     */
    getSpeed() {
        return this.velocity.length();
    }

    /**
     * Get speed in km/h
     */
    getSpeedKmh() {
        return this.getSpeed() * 3.6;
    }

    /**
     * Calculate engine torque at current RPM
     */
    getEngineTorque(rpm, throttle) {
        // Simplified torque curve - peak torque around 4500 RPM
        const normalizedRPM = rpm / this.maxRPM;
        let torqueMultiplier;
        
        if (normalizedRPM < 0.2) {
            torqueMultiplier = normalizedRPM * 3; // Low RPM buildup
        } else if (normalizedRPM < 0.6) {
            torqueMultiplier = 0.6 + normalizedRPM * 0.7; // Peak zone
        } else if (normalizedRPM < 0.9) {
            torqueMultiplier = 1.0 - (normalizedRPM - 0.6) * 0.5; // Falling off
        } else {
            torqueMultiplier = 0.85 - (normalizedRPM - 0.9) * 2; // Near redline
        }
        
        return this.maxTorque * torqueMultiplier * throttle * (1 - this.damage.engine * 0.5);
    }

    /**
     * Automatic transmission gear selection
     */
    updateGear(rpm, throttle) {
        const upshiftRPM = this.redlineRPM - 500;
        const downshiftRPM = 2500;
        
        if (rpm >= upshiftRPM && this.gear < 6 && throttle > 0.5) {
            this.gear++;
        } else if (rpm <= downshiftRPM && this.gear > 1) {
            this.gear--;
        }
    }

    /**
     * Main physics update
     */
    update(deltaTime, controls, world) {
        if (deltaTime <= 0 || deltaTime > 0.1) return;

        // Update controls smoothing
        controls.update(deltaTime);
        
        // Get input values
        const throttle = controls.throttle;
        const brake = controls.brake;
        const steering = controls.steering;
        const handbrake = controls.isHandbrake;
        
        // Update steering angle
        this.updateSteering(steering, deltaTime);
        
        // Check surface type
        if (world) {
            this.currentSurface = world.getSurfaceAt(this.position.x, this.position.y);
        }
        
        // Calculate weight distribution
        const speed = this.getSpeed();
        const forwardVel = this.velocity.dot(this.getForward());
        const lateralVel = this.velocity.dot(this.getRight());
        
        // Base weight distribution (50/50)
        let frontWeight = this.mass * 9.81 / 2;
        let rearWeight = this.mass * 9.81 / 2;
        
        // Longitudinal weight transfer
        const accelForce = forwardVel > 0 ? throttle * this.maxTorque : 0;
        const weightTransferLong = (accelForce * this.cgHeight) / this.wheelbase;
        frontWeight -= weightTransferLong * 0.3;
        rearWeight += weightTransferLong * 0.3;
        
        // Braking weight transfer
        if (brake > 0 || handbrake) {
            const brakeTransfer = brake * this.brakeTorque * this.cgHeight / this.wheelbase * 0.2;
            frontWeight += brakeTransfer;
            rearWeight -= brakeTransfer;
        }
        
        // Update engine RPM
        if (this.gear > 0) {
            const wheelRPM = (speed / (Math.PI * 0.65)) * 60; // Assuming 0.325m wheel radius
            const gearRatio = this.gearRatios[this.gear] * this.finalDrive;
            this.engineRPM = Math.max(this.idleRPM, wheelRPM * gearRatio);
            
            // Rev limiter
            if (this.engineRPM >= this.maxRPM) {
                this.engineRPM = this.maxRPM;
            }
        } else {
            // Idle in neutral
            this.engineRPM = this.idleRPM + throttle * 2000;
        }
        
        // Automatic transmission
        this.updateGear(this.engineRPM, throttle);
        
        // Calculate drive force
        let driveForce = 0;
        if (throttle > 0 && this.gear > 0) {
            const engineTorque = this.getEngineTorque(this.engineRPM, throttle);
            const gearRatio = this.gearRatios[this.gear] * this.finalDrive;
            const wheelTorque = engineTorque * gearRatio;
            driveForce = wheelTorque / 0.325; // Wheel radius
        } else if (brake > 0 && forwardVel < 1 && !handbrake) {
            // Reverse
            driveForce = -brake * this.maxTorque * 0.5;
            this.gear = 0;
        }
        
        // Process each wheel
        let totalForce = new Vector2(0, 0);
        let totalTorque = 0;
        
        const surfaceGrip = this.currentSurface.grip;
        
        for (let i = 0; i < 4; i++) {
            const wheel = this.wheels[i];
            const isFront = wheel.isFront;
            const isLeft = wheel.isLeft;
            
            // Wheel position in world space
            const localPos = wheel.localPosition.multiply(20); // Scale factor
            const wheelPos = this.position.add(localPos.rotate(this.angle));
            
            // Wheel weight
            const weight = isFront ? frontWeight / 2 : rearWeight / 2;
            wheel.load = weight;
            
            // Wheel direction
            const wheelAngle = this.angle + (isFront ? this.steerAngle : 0);
            const wheelForward = new Vector2(Math.sin(wheelAngle), Math.cos(wheelAngle));
            const wheelRight = new Vector2(Math.cos(wheelAngle), -Math.sin(wheelAngle));
            
            // Velocity at wheel
            const wheelVel = this.velocity.add(
                localPos.perpendicular().multiply(this.angularVelocity * 0.05)
            );
            
            // Slip angle calculation
            const forwardSpeed = wheelVel.dot(wheelForward);
            const lateralSpeed = wheelVel.dot(wheelRight);
            wheel.slipAngle = Math.atan2(lateralSpeed, Math.abs(forwardSpeed) + 0.1);
            
            // Slip ratio (for traction)
            const targetWheelSpeed = forwardSpeed;
            wheel.slipRatio = 0;
            
            // Calculate grip
            const tempGrip = wheel.getTemperatureGripMultiplier();
            const damageGrip = 1 - wheel.damage * 0.3;
            const totalGrip = surfaceGrip * tempGrip * damageGrip;
            wheel.grip = totalGrip;
            
            // Lateral force (cornering)
            let lateralForce = this.tirePhysics.calculateLateralForce(
                wheel.slipAngle, weight, totalGrip
            );
            
            // Handbrake - lock rear wheels
            if (handbrake && !isFront) {
                lateralForce *= 0.3; // Reduce grip significantly
                wheel.slipRatio = 1;
            }
            
            // Longitudinal force (drive/brake)
            let longitudinalForce = 0;
            
            // Drive force (rear wheel drive)
            if (!isFront && driveForce !== 0) {
                longitudinalForce = driveForce / 2;
            }
            
            // Braking force
            if (brake > 0 && forwardSpeed > 0.5) {
                const brakeForce = brake * this.brakeTorque * (isFront ? 0.6 : 0.4);
                longitudinalForce -= brakeForce;
            }
            
            // Apply friction circle
            const maxForce = weight * totalGrip;
            const forces = this.tirePhysics.applyFrictionCircle(
                lateralForce, longitudinalForce, maxForce
            );
            
            // Convert to world force
            const worldForce = wheelForward.multiply(forces.longitudinal)
                .add(wheelRight.multiply(-forces.lateral));
            
            totalForce = totalForce.add(worldForce);
            
            // Calculate torque from this wheel
            const r = localPos.rotate(this.angle);
            totalTorque += r.cross(worldForce) * 0.001;
            
            // Update tire temperature
            const slipMagnitude = Math.abs(wheel.slipAngle) + Math.abs(wheel.slipRatio);
            wheel.updateTemperature(slipMagnitude, deltaTime);
            
            // Update wheel rotation for visual
            wheel.rotation += forwardSpeed * deltaTime * 3;
            wheel.steerAngle = isFront ? this.steerAngle : 0;
        }
        
        // Apply aerodynamic drag
        const drag = this.physics.calculateDrag(
            this.velocity, this.dragCoefficient, this.frontalArea
        );
        totalForce = totalForce.add(drag.multiply(0.01));
        
        // Rolling resistance
        if (speed > 0.1) {
            const rollingForce = this.velocity.normalize().multiply(
                -this.mass * 9.81 * this.rollingResistance
            );
            totalForce = totalForce.add(rollingForce.multiply(0.1));
        }
        
        // Engine braking when no throttle
        if (throttle < 0.1 && forwardVel > 1) {
            const engineBrake = this.getForward().multiply(-forwardVel * 50);
            totalForce = totalForce.add(engineBrake);
        }
        
        // Apply forces
        const acceleration = totalForce.divide(this.mass);
        this.velocity = this.velocity.add(acceleration.multiply(deltaTime));
        
        // Apply angular acceleration
        const angularAccel = totalTorque / this.inertia;
        this.angularVelocity += angularAccel * deltaTime * 1000;
        
        // Angular damping
        this.angularVelocity *= 0.98;
        
        // Update position and angle
        this.position = this.position.add(this.velocity.multiply(deltaTime));
        this.angle += this.angularVelocity * deltaTime;
        
        // Normalize angle
        while (this.angle > Math.PI) this.angle -= Math.PI * 2;
        while (this.angle < -Math.PI) this.angle += Math.PI * 2;
        
        // Calculate G-forces
        const gForceX = acceleration.dot(this.getRight()) / 9.81;
        const gForceY = acceleration.dot(this.getForward()) / 9.81;
        this.gForce = new Vector2(gForceX, gForceY);
        this.maxGForce = Math.max(this.maxGForce, this.gForce.length());
        
        // Calculate drift angle
        if (speed > 5) {
            const velAngle = Math.atan2(this.velocity.x, this.velocity.y);
            this.driftAngle = (this.angle - velAngle) * (180 / Math.PI);
            // Normalize to -180 to 180
            while (this.driftAngle > 180) this.driftAngle -= 360;
            while (this.driftAngle < -180) this.driftAngle += 360;
        } else {
            this.driftAngle = 0;
        }
        
        // Update drift scoring
        this.updateDriftScore(deltaTime);
        
        // Update visual body roll and pitch
        this.bodyRoll = -gForceX * 3;
        this.bodyPitch = gForceY * 2;
        
        // Brake lights
        this.brakeLightsOn = brake > 0.1;
        
        // Smoke intensity based on slip
        const maxSlip = Math.max(...this.wheels.map(w => 
            Math.abs(w.slipAngle) + (w.slipRatio || 0)
        ));
        this.smokeIntensity = Math.min(1, maxSlip * 2);
    }

    updateSteering(input, deltaTime) {
        const targetAngle = input * this.maxSteerAngle;
        
        // Speed-dependent steering reduction
        const speedFactor = Math.max(0.3, 1 - this.getSpeed() / 50);
        const adjustedTarget = targetAngle * speedFactor;
        
        if (Math.abs(adjustedTarget - this.steerAngle) < 0.01) {
            this.steerAngle = adjustedTarget;
        } else if (adjustedTarget > this.steerAngle) {
            this.steerAngle += this.steerSpeed * deltaTime;
            if (this.steerAngle > adjustedTarget) this.steerAngle = adjustedTarget;
        } else {
            this.steerAngle -= this.steerSpeed * deltaTime;
            if (this.steerAngle < adjustedTarget) this.steerAngle = adjustedTarget;
        }
    }

    updateDriftScore(deltaTime) {
        const absDriftAngle = Math.abs(this.driftAngle);
        const speed = this.getSpeedKmh();
        
        // Check if drifting (angle > 15 degrees, speed > 30 km/h)
        if (absDriftAngle > 15 && speed > 30) {
            this.isDrifting = true;
            
            // Calculate points
            let points = absDriftAngle * speed * 0.01;
            
            // Bonus for optimal drift angle (30-45 degrees)
            if (absDriftAngle >= 30 && absDriftAngle <= 45) {
                points *= 1.5;
            }
            
            this.currentDriftScore += points * deltaTime;
            this.driftTimer = 0.5; // Reset combo timer
        } else {
            this.driftTimer -= deltaTime;
            
            if (this.driftTimer <= 0 && this.isDrifting) {
                // End drift
                if (this.currentDriftScore > 100) {
                    this.driftScore += Math.floor(this.currentDriftScore * this.driftCombo);
                    this.driftCombo = Math.min(5, this.driftCombo + 0.5);
                    this.bestDrift = Math.max(this.bestDrift, Math.floor(this.currentDriftScore));
                }
                this.currentDriftScore = 0;
                this.isDrifting = false;
            }
        }
        
        // Reset combo if not drifting for too long
        if (!this.isDrifting && this.driftTimer < -2) {
            this.driftCombo = 1;
        }
    }

    /**
     * Apply collision damage and deformation
     */
    applyCollision(collisionPoint, normal, impactForce) {
        // Determine damage zone
        const localPoint = collisionPoint.subtract(this.position).rotate(-this.angle);
        
        let zone = '';
        if (localPoint.y > this.length * 0.25) zone = 'front';
        else if (localPoint.y < -this.length * 0.25) zone = 'rear';
        else if (localPoint.x < 0) zone = 'left';
        else zone = 'right';
        
        // Calculate damage amount (threshold: 5000 units)
        const damageAmount = this.physics.calculateImpactDamage(impactForce, 5000);
        
        if (damageAmount > 0) {
            // Apply zone damage
            this.damage[zone] = Math.min(1, this.damage[zone] + damageAmount);
            
            // Engine damage from front impacts
            if (zone === 'front') {
                this.damage.engine = Math.min(1, this.damage.engine + damageAmount * 0.5);
            }
            
            // Calculate total damage
            this.damage.total = (
                this.damage.front + this.damage.rear +
                this.damage.left + this.damage.right
            ) / 4;
            
            // Apply deformation to body points
            this.applyDeformation(localPoint, damageAmount);
        }
        
        // Apply impulse
        const invMass = 1 / this.mass;
        const restitution = 0.3;
        const velAlongNormal = this.velocity.dot(normal);
        
        if (velAlongNormal < 0) {
            const j = -(1 + restitution) * velAlongNormal * this.mass;
            this.velocity = this.velocity.add(normal.multiply(j * invMass));
            
            // Angular impulse
            const r = collisionPoint.subtract(this.position);
            const angImpulse = r.cross(normal.multiply(j)) / this.inertia;
            this.angularVelocity += angImpulse * 0.1;
        }
        
        return { zone, damage: damageAmount, impactForce };
    }

    applyDeformation(localPoint, amount) {
        const deformRadius = 30;
        const maxDeform = 8;
        
        for (const key in this.bodyPoints) {
            const point = this.bodyPoints[key];
            const original = this.originalBodyPoints[key];
            const dist = point.subtract(localPoint).length();
            
            if (dist < deformRadius) {
                const deformAmount = (1 - dist / deformRadius) * amount * maxDeform;
                const direction = point.subtract(localPoint).normalize();
                
                // Deform towards the impact
                const newPoint = point.add(direction.multiply(-deformAmount));
                
                // Limit maximum deformation - use squared distances for performance
                const maxDistSq = original.lengthSquared() * 0.09; // 0.3 * 0.3 = 0.09
                if (newPoint.subtract(original).lengthSquared() < maxDistSq) {
                    this.bodyPoints[key] = newPoint;
                }
            }
        }
    }

    /**
     * Reset car to starting position
     */
    reset(x = 0, y = 0, angle = 0) {
        this.position = new Vector2(x, y);
        this.angle = angle;
        this.velocity = new Vector2(0, 0);
        this.angularVelocity = 0;
        this.steerAngle = 0;
        this.gear = 1;
        this.engineRPM = this.idleRPM;
        
        // Reset damage
        this.damage = { front: 0, rear: 0, left: 0, right: 0, engine: 0, total: 0 };
        
        // Reset body deformation
        this.bodyPoints = this.initBodyPoints();
        
        // Reset drift
        this.driftScore = 0;
        this.currentDriftScore = 0;
        this.driftCombo = 1;
        this.bestDrift = 0;
        
        // Reset wheels
        for (const wheel of this.wheels) {
            wheel.damage = 0;
            wheel.temperature = 50;
        }
    }

    /**
     * Get corners for collision detection
     */
    getCorners() {
        return CollisionSystem.getCorners(
            this.position, this.width, this.length, this.angle
        );
    }

    /**
     * Render the car
     */
    render(ctx, camera) {
        const screenX = (this.position.x - camera.x) * camera.scale + ctx.canvas.width / 2;
        const screenY = (this.position.y - camera.y) * camera.scale + ctx.canvas.height / 2;
        
        ctx.save();
        ctx.translate(screenX, screenY);
        ctx.rotate(-this.angle);
        
        // Apply visual body roll/pitch (simplified as slight offset)
        ctx.translate(this.bodyRoll * 2, this.bodyPitch * 2);
        
        const scale = camera.scale;
        
        // Draw shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.ellipse(3, 3, this.width * scale * 0.5, this.length * scale * 0.45, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw car body with deformation
        this.renderBody(ctx, scale);
        
        // Draw wheels
        this.renderWheels(ctx, scale);
        
        // Draw lights
        this.renderLights(ctx, scale);
        
        // Draw damage indicators
        this.renderDamageEffects(ctx, scale);
        
        ctx.restore();
    }

    renderBody(ctx, scale) {
        const bp = this.bodyPoints;
        
        // Main body color (gets darker with damage)
        const damageShade = Math.floor(220 - this.damage.total * 100);
        ctx.fillStyle = `rgb(${damageShade}, ${Math.floor(damageShade * 0.3)}, ${Math.floor(damageShade * 0.3)})`;
        
        // Draw deformed body shape
        ctx.beginPath();
        ctx.moveTo(bp.frontLeft.x * scale, -bp.frontLeft.y * scale);
        ctx.lineTo(bp.frontCenter.x * scale, -bp.frontCenter.y * scale);
        ctx.lineTo(bp.frontRight.x * scale, -bp.frontRight.y * scale);
        ctx.lineTo(bp.sideFR.x * scale, -bp.sideFR.y * scale);
        ctx.lineTo(bp.sideBR.x * scale, -bp.sideBR.y * scale);
        ctx.lineTo(bp.rearRight.x * scale, -bp.rearRight.y * scale);
        ctx.lineTo(bp.rearCenter.x * scale, -bp.rearCenter.y * scale);
        ctx.lineTo(bp.rearLeft.x * scale, -bp.rearLeft.y * scale);
        ctx.lineTo(bp.sideBL.x * scale, -bp.sideBL.y * scale);
        ctx.lineTo(bp.sideFL.x * scale, -bp.sideFL.y * scale);
        ctx.closePath();
        ctx.fill();
        
        // Body outline
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Windshield
        ctx.fillStyle = 'rgba(100, 150, 200, 0.7)';
        ctx.beginPath();
        ctx.moveTo(-12 * scale, -20 * scale);
        ctx.lineTo(12 * scale, -20 * scale);
        ctx.lineTo(10 * scale, -5 * scale);
        ctx.lineTo(-10 * scale, -5 * scale);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.stroke();
        
        // Rear window
        ctx.fillStyle = 'rgba(100, 150, 200, 0.6)';
        ctx.beginPath();
        ctx.moveTo(-10 * scale, 5 * scale);
        ctx.lineTo(10 * scale, 5 * scale);
        ctx.lineTo(12 * scale, 20 * scale);
        ctx.lineTo(-12 * scale, 20 * scale);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        // Roof
        ctx.fillStyle = '#333';
        ctx.fillRect(-10 * scale, -5 * scale, 20 * scale, 10 * scale);
    }

    renderWheels(ctx, scale) {
        for (const wheel of this.wheels) {
            ctx.save();
            
            const wx = wheel.localPosition.x * 20 * scale;
            const wy = -wheel.localPosition.y * 20 * scale;
            
            ctx.translate(wx, wy);
            ctx.rotate(-wheel.steerAngle);
            
            // Tire
            const tireWidth = 8 * scale;
            const tireHeight = 16 * scale;
            
            // Tire color based on temperature
            let tireColor = '#222';
            if (wheel.temperature > 100) tireColor = '#442222';
            else if (wheel.temperature > 80) tireColor = '#333';
            
            ctx.fillStyle = tireColor;
            ctx.fillRect(-tireWidth/2, -tireHeight/2, tireWidth, tireHeight);
            
            // Wheel rim
            ctx.fillStyle = '#888';
            ctx.beginPath();
            ctx.arc(0, 0, 4 * scale, 0, Math.PI * 2);
            ctx.fill();
            
            // Wheel damage indicator
            if (wheel.damage > 0.3) {
                ctx.strokeStyle = '#ff0000';
                ctx.lineWidth = 2;
                ctx.stroke();
            }
            
            ctx.restore();
        }
    }

    renderLights(ctx, scale) {
        // Headlights
        if (this.headlightsOn) {
            ctx.fillStyle = 'rgba(255, 255, 200, 0.9)';
            ctx.beginPath();
            ctx.arc(-12 * scale, -35 * scale, 4 * scale, 0, Math.PI * 2);
            ctx.arc(12 * scale, -35 * scale, 4 * scale, 0, Math.PI * 2);
            ctx.fill();
            
            // Headlight glow
            const gradient = ctx.createRadialGradient(
                -12 * scale, -35 * scale, 0,
                -12 * scale, -35 * scale, 20 * scale
            );
            gradient.addColorStop(0, 'rgba(255, 255, 200, 0.3)');
            gradient.addColorStop(1, 'rgba(255, 255, 200, 0)');
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(-12 * scale, -35 * scale, 20 * scale, 0, Math.PI * 2);
            ctx.fill();
            
            const gradient2 = ctx.createRadialGradient(
                12 * scale, -35 * scale, 0,
                12 * scale, -35 * scale, 20 * scale
            );
            gradient2.addColorStop(0, 'rgba(255, 255, 200, 0.3)');
            gradient2.addColorStop(1, 'rgba(255, 255, 200, 0)');
            ctx.fillStyle = gradient2;
            ctx.beginPath();
            ctx.arc(12 * scale, -35 * scale, 20 * scale, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Tail lights / Brake lights
        const tailColor = this.brakeLightsOn ? 'rgba(255, 0, 0, 1)' : 'rgba(150, 0, 0, 0.8)';
        ctx.fillStyle = tailColor;
        ctx.fillRect(-15 * scale, 35 * scale, 8 * scale, 4 * scale);
        ctx.fillRect(7 * scale, 35 * scale, 8 * scale, 4 * scale);
        
        // Brake light glow
        if (this.brakeLightsOn) {
            const brakeGradient = ctx.createRadialGradient(
                0, 38 * scale, 0, 0, 38 * scale, 30 * scale
            );
            brakeGradient.addColorStop(0, 'rgba(255, 0, 0, 0.3)');
            brakeGradient.addColorStop(1, 'rgba(255, 0, 0, 0)');
            ctx.fillStyle = brakeGradient;
            ctx.fillRect(-20 * scale, 30 * scale, 40 * scale, 30 * scale);
        }
    }

    renderDamageEffects(ctx, scale) {
        // Damage cracks/scratches
        if (this.damage.total > 0.2) {
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.lineWidth = 1;
            
            // Random scratches based on damage zones
            if (this.damage.front > 0.2) {
                ctx.beginPath();
                ctx.moveTo(-10 * scale, -30 * scale);
                ctx.lineTo(5 * scale, -38 * scale);
                ctx.stroke();
            }
            if (this.damage.rear > 0.2) {
                ctx.beginPath();
                ctx.moveTo(8 * scale, 30 * scale);
                ctx.lineTo(-5 * scale, 38 * scale);
                ctx.stroke();
            }
        }
        
        // Smoke from engine damage
        if (this.damage.engine > 0.5) {
            ctx.fillStyle = `rgba(100, 100, 100, ${this.damage.engine * 0.3})`;
            ctx.beginPath();
            ctx.arc(0, -30 * scale, 10 * scale * this.damage.engine, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    /**
     * Get data for HUD display
     */
    getHUDData() {
        return {
            speed: Math.round(this.getSpeedKmh()),
            rpm: Math.round(this.engineRPM),
            gear: this.gear,
            gForce: this.gForce,
            damage: this.damage,
            driftAngle: Math.round(this.driftAngle),
            driftScore: Math.floor(this.driftScore),
            currentDrift: Math.floor(this.currentDriftScore),
            driftCombo: this.driftCombo.toFixed(1),
            bestDrift: Math.floor(this.bestDrift),
            isDrifting: this.isDrifting,
            wheels: this.wheels.map(w => ({
                grip: w.grip,
                temp: w.temperature,
                slipAngle: w.slipAngle
            }))
        };
    }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.Car = Car;
}