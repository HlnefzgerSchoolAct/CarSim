/**
 * PerformanceUtils.js
 * Performance optimization utilities including object pooling and LOD management
 */

/**
 * Object pool for reusing objects to reduce garbage collection
 */
class ObjectPool {
    /**
     * Create an object pool
     * @param {Function} factory - Function that creates new objects
     * @param {Function} reset - Function to reset object state (optional)
     * @param {number} initialSize - Initial pool size
     */
    constructor(factory, reset = null, initialSize = 10) {
        this.factory = factory;
        this.reset = reset;
        this.available = [];
        this.inUse = new Set();
        
        // Pre-allocate initial objects
        for (let i = 0; i < initialSize; i++) {
            this.available.push(this.factory());
        }
    }

    /**
     * Get an object from the pool
     * @returns {*}
     */
    acquire() {
        let obj;
        
        if (this.available.length > 0) {
            obj = this.available.pop();
        } else {
            obj = this.factory();
        }
        
        this.inUse.add(obj);
        return obj;
    }

    /**
     * Return an object to the pool
     * @param {*} obj 
     */
    release(obj) {
        if (!this.inUse.has(obj)) {
            console.warn('Attempting to release object not acquired from pool');
            return;
        }
        
        this.inUse.delete(obj);
        
        // Reset object state if reset function provided
        if (this.reset) {
            this.reset(obj);
        }
        
        this.available.push(obj);
    }

    /**
     * Release all objects back to pool
     */
    releaseAll() {
        this.inUse.forEach(obj => {
            if (this.reset) {
                this.reset(obj);
            }
            this.available.push(obj);
        });
        this.inUse.clear();
    }

    /**
     * Get pool statistics
     * @returns {Object}
     */
    getStats() {
        return {
            available: this.available.length,
            inUse: this.inUse.size,
            total: this.available.length + this.inUse.size
        };
    }

    /**
     * Prune pool to reduce memory usage
     * @param {number} targetSize - Desired pool size
     */
    prune(targetSize) {
        while (this.available.length > targetSize) {
            this.available.pop();
        }
    }
}

/**
 * Particle pool specifically for particle systems
 */
class ParticlePool {
    /**
     * Create particle pool
     * @param {number} maxParticles - Maximum number of particles
     */
    constructor(maxParticles = 1000) {
        this.maxParticles = maxParticles;
        this.particles = [];
        this.activeCount = 0;
        
        // Pre-allocate particles
        for (let i = 0; i < maxParticles; i++) {
            this.particles.push({
                position: new Float32Array(3),
                velocity: new Float32Array(3),
                color: new Float32Array(4),
                size: 1.0,
                life: 0,
                maxLife: 1.0,
                active: false,
                userData: {}
            });
        }
    }

    /**
     * Spawn a new particle
     * @param {Object} config - Particle configuration
     * @returns {Object|null} - Particle object or null if pool is full
     */
    spawn(config) {
        if (this.activeCount >= this.maxParticles) {
            return null;
        }
        
        // Find first inactive particle
        for (let i = 0; i < this.maxParticles; i++) {
            const p = this.particles[i];
            if (!p.active) {
                // Initialize particle
                p.active = true;
                p.life = config.life || 1.0;
                p.maxLife = p.life;
                p.size = config.size || 1.0;
                
                // Set position
                if (config.position) {
                    p.position[0] = config.position[0] || 0;
                    p.position[1] = config.position[1] || 0;
                    p.position[2] = config.position[2] || 0;
                }
                
                // Set velocity
                if (config.velocity) {
                    p.velocity[0] = config.velocity[0] || 0;
                    p.velocity[1] = config.velocity[1] || 0;
                    p.velocity[2] = config.velocity[2] || 0;
                }
                
                // Set color
                if (config.color) {
                    p.color[0] = config.color[0] || 1;
                    p.color[1] = config.color[1] || 1;
                    p.color[2] = config.color[2] || 1;
                    p.color[3] = config.color[3] || 1;
                }
                
                // User data
                if (config.userData) {
                    Object.assign(p.userData, config.userData);
                }
                
                this.activeCount++;
                return p;
            }
        }
        
        return null;
    }

    /**
     * Kill a particle
     * @param {Object} particle 
     */
    kill(particle) {
        if (particle.active) {
            particle.active = false;
            this.activeCount--;
        }
    }

    /**
     * Update all active particles
     * @param {number} deltaTime 
     * @param {Function} updateFn - Custom update function
     */
    update(deltaTime, updateFn = null) {
        for (let i = 0; i < this.maxParticles; i++) {
            const p = this.particles[i];
            if (!p.active) continue;
            
            // Update life
            p.life -= deltaTime;
            if (p.life <= 0) {
                this.kill(p);
                continue;
            }
            
            // Default physics update
            p.position[0] += p.velocity[0] * deltaTime;
            p.position[1] += p.velocity[1] * deltaTime;
            p.position[2] += p.velocity[2] * deltaTime;
            
            // Custom update
            if (updateFn) {
                updateFn(p, deltaTime);
            }
        }
    }

    /**
     * Get all active particles
     * @returns {Array}
     */
    getActive() {
        return this.particles.filter(p => p.active);
    }

    /**
     * Clear all particles
     */
    clear() {
        for (let i = 0; i < this.maxParticles; i++) {
            this.particles[i].active = false;
        }
        this.activeCount = 0;
    }

    /**
     * Get pool statistics
     * @returns {Object}
     */
    getStats() {
        return {
            active: this.activeCount,
            available: this.maxParticles - this.activeCount,
            total: this.maxParticles
        };
    }
}

/**
 * Level of Detail (LOD) manager
 */
class LODManager {
    /**
     * Create LOD manager
     * @param {Object} camera - Camera object with position
     */
    constructor(camera) {
        this.camera = camera;
        this.objects = [];
        this.lodLevels = [
            { distance: 10, level: 0 },   // High detail
            { distance: 30, level: 1 },   // Medium detail
            { distance: 100, level: 2 },  // Low detail
            { distance: Infinity, level: 3 } // Very low/culled
        ];
    }

    /**
     * Register object for LOD management
     * @param {Object} obj - Object with position and lodLevels array
     */
    register(obj) {
        if (!obj.position || !obj.lodLevels) {
            console.warn('Object must have position and lodLevels properties');
            return;
        }
        this.objects.push(obj);
    }

    /**
     * Unregister object
     * @param {Object} obj 
     */
    unregister(obj) {
        const index = this.objects.indexOf(obj);
        if (index !== -1) {
            this.objects.splice(index, 1);
        }
    }

    /**
     * Update LOD levels for all objects
     */
    update() {
        for (const obj of this.objects) {
            const distance = this.getDistance(obj.position);
            const level = this.getLODLevel(distance);
            
            if (obj.currentLOD !== level) {
                obj.currentLOD = level;
                this.updateObjectLOD(obj, level);
            }
        }
    }

    /**
     * Get distance from camera to position
     * @param {Object} position 
     * @returns {number}
     */
    getDistance(position) {
        const dx = position.x - this.camera.position.x;
        const dy = position.y - this.camera.position.y;
        const dz = position.z - this.camera.position.z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    /**
     * Get LOD level for distance
     * @param {number} distance 
     * @returns {number}
     */
    getLODLevel(distance) {
        for (const lod of this.lodLevels) {
            if (distance < lod.distance) {
                return lod.level;
            }
        }
        return this.lodLevels[this.lodLevels.length - 1].level;
    }

    /**
     * Update object LOD visibility
     * @param {Object} obj 
     * @param {number} level 
     */
    updateObjectLOD(obj, level) {
        // Show/hide appropriate LOD level
        obj.lodLevels.forEach((lodObj, index) => {
            if (lodObj && lodObj.visible !== undefined) {
                lodObj.visible = (index === level);
            }
        });
        
        // Call custom update if provided
        if (obj.onLODChange) {
            obj.onLODChange(level);
        }
    }

    /**
     * Set custom LOD distances
     * @param {Array} levels - Array of {distance, level} objects
     */
    setLODLevels(levels) {
        this.lodLevels = levels;
    }
}

/**
 * Frame rate limiter and deltaTime smoother
 */
class FrameRateLimiter {
    constructor(targetFPS = 60) {
        this.targetFPS = targetFPS;
        this.targetFrameTime = 1000 / targetFPS;
        this.lastFrameTime = 0;
        this.deltaTimeHistory = [];
        this.historySize = 10;
    }

    /**
     * Check if frame should be rendered
     * @param {number} currentTime 
     * @returns {boolean}
     */
    shouldRender(currentTime) {
        const elapsed = currentTime - this.lastFrameTime;
        if (elapsed >= this.targetFrameTime) {
            this.lastFrameTime = currentTime;
            return true;
        }
        return false;
    }

    /**
     * Get smoothed delta time
     * @param {number} rawDelta 
     * @returns {number}
     */
    getSmoothDelta(rawDelta) {
        this.deltaTimeHistory.push(rawDelta);
        if (this.deltaTimeHistory.length > this.historySize) {
            this.deltaTimeHistory.shift();
        }
        
        // Return average
        const sum = this.deltaTimeHistory.reduce((a, b) => a + b, 0);
        return sum / this.deltaTimeHistory.length;
    }

    /**
     * Reset limiter
     */
    reset() {
        this.lastFrameTime = 0;
        this.deltaTimeHistory = [];
    }
}

/**
 * Memory monitor for tracking allocations
 */
class MemoryMonitor {
    constructor() {
        this.samples = [];
        this.maxSamples = 100;
        this.enabled = typeof performance !== 'undefined' && performance.memory;
    }

    /**
     * Take a memory sample
     */
    sample() {
        if (!this.enabled) return;
        
        this.samples.push({
            timestamp: Date.now(),
            usedJSHeapSize: performance.memory.usedJSHeapSize,
            totalJSHeapSize: performance.memory.totalJSHeapSize,
            jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
        });
        
        if (this.samples.length > this.maxSamples) {
            this.samples.shift();
        }
    }

    /**
     * Get memory statistics
     * @returns {Object}
     */
    getStats() {
        if (!this.enabled || this.samples.length === 0) {
            return null;
        }
        
        const latest = this.samples[this.samples.length - 1];
        const oldest = this.samples[0];
        
        return {
            current: latest.usedJSHeapSize,
            total: latest.totalJSHeapSize,
            limit: latest.jsHeapSizeLimit,
            percentUsed: (latest.usedJSHeapSize / latest.jsHeapSizeLimit) * 100,
            growth: latest.usedJSHeapSize - oldest.usedJSHeapSize,
            growthRate: (latest.usedJSHeapSize - oldest.usedJSHeapSize) / 
                       (latest.timestamp - oldest.timestamp) * 1000 // bytes per second
        };
    }

    /**
     * Check if memory usage is high
     * @param {number} threshold - Percentage threshold (0-100)
     * @returns {boolean}
     */
    isMemoryHigh(threshold = 80) {
        const stats = this.getStats();
        return stats ? stats.percentUsed > threshold : false;
    }
}

/**
 * Performance profiler for tracking execution time
 */
class Profiler {
    constructor() {
        this.marks = new Map();
        this.measurements = new Map();
    }

    /**
     * Start timing a section
     * @param {string} name 
     */
    start(name) {
        this.marks.set(name, performance.now());
    }

    /**
     * End timing a section
     * @param {string} name 
     * @returns {number} - Elapsed time in ms
     */
    end(name) {
        const startTime = this.marks.get(name);
        if (startTime === undefined) {
            console.warn(`No start mark for ${name}`);
            return 0;
        }
        
        const elapsed = performance.now() - startTime;
        this.marks.delete(name);
        
        // Store measurement
        if (!this.measurements.has(name)) {
            this.measurements.set(name, []);
        }
        const measurements = this.measurements.get(name);
        measurements.push(elapsed);
        
        // Keep only recent measurements
        if (measurements.length > 100) {
            measurements.shift();
        }
        
        return elapsed;
    }

    /**
     * Get average time for a measurement
     * @param {string} name 
     * @returns {number}
     */
    getAverage(name) {
        const measurements = this.measurements.get(name);
        if (!measurements || measurements.length === 0) {
            return 0;
        }
        
        const sum = measurements.reduce((a, b) => a + b, 0);
        return sum / measurements.length;
    }

    /**
     * Get all measurements
     * @returns {Object}
     */
    getAllStats() {
        const stats = {};
        for (const [name, measurements] of this.measurements.entries()) {
            if (measurements.length > 0) {
                const sum = measurements.reduce((a, b) => a + b, 0);
                const avg = sum / measurements.length;
                const max = Math.max(...measurements);
                const min = Math.min(...measurements);
                
                stats[name] = { avg, max, min, samples: measurements.length };
            }
        }
        return stats;
    }

    /**
     * Clear all measurements
     */
    clear() {
        this.marks.clear();
        this.measurements.clear();
    }

    /**
     * Reset measurements for a specific name
     * @param {string} name 
     */
    reset(name) {
        this.measurements.delete(name);
    }
}

// Export utilities
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        ObjectPool,
        ParticlePool,
        LODManager,
        FrameRateLimiter,
        MemoryMonitor,
        Profiler
    };
}
