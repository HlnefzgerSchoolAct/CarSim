/**
 * TireSmoke.js - Tire Smoke Particle Effect
 * 
 * Specialized particle system for tire smoke during drifting,
 * burnouts, and wheel spin.
 * 
 * @module effects/TireSmoke
 * @author CarSim Development Team
 * @version 2.0.0
 */

import { ParticleSystem } from './ParticleSystem.js';
import { MathUtils } from '../utils/MathUtils.js';

/**
 * @class TireSmoke
 * @description Manages tire smoke effects
 */
export class TireSmoke {
    /**
     * Creates a new TireSmoke effect system
     * @param {THREE.Scene} scene - Three.js scene
     * @param {Object} [config] - Configuration options
     */
    constructor(scene, config = {}) {
        /** @type {THREE.Scene} Scene reference */
        this.scene = scene;
        
        // Configuration
        /** @type {number} Maximum smoke particles */
        this.maxParticles = config.maxParticles ?? 500;
        
        /** @type {number} Minimum slip intensity for smoke */
        this.minSlipIntensity = config.minSlipIntensity ?? 0.15;
        
        /** @type {number} Smoke emission rate multiplier */
        this.emissionMultiplier = config.emissionMultiplier ?? 50;
        
        // Create particle system
        this.particleSystem = new ParticleSystem(scene, {
            maxParticles: this.maxParticles,
            usePointSprites: true,
            useGravity: false,
            baseSize: 1.0,
            emitterShape: 'point',
            life: [2, 4],
            speed: [0.5, 2],
            direction: new THREE.Vector3(0, 1, 0),
            spread: 0.3,
            sizeStart: [0.3, 0.6],
            sizeEnd: [1.5, 3],
            colorStart: 0x888888,
            colorEnd: 0x444444,
            alphaStart: 0.6,
            alphaEnd: 0
        });
        
        // Wheel emitters
        this.wheelEmitters = new Map();
        
        // Wind effect on smoke
        this.windDirection = new THREE.Vector3(0, 0, 0);
        this.windStrength = 0;
    }

    /**
     * Update smoke effects
     * @param {number} deltaTime - Time step
     * @param {Array} wheelStates - Array of wheel states
     */
    update(deltaTime, wheelStates) {
        // Update particle system
        this.particleSystem.update(deltaTime);
        
        // Apply wind to existing particles
        this.applyWind(deltaTime);
        
        // Emit smoke from wheels
        for (const wheelState of wheelStates) {
            this.processWheel(wheelState, deltaTime);
        }
    }

    /**
     * Process a wheel for smoke emission
     * @param {Object} wheelState - Wheel state
     * @param {number} deltaTime - Time step
     */
    processWheel(wheelState, deltaTime) {
        const {
            position,
            slipRatio = 0,
            slipAngle = 0,
            onGround = true,
            angularVelocity = 0,
            temperature = 20,
            surfaceType = 'asphalt'
        } = wheelState;
        
        if (!onGround) return;
        
        // Calculate slip intensity
        const slipIntensity = Math.sqrt(
            slipRatio * slipRatio + 
            slipAngle * slipAngle
        );
        
        if (slipIntensity < this.minSlipIntensity) return;
        
        // Calculate emission rate based on slip
        const normalizedSlip = MathUtils.clamp(
            (slipIntensity - this.minSlipIntensity) / (1 - this.minSlipIntensity),
            0, 1
        );
        
        // Temperature affects smoke amount
        const tempFactor = MathUtils.clamp(temperature / 100, 0.5, 2);
        
        // Surface affects smoke appearance
        const surfaceFactor = this.getSurfaceFactor(surfaceType);
        
        // Calculate number of particles to emit
        const emitCount = normalizedSlip * this.emissionMultiplier * 
                         tempFactor * surfaceFactor * deltaTime;
        
        // Emit particles
        for (let i = 0; i < Math.floor(emitCount); i++) {
            this.emitSmokeParticle(position, normalizedSlip, surfaceType);
        }
        
        // Handle fractional emission
        if (Math.random() < emitCount % 1) {
            this.emitSmokeParticle(position, normalizedSlip, surfaceType);
        }
    }

    /**
     * Emit a single smoke particle
     * @param {THREE.Vector3} position - Emission position
     * @param {number} intensity - Smoke intensity (0-1)
     * @param {string} surfaceType - Surface type
     */
    emitSmokeParticle(position, intensity, surfaceType) {
        const colors = this.getSmokeColors(surfaceType);
        
        // Adjust size based on intensity
        const sizeMultiplier = 0.5 + intensity * 0.5;
        
        // Emit position with slight randomness
        const emitPos = position.clone();
        emitPos.x += MathUtils.randomRange(-0.1, 0.1);
        emitPos.y += 0.1;
        emitPos.z += MathUtils.randomRange(-0.1, 0.1);
        
        // Velocity with some randomness
        const velocity = new THREE.Vector3(
            MathUtils.randomRange(-1, 1),
            MathUtils.randomRange(0.5, 1.5),
            MathUtils.randomRange(-1, 1)
        );
        
        // Add wind influence
        velocity.addScaledVector(this.windDirection, this.windStrength * 0.5);
        
        this.particleSystem.spawnParticle({
            position: emitPos,
            velocity: velocity,
            sizeStart: [0.2 * sizeMultiplier, 0.5 * sizeMultiplier],
            sizeEnd: [1 * sizeMultiplier, 2 * sizeMultiplier],
            colorStart: colors.start,
            colorEnd: colors.end,
            life: [1.5 + intensity, 3 + intensity],
            alphaStart: 0.4 + intensity * 0.3,
            alphaEnd: 0
        });
    }

    /**
     * Get surface factor for smoke amount
     * @param {string} surfaceType - Surface type
     * @returns {number} Smoke factor
     */
    getSurfaceFactor(surfaceType) {
        const factors = {
            'asphalt': 1.0,
            'concrete': 0.9,
            'gravel': 0.3, // Less rubber smoke, more dust
            'dirt': 0.2,
            'grass': 0.1,
            'ice': 0,
            'snow': 0.1
        };
        return factors[surfaceType] ?? 1.0;
    }

    /**
     * Get smoke colors based on surface
     * @param {string} surfaceType - Surface type
     * @returns {{start: number, end: number}} Color values
     */
    getSmokeColors(surfaceType) {
        switch (surfaceType) {
            case 'dirt':
            case 'gravel':
                return { start: 0x9c8b7a, end: 0x6b5344 };
            case 'grass':
                return { start: 0x7a8c7a, end: 0x4a5c4a };
            case 'snow':
                return { start: 0xffffff, end: 0xcccccc };
            default:
                return { start: 0x888888, end: 0x444444 };
        }
    }

    /**
     * Apply wind effect to particles
     * @param {number} deltaTime - Time step
     */
    applyWind(deltaTime) {
        if (this.windStrength < 0.1) return;
        
        for (const particle of this.particleSystem.particles) {
            if (!particle.active) continue;
            
            // Add wind acceleration
            particle.velocity.addScaledVector(
                this.windDirection,
                this.windStrength * deltaTime * 2
            );
        }
    }

    /**
     * Set wind parameters
     * @param {THREE.Vector3} direction - Wind direction
     * @param {number} strength - Wind strength
     */
    setWind(direction, strength) {
        this.windDirection.copy(direction).normalize();
        this.windStrength = strength;
    }

    /**
     * Create burnout effect at position
     * @param {THREE.Vector3} position - Burnout position
     * @param {number} intensity - Burnout intensity
     */
    createBurnout(position, intensity = 1) {
        // Emit burst of dense smoke
        for (let i = 0; i < 20 * intensity; i++) {
            this.particleSystem.spawnParticle({
                position: position.clone().add(new THREE.Vector3(
                    MathUtils.randomRange(-0.2, 0.2),
                    0.1,
                    MathUtils.randomRange(-0.2, 0.2)
                )),
                velocity: new THREE.Vector3(
                    MathUtils.randomRange(-2, 2),
                    MathUtils.randomRange(1, 3),
                    MathUtils.randomRange(-2, 2)
                ),
                sizeStart: [0.4, 0.8],
                sizeEnd: [2, 4],
                colorStart: 0x666666,
                colorEnd: 0x222222,
                life: [2, 5],
                alphaStart: 0.7,
                alphaEnd: 0
            });
        }
    }

    /**
     * Get active particle count
     * @returns {number} Active particles
     */
    getActiveCount() {
        return this.particleSystem.getActiveCount();
    }

    /**
     * Clear all smoke
     */
    clear() {
        this.particleSystem.clear();
    }

    /**
     * Dispose of resources
     */
    dispose() {
        this.particleSystem.dispose();
    }
}

export default TireSmoke;
