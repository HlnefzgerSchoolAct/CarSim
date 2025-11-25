/**
 * PhysicsWorld.js - Main Physics Simulation Engine
 * 
 * Core physics simulation managing all physical bodies, forces, collisions,
 * and constraints. Uses a fixed timestep integration with sub-stepping for
 * stability and accuracy.
 * 
 * @module physics/PhysicsWorld
 * @author CarSim Development Team
 * @version 2.0.0
 */

import { PHYSICS_CONSTANTS, VEHICLE_CONSTANTS } from '../core/Constants.js';
import { MathUtils } from '../utils/MathUtils.js';

/**
 * @typedef {Object} PhysicsBody
 * @property {string} id - Unique identifier
 * @property {string} type - Body type (dynamic, static, kinematic)
 * @property {THREE.Vector3} position - World position
 * @property {THREE.Quaternion} rotation - Rotation quaternion
 * @property {THREE.Vector3} velocity - Linear velocity
 * @property {THREE.Vector3} angularVelocity - Angular velocity
 * @property {THREE.Vector3} acceleration - Linear acceleration
 * @property {THREE.Vector3} angularAcceleration - Angular acceleration
 * @property {number} mass - Mass in kg
 * @property {number} inverseMass - 1/mass (0 for static)
 * @property {THREE.Matrix3} inertia - Moment of inertia tensor
 * @property {THREE.Matrix3} inverseInertia - Inverse inertia tensor
 * @property {THREE.Vector3} forceAccumulator - Accumulated forces
 * @property {THREE.Vector3} torqueAccumulator - Accumulated torques
 * @property {Object} collider - Collision shape
 * @property {number} friction - Surface friction coefficient
 * @property {number} restitution - Bounce coefficient
 * @property {boolean} isSleeping - Whether body is sleeping
 * @property {number} sleepTimer - Time since last significant motion
 * @property {Object} userData - Custom user data
 */

/**
 * @typedef {Object} CollisionInfo
 * @property {PhysicsBody} bodyA - First body
 * @property {PhysicsBody} bodyB - Second body
 * @property {THREE.Vector3} contactPoint - Contact point in world space
 * @property {THREE.Vector3} contactNormal - Normal pointing from A to B
 * @property {number} penetrationDepth - Overlap distance
 * @property {THREE.Vector3} relativeVelocity - Relative velocity at contact
 * @property {number} restitution - Combined restitution
 * @property {number} friction - Combined friction
 */

/**
 * @typedef {Object} RaycastResult
 * @property {boolean} hit - Whether ray hit something
 * @property {PhysicsBody} body - Body that was hit
 * @property {THREE.Vector3} point - Hit point in world space
 * @property {THREE.Vector3} normal - Surface normal at hit point
 * @property {number} distance - Distance from ray origin to hit
 */

/**
 * PhysicsWorld - Main physics simulation
 */
export class PhysicsWorld {
    /**
     * Creates a new PhysicsWorld
     * @param {Object} options - Configuration options
     */
    constructor(options = {}) {
        /**
         * Gravity vector
         * @type {THREE.Vector3}
         */
        this.gravity = new THREE.Vector3(
            options.gravityX || 0,
            options.gravityY !== undefined ? options.gravityY : -9.81,
            options.gravityZ || 0
        );
        
        /**
         * Fixed timestep for physics simulation
         * @type {number}
         */
        this.fixedTimeStep = options.fixedTimeStep || (1 / 120);
        
        /**
         * Maximum substeps per frame
         * @type {number}
         */
        this.maxSubSteps = options.maxSubSteps || 10;
        
        /**
         * Velocity threshold for sleeping
         * @type {number}
         */
        this.sleepVelocityThreshold = options.sleepVelocityThreshold || 0.1;
        
        /**
         * Time before body can sleep
         * @type {number}
         */
        this.sleepTimeThreshold = options.sleepTimeThreshold || 1.0;
        
        /**
         * Enable sleeping optimization
         * @type {boolean}
         */
        this.enableSleeping = options.enableSleeping !== false;
        
        /**
         * All physics bodies
         * @type {Map<string, PhysicsBody>}
         */
        this.bodies = new Map();
        
        /**
         * Static bodies (optimized spatial hash)
         * @type {Map<string, PhysicsBody>}
         */
        this.staticBodies = new Map();
        
        /**
         * Dynamic bodies
         * @type {Set<PhysicsBody>}
         */
        this.dynamicBodies = new Set();
        
        /**
         * Collision pairs to check
         * @type {Array<[PhysicsBody, PhysicsBody]>}
         */
        this.collisionPairs = [];
        
        /**
         * Active collisions this frame
         * @type {Array<CollisionInfo>}
         */
        this.activeCollisions = [];
        
        /**
         * Collision callbacks by body ID
         * @type {Map<string, Function>}
         */
        this.collisionCallbacks = new Map();
        
        /**
         * Global collision callback
         * @type {Function}
         */
        this.onCollision = options.onCollision || null;
        
        /**
         * Constraint solvers
         * @type {Array<Object>}
         */
        this.constraints = [];
        
        /**
         * Spatial hash grid for broad phase
         * @type {Object}
         */
        this.spatialHash = {
            cellSize: options.cellSize || 10,
            grid: new Map()
        };
        
        /**
         * Accumulated time for fixed timestep
         * @type {number}
         */
        this.accumulator = 0;
        
        /**
         * Total simulation time
         * @type {number}
         */
        this.totalTime = 0;
        
        /**
         * Simulation speed multiplier
         * @type {number}
         */
        this.timeScale = 1.0;
        
        /**
         * Whether simulation is paused
         * @type {boolean}
         */
        this.isPaused = false;
        
        /**
         * Debug mode
         * @type {boolean}
         */
        this.debug = options.debug || false;
        
        /**
         * Statistics
         * @type {Object}
         */
        this.stats = {
            bodyCount: 0,
            dynamicCount: 0,
            staticCount: 0,
            awakeCount: 0,
            collisionChecks: 0,
            activeCollisions: 0,
            constraintIterations: 0,
            lastStepTime: 0,
            subSteps: 0
        };
        
        // Reusable vectors for calculations
        this._tempVec1 = new THREE.Vector3();
        this._tempVec2 = new THREE.Vector3();
        this._tempVec3 = new THREE.Vector3();
        this._tempQuat = new THREE.Quaternion();
        this._tempMat3 = new THREE.Matrix3();
    }
    
    /**
     * Creates a physics body
     * @param {Object} config - Body configuration
     * @returns {PhysicsBody}
     */
    createBody(config) {
        const body = {
            id: config.id || `body_${this.bodies.size}`,
            type: config.type || 'dynamic',
            position: config.position ? config.position.clone() : new THREE.Vector3(),
            rotation: config.rotation ? config.rotation.clone() : new THREE.Quaternion(),
            velocity: config.velocity ? config.velocity.clone() : new THREE.Vector3(),
            angularVelocity: config.angularVelocity ? config.angularVelocity.clone() : new THREE.Vector3(),
            acceleration: new THREE.Vector3(),
            angularAcceleration: new THREE.Vector3(),
            mass: config.mass || 1,
            inverseMass: config.type === 'static' ? 0 : 1 / (config.mass || 1),
            inertia: new THREE.Matrix3(),
            inverseInertia: new THREE.Matrix3(),
            forceAccumulator: new THREE.Vector3(),
            torqueAccumulator: new THREE.Vector3(),
            collider: config.collider || { type: 'sphere', radius: 1 },
            friction: config.friction !== undefined ? config.friction : 0.5,
            restitution: config.restitution !== undefined ? config.restitution : 0.3,
            linearDamping: config.linearDamping !== undefined ? config.linearDamping : 0.01,
            angularDamping: config.angularDamping !== undefined ? config.angularDamping : 0.05,
            isSleeping: false,
            sleepTimer: 0,
            group: config.group || 1,
            mask: config.mask || 0xFFFFFFFF,
            userData: config.userData || {}
        };
        
        // Calculate inertia tensor
        this._calculateInertia(body);
        
        // Add to appropriate collections
        this.bodies.set(body.id, body);
        
        if (body.type === 'static') {
            this.staticBodies.set(body.id, body);
        } else {
            this.dynamicBodies.add(body);
        }
        
        // Update spatial hash
        this._addToSpatialHash(body);
        
        // Update stats
        this._updateStats();
        
        return body;
    }
    
    /**
     * Calculates inertia tensor for a body
     * @private
     * @param {PhysicsBody} body
     */
    _calculateInertia(body) {
        const collider = body.collider;
        let Ixx, Iyy, Izz;
        
        switch (collider.type) {
            case 'sphere':
                const I = (2 / 5) * body.mass * collider.radius * collider.radius;
                Ixx = Iyy = Izz = I;
                break;
                
            case 'box':
                const w = collider.width || 1;
                const h = collider.height || 1;
                const d = collider.depth || 1;
                Ixx = (1 / 12) * body.mass * (h * h + d * d);
                Iyy = (1 / 12) * body.mass * (w * w + d * d);
                Izz = (1 / 12) * body.mass * (w * w + h * h);
                break;
                
            case 'cylinder':
                const r = collider.radius || 0.5;
                const len = collider.height || 1;
                Ixx = Izz = (1 / 12) * body.mass * (3 * r * r + len * len);
                Iyy = (1 / 2) * body.mass * r * r;
                break;
                
            case 'capsule':
                // Approximate as cylinder
                const rc = collider.radius || 0.5;
                const lc = collider.height || 1;
                Ixx = Izz = (1 / 12) * body.mass * (3 * rc * rc + lc * lc);
                Iyy = (1 / 2) * body.mass * rc * rc;
                break;
                
            default:
                // Default to sphere-like
                const Idef = (2 / 5) * body.mass;
                Ixx = Iyy = Izz = Idef;
        }
        
        // Set diagonal inertia tensor
        body.inertia.set(
            Ixx, 0, 0,
            0, Iyy, 0,
            0, 0, Izz
        );
        
        // Calculate inverse
        if (body.type !== 'static') {
            body.inverseInertia.set(
                1 / Ixx, 0, 0,
                0, 1 / Iyy, 0,
                0, 0, 1 / Izz
            );
        } else {
            body.inverseInertia.set(
                0, 0, 0,
                0, 0, 0,
                0, 0, 0
            );
        }
    }
    
    /**
     * Adds body to spatial hash
     * @private
     * @param {PhysicsBody} body
     */
    _addToSpatialHash(body) {
        const cells = this._getBodyCells(body);
        for (const cell of cells) {
            if (!this.spatialHash.grid.has(cell)) {
                this.spatialHash.grid.set(cell, new Set());
            }
            this.spatialHash.grid.get(cell).add(body);
        }
    }
    
    /**
     * Removes body from spatial hash
     * @private
     * @param {PhysicsBody} body
     */
    _removeFromSpatialHash(body) {
        const cells = this._getBodyCells(body);
        for (const cell of cells) {
            const set = this.spatialHash.grid.get(cell);
            if (set) {
                set.delete(body);
                if (set.size === 0) {
                    this.spatialHash.grid.delete(cell);
                }
            }
        }
    }
    
    /**
     * Updates body in spatial hash
     * @private
     * @param {PhysicsBody} body
     * @param {THREE.Vector3} oldPosition
     */
    _updateSpatialHash(body, oldPosition) {
        // Simple approach: remove and re-add
        this._removeFromSpatialHash(body);
        this._addToSpatialHash(body);
    }
    
    /**
     * Gets grid cells occupied by a body
     * @private
     * @param {PhysicsBody} body
     * @returns {Array<string>}
     */
    _getBodyCells(body) {
        const cells = [];
        const size = this.spatialHash.cellSize;
        const radius = this._getColliderRadius(body.collider);
        
        const minX = Math.floor((body.position.x - radius) / size);
        const maxX = Math.floor((body.position.x + radius) / size);
        const minZ = Math.floor((body.position.z - radius) / size);
        const maxZ = Math.floor((body.position.z + radius) / size);
        
        for (let x = minX; x <= maxX; x++) {
            for (let z = minZ; z <= maxZ; z++) {
                cells.push(`${x},${z}`);
            }
        }
        
        return cells;
    }
    
    /**
     * Gets effective radius of a collider
     * @private
     * @param {Object} collider
     * @returns {number}
     */
    _getColliderRadius(collider) {
        switch (collider.type) {
            case 'sphere':
                return collider.radius || 1;
            case 'box':
                return Math.sqrt(
                    (collider.width || 1) ** 2 + 
                    (collider.height || 1) ** 2 + 
                    (collider.depth || 1) ** 2
                ) / 2;
            case 'cylinder':
            case 'capsule':
                return Math.max(collider.radius || 0.5, (collider.height || 1) / 2);
            default:
                return 1;
        }
    }
    
    /**
     * Removes a body from the simulation
     * @param {string} bodyId - Body identifier
     */
    removeBody(bodyId) {
        const body = this.bodies.get(bodyId);
        if (!body) return;
        
        this._removeFromSpatialHash(body);
        this.bodies.delete(bodyId);
        this.staticBodies.delete(bodyId);
        this.dynamicBodies.delete(body);
        this.collisionCallbacks.delete(bodyId);
        
        this._updateStats();
    }
    
    /**
     * Applies a force to a body at its center of mass
     * @param {string} bodyId - Body identifier
     * @param {THREE.Vector3} force - Force vector in world space
     */
    applyForce(bodyId, force) {
        const body = this.bodies.get(bodyId);
        if (!body || body.type === 'static') return;
        
        body.forceAccumulator.add(force);
        this._wakeBody(body);
    }
    
    /**
     * Applies a force at a world point
     * @param {string} bodyId - Body identifier
     * @param {THREE.Vector3} force - Force vector
     * @param {THREE.Vector3} point - Application point in world space
     */
    applyForceAtPoint(bodyId, force, point) {
        const body = this.bodies.get(bodyId);
        if (!body || body.type === 'static') return;
        
        // Add force
        body.forceAccumulator.add(force);
        
        // Calculate torque: τ = r × F
        const r = this._tempVec1.subVectors(point, body.position);
        const torque = this._tempVec2.crossVectors(r, force);
        body.torqueAccumulator.add(torque);
        
        this._wakeBody(body);
    }
    
    /**
     * Applies an impulse to a body
     * @param {string} bodyId - Body identifier
     * @param {THREE.Vector3} impulse - Impulse vector
     */
    applyImpulse(bodyId, impulse) {
        const body = this.bodies.get(bodyId);
        if (!body || body.type === 'static') return;
        
        body.velocity.addScaledVector(impulse, body.inverseMass);
        this._wakeBody(body);
    }
    
    /**
     * Applies an impulse at a world point
     * @param {string} bodyId - Body identifier
     * @param {THREE.Vector3} impulse - Impulse vector
     * @param {THREE.Vector3} point - Application point
     */
    applyImpulseAtPoint(bodyId, impulse, point) {
        const body = this.bodies.get(bodyId);
        if (!body || body.type === 'static') return;
        
        // Linear impulse
        body.velocity.addScaledVector(impulse, body.inverseMass);
        
        // Angular impulse: Δω = I⁻¹ × (r × J)
        const r = this._tempVec1.subVectors(point, body.position);
        const angularImpulse = this._tempVec2.crossVectors(r, impulse);
        
        // Apply inverse inertia tensor
        const deltaOmega = angularImpulse.applyMatrix3(body.inverseInertia);
        body.angularVelocity.add(deltaOmega);
        
        this._wakeBody(body);
    }
    
    /**
     * Applies a torque to a body
     * @param {string} bodyId - Body identifier
     * @param {THREE.Vector3} torque - Torque vector
     */
    applyTorque(bodyId, torque) {
        const body = this.bodies.get(bodyId);
        if (!body || body.type === 'static') return;
        
        body.torqueAccumulator.add(torque);
        this._wakeBody(body);
    }
    
    /**
     * Sets the velocity of a body
     * @param {string} bodyId - Body identifier
     * @param {THREE.Vector3} velocity - New velocity
     */
    setVelocity(bodyId, velocity) {
        const body = this.bodies.get(bodyId);
        if (!body || body.type === 'static') return;
        
        body.velocity.copy(velocity);
        this._wakeBody(body);
    }
    
    /**
     * Sets the angular velocity of a body
     * @param {string} bodyId - Body identifier
     * @param {THREE.Vector3} angularVelocity - New angular velocity
     */
    setAngularVelocity(bodyId, angularVelocity) {
        const body = this.bodies.get(bodyId);
        if (!body || body.type === 'static') return;
        
        body.angularVelocity.copy(angularVelocity);
        this._wakeBody(body);
    }
    
    /**
     * Sets the position of a body
     * @param {string} bodyId - Body identifier
     * @param {THREE.Vector3} position - New position
     */
    setPosition(bodyId, position) {
        const body = this.bodies.get(bodyId);
        if (!body) return;
        
        const oldPos = body.position.clone();
        body.position.copy(position);
        this._updateSpatialHash(body, oldPos);
        this._wakeBody(body);
    }
    
    /**
     * Sets the rotation of a body
     * @param {string} bodyId - Body identifier
     * @param {THREE.Quaternion} rotation - New rotation
     */
    setRotation(bodyId, rotation) {
        const body = this.bodies.get(bodyId);
        if (!body) return;
        
        body.rotation.copy(rotation);
        this._wakeBody(body);
    }
    
    /**
     * Wakes a sleeping body
     * @private
     * @param {PhysicsBody} body
     */
    _wakeBody(body) {
        if (body.isSleeping) {
            body.isSleeping = false;
            body.sleepTimer = 0;
        }
    }
    
    /**
     * Registers a collision callback for a body
     * @param {string} bodyId - Body identifier
     * @param {Function} callback - Callback function(collision)
     */
    setCollisionCallback(bodyId, callback) {
        this.collisionCallbacks.set(bodyId, callback);
    }
    
    /**
     * Main physics step
     * @param {number} deltaTime - Frame time in seconds
     */
    step(deltaTime) {
        if (this.isPaused) return;
        
        const startTime = performance.now();
        
        // Apply time scale
        deltaTime *= this.timeScale;
        
        // Accumulate time
        this.accumulator += deltaTime;
        
        // Fixed timestep integration with substeps
        let subSteps = 0;
        while (this.accumulator >= this.fixedTimeStep && subSteps < this.maxSubSteps) {
            this._fixedStep(this.fixedTimeStep);
            this.accumulator -= this.fixedTimeStep;
            this.totalTime += this.fixedTimeStep;
            subSteps++;
        }
        
        // Update stats
        this.stats.subSteps = subSteps;
        this.stats.lastStepTime = performance.now() - startTime;
    }
    
    /**
     * Fixed timestep physics step
     * @private
     * @param {number} dt - Fixed timestep
     */
    _fixedStep(dt) {
        // 1. Apply gravity and integrate forces
        this._integrateForces(dt);
        
        // 2. Broad phase collision detection
        this._broadPhase();
        
        // 3. Narrow phase collision detection
        this._narrowPhase();
        
        // 4. Solve constraints and collisions
        this._solveConstraints(dt);
        
        // 5. Integrate velocities to positions
        this._integrateVelocities(dt);
        
        // 6. Update spatial hash
        this._updateAllSpatialHash();
        
        // 7. Handle sleeping
        if (this.enableSleeping) {
            this._updateSleeping(dt);
        }
        
        // 8. Clear accumulators
        this._clearAccumulators();
    }
    
    /**
     * Integrates forces to velocities
     * @private
     * @param {number} dt
     */
    _integrateForces(dt) {
        for (const body of this.dynamicBodies) {
            if (body.isSleeping) continue;
            
            // Apply gravity
            body.forceAccumulator.addScaledVector(this.gravity, body.mass);
            
            // Calculate linear acceleration: a = F/m
            body.acceleration.copy(body.forceAccumulator).multiplyScalar(body.inverseMass);
            
            // Calculate angular acceleration: α = I⁻¹ × τ
            body.angularAcceleration.copy(body.torqueAccumulator).applyMatrix3(body.inverseInertia);
            
            // Integrate to velocity
            body.velocity.addScaledVector(body.acceleration, dt);
            body.angularVelocity.addScaledVector(body.angularAcceleration, dt);
            
            // Apply damping
            body.velocity.multiplyScalar(1 - body.linearDamping * dt);
            body.angularVelocity.multiplyScalar(1 - body.angularDamping * dt);
        }
    }
    
    /**
     * Broad phase collision detection using spatial hash
     * @private
     */
    _broadPhase() {
        this.collisionPairs = [];
        this.stats.collisionChecks = 0;
        
        const checked = new Set();
        
        for (const body of this.dynamicBodies) {
            if (body.isSleeping) continue;
            
            // Get potential collision partners from spatial hash
            const cells = this._getBodyCells(body);
            
            for (const cell of cells) {
                const others = this.spatialHash.grid.get(cell);
                if (!others) continue;
                
                for (const other of others) {
                    if (body === other) continue;
                    
                    // Skip if already checked
                    const pairKey = body.id < other.id ? 
                        `${body.id}:${other.id}` : `${other.id}:${body.id}`;
                    if (checked.has(pairKey)) continue;
                    checked.add(pairKey);
                    
                    // Check collision masks
                    if ((body.group & other.mask) === 0 || (other.group & body.mask) === 0) {
                        continue;
                    }
                    
                    // Quick AABB check
                    if (this._checkAABBOverlap(body, other)) {
                        this.collisionPairs.push([body, other]);
                    }
                    
                    this.stats.collisionChecks++;
                }
            }
        }
    }
    
    /**
     * Checks AABB overlap between two bodies
     * @private
     */
    _checkAABBOverlap(bodyA, bodyB) {
        const radiusA = this._getColliderRadius(bodyA.collider);
        const radiusB = this._getColliderRadius(bodyB.collider);
        const combinedRadius = radiusA + radiusB;
        
        // Simple sphere-sphere check for broad phase
        const dx = bodyA.position.x - bodyB.position.x;
        const dy = bodyA.position.y - bodyB.position.y;
        const dz = bodyA.position.z - bodyB.position.z;
        
        return (dx * dx + dy * dy + dz * dz) < (combinedRadius * combinedRadius * 1.2);
    }
    
    /**
     * Narrow phase collision detection
     * @private
     */
    _narrowPhase() {
        this.activeCollisions = [];
        
        for (const [bodyA, bodyB] of this.collisionPairs) {
            const collision = this._checkCollision(bodyA, bodyB);
            
            if (collision) {
                this.activeCollisions.push(collision);
            }
        }
        
        this.stats.activeCollisions = this.activeCollisions.length;
    }
    
    /**
     * Checks for collision between two bodies
     * @private
     * @param {PhysicsBody} bodyA
     * @param {PhysicsBody} bodyB
     * @returns {CollisionInfo|null}
     */
    _checkCollision(bodyA, bodyB) {
        const typeA = bodyA.collider.type;
        const typeB = bodyB.collider.type;
        
        // Dispatch to appropriate collision function
        if (typeA === 'sphere' && typeB === 'sphere') {
            return this._sphereSphereCollision(bodyA, bodyB);
        } else if (typeA === 'sphere' && typeB === 'box') {
            return this._sphereBoxCollision(bodyA, bodyB);
        } else if (typeA === 'box' && typeB === 'sphere') {
            const collision = this._sphereBoxCollision(bodyB, bodyA);
            if (collision) {
                // Swap bodies and flip normal
                [collision.bodyA, collision.bodyB] = [collision.bodyB, collision.bodyA];
                collision.contactNormal.negate();
            }
            return collision;
        } else if (typeA === 'box' && typeB === 'box') {
            return this._boxBoxCollision(bodyA, bodyB);
        }
        
        // Default to sphere-sphere approximation
        return this._sphereSphereCollision(bodyA, bodyB);
    }
    
    /**
     * Sphere-sphere collision detection
     * @private
     */
    _sphereSphereCollision(bodyA, bodyB) {
        const radiusA = bodyA.collider.radius || 1;
        const radiusB = bodyB.collider.radius || 1;
        
        const delta = this._tempVec1.subVectors(bodyB.position, bodyA.position);
        const distance = delta.length();
        const minDistance = radiusA + radiusB;
        
        if (distance >= minDistance || distance < 0.0001) {
            return null;
        }
        
        const normal = delta.normalize();
        const penetration = minDistance - distance;
        
        const contactPoint = this._tempVec2
            .copy(bodyA.position)
            .addScaledVector(normal, radiusA - penetration / 2);
        
        // Calculate relative velocity
        const relVel = this._tempVec3.subVectors(bodyB.velocity, bodyA.velocity);
        
        // Add rotational velocity at contact point
        // v = ω × r
        if (bodyA.type !== 'static') {
            const rA = contactPoint.clone().sub(bodyA.position);
            relVel.sub(new THREE.Vector3().crossVectors(bodyA.angularVelocity, rA));
        }
        if (bodyB.type !== 'static') {
            const rB = contactPoint.clone().sub(bodyB.position);
            relVel.add(new THREE.Vector3().crossVectors(bodyB.angularVelocity, rB));
        }
        
        return {
            bodyA,
            bodyB,
            contactPoint: contactPoint.clone(),
            contactNormal: normal.clone(),
            penetrationDepth: penetration,
            relativeVelocity: relVel.clone(),
            restitution: Math.min(bodyA.restitution, bodyB.restitution),
            friction: (bodyA.friction + bodyB.friction) / 2
        };
    }
    
    /**
     * Sphere-box collision detection
     * @private
     */
    _sphereBoxCollision(sphere, box) {
        const radius = sphere.collider.radius || 1;
        const halfW = (box.collider.width || 1) / 2;
        const halfH = (box.collider.height || 1) / 2;
        const halfD = (box.collider.depth || 1) / 2;
        
        // Transform sphere center to box local space
        const localCenter = sphere.position.clone().sub(box.position);
        
        // Apply inverse box rotation
        const invQuat = box.rotation.clone().invert();
        localCenter.applyQuaternion(invQuat);
        
        // Clamp to box bounds
        const closest = new THREE.Vector3(
            Math.max(-halfW, Math.min(halfW, localCenter.x)),
            Math.max(-halfH, Math.min(halfH, localCenter.y)),
            Math.max(-halfD, Math.min(halfD, localCenter.z))
        );
        
        // Distance from closest point to sphere center
        const delta = localCenter.clone().sub(closest);
        const distance = delta.length();
        
        if (distance >= radius || distance < 0.0001) {
            return null;
        }
        
        // Calculate normal in local space
        let normal;
        if (distance < 0.0001) {
            // Sphere center inside box - push out along shortest axis
            const absLocal = new THREE.Vector3(
                Math.abs(localCenter.x),
                Math.abs(localCenter.y),
                Math.abs(localCenter.z)
            );
            const extents = new THREE.Vector3(halfW, halfH, halfD);
            const penetrations = extents.clone().sub(absLocal);
            
            if (penetrations.x <= penetrations.y && penetrations.x <= penetrations.z) {
                normal = new THREE.Vector3(Math.sign(localCenter.x), 0, 0);
            } else if (penetrations.y <= penetrations.z) {
                normal = new THREE.Vector3(0, Math.sign(localCenter.y), 0);
            } else {
                normal = new THREE.Vector3(0, 0, Math.sign(localCenter.z));
            }
        } else {
            normal = delta.normalize();
        }
        
        // Transform back to world space
        normal.applyQuaternion(box.rotation);
        closest.applyQuaternion(box.rotation);
        closest.add(box.position);
        
        const penetration = radius - distance;
        
        // Relative velocity
        const relVel = this._tempVec3.subVectors(box.velocity, sphere.velocity);
        
        return {
            bodyA: sphere,
            bodyB: box,
            contactPoint: closest.clone(),
            contactNormal: normal.clone().negate(), // Normal from A to B
            penetrationDepth: penetration,
            relativeVelocity: relVel.clone(),
            restitution: Math.min(sphere.restitution, box.restitution),
            friction: (sphere.friction + box.friction) / 2
        };
    }
    
    /**
     * Box-box collision detection (SAT)
     * @private
     */
    _boxBoxCollision(bodyA, bodyB) {
        // Simplified box-box using AABB for now
        // Full OBB-OBB SAT is complex - using approximation
        
        const halfA = new THREE.Vector3(
            (bodyA.collider.width || 1) / 2,
            (bodyA.collider.height || 1) / 2,
            (bodyA.collider.depth || 1) / 2
        );
        
        const halfB = new THREE.Vector3(
            (bodyB.collider.width || 1) / 2,
            (bodyB.collider.height || 1) / 2,
            (bodyB.collider.depth || 1) / 2
        );
        
        const delta = bodyB.position.clone().sub(bodyA.position);
        
        // Check overlap on each axis
        const overlapX = (halfA.x + halfB.x) - Math.abs(delta.x);
        const overlapY = (halfA.y + halfB.y) - Math.abs(delta.y);
        const overlapZ = (halfA.z + halfB.z) - Math.abs(delta.z);
        
        if (overlapX <= 0 || overlapY <= 0 || overlapZ <= 0) {
            return null;
        }
        
        // Find minimum overlap axis
        let normal;
        let penetration;
        
        if (overlapX <= overlapY && overlapX <= overlapZ) {
            penetration = overlapX;
            normal = new THREE.Vector3(Math.sign(delta.x), 0, 0);
        } else if (overlapY <= overlapZ) {
            penetration = overlapY;
            normal = new THREE.Vector3(0, Math.sign(delta.y), 0);
        } else {
            penetration = overlapZ;
            normal = new THREE.Vector3(0, 0, Math.sign(delta.z));
        }
        
        // Contact point at midpoint
        const contactPoint = bodyA.position.clone().add(bodyB.position).multiplyScalar(0.5);
        
        // Relative velocity
        const relVel = bodyB.velocity.clone().sub(bodyA.velocity);
        
        return {
            bodyA,
            bodyB,
            contactPoint,
            contactNormal: normal,
            penetrationDepth: penetration,
            relativeVelocity: relVel,
            restitution: Math.min(bodyA.restitution, bodyB.restitution),
            friction: (bodyA.friction + bodyB.friction) / 2
        };
    }
    
    /**
     * Solves collision constraints
     * @private
     * @param {number} dt
     */
    _solveConstraints(dt) {
        const iterations = 10;
        this.stats.constraintIterations = iterations;
        
        for (let i = 0; i < iterations; i++) {
            // Solve collision constraints
            for (const collision of this.activeCollisions) {
                this._resolveCollision(collision);
            }
            
            // Solve user constraints
            for (const constraint of this.constraints) {
                this._solveConstraint(constraint, dt);
            }
        }
        
        // Fire collision callbacks
        for (const collision of this.activeCollisions) {
            this._fireCollisionCallbacks(collision);
        }
    }
    
    /**
     * Resolves a collision using sequential impulses
     * @private
     * @param {CollisionInfo} collision
     */
    _resolveCollision(collision) {
        const { bodyA, bodyB, contactPoint, contactNormal, penetrationDepth, restitution, friction } = collision;
        
        // Skip if both static
        if (bodyA.type === 'static' && bodyB.type === 'static') return;
        
        // Calculate relative velocity at contact
        const rA = contactPoint.clone().sub(bodyA.position);
        const rB = contactPoint.clone().sub(bodyB.position);
        
        const velA = bodyA.velocity.clone();
        if (bodyA.type !== 'static') {
            velA.add(new THREE.Vector3().crossVectors(bodyA.angularVelocity, rA));
        }
        
        const velB = bodyB.velocity.clone();
        if (bodyB.type !== 'static') {
            velB.add(new THREE.Vector3().crossVectors(bodyB.angularVelocity, rB));
        }
        
        const relVel = velB.clone().sub(velA);
        const velAlongNormal = relVel.dot(contactNormal);
        
        // Don't resolve if velocities separating
        if (velAlongNormal > 0) return;
        
        // Calculate impulse scalar
        const rAxN = new THREE.Vector3().crossVectors(rA, contactNormal);
        const rBxN = new THREE.Vector3().crossVectors(rB, contactNormal);
        
        let invMassSum = bodyA.inverseMass + bodyB.inverseMass;
        
        if (bodyA.type !== 'static') {
            const angularFactorA = rAxN.clone().applyMatrix3(bodyA.inverseInertia).dot(rAxN);
            invMassSum += angularFactorA;
        }
        
        if (bodyB.type !== 'static') {
            const angularFactorB = rBxN.clone().applyMatrix3(bodyB.inverseInertia).dot(rBxN);
            invMassSum += angularFactorB;
        }
        
        let j = -(1 + restitution) * velAlongNormal;
        j /= invMassSum;
        
        // Apply impulse
        const impulse = contactNormal.clone().multiplyScalar(j);
        
        if (bodyA.type !== 'static') {
            bodyA.velocity.addScaledVector(impulse, -bodyA.inverseMass);
            const angImpulseA = new THREE.Vector3().crossVectors(rA, impulse).negate();
            bodyA.angularVelocity.add(angImpulseA.applyMatrix3(bodyA.inverseInertia));
        }
        
        if (bodyB.type !== 'static') {
            bodyB.velocity.addScaledVector(impulse, bodyB.inverseMass);
            const angImpulseB = new THREE.Vector3().crossVectors(rB, impulse);
            bodyB.angularVelocity.add(angImpulseB.applyMatrix3(bodyB.inverseInertia));
        }
        
        // Apply friction impulse
        const tangent = relVel.clone().addScaledVector(contactNormal, -velAlongNormal);
        if (tangent.lengthSq() > 0.0001) {
            tangent.normalize();
            
            let jt = -relVel.dot(tangent);
            jt /= invMassSum;
            
            // Coulomb's law
            const frictionImpulse = tangent.clone();
            if (Math.abs(jt) < j * friction) {
                frictionImpulse.multiplyScalar(jt);
            } else {
                frictionImpulse.multiplyScalar(-j * friction * Math.sign(jt));
            }
            
            if (bodyA.type !== 'static') {
                bodyA.velocity.addScaledVector(frictionImpulse, -bodyA.inverseMass);
            }
            
            if (bodyB.type !== 'static') {
                bodyB.velocity.addScaledVector(frictionImpulse, bodyB.inverseMass);
            }
        }
        
        // Positional correction (Baumgarte stabilization)
        const percent = 0.8;
        const slop = 0.01;
        const correction = contactNormal.clone().multiplyScalar(
            Math.max(penetrationDepth - slop, 0) / invMassSum * percent
        );
        
        if (bodyA.type !== 'static') {
            bodyA.position.addScaledVector(correction, -bodyA.inverseMass);
        }
        
        if (bodyB.type !== 'static') {
            bodyB.position.addScaledVector(correction, bodyB.inverseMass);
        }
    }
    
    /**
     * Solves a user constraint
     * @private
     * @param {Object} constraint
     * @param {number} dt
     */
    _solveConstraint(constraint, dt) {
        // Placeholder for constraint solving
        // Can implement distance, hinge, slider constraints here
    }
    
    /**
     * Fires collision callbacks
     * @private
     * @param {CollisionInfo} collision
     */
    _fireCollisionCallbacks(collision) {
        // Global callback
        if (this.onCollision) {
            this.onCollision(collision);
        }
        
        // Body-specific callbacks
        const callbackA = this.collisionCallbacks.get(collision.bodyA.id);
        if (callbackA) callbackA(collision, collision.bodyB);
        
        const callbackB = this.collisionCallbacks.get(collision.bodyB.id);
        if (callbackB) callbackB(collision, collision.bodyA);
    }
    
    /**
     * Integrates velocities to positions
     * @private
     * @param {number} dt
     */
    _integrateVelocities(dt) {
        for (const body of this.dynamicBodies) {
            if (body.isSleeping) continue;
            
            // Update position
            body.position.addScaledVector(body.velocity, dt);
            
            // Update rotation using quaternion
            // dq/dt = 0.5 * ω * q
            const omega = body.angularVelocity;
            const q = body.rotation;
            
            const dq = new THREE.Quaternion(
                omega.x * 0.5 * dt,
                omega.y * 0.5 * dt,
                omega.z * 0.5 * dt,
                0
            );
            dq.multiply(q);
            
            q.x += dq.x;
            q.y += dq.y;
            q.z += dq.z;
            q.w += dq.w;
            q.normalize();
        }
    }
    
    /**
     * Updates spatial hash for all dynamic bodies
     * @private
     */
    _updateAllSpatialHash() {
        for (const body of this.dynamicBodies) {
            if (!body.isSleeping) {
                this._removeFromSpatialHash(body);
                this._addToSpatialHash(body);
            }
        }
    }
    
    /**
     * Updates body sleeping state
     * @private
     * @param {number} dt
     */
    _updateSleeping(dt) {
        let awakeCount = 0;
        
        for (const body of this.dynamicBodies) {
            if (body.isSleeping) continue;
            
            const linearSpeed = body.velocity.length();
            const angularSpeed = body.angularVelocity.length();
            
            if (linearSpeed < this.sleepVelocityThreshold && 
                angularSpeed < this.sleepVelocityThreshold) {
                body.sleepTimer += dt;
                
                if (body.sleepTimer >= this.sleepTimeThreshold) {
                    body.isSleeping = true;
                    body.velocity.set(0, 0, 0);
                    body.angularVelocity.set(0, 0, 0);
                }
            } else {
                body.sleepTimer = 0;
                awakeCount++;
            }
        }
        
        this.stats.awakeCount = awakeCount;
    }
    
    /**
     * Clears force and torque accumulators
     * @private
     */
    _clearAccumulators() {
        for (const body of this.dynamicBodies) {
            body.forceAccumulator.set(0, 0, 0);
            body.torqueAccumulator.set(0, 0, 0);
        }
    }
    
    /**
     * Performs a raycast
     * @param {THREE.Vector3} origin - Ray origin
     * @param {THREE.Vector3} direction - Ray direction (normalized)
     * @param {number} maxDistance - Maximum ray distance
     * @param {Object} options - Raycast options
     * @returns {RaycastResult}
     */
    raycast(origin, direction, maxDistance = 1000, options = {}) {
        let closestHit = null;
        let closestDist = maxDistance;
        
        const filterFn = options.filter || (() => true);
        
        for (const body of this.bodies.values()) {
            if (!filterFn(body)) continue;
            
            const hit = this._raycastBody(origin, direction, body, closestDist);
            if (hit && hit.distance < closestDist) {
                closestHit = hit;
                closestDist = hit.distance;
            }
        }
        
        return closestHit || { hit: false };
    }
    
    /**
     * Raycasts against a single body
     * @private
     */
    _raycastBody(origin, direction, body, maxDist) {
        const collider = body.collider;
        
        if (collider.type === 'sphere') {
            return this._raycastSphere(origin, direction, body.position, collider.radius, body, maxDist);
        } else if (collider.type === 'box') {
            return this._raycastBox(origin, direction, body, maxDist);
        }
        
        // Default sphere approximation
        const radius = this._getColliderRadius(collider);
        return this._raycastSphere(origin, direction, body.position, radius, body, maxDist);
    }
    
    /**
     * Raycasts against a sphere
     * @private
     */
    _raycastSphere(origin, direction, center, radius, body, maxDist) {
        const oc = origin.clone().sub(center);
        const a = direction.dot(direction);
        const b = 2 * oc.dot(direction);
        const c = oc.dot(oc) - radius * radius;
        const discriminant = b * b - 4 * a * c;
        
        if (discriminant < 0) return null;
        
        const t = (-b - Math.sqrt(discriminant)) / (2 * a);
        if (t < 0 || t > maxDist) return null;
        
        const point = origin.clone().addScaledVector(direction, t);
        const normal = point.clone().sub(center).normalize();
        
        return {
            hit: true,
            body,
            point,
            normal,
            distance: t
        };
    }
    
    /**
     * Raycasts against a box
     * @private
     */
    _raycastBox(origin, direction, body, maxDist) {
        // Transform ray to box local space
        const localOrigin = origin.clone().sub(body.position);
        const localDir = direction.clone();
        
        const invQuat = body.rotation.clone().invert();
        localOrigin.applyQuaternion(invQuat);
        localDir.applyQuaternion(invQuat);
        
        const halfW = (body.collider.width || 1) / 2;
        const halfH = (body.collider.height || 1) / 2;
        const halfD = (body.collider.depth || 1) / 2;
        
        const tMin = new THREE.Vector3(-halfW, -halfH, -halfD).sub(localOrigin).divide(localDir);
        const tMax = new THREE.Vector3(halfW, halfH, halfD).sub(localOrigin).divide(localDir);
        
        const t1 = new THREE.Vector3(
            Math.min(tMin.x, tMax.x),
            Math.min(tMin.y, tMax.y),
            Math.min(tMin.z, tMax.z)
        );
        const t2 = new THREE.Vector3(
            Math.max(tMin.x, tMax.x),
            Math.max(tMin.y, tMax.y),
            Math.max(tMin.z, tMax.z)
        );
        
        const tNear = Math.max(t1.x, t1.y, t1.z);
        const tFar = Math.min(t2.x, t2.y, t2.z);
        
        if (tNear > tFar || tFar < 0 || tNear > maxDist) return null;
        
        const t = tNear > 0 ? tNear : tFar;
        const localPoint = localOrigin.clone().addScaledVector(localDir, t);
        
        // Determine hit face normal
        let normal = new THREE.Vector3();
        const epsilon = 0.001;
        if (Math.abs(localPoint.x - halfW) < epsilon) normal.set(1, 0, 0);
        else if (Math.abs(localPoint.x + halfW) < epsilon) normal.set(-1, 0, 0);
        else if (Math.abs(localPoint.y - halfH) < epsilon) normal.set(0, 1, 0);
        else if (Math.abs(localPoint.y + halfH) < epsilon) normal.set(0, -1, 0);
        else if (Math.abs(localPoint.z - halfD) < epsilon) normal.set(0, 0, 1);
        else if (Math.abs(localPoint.z + halfD) < epsilon) normal.set(0, 0, -1);
        
        // Transform back to world space
        localPoint.applyQuaternion(body.rotation).add(body.position);
        normal.applyQuaternion(body.rotation);
        
        return {
            hit: true,
            body,
            point: localPoint,
            normal,
            distance: t
        };
    }
    
    /**
     * Updates statistics
     * @private
     */
    _updateStats() {
        this.stats.bodyCount = this.bodies.size;
        this.stats.dynamicCount = this.dynamicBodies.size;
        this.stats.staticCount = this.staticBodies.size;
    }
    
    /**
     * Gets the body with the given ID
     * @param {string} bodyId
     * @returns {PhysicsBody|undefined}
     */
    getBody(bodyId) {
        return this.bodies.get(bodyId);
    }
    
    /**
     * Checks if a body exists
     * @param {string} bodyId
     * @returns {boolean}
     */
    hasBody(bodyId) {
        return this.bodies.has(bodyId);
    }
    
    /**
     * Pauses the simulation
     */
    pause() {
        this.isPaused = true;
    }
    
    /**
     * Resumes the simulation
     */
    resume() {
        this.isPaused = false;
    }
    
    /**
     * Resets the simulation
     */
    reset() {
        this.bodies.clear();
        this.staticBodies.clear();
        this.dynamicBodies.clear();
        this.collisionPairs = [];
        this.activeCollisions = [];
        this.collisionCallbacks.clear();
        this.constraints = [];
        this.spatialHash.grid.clear();
        this.accumulator = 0;
        this.totalTime = 0;
        this._updateStats();
    }
    
    /**
     * Gets statistics
     * @returns {Object}
     */
    getStats() {
        return { ...this.stats };
    }
    
    /**
     * Disposes the physics world
     */
    dispose() {
        this.reset();
    }
}

export default PhysicsWorld;
