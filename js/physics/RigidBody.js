/**
 * RigidBody.js
 * Rigid body dynamics simulation with mass, inertia, forces, and torques
 * Based on classical Newtonian mechanics
 */

/**
 * RigidBody class represents a physical object with mass and inertia
 */
class RigidBody {
    /**
     * Create a rigid body
     * @param {Object} config - Configuration object
     */
    constructor(config = {}) {
        // Mass properties (SI units: kg, kg⋅m²)
        this.mass = config.mass || 1.0;
        this.invMass = this.mass > 0 ? 1.0 / this.mass : 0;
        
        // Moment of inertia tensor (3x3 matrix for 3D rotation)
        // For a box: Ixx = (m/12)(h² + d²), Iyy = (m/12)(w² + d²), Izz = (m/12)(w² + h²)
        this.inertia = new Float32Array(9);
        this.invInertia = new Float32Array(9);
        this.setInertia(
            config.inertia || { x: 1, y: 1, z: 1 }
        );
        
        // Linear motion (position, velocity, acceleration in m, m/s, m/s²)
        this.position = new Float32Array(config.position || [0, 0, 0]);
        this.velocity = new Float32Array(config.velocity || [0, 0, 0]);
        this.acceleration = new Float32Array([0, 0, 0]);
        
        // Angular motion (orientation as quaternion, angular velocity in rad/s)
        this.orientation = new Float32Array(config.orientation || [0, 0, 0, 1]);
        this.angularVelocity = new Float32Array(config.angularVelocity || [0, 0, 0]);
        this.angularAcceleration = new Float32Array([0, 0, 0]);
        
        // Force and torque accumulators
        this.force = new Float32Array([0, 0, 0]);
        this.torque = new Float32Array([0, 0, 0]);
        
        // Material properties
        this.restitution = config.restitution !== undefined ? config.restitution : 0.3; // Bounce coefficient [0, 1]
        this.friction = config.friction !== undefined ? config.friction : 0.5; // Surface friction coefficient
        this.linearDamping = config.linearDamping !== undefined ? config.linearDamping : 0.01;
        this.angularDamping = config.angularDamping !== undefined ? config.angularDamping : 0.05;
        
        // State flags
        this.isStatic = config.isStatic || false; // Static bodies don't move
        this.isKinematic = config.isKinematic || false; // Kinematic bodies move but aren't affected by forces
        this.isAwake = true;
        this.canSleep = config.canSleep !== undefined ? config.canSleep : true;
        this.sleepThreshold = 0.01; // Velocity threshold for sleeping
        this.sleepTime = 0;
        this.timeToSleep = 0.5; // seconds
        
        // Bounding information for collision detection
        this.boundingRadius = config.boundingRadius || 1.0;
        this.boundingBox = {
            min: new Float32Array([-1, -1, -1]),
            max: new Float32Array([1, 1, 1])
        };
        
        // User data
        this.userData = config.userData || {};
        
        // Collision response properties
        this.collisionGroup = config.collisionGroup || 0;
        this.collisionMask = config.collisionMask !== undefined ? config.collisionMask : 0xFFFFFFFF;
        
        // Update derived quantities
        this.updateDerivedQuantities();
    }

    /**
     * Set inertia tensor (diagonal values for principal axes)
     * @param {Object} inertia - {x, y, z} inertia values
     */
    setInertia(inertia) {
        // Set diagonal inertia tensor (assuming principal axes align with body axes)
        this.inertia[0] = inertia.x || 1;
        this.inertia[1] = 0;
        this.inertia[2] = 0;
        this.inertia[3] = 0;
        this.inertia[4] = inertia.y || 1;
        this.inertia[5] = 0;
        this.inertia[6] = 0;
        this.inertia[7] = 0;
        this.inertia[8] = inertia.z || 1;
        
        // Calculate inverse
        this.updateInverseInertia();
    }

    /**
     * Update inverse inertia tensor
     */
    updateInverseInertia() {
        if (this.isStatic || this.isKinematic) {
            // Static/kinematic bodies have infinite inertia
            for (let i = 0; i < 9; i++) {
                this.invInertia[i] = 0;
            }
            return;
        }
        
        // For diagonal tensor, inverse is just reciprocal of diagonal elements
        this.invInertia[0] = this.inertia[0] > 0 ? 1.0 / this.inertia[0] : 0;
        this.invInertia[1] = 0;
        this.invInertia[2] = 0;
        this.invInertia[3] = 0;
        this.invInertia[4] = this.inertia[4] > 0 ? 1.0 / this.inertia[4] : 0;
        this.invInertia[5] = 0;
        this.invInertia[6] = 0;
        this.invInertia[7] = 0;
        this.invInertia[8] = this.inertia[8] > 0 ? 1.0 / this.inertia[8] : 0;
    }

    /**
     * Calculate inertia tensor for a box
     * @param {number} mass 
     * @param {number} width 
     * @param {number} height 
     * @param {number} depth 
     * @returns {Object}
     */
    static calculateBoxInertia(mass, width, height, depth) {
        return {
            x: (mass / 12) * (height * height + depth * depth),
            y: (mass / 12) * (width * width + depth * depth),
            z: (mass / 12) * (width * width + height * height)
        };
    }

    /**
     * Calculate inertia tensor for a sphere
     * @param {number} mass 
     * @param {number} radius 
     * @returns {Object}
     */
    static calculateSphereInertia(mass, radius) {
        const i = (2 / 5) * mass * radius * radius;
        return { x: i, y: i, z: i };
    }

    /**
     * Calculate inertia tensor for a cylinder
     * @param {number} mass 
     * @param {number} radius 
     * @param {number} height 
     * @param {string} axis - 'x', 'y', or 'z'
     * @returns {Object}
     */
    static calculateCylinderInertia(mass, radius, height, axis = 'y') {
        const iPerp = (mass / 12) * (3 * radius * radius + height * height);
        const iAxis = (mass / 2) * radius * radius;
        
        if (axis === 'y') {
            return { x: iPerp, y: iAxis, z: iPerp };
        } else if (axis === 'x') {
            return { x: iAxis, y: iPerp, z: iPerp };
        } else {
            return { x: iPerp, y: iPerp, z: iAxis };
        }
    }

    /**
     * Apply force at center of mass
     * @param {Float32Array|Array} force - Force vector in Newtons
     */
    applyForce(force) {
        if (this.isStatic || this.isKinematic) return;
        
        this.force[0] += force[0];
        this.force[1] += force[1];
        this.force[2] += force[2];
    }

    /**
     * Apply force at a world space point
     * Generates both linear force and torque
     * @param {Float32Array|Array} force - Force vector in Newtons
     * @param {Float32Array|Array} worldPoint - Point in world space
     */
    applyForceAtPoint(force, worldPoint) {
        if (this.isStatic || this.isKinematic) return;
        
        // Add linear force
        this.applyForce(force);
        
        // Calculate torque: τ = r × F
        const rx = worldPoint[0] - this.position[0];
        const ry = worldPoint[1] - this.position[1];
        const rz = worldPoint[2] - this.position[2];
        
        const torqueX = ry * force[2] - rz * force[1];
        const torqueY = rz * force[0] - rx * force[2];
        const torqueZ = rx * force[1] - ry * force[0];
        
        this.applyTorque([torqueX, torqueY, torqueZ]);
    }

    /**
     * Apply impulse at center of mass
     * Impulse = change in momentum = m * Δv
     * @param {Float32Array|Array} impulse - Impulse vector in N⋅s
     */
    applyImpulse(impulse) {
        if (this.isStatic || this.isKinematic) return;
        
        // Δv = impulse / m
        this.velocity[0] += impulse[0] * this.invMass;
        this.velocity[1] += impulse[1] * this.invMass;
        this.velocity[2] += impulse[2] * this.invMass;
        
        this.wakeUp();
    }

    /**
     * Apply impulse at a world space point
     * @param {Float32Array|Array} impulse - Impulse vector in N⋅s
     * @param {Float32Array|Array} worldPoint - Point in world space
     */
    applyImpulseAtPoint(impulse, worldPoint) {
        if (this.isStatic || this.isKinematic) return;
        
        // Apply linear impulse
        this.applyImpulse(impulse);
        
        // Calculate angular impulse: L = r × p
        const rx = worldPoint[0] - this.position[0];
        const ry = worldPoint[1] - this.position[1];
        const rz = worldPoint[2] - this.position[2];
        
        const angularImpulseX = ry * impulse[2] - rz * impulse[1];
        const angularImpulseY = rz * impulse[0] - rx * impulse[2];
        const angularImpulseZ = rx * impulse[1] - ry * impulse[0];
        
        // Δω = I⁻¹ * L
        this.angularVelocity[0] += this.invInertia[0] * angularImpulseX;
        this.angularVelocity[1] += this.invInertia[4] * angularImpulseY;
        this.angularVelocity[2] += this.invInertia[8] * angularImpulseZ;
        
        this.wakeUp();
    }

    /**
     * Apply torque (rotational force)
     * @param {Float32Array|Array} torque - Torque vector in N⋅m
     */
    applyTorque(torque) {
        if (this.isStatic || this.isKinematic) return;
        
        this.torque[0] += torque[0];
        this.torque[1] += torque[1];
        this.torque[2] += torque[2];
    }

    /**
     * Get velocity at a world space point
     * v = v_cm + ω × r
     * @param {Float32Array|Array} worldPoint 
     * @returns {Float32Array}
     */
    getVelocityAtPoint(worldPoint) {
        const rx = worldPoint[0] - this.position[0];
        const ry = worldPoint[1] - this.position[1];
        const rz = worldPoint[2] - this.position[2];
        
        // ω × r
        const crossX = this.angularVelocity[1] * rz - this.angularVelocity[2] * ry;
        const crossY = this.angularVelocity[2] * rx - this.angularVelocity[0] * rz;
        const crossZ = this.angularVelocity[0] * ry - this.angularVelocity[1] * rx;
        
        return new Float32Array([
            this.velocity[0] + crossX,
            this.velocity[1] + crossY,
            this.velocity[2] + crossZ
        ]);
    }

    /**
     * Integrate motion using semi-implicit Euler method
     * @param {number} dt - Time step in seconds
     */
    integrate(dt) {
        if (this.isStatic || !this.isAwake) return;
        
        // Semi-implicit Euler (symplectic Euler)
        // v(t+dt) = v(t) + a(t)*dt
        // x(t+dt) = x(t) + v(t+dt)*dt
        
        if (!this.isKinematic) {
            // Calculate acceleration from forces: a = F/m
            this.acceleration[0] = this.force[0] * this.invMass;
            this.acceleration[1] = this.force[1] * this.invMass;
            this.acceleration[2] = this.force[2] * this.invMass;
            
            // Update linear velocity
            this.velocity[0] += this.acceleration[0] * dt;
            this.velocity[1] += this.acceleration[1] * dt;
            this.velocity[2] += this.acceleration[2] * dt;
            
            // Apply linear damping
            const linearDampFactor = Math.pow(1.0 - this.linearDamping, dt);
            this.velocity[0] *= linearDampFactor;
            this.velocity[1] *= linearDampFactor;
            this.velocity[2] *= linearDampFactor;
            
            // Calculate angular acceleration: α = I⁻¹ * τ
            this.angularAcceleration[0] = this.invInertia[0] * this.torque[0];
            this.angularAcceleration[1] = this.invInertia[4] * this.torque[1];
            this.angularAcceleration[2] = this.invInertia[8] * this.torque[2];
            
            // Update angular velocity
            this.angularVelocity[0] += this.angularAcceleration[0] * dt;
            this.angularVelocity[1] += this.angularAcceleration[1] * dt;
            this.angularVelocity[2] += this.angularAcceleration[2] * dt;
            
            // Apply angular damping
            const angularDampFactor = Math.pow(1.0 - this.angularDamping, dt);
            this.angularVelocity[0] *= angularDampFactor;
            this.angularVelocity[1] *= angularDampFactor;
            this.angularVelocity[2] *= angularDampFactor;
        }
        
        // Update position (works for both kinematic and dynamic)
        this.position[0] += this.velocity[0] * dt;
        this.position[1] += this.velocity[1] * dt;
        this.position[2] += this.velocity[2] * dt;
        
        // Update orientation using quaternion integration
        // dq/dt = 0.5 * ω * q
        this.integrateOrientation(dt);
        
        // Clear force and torque accumulators
        this.clearForces();
        
        // Update derived quantities (rotation matrix, bounds, etc.)
        this.updateDerivedQuantities();
        
        // Check for sleep
        if (this.canSleep) {
            this.updateSleepState(dt);
        }
    }

    /**
     * Integrate orientation using quaternion
     * @param {number} dt 
     */
    integrateOrientation(dt) {
        // Create quaternion from angular velocity
        const halfDt = dt * 0.5;
        const wx = this.angularVelocity[0] * halfDt;
        const wy = this.angularVelocity[1] * halfDt;
        const wz = this.angularVelocity[2] * halfDt;
        
        // Quaternion derivative: dq/dt = 0.5 * [wx, wy, wz, 0] * q
        const qx = this.orientation[0];
        const qy = this.orientation[1];
        const qz = this.orientation[2];
        const qw = this.orientation[3];
        
        // Update quaternion
        this.orientation[0] += wx * qw + wy * qz - wz * qy;
        this.orientation[1] += wy * qw + wz * qx - wx * qz;
        this.orientation[2] += wz * qw + wx * qy - wy * qx;
        this.orientation[3] += -wx * qx - wy * qy - wz * qz;
        
        // Normalize quaternion to prevent drift
        this.normalizeOrientation();
    }

    /**
     * Normalize orientation quaternion
     */
    normalizeOrientation() {
        const len = Math.sqrt(
            this.orientation[0] * this.orientation[0] +
            this.orientation[1] * this.orientation[1] +
            this.orientation[2] * this.orientation[2] +
            this.orientation[3] * this.orientation[3]
        );
        
        if (len > 0) {
            const invLen = 1.0 / len;
            this.orientation[0] *= invLen;
            this.orientation[1] *= invLen;
            this.orientation[2] *= invLen;
            this.orientation[3] *= invLen;
        }
    }

    /**
     * Clear accumulated forces and torques
     */
    clearForces() {
        this.force[0] = 0;
        this.force[1] = 0;
        this.force[2] = 0;
        this.torque[0] = 0;
        this.torque[1] = 0;
        this.torque[2] = 0;
    }

    /**
     * Update derived quantities (rotation matrix, etc.)
     */
    updateDerivedQuantities() {
        // Update bounding box based on position and orientation
        // This is a simplified version - real implementation would transform actual bounds
        const r = this.boundingRadius;
        this.boundingBox.min[0] = this.position[0] - r;
        this.boundingBox.min[1] = this.position[1] - r;
        this.boundingBox.min[2] = this.position[2] - r;
        this.boundingBox.max[0] = this.position[0] + r;
        this.boundingBox.max[1] = this.position[1] + r;
        this.boundingBox.max[2] = this.position[2] + r;
    }

    /**
     * Update sleep state based on motion
     * @param {number} dt 
     */
    updateSleepState(dt) {
        // Calculate kinetic energy
        const linearKE = 0.5 * this.mass * (
            this.velocity[0] * this.velocity[0] +
            this.velocity[1] * this.velocity[1] +
            this.velocity[2] * this.velocity[2]
        );
        
        const angularKE = 0.5 * (
            this.inertia[0] * this.angularVelocity[0] * this.angularVelocity[0] +
            this.inertia[4] * this.angularVelocity[1] * this.angularVelocity[1] +
            this.inertia[8] * this.angularVelocity[2] * this.angularVelocity[2]
        );
        
        const totalKE = linearKE + angularKE;
        
        // Check if below sleep threshold
        if (totalKE < this.sleepThreshold) {
            this.sleepTime += dt;
            if (this.sleepTime > this.timeToSleep) {
                this.sleep();
            }
        } else {
            this.sleepTime = 0;
            if (!this.isAwake) {
                this.wakeUp();
            }
        }
    }

    /**
     * Put body to sleep (optimization)
     */
    sleep() {
        this.isAwake = false;
        this.velocity[0] = 0;
        this.velocity[1] = 0;
        this.velocity[2] = 0;
        this.angularVelocity[0] = 0;
        this.angularVelocity[1] = 0;
        this.angularVelocity[2] = 0;
    }

    /**
     * Wake up body
     */
    wakeUp() {
        this.isAwake = true;
        this.sleepTime = 0;
    }

    /**
     * Get kinetic energy
     * @returns {number}
     */
    getKineticEnergy() {
        const linearKE = 0.5 * this.mass * (
            this.velocity[0] * this.velocity[0] +
            this.velocity[1] * this.velocity[1] +
            this.velocity[2] * this.velocity[2]
        );
        
        const angularKE = 0.5 * (
            this.inertia[0] * this.angularVelocity[0] * this.angularVelocity[0] +
            this.inertia[4] * this.angularVelocity[1] * this.angularVelocity[1] +
            this.inertia[8] * this.angularVelocity[2] * this.angularVelocity[2]
        );
        
        return linearKE + angularKE;
    }

    /**
     * Get speed (magnitude of velocity)
     * @returns {number}
     */
    getSpeed() {
        return Math.sqrt(
            this.velocity[0] * this.velocity[0] +
            this.velocity[1] * this.velocity[1] +
            this.velocity[2] * this.velocity[2]
        );
    }

    /**
     * Get angular speed (magnitude of angular velocity)
     * @returns {number}
     */
    getAngularSpeed() {
        return Math.sqrt(
            this.angularVelocity[0] * this.angularVelocity[0] +
            this.angularVelocity[1] * this.angularVelocity[1] +
            this.angularVelocity[2] * this.angularVelocity[2]
        );
    }

    /**
     * Transform point from local space to world space
     * @param {Float32Array|Array} localPoint 
     * @returns {Float32Array}
     */
    localToWorld(localPoint) {
        // Rotate by orientation quaternion, then translate
        const result = new Float32Array(3);
        this.rotateByOrientation(result, localPoint);
        result[0] += this.position[0];
        result[1] += this.position[1];
        result[2] += this.position[2];
        return result;
    }

    /**
     * Transform point from world space to local space
     * @param {Float32Array|Array} worldPoint 
     * @returns {Float32Array}
     */
    worldToLocal(worldPoint) {
        // Translate, then rotate by inverse orientation
        const translated = new Float32Array([
            worldPoint[0] - this.position[0],
            worldPoint[1] - this.position[1],
            worldPoint[2] - this.position[2]
        ]);
        
        const result = new Float32Array(3);
        this.rotateByInverseOrientation(result, translated);
        return result;
    }

    /**
     * Rotate vector by orientation quaternion
     * @param {Float32Array} out 
     * @param {Float32Array|Array} v 
     */
    rotateByOrientation(out, v) {
        const qx = this.orientation[0], qy = this.orientation[1];
        const qz = this.orientation[2], qw = this.orientation[3];
        const vx = v[0], vy = v[1], vz = v[2];
        
        // q * v * q*
        const ix = qw * vx + qy * vz - qz * vy;
        const iy = qw * vy + qz * vx - qx * vz;
        const iz = qw * vz + qx * vy - qy * vx;
        const iw = -qx * vx - qy * vy - qz * vz;
        
        out[0] = ix * qw + iw * -qx + iy * -qz - iz * -qy;
        out[1] = iy * qw + iw * -qy + iz * -qx - ix * -qz;
        out[2] = iz * qw + iw * -qz + ix * -qy - iy * -qx;
    }

    /**
     * Rotate vector by inverse orientation quaternion
     * @param {Float32Array} out 
     * @param {Float32Array|Array} v 
     */
    rotateByInverseOrientation(out, v) {
        const qx = -this.orientation[0], qy = -this.orientation[1];
        const qz = -this.orientation[2], qw = this.orientation[3];
        const vx = v[0], vy = v[1], vz = v[2];
        
        const ix = qw * vx + qy * vz - qz * vy;
        const iy = qw * vy + qz * vx - qx * vz;
        const iz = qw * vz + qx * vy - qy * vx;
        const iw = -qx * vx - qy * vy - qz * vz;
        
        out[0] = ix * qw + iw * -qx + iy * -qz - iz * -qy;
        out[1] = iy * qw + iw * -qy + iz * -qx - ix * -qz;
        out[2] = iz * qw + iw * -qz + ix * -qy - iy * -qx;
    }

    /**
     * Set position
     * @param {Float32Array|Array} pos 
     */
    setPosition(pos) {
        this.position[0] = pos[0];
        this.position[1] = pos[1];
        this.position[2] = pos[2];
        this.updateDerivedQuantities();
    }

    /**
     * Set velocity
     * @param {Float32Array|Array} vel 
     */
    setVelocity(vel) {
        this.velocity[0] = vel[0];
        this.velocity[1] = vel[1];
        this.velocity[2] = vel[2];
        this.wakeUp();
    }

    /**
     * Set orientation from Euler angles (ZYX order)
     * @param {number} pitch - X rotation in radians
     * @param {number} yaw - Y rotation in radians
     * @param {number} roll - Z rotation in radians
     */
    setOrientationFromEuler(pitch, yaw, roll) {
        const halfX = pitch * 0.5;
        const halfY = yaw * 0.5;
        const halfZ = roll * 0.5;
        
        const cx = Math.cos(halfX), sx = Math.sin(halfX);
        const cy = Math.cos(halfY), sy = Math.sin(halfY);
        const cz = Math.cos(halfZ), sz = Math.sin(halfZ);
        
        this.orientation[0] = sx * cy * cz - cx * sy * sz;
        this.orientation[1] = cx * sy * cz + sx * cy * sz;
        this.orientation[2] = cx * cy * sz - sx * sy * cz;
        this.orientation[3] = cx * cy * cz + sx * sy * sz;
        
        this.updateDerivedQuantities();
    }

    /**
     * Get Euler angles from orientation
     * @returns {Object} {pitch, yaw, roll}
     */
    getEulerAngles() {
        const qx = this.orientation[0], qy = this.orientation[1];
        const qz = this.orientation[2], qw = this.orientation[3];
        
        // Calculate Euler angles (ZYX order)
        const sinr_cosp = 2 * (qw * qx + qy * qz);
        const cosr_cosp = 1 - 2 * (qx * qx + qy * qy);
        const roll = Math.atan2(sinr_cosp, cosr_cosp);
        
        const sinp = 2 * (qw * qy - qz * qx);
        const pitch = Math.abs(sinp) >= 1 ? Math.sign(sinp) * Math.PI / 2 : Math.asin(sinp);
        
        const siny_cosp = 2 * (qw * qz + qx * qy);
        const cosy_cosp = 1 - 2 * (qy * qy + qz * qz);
        const yaw = Math.atan2(siny_cosp, cosy_cosp);
        
        return { pitch, yaw, roll };
    }

    /**
     * Clone this rigid body
     * @returns {RigidBody}
     */
    clone() {
        return new RigidBody({
            mass: this.mass,
            inertia: { 
                x: this.inertia[0], 
                y: this.inertia[4], 
                z: this.inertia[8] 
            },
            position: Array.from(this.position),
            velocity: Array.from(this.velocity),
            orientation: Array.from(this.orientation),
            angularVelocity: Array.from(this.angularVelocity),
            restitution: this.restitution,
            friction: this.friction,
            linearDamping: this.linearDamping,
            angularDamping: this.angularDamping,
            isStatic: this.isStatic,
            isKinematic: this.isKinematic,
            canSleep: this.canSleep,
            boundingRadius: this.boundingRadius,
            collisionGroup: this.collisionGroup,
            collisionMask: this.collisionMask
        });
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { RigidBody };
}
