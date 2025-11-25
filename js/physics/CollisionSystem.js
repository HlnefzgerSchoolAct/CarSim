/**
 * CollisionSystem.js - Advanced Collision Detection and Response
 * 
 * Provides comprehensive collision detection for complex vehicle simulations
 * including deformation calculation, impact force analysis, and multi-body
 * collision handling.
 * 
 * @module physics/CollisionSystem
 * @author CarSim Development Team
 * @version 2.0.0
 */

import { VEHICLE_CONSTANTS, PHYSICS_CONSTANTS, DAMAGE_CONSTANTS } from '../core/Constants.js';
import { MathUtils } from '../utils/MathUtils.js';
import { ObjectPool } from '../utils/ObjectPool.js';

/**
 * @typedef {Object} CollisionEvent
 * @property {string} type - Collision type (vehicle-vehicle, vehicle-static, etc.)
 * @property {Object} bodyA - First collision body
 * @property {Object} bodyB - Second collision body
 * @property {THREE.Vector3} impactPoint - World position of impact
 * @property {THREE.Vector3} impactNormal - Normal vector at impact
 * @property {THREE.Vector3} impactVelocity - Relative velocity at impact
 * @property {number} impactForce - Calculated impact force in Newtons
 * @property {number} penetrationDepth - Overlap distance
 * @property {number} timeOfImpact - Time within frame when collision occurred
 * @property {Object} damageInfo - Information about resulting damage
 */

/**
 * @typedef {Object} CollisionBody
 * @property {string} id - Unique identifier
 * @property {string} type - Body type (vehicle, static, dynamic)
 * @property {THREE.Vector3} position - Current position
 * @property {THREE.Vector3} previousPosition - Position last frame
 * @property {THREE.Vector3} velocity - Current velocity
 * @property {THREE.Quaternion} rotation - Current rotation
 * @property {number} mass - Mass in kg
 * @property {Object} collider - Collision shape(s)
 * @property {number} friction - Surface friction
 * @property {number} restitution - Bounce coefficient
 * @property {Object} userData - Custom data
 */

/**
 * @typedef {Object} BoundingVolume
 * @property {THREE.Vector3} min - Minimum corner
 * @property {THREE.Vector3} max - Maximum corner
 * @property {THREE.Vector3} center - Center point
 * @property {number} radius - Bounding sphere radius
 */

/**
 * CollisionSystem - Advanced collision detection and response
 */
export class CollisionSystem {
    /**
     * Creates a new CollisionSystem
     * @param {Object} options - Configuration options
     */
    constructor(options = {}) {
        /**
         * Registered collision bodies
         * @type {Map<string, CollisionBody>}
         */
        this.bodies = new Map();
        
        /**
         * Vehicle bodies (special handling)
         * @type {Map<string, CollisionBody>}
         */
        this.vehicles = new Map();
        
        /**
         * Static bodies (spatial hash optimized)
         * @type {Map<string, CollisionBody>}
         */
        this.statics = new Map();
        
        /**
         * Active collision events this frame
         * @type {Array<CollisionEvent>}
         */
        this.collisionEvents = [];
        
        /**
         * Collision event pool
         * @type {ObjectPool}
         */
        this.eventPool = new ObjectPool(() => this._createCollisionEvent(), 100);
        
        /**
         * Spatial hash for broad phase
         * @type {Object}
         */
        this.spatialHash = {
            cellSize: options.cellSize || 20,
            grid: new Map()
        };
        
        /**
         * Collision layers/groups
         * @type {Object}
         */
        this.layers = {
            DEFAULT: 0x0001,
            VEHICLE: 0x0002,
            STATIC: 0x0004,
            DESTRUCTIBLE: 0x0008,
            TRIGGER: 0x0010,
            DEBRIS: 0x0020
        };
        
        /**
         * Collision matrix (which layers collide)
         * @type {Object}
         */
        this.collisionMatrix = {};
        this._initializeCollisionMatrix();
        
        /**
         * Collision callbacks by layer
         * @type {Map<number, Function>}
         */
        this.layerCallbacks = new Map();
        
        /**
         * Global collision callback
         * @type {Function}
         */
        this.onCollision = options.onCollision || null;
        
        /**
         * Continuous collision detection threshold
         * @type {number}
         */
        this.ccdThreshold = options.ccdThreshold || 5.0; // m/s
        
        /**
         * Minimum impact force to register
         * @type {number}
         */
        this.minImpactForce = options.minImpactForce || 100; // N
        
        /**
         * Enable continuous collision detection
         * @type {boolean}
         */
        this.enableCCD = options.enableCCD !== false;
        
        /**
         * Debug visualization enabled
         * @type {boolean}
         */
        this.debug = options.debug || false;
        
        /**
         * Debug helpers
         * @type {Array<THREE.Object3D>}
         */
        this.debugHelpers = [];
        
        /**
         * Statistics
         * @type {Object}
         */
        this.stats = {
            broadPhaseChecks: 0,
            narrowPhaseChecks: 0,
            collisionsDetected: 0,
            ccdChecks: 0,
            lastUpdateTime: 0
        };
        
        // Reusable vectors
        this._tempVec1 = new THREE.Vector3();
        this._tempVec2 = new THREE.Vector3();
        this._tempVec3 = new THREE.Vector3();
        this._tempMat4 = new THREE.Matrix4();
        this._tempBox = new THREE.Box3();
    }
    
    /**
     * Initializes collision matrix
     * @private
     */
    _initializeCollisionMatrix() {
        const { DEFAULT, VEHICLE, STATIC, DESTRUCTIBLE, TRIGGER, DEBRIS } = this.layers;
        
        // Set which layers can collide with which
        this._setLayerCollision(VEHICLE, VEHICLE, true);
        this._setLayerCollision(VEHICLE, STATIC, true);
        this._setLayerCollision(VEHICLE, DESTRUCTIBLE, true);
        this._setLayerCollision(VEHICLE, TRIGGER, true);
        this._setLayerCollision(VEHICLE, DEBRIS, false);
        this._setLayerCollision(DEBRIS, STATIC, true);
        this._setLayerCollision(DEBRIS, DEBRIS, false);
        this._setLayerCollision(DESTRUCTIBLE, DESTRUCTIBLE, false);
    }
    
    /**
     * Sets collision between two layers
     * @private
     */
    _setLayerCollision(layerA, layerB, enabled) {
        if (!this.collisionMatrix[layerA]) {
            this.collisionMatrix[layerA] = {};
        }
        if (!this.collisionMatrix[layerB]) {
            this.collisionMatrix[layerB] = {};
        }
        this.collisionMatrix[layerA][layerB] = enabled;
        this.collisionMatrix[layerB][layerA] = enabled;
    }
    
    /**
     * Checks if two layers can collide
     * @param {number} layerA - First layer
     * @param {number} layerB - Second layer
     * @returns {boolean}
     */
    canLayersCollide(layerA, layerB) {
        if (!this.collisionMatrix[layerA]) return true;
        if (this.collisionMatrix[layerA][layerB] === undefined) return true;
        return this.collisionMatrix[layerA][layerB];
    }
    
    /**
     * Creates a collision event object
     * @private
     * @returns {CollisionEvent}
     */
    _createCollisionEvent() {
        return {
            type: '',
            bodyA: null,
            bodyB: null,
            impactPoint: new THREE.Vector3(),
            impactNormal: new THREE.Vector3(),
            impactVelocity: new THREE.Vector3(),
            impactForce: 0,
            penetrationDepth: 0,
            timeOfImpact: 0,
            damageInfo: {
                zone: '',
                severity: 0,
                deformationVector: new THREE.Vector3(),
                affectedComponents: []
            }
        };
    }
    
    /**
     * Registers a collision body
     * @param {Object} config - Body configuration
     * @returns {CollisionBody}
     */
    registerBody(config) {
        const body = {
            id: config.id || `body_${this.bodies.size}`,
            type: config.type || 'dynamic',
            position: config.position ? config.position.clone() : new THREE.Vector3(),
            previousPosition: config.position ? config.position.clone() : new THREE.Vector3(),
            velocity: config.velocity ? config.velocity.clone() : new THREE.Vector3(),
            rotation: config.rotation ? config.rotation.clone() : new THREE.Quaternion(),
            mass: config.mass || 1,
            collider: this._createCollider(config.collider || { type: 'sphere', radius: 1 }),
            friction: config.friction !== undefined ? config.friction : 0.5,
            restitution: config.restitution !== undefined ? config.restitution : 0.3,
            layer: config.layer || this.layers.DEFAULT,
            userData: config.userData || {},
            boundingVolume: null,
            isVehicle: config.type === 'vehicle',
            mesh: config.mesh || null
        };
        
        // Calculate bounding volume
        body.boundingVolume = this._calculateBoundingVolume(body);
        
        // Add to appropriate collections
        this.bodies.set(body.id, body);
        
        if (body.type === 'vehicle') {
            this.vehicles.set(body.id, body);
            body.layer = this.layers.VEHICLE;
        } else if (body.type === 'static') {
            this.statics.set(body.id, body);
            body.layer = this.layers.STATIC;
        }
        
        // Add to spatial hash
        this._addToSpatialHash(body);
        
        return body;
    }
    
    /**
     * Creates a collider from configuration
     * @private
     * @param {Object} config - Collider configuration
     * @returns {Object}
     */
    _createCollider(config) {
        const collider = {
            type: config.type || 'sphere',
            shapes: []
        };
        
        switch (config.type) {
            case 'sphere':
                collider.shapes.push({
                    type: 'sphere',
                    center: config.center ? config.center.clone() : new THREE.Vector3(),
                    radius: config.radius || 1
                });
                break;
                
            case 'box':
                collider.shapes.push({
                    type: 'box',
                    center: config.center ? config.center.clone() : new THREE.Vector3(),
                    halfExtents: new THREE.Vector3(
                        (config.width || 1) / 2,
                        (config.height || 1) / 2,
                        (config.depth || 1) / 2
                    ),
                    rotation: config.rotation ? config.rotation.clone() : new THREE.Quaternion()
                });
                break;
                
            case 'capsule':
                collider.shapes.push({
                    type: 'capsule',
                    center: config.center ? config.center.clone() : new THREE.Vector3(),
                    radius: config.radius || 0.5,
                    height: config.height || 1
                });
                break;
                
            case 'compound':
                // Compound collider with multiple shapes
                for (const shapeConfig of (config.shapes || [])) {
                    collider.shapes.push(this._createCollider(shapeConfig).shapes[0]);
                }
                break;
                
            case 'vehicle':
                // Special vehicle collider with chassis + wheels
                collider.shapes.push({
                    type: 'box',
                    center: new THREE.Vector3(0, 0.3, 0),
                    halfExtents: new THREE.Vector3(
                        (config.width || 2) / 2,
                        (config.height || 1) / 2,
                        (config.length || 4) / 2
                    ),
                    rotation: new THREE.Quaternion()
                });
                
                // Add wheel spheres
                const wheelPositions = config.wheelPositions || [
                    new THREE.Vector3(-0.8, 0.35, 1.3),
                    new THREE.Vector3(0.8, 0.35, 1.3),
                    new THREE.Vector3(-0.8, 0.35, -1.3),
                    new THREE.Vector3(0.8, 0.35, -1.3)
                ];
                
                for (const pos of wheelPositions) {
                    collider.shapes.push({
                        type: 'sphere',
                        center: pos.clone(),
                        radius: config.wheelRadius || 0.35
                    });
                }
                break;
                
            default:
                // Default to sphere
                collider.shapes.push({
                    type: 'sphere',
                    center: new THREE.Vector3(),
                    radius: 1
                });
        }
        
        return collider;
    }
    
    /**
     * Calculates bounding volume for a body
     * @private
     * @param {CollisionBody} body
     * @returns {BoundingVolume}
     */
    _calculateBoundingVolume(body) {
        const min = new THREE.Vector3(Infinity, Infinity, Infinity);
        const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
        
        for (const shape of body.collider.shapes) {
            const shapeMin = new THREE.Vector3();
            const shapeMax = new THREE.Vector3();
            
            switch (shape.type) {
                case 'sphere':
                    shapeMin.copy(shape.center).subScalar(shape.radius);
                    shapeMax.copy(shape.center).addScalar(shape.radius);
                    break;
                    
                case 'box':
                    shapeMin.copy(shape.center).sub(shape.halfExtents);
                    shapeMax.copy(shape.center).add(shape.halfExtents);
                    break;
                    
                case 'capsule':
                    const r = shape.radius;
                    const h = shape.height / 2;
                    shapeMin.set(-r, -h - r, -r).add(shape.center);
                    shapeMax.set(r, h + r, r).add(shape.center);
                    break;
            }
            
            min.min(shapeMin);
            max.max(shapeMax);
        }
        
        const center = new THREE.Vector3().addVectors(min, max).multiplyScalar(0.5);
        const radius = center.distanceTo(max);
        
        return { min, max, center, radius };
    }
    
    /**
     * Adds body to spatial hash
     * @private
     * @param {CollisionBody} body
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
     * @param {CollisionBody} body
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
     * Gets grid cells for a body
     * @private
     * @param {CollisionBody} body
     * @returns {Array<string>}
     */
    _getBodyCells(body) {
        const cells = [];
        const size = this.spatialHash.cellSize;
        const bv = body.boundingVolume;
        const pos = body.position;
        
        const minX = Math.floor((pos.x + bv.min.x) / size);
        const maxX = Math.floor((pos.x + bv.max.x) / size);
        const minZ = Math.floor((pos.z + bv.min.z) / size);
        const maxZ = Math.floor((pos.z + bv.max.z) / size);
        
        for (let x = minX; x <= maxX; x++) {
            for (let z = minZ; z <= maxZ; z++) {
                cells.push(`${x},${z}`);
            }
        }
        
        return cells;
    }
    
    /**
     * Updates body position and spatial hash
     * @param {string} bodyId - Body identifier
     * @param {THREE.Vector3} position - New position
     * @param {THREE.Vector3} velocity - New velocity
     * @param {THREE.Quaternion} rotation - New rotation
     */
    updateBody(bodyId, position, velocity, rotation) {
        const body = this.bodies.get(bodyId);
        if (!body) return;
        
        // Store previous position for CCD
        body.previousPosition.copy(body.position);
        
        // Update current state
        body.position.copy(position);
        if (velocity) body.velocity.copy(velocity);
        if (rotation) body.rotation.copy(rotation);
        
        // Update spatial hash
        this._removeFromSpatialHash(body);
        this._addToSpatialHash(body);
    }
    
    /**
     * Removes a body
     * @param {string} bodyId - Body identifier
     */
    removeBody(bodyId) {
        const body = this.bodies.get(bodyId);
        if (!body) return;
        
        this._removeFromSpatialHash(body);
        this.bodies.delete(bodyId);
        this.vehicles.delete(bodyId);
        this.statics.delete(bodyId);
    }
    
    /**
     * Performs collision detection
     * @param {number} deltaTime - Frame time
     * @returns {Array<CollisionEvent>} Collision events
     */
    detectCollisions(deltaTime) {
        const startTime = performance.now();
        
        // Clear previous frame's events
        for (const event of this.collisionEvents) {
            this.eventPool.release(event);
        }
        this.collisionEvents = [];
        
        // Reset stats
        this.stats.broadPhaseChecks = 0;
        this.stats.narrowPhaseChecks = 0;
        this.stats.ccdChecks = 0;
        
        // Broad phase
        const potentialPairs = this._broadPhase();
        
        // Narrow phase
        for (const [bodyA, bodyB] of potentialPairs) {
            this.stats.narrowPhaseChecks++;
            
            // Check if layers can collide
            if (!this.canLayersCollide(bodyA.layer, bodyB.layer)) {
                continue;
            }
            
            // Perform narrow phase collision detection
            const collision = this._narrowPhase(bodyA, bodyB, deltaTime);
            
            if (collision) {
                this.collisionEvents.push(collision);
            }
        }
        
        this.stats.collisionsDetected = this.collisionEvents.length;
        this.stats.lastUpdateTime = performance.now() - startTime;
        
        // Fire callbacks
        this._fireCollisionCallbacks();
        
        return this.collisionEvents;
    }
    
    /**
     * Broad phase collision detection
     * @private
     * @returns {Array<[CollisionBody, CollisionBody]>}
     */
    _broadPhase() {
        const pairs = [];
        const checked = new Set();
        
        // For each vehicle, check against potential colliders
        for (const vehicle of this.vehicles.values()) {
            const cells = this._getBodyCells(vehicle);
            
            for (const cell of cells) {
                const others = this.spatialHash.grid.get(cell);
                if (!others) continue;
                
                for (const other of others) {
                    if (vehicle === other) continue;
                    
                    // Avoid duplicate pairs
                    const pairKey = vehicle.id < other.id ? 
                        `${vehicle.id}:${other.id}` : `${other.id}:${vehicle.id}`;
                    if (checked.has(pairKey)) continue;
                    checked.add(pairKey);
                    
                    this.stats.broadPhaseChecks++;
                    
                    // Quick bounding sphere check
                    if (this._checkBoundingSphereOverlap(vehicle, other)) {
                        pairs.push([vehicle, other]);
                    }
                }
            }
        }
        
        return pairs;
    }
    
    /**
     * Checks bounding sphere overlap
     * @private
     */
    _checkBoundingSphereOverlap(bodyA, bodyB) {
        const centerA = this._tempVec1.copy(bodyA.boundingVolume.center).add(bodyA.position);
        const centerB = this._tempVec2.copy(bodyB.boundingVolume.center).add(bodyB.position);
        
        const combinedRadius = bodyA.boundingVolume.radius + bodyB.boundingVolume.radius;
        const distSq = centerA.distanceToSquared(centerB);
        
        return distSq < combinedRadius * combinedRadius;
    }
    
    /**
     * Narrow phase collision detection
     * @private
     * @param {CollisionBody} bodyA
     * @param {CollisionBody} bodyB
     * @param {number} deltaTime
     * @returns {CollisionEvent|null}
     */
    _narrowPhase(bodyA, bodyB, deltaTime) {
        // Check for CCD if moving fast
        const needsCCD = this.enableCCD && (
            bodyA.velocity.length() > this.ccdThreshold ||
            bodyB.velocity.length() > this.ccdThreshold
        );
        
        if (needsCCD) {
            return this._continuousCollisionDetection(bodyA, bodyB, deltaTime);
        }
        
        // Standard discrete collision detection
        return this._discreteCollisionDetection(bodyA, bodyB);
    }
    
    /**
     * Discrete collision detection
     * @private
     */
    _discreteCollisionDetection(bodyA, bodyB) {
        // Check each shape pair
        for (const shapeA of bodyA.collider.shapes) {
            for (const shapeB of bodyB.collider.shapes) {
                const result = this._testShapeCollision(shapeA, bodyA, shapeB, bodyB);
                
                if (result) {
                    return this._createCollisionFromResult(bodyA, bodyB, result);
                }
            }
        }
        
        return null;
    }
    
    /**
     * Continuous collision detection
     * @private
     */
    _continuousCollisionDetection(bodyA, bodyB, deltaTime) {
        this.stats.ccdChecks++;
        
        // Swept sphere test for fast moving objects
        const steps = 4;
        
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            
            // Interpolate positions
            const posA = new THREE.Vector3().lerpVectors(
                bodyA.previousPosition, bodyA.position, t
            );
            const posB = new THREE.Vector3().lerpVectors(
                bodyB.previousPosition || bodyB.position, bodyB.position, t
            );
            
            // Check collision at interpolated position
            for (const shapeA of bodyA.collider.shapes) {
                for (const shapeB of bodyB.collider.shapes) {
                    const worldShapeA = this._transformShape(shapeA, posA, bodyA.rotation);
                    const worldShapeB = this._transformShape(shapeB, posB, bodyB.rotation);
                    
                    const result = this._testShapeCollisionRaw(worldShapeA, worldShapeB);
                    
                    if (result) {
                        const event = this._createCollisionFromResult(bodyA, bodyB, result);
                        event.timeOfImpact = t * deltaTime;
                        return event;
                    }
                }
            }
        }
        
        return null;
    }
    
    /**
     * Transforms a shape to world space
     * @private
     */
    _transformShape(shape, position, rotation) {
        const transformed = { ...shape };
        
        if (shape.center) {
            transformed.center = shape.center.clone();
            transformed.center.applyQuaternion(rotation);
            transformed.center.add(position);
        }
        
        if (shape.halfExtents) {
            transformed.halfExtents = shape.halfExtents.clone();
        }
        
        if (shape.rotation) {
            transformed.rotation = shape.rotation.clone().multiply(rotation);
        } else {
            transformed.rotation = rotation.clone();
        }
        
        return transformed;
    }
    
    /**
     * Tests collision between two shapes
     * @private
     */
    _testShapeCollision(shapeA, bodyA, shapeB, bodyB) {
        // Transform shapes to world space
        const worldA = this._transformShape(shapeA, bodyA.position, bodyA.rotation);
        const worldB = this._transformShape(shapeB, bodyB.position, bodyB.rotation);
        
        return this._testShapeCollisionRaw(worldA, worldB);
    }
    
    /**
     * Tests collision between two world-space shapes
     * @private
     */
    _testShapeCollisionRaw(shapeA, shapeB) {
        const typeA = shapeA.type;
        const typeB = shapeB.type;
        
        // Dispatch to appropriate collision test
        if (typeA === 'sphere' && typeB === 'sphere') {
            return this._sphereSphereTest(shapeA, shapeB);
        } else if (typeA === 'sphere' && typeB === 'box') {
            return this._sphereBoxTest(shapeA, shapeB);
        } else if (typeA === 'box' && typeB === 'sphere') {
            const result = this._sphereBoxTest(shapeB, shapeA);
            if (result) result.normal.negate();
            return result;
        } else if (typeA === 'box' && typeB === 'box') {
            return this._boxBoxTest(shapeA, shapeB);
        } else if (typeA === 'capsule' || typeB === 'capsule') {
            // Approximate capsule as sphere
            const sphereA = typeA === 'capsule' ? 
                { type: 'sphere', center: shapeA.center, radius: shapeA.radius } : shapeA;
            const sphereB = typeB === 'capsule' ? 
                { type: 'sphere', center: shapeB.center, radius: shapeB.radius } : shapeB;
            return this._testShapeCollisionRaw(sphereA, sphereB);
        }
        
        return null;
    }
    
    /**
     * Sphere-sphere collision test
     * @private
     */
    _sphereSphereTest(sphereA, sphereB) {
        const delta = this._tempVec1.subVectors(sphereB.center, sphereA.center);
        const distance = delta.length();
        const minDistance = sphereA.radius + sphereB.radius;
        
        if (distance >= minDistance || distance < 0.0001) {
            return null;
        }
        
        const normal = delta.clone().normalize();
        const penetration = minDistance - distance;
        const point = sphereA.center.clone().addScaledVector(normal, sphereA.radius - penetration / 2);
        
        return { point, normal, penetration };
    }
    
    /**
     * Sphere-box collision test
     * @private
     */
    _sphereBoxTest(sphere, box) {
        // Transform sphere center to box local space
        const invRot = box.rotation.clone().invert();
        const localCenter = sphere.center.clone().sub(box.center);
        localCenter.applyQuaternion(invRot);
        
        // Clamp to box bounds
        const closest = new THREE.Vector3(
            Math.max(-box.halfExtents.x, Math.min(box.halfExtents.x, localCenter.x)),
            Math.max(-box.halfExtents.y, Math.min(box.halfExtents.y, localCenter.y)),
            Math.max(-box.halfExtents.z, Math.min(box.halfExtents.z, localCenter.z))
        );
        
        const delta = localCenter.clone().sub(closest);
        const distance = delta.length();
        
        if (distance >= sphere.radius || distance < 0.0001) {
            // Check if sphere center is inside box
            if (distance < 0.0001) {
                // Push out along shortest axis
                const absLocal = new THREE.Vector3(
                    Math.abs(localCenter.x),
                    Math.abs(localCenter.y),
                    Math.abs(localCenter.z)
                );
                const penetrations = box.halfExtents.clone().sub(absLocal);
                
                let normal;
                let penetration;
                
                if (penetrations.x <= penetrations.y && penetrations.x <= penetrations.z) {
                    penetration = penetrations.x + sphere.radius;
                    normal = new THREE.Vector3(Math.sign(localCenter.x), 0, 0);
                } else if (penetrations.y <= penetrations.z) {
                    penetration = penetrations.y + sphere.radius;
                    normal = new THREE.Vector3(0, Math.sign(localCenter.y), 0);
                } else {
                    penetration = penetrations.z + sphere.radius;
                    normal = new THREE.Vector3(0, 0, Math.sign(localCenter.z));
                }
                
                normal.applyQuaternion(box.rotation);
                const point = box.center.clone().addScaledVector(normal, -penetration / 2);
                
                return { point, normal: normal.negate(), penetration };
            }
            return null;
        }
        
        const normal = delta.normalize();
        const penetration = sphere.radius - distance;
        
        // Transform back to world space
        closest.applyQuaternion(box.rotation);
        closest.add(box.center);
        normal.applyQuaternion(box.rotation);
        
        return { point: closest, normal: normal.negate(), penetration };
    }
    
    /**
     * Box-box collision test (AABB approximation)
     * @private
     */
    _boxBoxTest(boxA, boxB) {
        // Simplified AABB test
        // For full OBB-OBB, use SAT
        
        const delta = boxB.center.clone().sub(boxA.center);
        
        const overlapX = (boxA.halfExtents.x + boxB.halfExtents.x) - Math.abs(delta.x);
        const overlapY = (boxA.halfExtents.y + boxB.halfExtents.y) - Math.abs(delta.y);
        const overlapZ = (boxA.halfExtents.z + boxB.halfExtents.z) - Math.abs(delta.z);
        
        if (overlapX <= 0 || overlapY <= 0 || overlapZ <= 0) {
            return null;
        }
        
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
        
        const point = boxA.center.clone().add(boxB.center).multiplyScalar(0.5);
        
        return { point, normal, penetration };
    }
    
    /**
     * Creates a collision event from test result
     * @private
     */
    _createCollisionFromResult(bodyA, bodyB, result) {
        const event = this.eventPool.acquire();
        
        // Determine collision type
        if (bodyA.isVehicle && bodyB.isVehicle) {
            event.type = 'vehicle-vehicle';
        } else if (bodyA.isVehicle || bodyB.isVehicle) {
            event.type = bodyB.type === 'static' || bodyA.type === 'static' ? 
                'vehicle-static' : 'vehicle-dynamic';
        } else {
            event.type = 'dynamic-static';
        }
        
        event.bodyA = bodyA;
        event.bodyB = bodyB;
        event.impactPoint.copy(result.point);
        event.impactNormal.copy(result.normal);
        event.penetrationDepth = result.penetration;
        
        // Calculate relative velocity
        event.impactVelocity.subVectors(bodyA.velocity, bodyB.velocity);
        
        // Calculate impact force using impulse-momentum
        const relVelAlongNormal = event.impactVelocity.dot(event.impactNormal);
        
        if (relVelAlongNormal > 0) {
            // Bodies are separating
            event.impactForce = 0;
        } else {
            // Calculate effective mass
            const effectiveMass = 1 / (1 / bodyA.mass + 1 / bodyB.mass);
            
            // Combined restitution
            const restitution = Math.min(bodyA.restitution, bodyB.restitution);
            
            // Impact force (simplified)
            event.impactForce = Math.abs(relVelAlongNormal) * effectiveMass * (1 + restitution);
        }
        
        // Calculate damage info for vehicles
        if (bodyA.isVehicle || bodyB.isVehicle) {
            this._calculateDamageInfo(event);
        }
        
        return event;
    }
    
    /**
     * Calculates damage information for a collision
     * @private
     * @param {CollisionEvent} event
     */
    _calculateDamageInfo(event) {
        const vehicle = event.bodyA.isVehicle ? event.bodyA : event.bodyB;
        const other = event.bodyA.isVehicle ? event.bodyB : event.bodyA;
        
        // Transform impact point to vehicle local space
        const localImpact = event.impactPoint.clone().sub(vehicle.position);
        const invRot = vehicle.rotation.clone().invert();
        localImpact.applyQuaternion(invRot);
        
        // Determine damage zone based on local position
        let zone = 'CENTER';
        
        if (localImpact.z > 1.0) {
            zone = 'FRONT';
        } else if (localImpact.z < -1.0) {
            zone = 'REAR';
        } else if (localImpact.x > 0.5) {
            zone = 'RIGHT';
        } else if (localImpact.x < -0.5) {
            zone = 'LEFT';
        } else if (localImpact.y > 0.5) {
            zone = 'TOP';
        } else if (localImpact.y < 0) {
            zone = 'BOTTOM';
        }
        
        event.damageInfo.zone = zone;
        
        // Calculate severity (0-1) based on force
        const maxForce = DAMAGE_CONSTANTS?.MAX_IMPACT_FORCE || 500000;
        event.damageInfo.severity = Math.min(1, event.impactForce / maxForce);
        
        // Calculate deformation vector
        const localNormal = event.impactNormal.clone().applyQuaternion(invRot);
        event.damageInfo.deformationVector.copy(localNormal).multiplyScalar(-event.damageInfo.severity);
        
        // Determine affected components
        event.damageInfo.affectedComponents = this._getAffectedComponents(zone, event.damageInfo.severity);
    }
    
    /**
     * Gets components affected by damage zone
     * @private
     */
    _getAffectedComponents(zone, severity) {
        const components = [];
        
        const zoneComponents = {
            FRONT: ['FRONT_BUMPER', 'HOOD', 'HEADLIGHT_LEFT', 'HEADLIGHT_RIGHT', 'FENDER_FL', 'FENDER_FR', 'RADIATOR', 'ENGINE'],
            REAR: ['REAR_BUMPER', 'TRUNK', 'TAILLIGHT_LEFT', 'TAILLIGHT_RIGHT', 'FENDER_RL', 'FENDER_RR', 'EXHAUST'],
            LEFT: ['DOOR_LEFT', 'MIRROR_LEFT', 'FENDER_FL', 'FENDER_RL', 'WINDOW_LEFT'],
            RIGHT: ['DOOR_RIGHT', 'MIRROR_RIGHT', 'FENDER_FR', 'FENDER_RR', 'WINDOW_RIGHT'],
            TOP: ['ROOF', 'SUNROOF'],
            BOTTOM: ['UNDERBODY', 'EXHAUST']
        };
        
        const zoneList = zoneComponents[zone] || [];
        
        // Filter based on severity
        for (const component of zoneList) {
            if (severity > 0.3 || Math.random() < severity * 2) {
                components.push(component);
            }
        }
        
        return components;
    }
    
    /**
     * Fires collision callbacks
     * @private
     */
    _fireCollisionCallbacks() {
        for (const event of this.collisionEvents) {
            // Global callback
            if (this.onCollision && event.impactForce >= this.minImpactForce) {
                this.onCollision(event);
            }
            
            // Layer callbacks
            const callbackA = this.layerCallbacks.get(event.bodyA.layer);
            if (callbackA) callbackA(event, event.bodyA, event.bodyB);
            
            const callbackB = this.layerCallbacks.get(event.bodyB.layer);
            if (callbackB) callbackB(event, event.bodyB, event.bodyA);
        }
    }
    
    /**
     * Registers a layer collision callback
     * @param {number} layer - Layer
     * @param {Function} callback - Callback function
     */
    setLayerCallback(layer, callback) {
        this.layerCallbacks.set(layer, callback);
    }
    
    /**
     * Performs a raycast
     * @param {THREE.Vector3} origin - Ray origin
     * @param {THREE.Vector3} direction - Ray direction
     * @param {number} maxDistance - Maximum distance
     * @param {Object} options - Options
     * @returns {Object|null} Hit result
     */
    raycast(origin, direction, maxDistance = 1000, options = {}) {
        let closestHit = null;
        let closestDist = maxDistance;
        
        const layerMask = options.layerMask !== undefined ? options.layerMask : 0xFFFFFFFF;
        const ignoreBodies = new Set(options.ignoreBodies || []);
        
        for (const body of this.bodies.values()) {
            if (ignoreBodies.has(body.id)) continue;
            if ((body.layer & layerMask) === 0) continue;
            
            for (const shape of body.collider.shapes) {
                const worldShape = this._transformShape(shape, body.position, body.rotation);
                const hit = this._raycastShape(origin, direction, worldShape, closestDist);
                
                if (hit && hit.distance < closestDist) {
                    closestDist = hit.distance;
                    closestHit = {
                        hit: true,
                        body,
                        point: hit.point,
                        normal: hit.normal,
                        distance: hit.distance
                    };
                }
            }
        }
        
        return closestHit;
    }
    
    /**
     * Raycasts against a shape
     * @private
     */
    _raycastShape(origin, direction, shape, maxDist) {
        switch (shape.type) {
            case 'sphere':
                return this._raycastSphere(origin, direction, shape, maxDist);
            case 'box':
                return this._raycastBox(origin, direction, shape, maxDist);
            default:
                return null;
        }
    }
    
    /**
     * Raycasts against a sphere
     * @private
     */
    _raycastSphere(origin, direction, sphere, maxDist) {
        const oc = origin.clone().sub(sphere.center);
        const a = direction.dot(direction);
        const b = 2 * oc.dot(direction);
        const c = oc.dot(oc) - sphere.radius * sphere.radius;
        const discriminant = b * b - 4 * a * c;
        
        if (discriminant < 0) return null;
        
        const t = (-b - Math.sqrt(discriminant)) / (2 * a);
        if (t < 0 || t > maxDist) return null;
        
        const point = origin.clone().addScaledVector(direction, t);
        const normal = point.clone().sub(sphere.center).normalize();
        
        return { point, normal, distance: t };
    }
    
    /**
     * Raycasts against a box
     * @private
     */
    _raycastBox(origin, direction, box, maxDist) {
        // Transform to box local space
        const invRot = box.rotation.clone().invert();
        const localOrigin = origin.clone().sub(box.center).applyQuaternion(invRot);
        const localDir = direction.clone().applyQuaternion(invRot);
        
        const half = box.halfExtents;
        
        const tMin = new THREE.Vector3(-half.x, -half.y, -half.z).sub(localOrigin).divide(localDir);
        const tMax = new THREE.Vector3(half.x, half.y, half.z).sub(localOrigin).divide(localDir);
        
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
        
        // Determine face normal
        let normal = new THREE.Vector3();
        const epsilon = 0.001;
        if (Math.abs(localPoint.x - half.x) < epsilon) normal.set(1, 0, 0);
        else if (Math.abs(localPoint.x + half.x) < epsilon) normal.set(-1, 0, 0);
        else if (Math.abs(localPoint.y - half.y) < epsilon) normal.set(0, 1, 0);
        else if (Math.abs(localPoint.y + half.y) < epsilon) normal.set(0, -1, 0);
        else if (Math.abs(localPoint.z - half.z) < epsilon) normal.set(0, 0, 1);
        else if (Math.abs(localPoint.z + half.z) < epsilon) normal.set(0, 0, -1);
        
        // Transform back to world
        const point = localPoint.applyQuaternion(box.rotation).add(box.center);
        normal.applyQuaternion(box.rotation);
        
        return { point, normal, distance: t };
    }
    
    /**
     * Gets statistics
     * @returns {Object}
     */
    getStats() {
        return { ...this.stats };
    }
    
    /**
     * Resets the collision system
     */
    reset() {
        this.bodies.clear();
        this.vehicles.clear();
        this.statics.clear();
        this.spatialHash.grid.clear();
        this.collisionEvents = [];
        this.layerCallbacks.clear();
    }
    
    /**
     * Disposes resources
     */
    dispose() {
        this.reset();
        this.eventPool.clear();
    }
}

export default CollisionSystem;
