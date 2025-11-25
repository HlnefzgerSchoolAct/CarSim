/**
 * ObjectPool.js - Generic Object Pooling System
 * 
 * Provides efficient object pooling for frequently created and destroyed objects
 * such as particles, projectiles, and temporary calculations.
 * 
 * @module utils/ObjectPool
 * @author CarSim Development Team
 * @version 2.0.0
 */

/**
 * @class ObjectPool
 * @description Generic object pool for reusing objects to reduce garbage collection
 * @template T
 */
export class ObjectPool {
    /**
     * Creates a new ObjectPool
     * @param {Function} factory - Factory function to create new objects
     * @param {Function} [reset] - Function to reset an object before reuse
     * @param {number} [initialSize=0] - Initial pool size
     * @param {number} [maxSize=1000] - Maximum pool size
     */
    constructor(factory, reset = null, initialSize = 0, maxSize = 1000) {
        /** @type {Function} Factory function for creating objects */
        this.factory = factory;
        
        /** @type {Function|null} Reset function for recycling objects */
        this.reset = reset;
        
        /** @type {number} Maximum pool size */
        this.maxSize = maxSize;
        
        /** @type {Array<T>} Pool of available objects */
        this.pool = [];
        
        /** @type {number} Total objects created */
        this.totalCreated = 0;
        
        /** @type {number} Total objects acquired */
        this.totalAcquired = 0;
        
        /** @type {number} Total objects released */
        this.totalReleased = 0;
        
        /** @type {number} Peak pool size reached */
        this.peakSize = 0;
        
        // Pre-populate pool
        this.prewarm(initialSize);
    }

    /**
     * Pre-populate the pool with objects
     * @param {number} count - Number of objects to create
     */
    prewarm(count) {
        for (let i = 0; i < count && this.pool.length < this.maxSize; i++) {
            const obj = this.factory();
            this.pool.push(obj);
            this.totalCreated++;
        }
        this.updatePeakSize();
    }

    /**
     * Acquire an object from the pool
     * @returns {T} An object from the pool or a new object
     */
    acquire() {
        this.totalAcquired++;
        
        if (this.pool.length > 0) {
            return this.pool.pop();
        }
        
        this.totalCreated++;
        return this.factory();
    }

    /**
     * Release an object back to the pool
     * @param {T} obj - Object to release
     * @returns {boolean} True if object was added to pool
     */
    release(obj) {
        if (obj === null || obj === undefined) {
            return false;
        }
        
        if (this.pool.length >= this.maxSize) {
            return false;
        }
        
        if (this.reset) {
            this.reset(obj);
        }
        
        this.pool.push(obj);
        this.totalReleased++;
        this.updatePeakSize();
        
        return true;
    }

    /**
     * Release multiple objects at once
     * @param {Array<T>} objects - Array of objects to release
     */
    releaseAll(objects) {
        for (const obj of objects) {
            this.release(obj);
        }
    }

    /**
     * Clear all objects from the pool
     */
    clear() {
        this.pool.length = 0;
    }

    /**
     * Update peak size tracking
     * @private
     */
    updatePeakSize() {
        if (this.pool.length > this.peakSize) {
            this.peakSize = this.pool.length;
        }
    }

    /**
     * Get current pool statistics
     * @returns {Object} Pool statistics
     */
    getStats() {
        return {
            available: this.pool.length,
            totalCreated: this.totalCreated,
            totalAcquired: this.totalAcquired,
            totalReleased: this.totalReleased,
            peakSize: this.peakSize,
            maxSize: this.maxSize,
            hitRate: this.totalAcquired > 0 
                ? (this.totalReleased / this.totalAcquired) * 100 
                : 0
        };
    }

    /**
     * Get current available count
     * @returns {number} Number of available objects
     */
    get available() {
        return this.pool.length;
    }
}

/**
 * @class Vector3Pool
 * @description Specialized pool for Three.js Vector3 objects
 */
export class Vector3Pool extends ObjectPool {
    /**
     * Creates a Vector3Pool
     * @param {number} [initialSize=50] - Initial pool size
     */
    constructor(initialSize = 50) {
        super(
            () => new THREE.Vector3(),
            (v) => v.set(0, 0, 0),
            initialSize,
            500
        );
    }

    /**
     * Acquire a vector and optionally set its values
     * @param {number} [x=0] - X component
     * @param {number} [y=0] - Y component
     * @param {number} [z=0] - Z component
     * @returns {THREE.Vector3} Vector from pool
     */
    acquire(x = 0, y = 0, z = 0) {
        const v = super.acquire();
        v.set(x, y, z);
        return v;
    }
}

/**
 * @class QuaternionPool
 * @description Specialized pool for Three.js Quaternion objects
 */
export class QuaternionPool extends ObjectPool {
    /**
     * Creates a QuaternionPool
     * @param {number} [initialSize=20] - Initial pool size
     */
    constructor(initialSize = 20) {
        super(
            () => new THREE.Quaternion(),
            (q) => q.set(0, 0, 0, 1),
            initialSize,
            200
        );
    }

    /**
     * Acquire a quaternion and optionally set its values
     * @param {number} [x=0] - X component
     * @param {number} [y=0] - Y component
     * @param {number} [z=0] - Z component
     * @param {number} [w=1] - W component
     * @returns {THREE.Quaternion} Quaternion from pool
     */
    acquire(x = 0, y = 0, z = 0, w = 1) {
        const q = super.acquire();
        q.set(x, y, z, w);
        return q;
    }
}

/**
 * @class Matrix4Pool
 * @description Specialized pool for Three.js Matrix4 objects
 */
export class Matrix4Pool extends ObjectPool {
    /**
     * Creates a Matrix4Pool
     * @param {number} [initialSize=10] - Initial pool size
     */
    constructor(initialSize = 10) {
        super(
            () => new THREE.Matrix4(),
            (m) => m.identity(),
            initialSize,
            100
        );
    }
}

/**
 * @class ParticlePool
 * @description Specialized pool for particle objects
 */
export class ParticlePool extends ObjectPool {
    /**
     * Creates a ParticlePool
     * @param {number} [initialSize=100] - Initial pool size
     * @param {number} [maxSize=1000] - Maximum pool size
     */
    constructor(initialSize = 100, maxSize = 1000) {
        super(
            () => ({
                position: new THREE.Vector3(),
                velocity: new THREE.Vector3(),
                acceleration: new THREE.Vector3(),
                color: new THREE.Color(),
                size: 1,
                life: 0,
                maxLife: 1,
                alpha: 1,
                rotation: 0,
                rotationSpeed: 0,
                mesh: null,
                active: false,
                userData: {}
            }),
            (p) => {
                p.position.set(0, 0, 0);
                p.velocity.set(0, 0, 0);
                p.acceleration.set(0, 0, 0);
                p.color.setHex(0xffffff);
                p.size = 1;
                p.life = 0;
                p.maxLife = 1;
                p.alpha = 1;
                p.rotation = 0;
                p.rotationSpeed = 0;
                p.active = false;
                p.userData = {};
            },
            initialSize,
            maxSize
        );
    }
}

/**
 * @class CollisionResultPool
 * @description Specialized pool for collision result objects
 */
export class CollisionResultPool extends ObjectPool {
    /**
     * Creates a CollisionResultPool
     * @param {number} [initialSize=20] - Initial pool size
     */
    constructor(initialSize = 20) {
        super(
            () => ({
                collided: false,
                point: new THREE.Vector3(),
                normal: new THREE.Vector3(),
                depth: 0,
                objectA: null,
                objectB: null,
                impulse: 0,
                relativeVelocity: new THREE.Vector3(),
                contactPoints: []
            }),
            (r) => {
                r.collided = false;
                r.point.set(0, 0, 0);
                r.normal.set(0, 0, 0);
                r.depth = 0;
                r.objectA = null;
                r.objectB = null;
                r.impulse = 0;
                r.relativeVelocity.set(0, 0, 0);
                r.contactPoints.length = 0;
            },
            initialSize,
            100
        );
    }
}

/**
 * @class RaycastResultPool
 * @description Specialized pool for raycast result objects
 */
export class RaycastResultPool extends ObjectPool {
    /**
     * Creates a RaycastResultPool
     * @param {number} [initialSize=10] - Initial pool size
     */
    constructor(initialSize = 10) {
        super(
            () => ({
                hit: false,
                point: new THREE.Vector3(),
                normal: new THREE.Vector3(),
                distance: 0,
                object: null,
                face: null,
                faceIndex: -1,
                uv: new THREE.Vector2()
            }),
            (r) => {
                r.hit = false;
                r.point.set(0, 0, 0);
                r.normal.set(0, 0, 0);
                r.distance = 0;
                r.object = null;
                r.face = null;
                r.faceIndex = -1;
                r.uv.set(0, 0);
            },
            initialSize,
            50
        );
    }
}

/**
 * @class WheelStatePool
 * @description Specialized pool for wheel state objects
 */
export class WheelStatePool extends ObjectPool {
    /**
     * Creates a WheelStatePool
     * @param {number} [initialSize=8] - Initial pool size (typically 4-8 wheels)
     */
    constructor(initialSize = 8) {
        super(
            () => ({
                position: new THREE.Vector3(),
                rotation: new THREE.Quaternion(),
                angularVelocity: 0,
                slipRatio: 0,
                slipAngle: 0,
                load: 0,
                lateralForce: 0,
                longitudinalForce: 0,
                suspensionCompression: 0,
                suspensionVelocity: 0,
                temperature: 20,
                wear: 0,
                onGround: false,
                surfaceType: 'asphalt',
                contactPoint: new THREE.Vector3(),
                contactNormal: new THREE.Vector3()
            }),
            (w) => {
                w.position.set(0, 0, 0);
                w.rotation.set(0, 0, 0, 1);
                w.angularVelocity = 0;
                w.slipRatio = 0;
                w.slipAngle = 0;
                w.load = 0;
                w.lateralForce = 0;
                w.longitudinalForce = 0;
                w.suspensionCompression = 0;
                w.suspensionVelocity = 0;
                w.temperature = 20;
                w.wear = 0;
                w.onGround = false;
                w.surfaceType = 'asphalt';
                w.contactPoint.set(0, 0, 0);
                w.contactNormal.set(0, 1, 0);
            },
            initialSize,
            32
        );
    }
}

/**
 * @class PoolManager
 * @description Manages multiple object pools and provides global access
 */
export class PoolManager {
    /**
     * Creates a PoolManager
     */
    constructor() {
        /** @type {Map<string, ObjectPool>} Map of named pools */
        this.pools = new Map();
        
        /** @type {boolean} Enable statistics tracking */
        this.trackStats = true;
        
        this.initializeDefaultPools();
    }

    /**
     * Initialize default pools commonly used in the simulation
     * @private
     */
    initializeDefaultPools() {
        // These will be initialized when THREE is available
        this.registerPool('vector3', null);
        this.registerPool('quaternion', null);
        this.registerPool('matrix4', null);
        this.registerPool('particle', null);
        this.registerPool('collision', null);
        this.registerPool('raycast', null);
        this.registerPool('wheelState', null);
    }

    /**
     * Initialize Three.js dependent pools
     * Call this after THREE is available
     */
    initializeThreePools() {
        if (typeof THREE !== 'undefined') {
            this.pools.set('vector3', new Vector3Pool(100));
            this.pools.set('quaternion', new QuaternionPool(30));
            this.pools.set('matrix4', new Matrix4Pool(20));
            this.pools.set('particle', new ParticlePool(200, 2000));
            this.pools.set('collision', new CollisionResultPool(30));
            this.pools.set('raycast', new RaycastResultPool(20));
            this.pools.set('wheelState', new WheelStatePool(16));
        }
    }

    /**
     * Register a custom pool
     * @param {string} name - Pool name
     * @param {ObjectPool} pool - Pool instance
     */
    registerPool(name, pool) {
        this.pools.set(name, pool);
    }

    /**
     * Get a pool by name
     * @param {string} name - Pool name
     * @returns {ObjectPool|undefined} The pool or undefined
     */
    getPool(name) {
        return this.pools.get(name);
    }

    /**
     * Acquire an object from a named pool
     * @param {string} poolName - Pool name
     * @param {...*} args - Arguments to pass to acquire
     * @returns {*} Object from pool
     */
    acquire(poolName, ...args) {
        const pool = this.pools.get(poolName);
        if (!pool) {
            console.warn(`Pool '${poolName}' not found`);
            return null;
        }
        return pool.acquire(...args);
    }

    /**
     * Release an object to a named pool
     * @param {string} poolName - Pool name
     * @param {*} obj - Object to release
     * @returns {boolean} True if released
     */
    release(poolName, obj) {
        const pool = this.pools.get(poolName);
        if (!pool) {
            console.warn(`Pool '${poolName}' not found`);
            return false;
        }
        return pool.release(obj);
    }

    /**
     * Get statistics for all pools
     * @returns {Object} Statistics for each pool
     */
    getAllStats() {
        const stats = {};
        for (const [name, pool] of this.pools) {
            if (pool) {
                stats[name] = pool.getStats();
            }
        }
        return stats;
    }

    /**
     * Clear all pools
     */
    clearAll() {
        for (const pool of this.pools.values()) {
            if (pool) {
                pool.clear();
            }
        }
    }

    /**
     * Log pool statistics to console
     */
    logStats() {
        console.group('Object Pool Statistics');
        for (const [name, pool] of this.pools) {
            if (pool) {
                const stats = pool.getStats();
                console.log(`${name}: available=${stats.available}, created=${stats.totalCreated}, hitRate=${stats.hitRate.toFixed(1)}%`);
            }
        }
        console.groupEnd();
    }
}

/**
 * @class TypedArrayPool
 * @description Pool for typed arrays (Float32Array, Int32Array, etc.)
 */
export class TypedArrayPool {
    /**
     * Creates a TypedArrayPool
     * @param {Function} ArrayType - Typed array constructor
     * @param {number} [maxPoolsPerSize=10] - Max pools per array size
     */
    constructor(ArrayType, maxPoolsPerSize = 10) {
        /** @type {Function} Typed array constructor */
        this.ArrayType = ArrayType;
        
        /** @type {number} Max pools per size */
        this.maxPoolsPerSize = maxPoolsPerSize;
        
        /** @type {Map<number, Array>} Pools organized by size */
        this.pools = new Map();
    }

    /**
     * Acquire a typed array of specified length
     * @param {number} length - Array length
     * @returns {TypedArray} Typed array from pool or new
     */
    acquire(length) {
        let pool = this.pools.get(length);
        
        if (pool && pool.length > 0) {
            return pool.pop();
        }
        
        return new this.ArrayType(length);
    }

    /**
     * Release a typed array back to pool
     * @param {TypedArray} array - Array to release
     * @returns {boolean} True if released
     */
    release(array) {
        if (!array || array.length === 0) return false;
        
        let pool = this.pools.get(array.length);
        
        if (!pool) {
            pool = [];
            this.pools.set(array.length, pool);
        }
        
        if (pool.length >= this.maxPoolsPerSize) {
            return false;
        }
        
        // Zero out the array
        array.fill(0);
        pool.push(array);
        return true;
    }

    /**
     * Clear all pools
     */
    clear() {
        this.pools.clear();
    }
}

// Create and export singleton instance
export const poolManager = new PoolManager();

// Export individual pool classes and manager
export default {
    ObjectPool,
    Vector3Pool,
    QuaternionPool,
    Matrix4Pool,
    ParticlePool,
    CollisionResultPool,
    RaycastResultPool,
    WheelStatePool,
    TypedArrayPool,
    PoolManager,
    poolManager
};
