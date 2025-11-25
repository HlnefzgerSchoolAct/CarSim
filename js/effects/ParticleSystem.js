/**
 * ParticleSystem.js - Base Particle System
 * 
 * Provides a reusable particle system for various visual effects
 * including smoke, sparks, debris, and weather effects.
 * 
 * @module effects/ParticleSystem
 * @author CarSim Development Team
 * @version 2.0.0
 */

import { PARTICLE_CONSTANTS, PHYSICS_CONSTANTS } from '../core/Constants.js';
import { MathUtils } from '../utils/MathUtils.js';
import { ObjectPool } from '../utils/ObjectPool.js';

/**
 * @class Particle
 * @description Individual particle data structure
 */
class Particle {
    constructor() {
        this.position = new THREE.Vector3();
        this.velocity = new THREE.Vector3();
        this.acceleration = new THREE.Vector3();
        this.color = new THREE.Color(0xffffff);
        this.size = 1;
        this.sizeStart = 1;
        this.sizeEnd = 0;
        this.life = 0;
        this.maxLife = 1;
        this.alpha = 1;
        this.alphaStart = 1;
        this.alphaEnd = 0;
        this.rotation = 0;
        this.rotationSpeed = 0;
        this.active = false;
        this.colorStart = new THREE.Color(0xffffff);
        this.colorEnd = new THREE.Color(0xffffff);
    }

    reset() {
        this.position.set(0, 0, 0);
        this.velocity.set(0, 0, 0);
        this.acceleration.set(0, 0, 0);
        this.color.setHex(0xffffff);
        this.size = 1;
        this.sizeStart = 1;
        this.sizeEnd = 0;
        this.life = 0;
        this.maxLife = 1;
        this.alpha = 1;
        this.alphaStart = 1;
        this.alphaEnd = 0;
        this.rotation = 0;
        this.rotationSpeed = 0;
        this.active = false;
    }
}

/**
 * @class ParticleSystem
 * @description Manages a collection of particles
 */
export class ParticleSystem {
    /**
     * Creates a new ParticleSystem
     * @param {THREE.Scene} scene - Three.js scene
     * @param {Object} [config] - Configuration options
     */
    constructor(scene, config = {}) {
        /** @type {THREE.Scene} Scene reference */
        this.scene = scene;
        
        /** @type {number} Maximum number of particles */
        this.maxParticles = config.maxParticles ?? 1000;
        
        /** @type {string} Particle texture path */
        this.texturePath = config.texturePath ?? null;
        
        /** @type {number} Particle base size */
        this.baseSize = config.baseSize ?? 0.5;
        
        /** @type {boolean} Use additive blending */
        this.additiveBlending = config.additiveBlending ?? false;
        
        /** @type {boolean} Particles affected by gravity */
        this.useGravity = config.useGravity ?? true;
        
        /** @type {number} Gravity strength */
        this.gravity = config.gravity ?? PHYSICS_CONSTANTS.GRAVITY;
        
        /** @type {boolean} Is system active */
        this.active = true;
        
        /** @type {boolean} Use point sprites or mesh instances */
        this.usePointSprites = config.usePointSprites ?? true;
        
        // Particle pool
        this.particles = [];
        this.activeCount = 0;
        
        // Initialize particles
        this.initializeParticles();
        
        // Create rendering objects
        this.createRenderObjects();
        
        // Emitter settings
        this.emitting = false;
        this.emitRate = config.emitRate ?? 10; // Particles per second
        this.emitAccumulator = 0;
        
        // Emitter position and shape
        this.emitterPosition = new THREE.Vector3();
        this.emitterShape = config.emitterShape ?? 'point'; // point, sphere, box, cone
        this.emitterSize = config.emitterSize ?? new THREE.Vector3(0.5, 0.5, 0.5);
        
        // Particle spawn properties
        this.spawnConfig = {
            life: config.life ?? [1, 2],
            speed: config.speed ?? [1, 3],
            direction: config.direction ?? new THREE.Vector3(0, 1, 0),
            spread: config.spread ?? 0.5,
            sizeStart: config.sizeStart ?? [0.2, 0.5],
            sizeEnd: config.sizeEnd ?? [0, 0],
            colorStart: config.colorStart ?? 0xffffff,
            colorEnd: config.colorEnd ?? 0xffffff,
            alphaStart: config.alphaStart ?? 1,
            alphaEnd: config.alphaEnd ?? 0,
            rotationSpeed: config.rotationSpeed ?? [0, 0]
        };
    }

    /**
     * Initialize particle pool
     */
    initializeParticles() {
        for (let i = 0; i < this.maxParticles; i++) {
            this.particles.push(new Particle());
        }
    }

    /**
     * Create Three.js rendering objects
     */
    createRenderObjects() {
        if (this.usePointSprites) {
            this.createPointSprites();
        } else {
            this.createInstancedMesh();
        }
    }

    /**
     * Create point sprite system
     */
    createPointSprites() {
        // Create positions array
        this.positions = new Float32Array(this.maxParticles * 3);
        this.colors = new Float32Array(this.maxParticles * 3);
        this.sizes = new Float32Array(this.maxParticles);
        this.alphas = new Float32Array(this.maxParticles);
        
        // Create geometry
        this.geometry = new THREE.BufferGeometry();
        this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
        this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
        this.geometry.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1));
        this.geometry.setAttribute('alpha', new THREE.BufferAttribute(this.alphas, 1));
        
        // Create material
        const materialConfig = {
            size: this.baseSize,
            vertexColors: true,
            transparent: true,
            depthWrite: false,
            sizeAttenuation: true
        };
        
        if (this.additiveBlending) {
            materialConfig.blending = THREE.AdditiveBlending;
        }
        
        this.material = new THREE.PointsMaterial(materialConfig);
        
        // Load texture if provided
        if (this.texturePath) {
            const textureLoader = new THREE.TextureLoader();
            textureLoader.load(this.texturePath, (texture) => {
                this.material.map = texture;
                this.material.needsUpdate = true;
            });
        }
        
        // Create points object
        this.pointsObject = new THREE.Points(this.geometry, this.material);
        this.pointsObject.frustumCulled = false;
        this.scene.add(this.pointsObject);
    }

    /**
     * Create instanced mesh system (for complex particles)
     */
    createInstancedMesh() {
        // Simple sphere geometry for each particle
        const geometry = new THREE.SphereGeometry(this.baseSize, 6, 6);
        const material = new THREE.MeshBasicMaterial({
            transparent: true,
            vertexColors: true
        });
        
        if (this.additiveBlending) {
            material.blending = THREE.AdditiveBlending;
        }
        
        this.instancedMesh = new THREE.InstancedMesh(geometry, material, this.maxParticles);
        this.instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.instancedMesh.count = 0;
        
        this.scene.add(this.instancedMesh);
        
        // Temp matrix for instance updates
        this._tempMatrix = new THREE.Matrix4();
    }

    /**
     * Update particle system
     * @param {number} deltaTime - Time step in seconds
     */
    update(deltaTime) {
        if (!this.active) return;
        
        // Emit new particles
        if (this.emitting) {
            this.emitParticles(deltaTime);
        }
        
        // Update existing particles
        this.updateParticles(deltaTime);
        
        // Update render data
        this.updateRenderData();
    }

    /**
     * Emit new particles based on emit rate
     * @param {number} deltaTime - Time step
     */
    emitParticles(deltaTime) {
        this.emitAccumulator += deltaTime * this.emitRate;
        
        while (this.emitAccumulator >= 1) {
            this.spawnParticle();
            this.emitAccumulator -= 1;
        }
    }

    /**
     * Spawn a single particle
     * @param {Object} [overrides] - Override spawn properties
     * @returns {Particle|null} Spawned particle or null if pool is full
     */
    spawnParticle(overrides = {}) {
        // Find inactive particle
        let particle = null;
        for (let i = 0; i < this.maxParticles; i++) {
            if (!this.particles[i].active) {
                particle = this.particles[i];
                break;
            }
        }
        
        if (!particle) return null;
        
        // Configure particle
        particle.active = true;
        
        // Position
        particle.position.copy(this.getEmitPosition());
        if (overrides.position) particle.position.copy(overrides.position);
        
        // Velocity
        const direction = this.getEmitDirection();
        const speed = this.getRandomInRange(
            overrides.speed ?? this.spawnConfig.speed
        );
        particle.velocity.copy(direction).multiplyScalar(speed);
        if (overrides.velocity) particle.velocity.copy(overrides.velocity);
        
        // Life
        particle.life = 0;
        particle.maxLife = this.getRandomInRange(
            overrides.life ?? this.spawnConfig.life
        );
        
        // Size
        particle.sizeStart = this.getRandomInRange(
            overrides.sizeStart ?? this.spawnConfig.sizeStart
        );
        particle.sizeEnd = this.getRandomInRange(
            overrides.sizeEnd ?? this.spawnConfig.sizeEnd
        );
        particle.size = particle.sizeStart;
        
        // Color
        particle.colorStart.setHex(overrides.colorStart ?? this.spawnConfig.colorStart);
        particle.colorEnd.setHex(overrides.colorEnd ?? this.spawnConfig.colorEnd);
        particle.color.copy(particle.colorStart);
        
        // Alpha
        particle.alphaStart = overrides.alphaStart ?? this.spawnConfig.alphaStart;
        particle.alphaEnd = overrides.alphaEnd ?? this.spawnConfig.alphaEnd;
        particle.alpha = particle.alphaStart;
        
        // Rotation
        particle.rotation = MathUtils.randomRange(0, Math.PI * 2);
        particle.rotationSpeed = this.getRandomInRange(
            overrides.rotationSpeed ?? this.spawnConfig.rotationSpeed
        );
        
        // Gravity
        if (this.useGravity) {
            particle.acceleration.set(0, -this.gravity, 0);
        }
        
        this.activeCount++;
        return particle;
    }

    /**
     * Get position based on emitter shape
     * @returns {THREE.Vector3} Emit position
     */
    getEmitPosition() {
        const pos = this.emitterPosition.clone();
        
        switch (this.emitterShape) {
            case 'sphere':
                const phi = MathUtils.randomRange(0, Math.PI * 2);
                const theta = MathUtils.randomRange(0, Math.PI);
                const r = MathUtils.randomRange(0, 1) * this.emitterSize.x;
                pos.x += r * Math.sin(theta) * Math.cos(phi);
                pos.y += r * Math.sin(theta) * Math.sin(phi);
                pos.z += r * Math.cos(theta);
                break;
                
            case 'box':
                pos.x += MathUtils.randomRange(-this.emitterSize.x, this.emitterSize.x);
                pos.y += MathUtils.randomRange(-this.emitterSize.y, this.emitterSize.y);
                pos.z += MathUtils.randomRange(-this.emitterSize.z, this.emitterSize.z);
                break;
                
            case 'cone':
                const angle = MathUtils.randomRange(0, Math.PI * 2);
                const coneRadius = MathUtils.randomRange(0, 1) * this.emitterSize.x;
                pos.x += coneRadius * Math.cos(angle);
                pos.z += coneRadius * Math.sin(angle);
                break;
                
            case 'point':
            default:
                // No offset
                break;
        }
        
        return pos;
    }

    /**
     * Get emit direction with spread
     * @returns {THREE.Vector3} Emit direction
     */
    getEmitDirection() {
        const dir = this.spawnConfig.direction.clone().normalize();
        
        if (this.spawnConfig.spread > 0) {
            // Add random spread
            const spreadAngle = this.spawnConfig.spread * Math.PI;
            const theta = MathUtils.randomRange(0, spreadAngle);
            const phi = MathUtils.randomRange(0, Math.PI * 2);
            
            // Create perpendicular vectors
            const perp1 = new THREE.Vector3();
            const perp2 = new THREE.Vector3();
            
            if (Math.abs(dir.x) < 0.9) {
                perp1.crossVectors(dir, new THREE.Vector3(1, 0, 0)).normalize();
            } else {
                perp1.crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
            }
            perp2.crossVectors(dir, perp1).normalize();
            
            // Apply spread
            dir.multiplyScalar(Math.cos(theta));
            dir.addScaledVector(perp1, Math.sin(theta) * Math.cos(phi));
            dir.addScaledVector(perp2, Math.sin(theta) * Math.sin(phi));
        }
        
        return dir.normalize();
    }

    /**
     * Get random value in range
     * @param {number|Array} range - Single value or [min, max] array
     * @returns {number} Random value
     */
    getRandomInRange(range) {
        if (Array.isArray(range)) {
            return MathUtils.randomRange(range[0], range[1]);
        }
        return range;
    }

    /**
     * Update all particles
     * @param {number} deltaTime - Time step
     */
    updateParticles(deltaTime) {
        this.activeCount = 0;
        
        for (let i = 0; i < this.maxParticles; i++) {
            const p = this.particles[i];
            
            if (!p.active) continue;
            
            // Update life
            p.life += deltaTime;
            
            if (p.life >= p.maxLife) {
                p.active = false;
                continue;
            }
            
            this.activeCount++;
            
            // Life progress (0-1)
            const t = p.life / p.maxLife;
            
            // Update physics
            p.velocity.addScaledVector(p.acceleration, deltaTime);
            p.position.addScaledVector(p.velocity, deltaTime);
            
            // Update rotation
            p.rotation += p.rotationSpeed * deltaTime;
            
            // Interpolate properties
            p.size = MathUtils.lerp(p.sizeStart, p.sizeEnd, t);
            p.alpha = MathUtils.lerp(p.alphaStart, p.alphaEnd, t);
            p.color.lerpColors(p.colorStart, p.colorEnd, t);
        }
    }

    /**
     * Update render data for Three.js
     */
    updateRenderData() {
        if (this.usePointSprites) {
            this.updatePointSprites();
        } else {
            this.updateInstancedMesh();
        }
    }

    /**
     * Update point sprite data
     */
    updatePointSprites() {
        let visibleCount = 0;
        
        for (let i = 0; i < this.maxParticles; i++) {
            const p = this.particles[i];
            
            if (!p.active) {
                // Move inactive particles far away
                this.positions[i * 3] = 0;
                this.positions[i * 3 + 1] = -10000;
                this.positions[i * 3 + 2] = 0;
                this.sizes[i] = 0;
                this.alphas[i] = 0;
                continue;
            }
            
            visibleCount++;
            
            // Position
            this.positions[i * 3] = p.position.x;
            this.positions[i * 3 + 1] = p.position.y;
            this.positions[i * 3 + 2] = p.position.z;
            
            // Color
            this.colors[i * 3] = p.color.r;
            this.colors[i * 3 + 1] = p.color.g;
            this.colors[i * 3 + 2] = p.color.b;
            
            // Size
            this.sizes[i] = p.size;
            
            // Alpha
            this.alphas[i] = p.alpha;
        }
        
        // Update buffer attributes
        this.geometry.attributes.position.needsUpdate = true;
        this.geometry.attributes.color.needsUpdate = true;
        this.geometry.attributes.size.needsUpdate = true;
        this.geometry.attributes.alpha.needsUpdate = true;
    }

    /**
     * Update instanced mesh data
     */
    updateInstancedMesh() {
        let instanceIndex = 0;
        
        for (let i = 0; i < this.maxParticles; i++) {
            const p = this.particles[i];
            
            if (!p.active) continue;
            
            // Set instance matrix
            this._tempMatrix.makeScale(p.size, p.size, p.size);
            this._tempMatrix.setPosition(p.position);
            this.instancedMesh.setMatrixAt(instanceIndex, this._tempMatrix);
            
            // Set instance color
            this.instancedMesh.setColorAt(instanceIndex, p.color);
            
            instanceIndex++;
        }
        
        this.instancedMesh.count = instanceIndex;
        this.instancedMesh.instanceMatrix.needsUpdate = true;
        if (this.instancedMesh.instanceColor) {
            this.instancedMesh.instanceColor.needsUpdate = true;
        }
    }

    /**
     * Emit burst of particles
     * @param {number} count - Number of particles to emit
     * @param {Object} [overrides] - Property overrides
     */
    burst(count, overrides = {}) {
        for (let i = 0; i < count; i++) {
            this.spawnParticle(overrides);
        }
    }

    /**
     * Start continuous emission
     * @param {number} [rate] - Emission rate
     */
    startEmitting(rate) {
        if (rate !== undefined) {
            this.emitRate = rate;
        }
        this.emitting = true;
    }

    /**
     * Stop continuous emission
     */
    stopEmitting() {
        this.emitting = false;
    }

    /**
     * Set emitter position
     * @param {THREE.Vector3|number} x - X position or Vector3
     * @param {number} [y] - Y position
     * @param {number} [z] - Z position
     */
    setPosition(x, y, z) {
        if (x instanceof THREE.Vector3) {
            this.emitterPosition.copy(x);
        } else {
            this.emitterPosition.set(x, y, z);
        }
    }

    /**
     * Clear all particles
     */
    clear() {
        for (const p of this.particles) {
            p.active = false;
        }
        this.activeCount = 0;
    }

    /**
     * Get particle count
     * @returns {number} Active particle count
     */
    getActiveCount() {
        return this.activeCount;
    }

    /**
     * Dispose of all resources
     */
    dispose() {
        if (this.usePointSprites) {
            this.scene.remove(this.pointsObject);
            this.geometry.dispose();
            this.material.dispose();
        } else {
            this.scene.remove(this.instancedMesh);
            this.instancedMesh.geometry.dispose();
            this.instancedMesh.material.dispose();
        }
    }
}

export default ParticleSystem;
