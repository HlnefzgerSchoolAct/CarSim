/**
 * Sparks.js - Collision Spark Effects
 * 
 * Creates spark particle effects for metal-on-metal collisions,
 * scraping, and grinding.
 * 
 * @module effects/Sparks
 * @author CarSim Development Team
 * @version 2.0.0
 */

import { ParticleSystem } from './ParticleSystem.js';
import { MathUtils } from '../utils/MathUtils.js';
import { PARTICLE_CONSTANTS } from '../core/Constants.js';

/**
 * @class Sparks
 * @description Manages spark particle effects
 */
export class Sparks {
    /**
     * Creates a new Sparks effect system
     * @param {THREE.Scene} scene - Three.js scene
     * @param {Object} [config] - Configuration options
     */
    constructor(scene, config = {}) {
        /** @type {THREE.Scene} Scene reference */
        this.scene = scene;
        
        // Configuration
        /** @type {number} Maximum spark particles */
        this.maxParticles = config.maxParticles ?? PARTICLE_CONSTANTS.MAX_COLLISION_SPARKS * 3;
        
        /** @type {number} Minimum force for sparks */
        this.minForce = config.minForce ?? 5000;
        
        /** @type {number} Spark gravity */
        this.sparkGravity = config.sparkGravity ?? PARTICLE_CONSTANTS.SPARK_GRAVITY;
        
        // Create particle system for sparks
        this.particleSystem = new ParticleSystem(scene, {
            maxParticles: this.maxParticles,
            usePointSprites: true,
            useGravity: true,
            gravity: this.sparkGravity,
            baseSize: 0.15,
            additiveBlending: true,
            emitterShape: 'point',
            life: [0.2, 0.8],
            speed: [5, 15],
            direction: new THREE.Vector3(0, 1, 0),
            spread: 0.8,
            sizeStart: [0.03, 0.08],
            sizeEnd: [0, 0],
            colorStart: 0xffff88,
            colorEnd: 0xff4400,
            alphaStart: 1,
            alphaEnd: 0
        });
        
        // Active scrape emitters
        this.scrapeEmitters = new Map();
        
        // Ember particles (longer-lived glow)
        this.emberSystem = new ParticleSystem(scene, {
            maxParticles: 100,
            usePointSprites: true,
            useGravity: true,
            gravity: this.sparkGravity * 0.3,
            baseSize: 0.1,
            additiveBlending: true,
            life: [1, 3],
            speed: [0.5, 2],
            sizeStart: [0.02, 0.05],
            sizeEnd: [0, 0],
            colorStart: 0xff6600,
            colorEnd: 0x330000,
            alphaStart: 1,
            alphaEnd: 0
        });
    }

    /**
     * Update spark effects
     * @param {number} deltaTime - Time step
     */
    update(deltaTime) {
        this.particleSystem.update(deltaTime);
        this.emberSystem.update(deltaTime);
        
        // Update scrape emitters
        this.updateScrapeEmitters(deltaTime);
    }

    /**
     * Create spark burst from collision
     * @param {THREE.Vector3} position - Collision position
     * @param {THREE.Vector3} normal - Surface normal
     * @param {number} force - Impact force
     * @param {THREE.Vector3} [velocity] - Relative velocity for direction
     */
    createCollisionSparks(position, normal, force, velocity) {
        if (force < this.minForce) return;
        
        // Calculate spark count based on force
        const normalizedForce = MathUtils.clamp(force / 50000, 0, 1);
        const sparkCount = Math.floor(10 + normalizedForce * 40);
        
        // Calculate reflection direction
        let baseDirection;
        if (velocity && velocity.length() > 0.1) {
            // Reflect velocity off normal
            baseDirection = velocity.clone().reflect(normal).normalize();
        } else {
            baseDirection = normal.clone();
        }
        
        // Emit sparks
        for (let i = 0; i < sparkCount; i++) {
            const sparkDir = baseDirection.clone();
            
            // Add randomness
            sparkDir.x += MathUtils.randomRange(-0.5, 0.5);
            sparkDir.y += MathUtils.randomRange(0, 0.5);
            sparkDir.z += MathUtils.randomRange(-0.5, 0.5);
            sparkDir.normalize();
            
            const speed = MathUtils.randomRange(5, 15) * (0.5 + normalizedForce * 0.5);
            
            this.particleSystem.spawnParticle({
                position: position.clone().addScaledVector(normal, 0.05),
                velocity: sparkDir.multiplyScalar(speed),
                life: [0.1 + normalizedForce * 0.3, 0.4 + normalizedForce * 0.5],
                sizeStart: [0.02 + normalizedForce * 0.03, 0.05 + normalizedForce * 0.05],
                sizeEnd: [0, 0],
                colorStart: this.getSparkColor(normalizedForce),
                colorEnd: 0xff2200,
                alphaStart: 1,
                alphaEnd: 0
            });
        }
        
        // Create some embers for big impacts
        if (normalizedForce > 0.5) {
            this.createEmbers(position, normal, normalizedForce);
        }
    }

    /**
     * Create ember particles (longer-lived glow)
     * @param {THREE.Vector3} position - Position
     * @param {THREE.Vector3} normal - Direction
     * @param {number} intensity - Intensity
     */
    createEmbers(position, normal, intensity) {
        const emberCount = Math.floor(5 + intensity * 10);
        
        for (let i = 0; i < emberCount; i++) {
            const dir = normal.clone();
            dir.x += MathUtils.randomRange(-0.3, 0.3);
            dir.y += MathUtils.randomRange(0.2, 0.5);
            dir.z += MathUtils.randomRange(-0.3, 0.3);
            dir.normalize();
            
            this.emberSystem.spawnParticle({
                position: position.clone().addScaledVector(normal, 0.05),
                velocity: dir.multiplyScalar(MathUtils.randomRange(1, 3)),
                life: [1, 2 + intensity],
                sizeStart: [0.02, 0.04],
                sizeEnd: [0, 0],
                colorStart: 0xff4400,
                colorEnd: 0x220000,
                alphaStart: 1,
                alphaEnd: 0
            });
        }
    }

    /**
     * Start continuous scrape sparks
     * @param {string} id - Scrape identifier
     * @param {THREE.Vector3} position - Scrape position
     * @param {THREE.Vector3} direction - Scrape direction
     * @param {number} intensity - Scrape intensity (0-1)
     */
    startScrape(id, position, direction, intensity) {
        this.scrapeEmitters.set(id, {
            position: position.clone(),
            direction: direction.clone().normalize(),
            intensity: MathUtils.clamp(intensity, 0, 1),
            accumulator: 0
        });
    }

    /**
     * Update scrape position and intensity
     * @param {string} id - Scrape identifier
     * @param {THREE.Vector3} position - New position
     * @param {THREE.Vector3} direction - New direction
     * @param {number} intensity - New intensity
     */
    updateScrape(id, position, direction, intensity) {
        const emitter = this.scrapeEmitters.get(id);
        if (emitter) {
            emitter.position.copy(position);
            emitter.direction.copy(direction).normalize();
            emitter.intensity = MathUtils.clamp(intensity, 0, 1);
        }
    }

    /**
     * Stop scrape sparks
     * @param {string} id - Scrape identifier
     */
    stopScrape(id) {
        this.scrapeEmitters.delete(id);
    }

    /**
     * Update all scrape emitters
     * @param {number} deltaTime - Time step
     */
    updateScrapeEmitters(deltaTime) {
        for (const [id, emitter] of this.scrapeEmitters) {
            if (emitter.intensity < 0.1) continue;
            
            // Calculate emission rate
            const emissionRate = 30 * emitter.intensity;
            emitter.accumulator += emissionRate * deltaTime;
            
            while (emitter.accumulator >= 1) {
                this.emitScrapeSpark(emitter);
                emitter.accumulator -= 1;
            }
        }
    }

    /**
     * Emit a single scrape spark
     * @param {Object} emitter - Emitter data
     */
    emitScrapeSpark(emitter) {
        // Perpendicular to scrape direction
        const perpX = new THREE.Vector3(1, 0, 0);
        const perpZ = new THREE.Vector3(0, 0, 1);
        
        // Choose perpendicular direction
        const perp = Math.abs(emitter.direction.dot(perpX)) > 0.9 ? perpZ : perpX;
        const sparkDir = new THREE.Vector3().crossVectors(emitter.direction, perp);
        
        // Add randomness
        sparkDir.y += MathUtils.randomRange(0.3, 0.6);
        sparkDir.x += MathUtils.randomRange(-0.2, 0.2);
        sparkDir.z += MathUtils.randomRange(-0.2, 0.2);
        sparkDir.normalize();
        
        // Occasionally flip direction
        if (Math.random() > 0.5) {
            sparkDir.x *= -1;
            sparkDir.z *= -1;
        }
        
        const speed = MathUtils.randomRange(3, 8) * emitter.intensity;
        
        this.particleSystem.spawnParticle({
            position: emitter.position.clone(),
            velocity: sparkDir.multiplyScalar(speed),
            life: [0.1, 0.3],
            sizeStart: [0.02, 0.04],
            sizeEnd: [0, 0],
            colorStart: this.getSparkColor(emitter.intensity),
            colorEnd: 0xff2200,
            alphaStart: 1,
            alphaEnd: 0
        });
    }

    /**
     * Get spark color based on intensity
     * @param {number} intensity - Spark intensity
     * @returns {number} Color hex value
     */
    getSparkColor(intensity) {
        // Hotter sparks are more white/yellow, cooler are orange
        if (intensity > 0.8) {
            return 0xffffaa; // White-yellow
        } else if (intensity > 0.5) {
            return 0xffff44; // Yellow
        } else {
            return 0xffaa00; // Orange
        }
    }

    /**
     * Create grinding sparks (continuous stream)
     * @param {THREE.Vector3} position - Position
     * @param {THREE.Vector3} direction - Grinding direction
     * @param {number} count - Number of sparks
     */
    createGrindingSparks(position, direction, count = 5) {
        for (let i = 0; i < count; i++) {
            const sparkDir = direction.clone();
            sparkDir.y += MathUtils.randomRange(0.2, 0.5);
            sparkDir.x += MathUtils.randomRange(-0.2, 0.2);
            sparkDir.z += MathUtils.randomRange(-0.2, 0.2);
            sparkDir.normalize();
            
            // Add some along the grinding direction
            sparkDir.addScaledVector(direction, MathUtils.randomRange(-0.5, 0.5));
            
            this.particleSystem.spawnParticle({
                position: position.clone(),
                velocity: sparkDir.multiplyScalar(MathUtils.randomRange(3, 8)),
                life: [0.1, 0.4],
                sizeStart: [0.015, 0.03],
                sizeEnd: [0, 0],
                colorStart: 0xffff66,
                colorEnd: 0xff3300,
                alphaStart: 1,
                alphaEnd: 0
            });
        }
    }

    /**
     * Get active particle count
     * @returns {number} Active particles
     */
    getActiveCount() {
        return this.particleSystem.getActiveCount() + this.emberSystem.getActiveCount();
    }

    /**
     * Clear all sparks
     */
    clear() {
        this.particleSystem.clear();
        this.emberSystem.clear();
        this.scrapeEmitters.clear();
    }

    /**
     * Dispose of resources
     */
    dispose() {
        this.particleSystem.dispose();
        this.emberSystem.dispose();
    }
}

export default Sparks;
