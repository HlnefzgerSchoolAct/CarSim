/**
 * ComponentDetachment.js - Vehicle Component Detachment System
 * 
 * Manages detachable vehicle components including bumpers, doors, hood,
 * mirrors, and other external parts. Handles physics-based detachment
 * based on impact force and damage accumulation.
 * 
 * @module damage/ComponentDetachment
 * @author CarSim Development Team
 * @version 2.0.0
 */

import { DAMAGE_CONSTANTS, PHYSICS_CONSTANTS } from '../core/Constants.js';
import { MathUtils } from '../utils/MathUtils.js';
import { ObjectPool } from '../utils/ObjectPool.js';

/**
 * @typedef {Object} ComponentConfig
 * @property {string} name - Component name
 * @property {string} type - Component type (bumper, door, hood, etc.)
 * @property {THREE.Vector3} position - Local position on vehicle
 * @property {THREE.Vector3} attachmentPoint - Attachment/hinge point
 * @property {number} mass - Component mass in kg
 * @property {number} detachThreshold - Force threshold for detachment in N
 * @property {THREE.Mesh} mesh - Component mesh
 * @property {boolean} isAttached - Whether component is still attached
 * @property {number} damage - Current damage level 0-100
 * @property {number} hingeStrength - Strength of connection
 */

/**
 * @typedef {Object} DetachedComponent
 * @property {THREE.Mesh} mesh - Component mesh
 * @property {THREE.Vector3} position - World position
 * @property {THREE.Vector3} velocity - Linear velocity
 * @property {THREE.Vector3} angularVelocity - Angular velocity
 * @property {number} mass - Component mass
 * @property {number} lifetime - Remaining lifetime before cleanup
 * @property {boolean} isOnGround - Whether component has landed
 */

/**
 * ComponentDetachment System
 * Manages all detachable vehicle components
 */
export class ComponentDetachment {
    /**
     * Creates a new ComponentDetachment system
     * @param {THREE.Scene} scene - Three.js scene
     * @param {Object} options - Configuration options
     */
    constructor(scene, options = {}) {
        /** @type {THREE.Scene} */
        this.scene = scene;
        
        /** @type {Map<string, ComponentConfig>} */
        this.components = new Map();
        
        /** @type {Array<DetachedComponent>} */
        this.detachedComponents = [];
        
        /** @type {ObjectPool} Pool for detached component physics */
        this.detachedPool = new ObjectPool(() => this.createDetachedComponent(), 20);
        
        /** @type {number} Maximum number of detached components */
        this.maxDetachedComponents = options.maxDetachedComponents || 50;
        
        /** @type {number} Lifetime of detached components in seconds */
        this.componentLifetime = options.componentLifetime || 30;
        
        /** @type {number} Ground friction coefficient */
        this.groundFriction = options.groundFriction || 0.5;
        
        /** @type {number} Air resistance coefficient */
        this.airResistance = options.airResistance || 0.1;
        
        /** @type {boolean} Enable component shadows */
        this.enableShadows = options.enableShadows !== false;
        
        /** @type {Function} Callback when component detaches */
        this.onDetach = options.onDetach || null;
        
        /** @type {Function} Callback when component lands */
        this.onLand = options.onLand || null;
        
        /**
         * Component type definitions with default properties
         * @type {Object}
         */
        this.componentTypes = {
            FRONT_BUMPER: {
                mass: 15,
                detachThreshold: 80000,
                dragCoefficient: 0.8,
                bounceRestitution: 0.3,
                friction: 0.6
            },
            REAR_BUMPER: {
                mass: 12,
                detachThreshold: 70000,
                dragCoefficient: 0.7,
                bounceRestitution: 0.3,
                friction: 0.6
            },
            HOOD: {
                mass: 25,
                detachThreshold: 100000,
                dragCoefficient: 1.2,
                bounceRestitution: 0.2,
                friction: 0.5
            },
            TRUNK: {
                mass: 20,
                detachThreshold: 90000,
                dragCoefficient: 1.0,
                bounceRestitution: 0.2,
                friction: 0.5
            },
            DOOR_LEFT: {
                mass: 30,
                detachThreshold: 120000,
                dragCoefficient: 1.5,
                bounceRestitution: 0.2,
                friction: 0.4
            },
            DOOR_RIGHT: {
                mass: 30,
                detachThreshold: 120000,
                dragCoefficient: 1.5,
                bounceRestitution: 0.2,
                friction: 0.4
            },
            FENDER_FL: {
                mass: 8,
                detachThreshold: 50000,
                dragCoefficient: 0.6,
                bounceRestitution: 0.4,
                friction: 0.7
            },
            FENDER_FR: {
                mass: 8,
                detachThreshold: 50000,
                dragCoefficient: 0.6,
                bounceRestitution: 0.4,
                friction: 0.7
            },
            FENDER_RL: {
                mass: 8,
                detachThreshold: 50000,
                dragCoefficient: 0.6,
                bounceRestitution: 0.4,
                friction: 0.7
            },
            FENDER_RR: {
                mass: 8,
                detachThreshold: 50000,
                dragCoefficient: 0.6,
                bounceRestitution: 0.4,
                friction: 0.7
            },
            MIRROR_LEFT: {
                mass: 1.5,
                detachThreshold: 15000,
                dragCoefficient: 0.3,
                bounceRestitution: 0.5,
                friction: 0.8
            },
            MIRROR_RIGHT: {
                mass: 1.5,
                detachThreshold: 15000,
                dragCoefficient: 0.3,
                bounceRestitution: 0.5,
                friction: 0.8
            },
            SPOILER: {
                mass: 5,
                detachThreshold: 40000,
                dragCoefficient: 0.9,
                bounceRestitution: 0.35,
                friction: 0.6
            },
            EXHAUST: {
                mass: 10,
                detachThreshold: 60000,
                dragCoefficient: 0.4,
                bounceRestitution: 0.3,
                friction: 0.5
            },
            HEADLIGHT_LEFT: {
                mass: 2,
                detachThreshold: 25000,
                dragCoefficient: 0.2,
                bounceRestitution: 0.2,
                friction: 0.8
            },
            HEADLIGHT_RIGHT: {
                mass: 2,
                detachThreshold: 25000,
                dragCoefficient: 0.2,
                bounceRestitution: 0.2,
                friction: 0.8
            },
            TAILLIGHT_LEFT: {
                mass: 1.5,
                detachThreshold: 20000,
                dragCoefficient: 0.2,
                bounceRestitution: 0.2,
                friction: 0.8
            },
            TAILLIGHT_RIGHT: {
                mass: 1.5,
                detachThreshold: 20000,
                dragCoefficient: 0.2,
                bounceRestitution: 0.2,
                friction: 0.8
            },
            WHEEL: {
                mass: 20,
                detachThreshold: 200000,
                dragCoefficient: 0.5,
                bounceRestitution: 0.6,
                friction: 0.7
            },
            LICENSE_PLATE: {
                mass: 0.5,
                detachThreshold: 10000,
                dragCoefficient: 0.15,
                bounceRestitution: 0.4,
                friction: 0.9
            }
        };
        
        /**
         * Damage zones mapping components to damage regions
         * @type {Object}
         */
        this.damageZones = {
            FRONT: ['FRONT_BUMPER', 'HOOD', 'HEADLIGHT_LEFT', 'HEADLIGHT_RIGHT', 'FENDER_FL', 'FENDER_FR'],
            REAR: ['REAR_BUMPER', 'TRUNK', 'TAILLIGHT_LEFT', 'TAILLIGHT_RIGHT', 'FENDER_RL', 'FENDER_RR', 'SPOILER', 'EXHAUST', 'LICENSE_PLATE'],
            LEFT: ['DOOR_LEFT', 'MIRROR_LEFT', 'FENDER_FL', 'FENDER_RL'],
            RIGHT: ['DOOR_RIGHT', 'MIRROR_RIGHT', 'FENDER_FR', 'FENDER_RR'],
            TOP: ['HOOD', 'TRUNK', 'SPOILER'],
            BOTTOM: ['EXHAUST']
        };
        
        /** @type {Object} Statistics tracking */
        this.stats = {
            totalDetachments: 0,
            componentsByType: {},
            maxForceRecorded: 0,
            averageDetachForce: 0
        };
        
        this._initializeStats();
    }
    
    /**
     * Initialize statistics tracking
     * @private
     */
    _initializeStats() {
        for (const type of Object.keys(this.componentTypes)) {
            this.stats.componentsByType[type] = 0;
        }
    }
    
    /**
     * Creates a detached component object for pooling
     * @private
     * @returns {DetachedComponent}
     */
    createDetachedComponent() {
        return {
            mesh: null,
            position: new THREE.Vector3(),
            velocity: new THREE.Vector3(),
            angularVelocity: new THREE.Vector3(),
            mass: 1,
            lifetime: this.componentLifetime,
            isOnGround: false,
            bounceCount: 0,
            maxBounces: 3,
            typeProps: null,
            componentType: '',
            rotation: new THREE.Euler(),
            groundY: 0
        };
    }
    
    /**
     * Registers a component that can be detached
     * @param {string} id - Unique component identifier
     * @param {ComponentConfig} config - Component configuration
     */
    registerComponent(id, config) {
        const typeProps = this.componentTypes[config.type] || this.componentTypes.FRONT_BUMPER;
        
        const component = {
            id,
            name: config.name || id,
            type: config.type,
            mesh: config.mesh,
            position: config.position ? config.position.clone() : new THREE.Vector3(),
            attachmentPoint: config.attachmentPoint ? config.attachmentPoint.clone() : new THREE.Vector3(),
            mass: config.mass || typeProps.mass,
            detachThreshold: config.detachThreshold || typeProps.detachThreshold,
            isAttached: true,
            damage: 0,
            currentForce: 0,
            hingeStrength: config.hingeStrength || 1.0,
            typeProps,
            damagedMaterial: null,
            originalMaterial: config.mesh ? config.mesh.material.clone() : null,
            impactHistory: [],
            weakened: false
        };
        
        this.components.set(id, component);
        return component;
    }
    
    /**
     * Registers multiple components at once
     * @param {Object[]} configs - Array of component configurations
     */
    registerComponents(configs) {
        for (const config of configs) {
            this.registerComponent(config.id, config);
        }
    }
    
    /**
     * Applies impact force to a component
     * @param {string} componentId - Component identifier
     * @param {number} force - Impact force in Newtons
     * @param {THREE.Vector3} impactPoint - World position of impact
     * @param {THREE.Vector3} impactDirection - Direction of impact force
     * @param {THREE.Vector3} vehicleVelocity - Vehicle velocity at time of impact
     * @returns {Object} Result containing detachment info
     */
    applyImpact(componentId, force, impactPoint, impactDirection, vehicleVelocity = null) {
        const component = this.components.get(componentId);
        if (!component || !component.isAttached) {
            return { detached: false, component: null };
        }
        
        // Record impact for cumulative damage
        component.impactHistory.push({
            force,
            time: performance.now(),
            point: impactPoint.clone(),
            direction: impactDirection.clone()
        });
        
        // Cleanup old impacts (older than 5 seconds)
        const now = performance.now();
        component.impactHistory = component.impactHistory.filter(
            impact => now - impact.time < 5000
        );
        
        // Calculate cumulative force from recent impacts
        const cumulativeForce = component.impactHistory.reduce(
            (sum, impact) => sum + impact.force * Math.exp(-(now - impact.time) / 2000),
            0
        );
        
        // Update current force
        component.currentForce = Math.max(force, cumulativeForce);
        
        // Apply damage based on force
        const damageIncrement = (force / component.detachThreshold) * 25;
        component.damage = Math.min(100, component.damage + damageIncrement);
        
        // Update material to show damage
        this._updateComponentDamageVisual(component);
        
        // Check for detachment
        const effectiveThreshold = component.detachThreshold * component.hingeStrength * 
            (component.weakened ? 0.5 : 1.0) * (1 - component.damage / 200);
        
        if (force >= effectiveThreshold) {
            return this._detachComponent(component, impactPoint, impactDirection, vehicleVelocity);
        }
        
        // Check for weakening
        if (component.damage > 60 && !component.weakened) {
            component.weakened = true;
            component.hingeStrength *= 0.6;
        }
        
        // Update stats
        this.stats.maxForceRecorded = Math.max(this.stats.maxForceRecorded, force);
        
        return { detached: false, component, damage: component.damage };
    }
    
    /**
     * Applies impact to all components in a damage zone
     * @param {string} zone - Damage zone name (FRONT, REAR, LEFT, RIGHT, TOP, BOTTOM)
     * @param {number} force - Impact force in Newtons
     * @param {THREE.Vector3} impactPoint - World position of impact
     * @param {THREE.Vector3} impactDirection - Direction of impact force
     * @param {THREE.Vector3} vehicleVelocity - Vehicle velocity at time of impact
     * @returns {Object[]} Array of results for each affected component
     */
    applyZoneImpact(zone, force, impactPoint, impactDirection, vehicleVelocity = null) {
        const components = this.damageZones[zone];
        if (!components) {
            return [];
        }
        
        const results = [];
        
        for (const componentType of components) {
            // Find all registered components of this type
            for (const [id, component] of this.components) {
                if (component.type === componentType && component.isAttached) {
                    // Calculate distance-based force falloff
                    const distance = component.position.distanceTo(impactPoint);
                    const falloff = Math.exp(-distance / 2);
                    const effectiveForce = force * falloff;
                    
                    const result = this.applyImpact(
                        id, 
                        effectiveForce, 
                        impactPoint, 
                        impactDirection, 
                        vehicleVelocity
                    );
                    results.push(result);
                }
            }
        }
        
        return results;
    }
    
    /**
     * Detaches a component from the vehicle
     * @private
     * @param {ComponentConfig} component - Component to detach
     * @param {THREE.Vector3} impactPoint - Point of impact
     * @param {THREE.Vector3} impactDirection - Direction of impact
     * @param {THREE.Vector3} vehicleVelocity - Vehicle velocity
     * @returns {Object} Detachment result
     */
    _detachComponent(component, impactPoint, impactDirection, vehicleVelocity) {
        if (!component.isAttached || !component.mesh) {
            return { detached: false, component };
        }
        
        // Mark as detached
        component.isAttached = false;
        
        // Get world position and rotation before detaching
        const worldPosition = new THREE.Vector3();
        const worldQuaternion = new THREE.Quaternion();
        component.mesh.getWorldPosition(worldPosition);
        component.mesh.getWorldQuaternion(worldQuaternion);
        
        // Remove from parent (vehicle)
        const parent = component.mesh.parent;
        if (parent) {
            parent.remove(component.mesh);
        }
        
        // Add to scene as independent object
        this.scene.add(component.mesh);
        component.mesh.position.copy(worldPosition);
        component.mesh.quaternion.copy(worldQuaternion);
        
        // Create detached component physics object
        const detached = this.detachedPool.acquire();
        detached.mesh = component.mesh;
        detached.position.copy(worldPosition);
        detached.mass = component.mass;
        detached.lifetime = this.componentLifetime;
        detached.isOnGround = false;
        detached.bounceCount = 0;
        detached.typeProps = component.typeProps;
        detached.componentType = component.type;
        detached.rotation.setFromQuaternion(worldQuaternion);
        detached.groundY = 0;
        
        // Calculate initial velocity
        // Inherit vehicle velocity plus impact force
        const impactVelocity = impactDirection.clone().multiplyScalar(
            component.currentForce / component.mass * 0.001
        );
        
        if (vehicleVelocity) {
            detached.velocity.copy(vehicleVelocity).add(impactVelocity);
        } else {
            detached.velocity.copy(impactVelocity);
        }
        
        // Add some upward velocity for dramatic effect
        detached.velocity.y += Math.random() * 3 + 2;
        
        // Calculate angular velocity based on offset from impact point
        const offset = worldPosition.clone().sub(impactPoint);
        detached.angularVelocity.set(
            (Math.random() - 0.5) * 10 + offset.z * 2,
            (Math.random() - 0.5) * 5,
            (Math.random() - 0.5) * 10 - offset.x * 2
        );
        
        // Limit to max detached components
        if (this.detachedComponents.length >= this.maxDetachedComponents) {
            const oldest = this.detachedComponents.shift();
            this._cleanupDetachedComponent(oldest);
        }
        
        this.detachedComponents.push(detached);
        
        // Update statistics
        this.stats.totalDetachments++;
        this.stats.componentsByType[component.type] = 
            (this.stats.componentsByType[component.type] || 0) + 1;
        this._updateAverageDetachForce(component.currentForce);
        
        // Fire callback
        if (this.onDetach) {
            this.onDetach(component, detached);
        }
        
        return { 
            detached: true, 
            component, 
            detachedPhysics: detached,
            force: component.currentForce
        };
    }
    
    /**
     * Updates the visual appearance of a damaged component
     * @private
     * @param {ComponentConfig} component - Component to update
     */
    _updateComponentDamageVisual(component) {
        if (!component.mesh || !component.mesh.material) return;
        
        const damageRatio = component.damage / 100;
        
        // Darken and roughen material based on damage
        if (component.mesh.material.color) {
            const originalColor = component.originalMaterial.color;
            const darkenFactor = 1 - damageRatio * 0.5;
            
            component.mesh.material.color.setRGB(
                originalColor.r * darkenFactor,
                originalColor.g * darkenFactor,
                originalColor.b * darkenFactor
            );
        }
        
        if (component.mesh.material.roughness !== undefined) {
            component.mesh.material.roughness = Math.min(
                1, 
                (component.originalMaterial.roughness || 0.5) + damageRatio * 0.3
            );
        }
    }
    
    /**
     * Updates average detach force statistic
     * @private
     * @param {number} force - Force that caused detachment
     */
    _updateAverageDetachForce(force) {
        const n = this.stats.totalDetachments;
        this.stats.averageDetachForce = 
            (this.stats.averageDetachForce * (n - 1) + force) / n;
    }
    
    /**
     * Updates all detached components physics
     * @param {number} deltaTime - Time step in seconds
     */
    update(deltaTime) {
        const gravity = PHYSICS_CONSTANTS?.GRAVITY || 9.81;
        
        for (let i = this.detachedComponents.length - 1; i >= 0; i--) {
            const detached = this.detachedComponents[i];
            
            // Update lifetime
            detached.lifetime -= deltaTime;
            if (detached.lifetime <= 0) {
                this._cleanupDetachedComponent(detached);
                this.detachedComponents.splice(i, 1);
                continue;
            }
            
            if (!detached.isOnGround) {
                // Apply gravity
                detached.velocity.y -= gravity * deltaTime;
                
                // Apply air resistance
                const dragCoeff = detached.typeProps?.dragCoefficient || 0.5;
                const speed = detached.velocity.length();
                if (speed > 0.1) {
                    const dragForce = 0.5 * 1.225 * dragCoeff * speed * speed;
                    const dragAccel = dragForce / detached.mass;
                    const dragVec = detached.velocity.clone().normalize().multiplyScalar(-dragAccel * deltaTime);
                    detached.velocity.add(dragVec);
                }
                
                // Update position
                detached.position.addScaledVector(detached.velocity, deltaTime);
                
                // Update rotation
                detached.rotation.x += detached.angularVelocity.x * deltaTime;
                detached.rotation.y += detached.angularVelocity.y * deltaTime;
                detached.rotation.z += detached.angularVelocity.z * deltaTime;
                
                // Check for ground collision
                if (detached.position.y <= detached.groundY) {
                    detached.position.y = detached.groundY;
                    detached.bounceCount++;
                    
                    const restitution = detached.typeProps?.bounceRestitution || 0.3;
                    
                    if (detached.bounceCount <= detached.maxBounces && 
                        Math.abs(detached.velocity.y) > 0.5) {
                        // Bounce
                        detached.velocity.y *= -restitution;
                        detached.velocity.x *= 1 - (detached.typeProps?.friction || 0.5);
                        detached.velocity.z *= 1 - (detached.typeProps?.friction || 0.5);
                        
                        // Reduce angular velocity
                        detached.angularVelocity.multiplyScalar(0.6);
                        
                        // Fire land callback
                        if (this.onLand) {
                            this.onLand(detached, detached.bounceCount);
                        }
                    } else {
                        // Come to rest
                        detached.isOnGround = true;
                        detached.velocity.set(0, 0, 0);
                        detached.angularVelocity.set(0, 0, 0);
                    }
                }
            } else {
                // Slide friction when on ground
                if (detached.velocity.lengthSq() > 0.01) {
                    const friction = detached.typeProps?.friction || 0.5;
                    detached.velocity.multiplyScalar(1 - friction * deltaTime * 10);
                    detached.position.addScaledVector(detached.velocity, deltaTime);
                }
            }
            
            // Update mesh transform
            if (detached.mesh) {
                detached.mesh.position.copy(detached.position);
                detached.mesh.rotation.copy(detached.rotation);
                
                // Fade out near end of lifetime
                if (detached.lifetime < 5 && detached.mesh.material.opacity !== undefined) {
                    detached.mesh.material.opacity = detached.lifetime / 5;
                    detached.mesh.material.transparent = true;
                }
            }
        }
    }
    
    /**
     * Cleans up a detached component
     * @private
     * @param {DetachedComponent} detached - Component to cleanup
     */
    _cleanupDetachedComponent(detached) {
        if (detached.mesh) {
            this.scene.remove(detached.mesh);
            
            // Dispose geometry and material
            if (detached.mesh.geometry) {
                detached.mesh.geometry.dispose();
            }
            if (detached.mesh.material) {
                if (Array.isArray(detached.mesh.material)) {
                    detached.mesh.material.forEach(m => m.dispose());
                } else {
                    detached.mesh.material.dispose();
                }
            }
            detached.mesh = null;
        }
        
        // Return to pool
        this.detachedPool.release(detached);
    }
    
    /**
     * Forces detachment of a specific component
     * @param {string} componentId - Component identifier
     * @param {THREE.Vector3} velocity - Initial velocity for detached component
     * @returns {Object} Detachment result
     */
    forceDetach(componentId, velocity = null) {
        const component = this.components.get(componentId);
        if (!component || !component.isAttached) {
            return { detached: false };
        }
        
        const impactPoint = component.position.clone();
        const impactDirection = velocity ? velocity.clone().normalize() : new THREE.Vector3(0, 1, 0);
        
        return this._detachComponent(component, impactPoint, impactDirection, velocity);
    }
    
    /**
     * Checks if a component is attached
     * @param {string} componentId - Component identifier
     * @returns {boolean} True if attached
     */
    isAttached(componentId) {
        const component = this.components.get(componentId);
        return component ? component.isAttached : false;
    }
    
    /**
     * Gets the damage level of a component
     * @param {string} componentId - Component identifier
     * @returns {number} Damage level 0-100
     */
    getComponentDamage(componentId) {
        const component = this.components.get(componentId);
        return component ? component.damage : 0;
    }
    
    /**
     * Gets all attached components
     * @returns {ComponentConfig[]} Array of attached components
     */
    getAttachedComponents() {
        const attached = [];
        for (const component of this.components.values()) {
            if (component.isAttached) {
                attached.push(component);
            }
        }
        return attached;
    }
    
    /**
     * Gets all detached components
     * @returns {DetachedComponent[]} Array of detached components
     */
    getDetachedComponents() {
        return [...this.detachedComponents];
    }
    
    /**
     * Gets components in a specific damage zone
     * @param {string} zone - Damage zone name
     * @returns {ComponentConfig[]} Components in zone
     */
    getZoneComponents(zone) {
        const types = this.damageZones[zone];
        if (!types) return [];
        
        const components = [];
        for (const component of this.components.values()) {
            if (types.includes(component.type)) {
                components.push(component);
            }
        }
        return components;
    }
    
    /**
     * Gets total damage percentage across all components
     * @returns {number} Average damage 0-100
     */
    getTotalDamage() {
        let total = 0;
        let count = 0;
        
        for (const component of this.components.values()) {
            // Count detached as 100% damage
            total += component.isAttached ? component.damage : 100;
            count++;
        }
        
        return count > 0 ? total / count : 0;
    }
    
    /**
     * Gets damage breakdown by zone
     * @returns {Object} Damage by zone
     */
    getZoneDamage() {
        const zoneDamage = {};
        
        for (const [zone, types] of Object.entries(this.damageZones)) {
            let total = 0;
            let count = 0;
            
            for (const component of this.components.values()) {
                if (types.includes(component.type)) {
                    total += component.isAttached ? component.damage : 100;
                    count++;
                }
            }
            
            zoneDamage[zone] = count > 0 ? total / count : 0;
        }
        
        return zoneDamage;
    }
    
    /**
     * Resets all components to attached state
     */
    reset() {
        // Cleanup detached components
        for (const detached of this.detachedComponents) {
            this._cleanupDetachedComponent(detached);
        }
        this.detachedComponents = [];
        
        // Reset registered components
        for (const component of this.components.values()) {
            component.isAttached = true;
            component.damage = 0;
            component.currentForce = 0;
            component.hingeStrength = 1.0;
            component.weakened = false;
            component.impactHistory = [];
            
            // Reset material
            if (component.mesh && component.originalMaterial) {
                component.mesh.material = component.originalMaterial.clone();
            }
        }
        
        // Reset stats
        this.stats.totalDetachments = 0;
        this.stats.maxForceRecorded = 0;
        this.stats.averageDetachForce = 0;
        this._initializeStats();
    }
    
    /**
     * Gets system statistics
     * @returns {Object} Statistics object
     */
    getStats() {
        return {
            ...this.stats,
            attachedCount: this.getAttachedComponents().length,
            detachedCount: this.detachedComponents.length,
            totalDamage: this.getTotalDamage()
        };
    }
    
    /**
     * Cleans up all resources
     */
    dispose() {
        for (const detached of this.detachedComponents) {
            this._cleanupDetachedComponent(detached);
        }
        this.detachedComponents = [];
        this.components.clear();
        this.detachedPool.clear();
    }
}

export default ComponentDetachment;
