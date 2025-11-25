/**
 * Brakes.js - Brake System Simulation
 * 
 * Simulates a realistic braking system with brake bias, ABS, fade,
 * and temperature management.
 * 
 * @module vehicle/Brakes
 * @author CarSim Development Team
 * @version 2.0.0
 */

import { BRAKE_CONSTANTS } from '../core/Constants.js';
import { MathUtils } from '../utils/MathUtils.js';

/**
 * @class Brakes
 * @description Simulates the vehicle braking system
 */
export class Brakes {
    /**
     * Creates a new Brakes instance
     * @param {Object} [config] - Brake configuration
     */
    constructor(config = {}) {
        // Brake specifications
        /** @type {number} Maximum total brake force in N */
        this.maxBrakeForce = config.maxBrakeForce ?? BRAKE_CONSTANTS.MAX_BRAKE_FORCE;
        
        /** @type {number} Brake bias (percentage to front, 0-1) */
        this.brakeBias = config.brakeBias ?? BRAKE_CONSTANTS.BRAKE_BIAS;
        
        /** @type {number} Brake pad friction coefficient */
        this.padFriction = config.padFriction ?? BRAKE_CONSTANTS.BRAKE_PAD_FRICTION;
        
        // ABS configuration
        /** @type {boolean} ABS enabled */
        this.absEnabled = config.absEnabled ?? true;
        
        /** @type {number} ABS slip threshold */
        this.absThreshold = config.absThreshold ?? BRAKE_CONSTANTS.ABS_THRESHOLD;
        
        /** @type {number} ABS release threshold */
        this.absRelease = config.absRelease ?? BRAKE_CONSTANTS.ABS_RELEASE;
        
        /** @type {number} ABS cycle frequency */
        this.absFrequency = config.absFrequency ?? BRAKE_CONSTANTS.ABS_FREQUENCY;
        
        // Brake fade configuration
        /** @type {number} Temperature at which fade starts */
        this.fadeStartTemp = config.fadeStartTemp ?? BRAKE_CONSTANTS.BRAKE_FADE_TEMP_START;
        
        /** @type {number} Temperature at which fade is maximum */
        this.fadeFullTemp = config.fadeFullTemp ?? BRAKE_CONSTANTS.BRAKE_FADE_TEMP_FULL;
        
        // Heat characteristics
        /** @type {number} Heat generation coefficient */
        this.heatGeneration = config.heatGeneration ?? BRAKE_CONSTANTS.BRAKE_HEAT_GENERATION;
        
        /** @type {number} Heat dissipation coefficient */
        this.heatDissipation = config.heatDissipation ?? BRAKE_CONSTANTS.BRAKE_HEAT_DISSIPATION;
        
        // Handbrake
        /** @type {number} Handbrake force multiplier */
        this.handbrakeForce = config.handbrakeForce ?? BRAKE_CONSTANTS.HANDBRAKE_FORCE_MULTIPLIER;
        
        // Current state
        /** @type {number} Brake pedal input (0-1) */
        this.pedalInput = 0;
        
        /** @type {boolean} Handbrake engaged */
        this.handbrakeEngaged = false;
        
        // Per-wheel state
        this.wheels = {
            frontLeft: this.createWheelBrakeState('front'),
            frontRight: this.createWheelBrakeState('front'),
            rearLeft: this.createWheelBrakeState('rear'),
            rearRight: this.createWheelBrakeState('rear')
        };
        
        // ABS state
        this.absActive = false;
        this.absTimer = 0;
        
        // Damage
        /** @type {number} Overall brake system damage (0-1) */
        this.damage = 0;
    }

    /**
     * Create initial state for a wheel brake
     * @param {string} position - 'front' or 'rear'
     * @returns {Object} Wheel brake state
     */
    createWheelBrakeState(position) {
        const isFront = position === 'front';
        return {
            position,
            temperature: 20,
            wear: 0,
            damage: 0,
            absActive: false,
            absPhase: 0,
            outputForce: 0,
            fadeMultiplier: 1.0,
            // Physical specs
            discDiameter: isFront 
                ? BRAKE_CONSTANTS.BRAKE_DISC_DIAMETER_FRONT 
                : BRAKE_CONSTANTS.BRAKE_DISC_DIAMETER_REAR
        };
    }

    /**
     * Update brake system
     * @param {number} deltaTime - Time step in seconds
     * @param {Object} wheelStates - States of all wheels (slip ratios, speeds)
     * @param {number} vehicleSpeed - Vehicle speed in m/s
     * @returns {Object} Brake torques for each wheel
     */
    update(deltaTime, wheelStates, vehicleSpeed) {
        // Update ABS timer
        this.absTimer += deltaTime;
        
        // Calculate base brake forces
        const forces = this.calculateBrakeForces(wheelStates, vehicleSpeed);
        
        // Update temperatures and fade
        this.updateTemperatures(deltaTime, forces, vehicleSpeed);
        
        // Apply brake fade
        this.applyBrakeFade(forces);
        
        // Process ABS if needed
        if (this.absEnabled && this.pedalInput > 0.1) {
            this.processABS(forces, wheelStates);
        }
        
        // Apply damage effects
        this.applyDamageEffects(forces);
        
        // Convert forces to torques
        return this.forcesToTorques(forces);
    }

    /**
     * Calculate brake forces for each wheel
     * @param {Object} wheelStates - Wheel states
     * @param {number} vehicleSpeed - Vehicle speed
     * @returns {Object} Brake forces per wheel
     */
    calculateBrakeForces(wheelStates, vehicleSpeed) {
        const totalForce = this.pedalInput * this.maxBrakeForce;
        const frontForce = totalForce * this.brakeBias;
        const rearForce = totalForce * (1 - this.brakeBias);
        
        const forces = {
            frontLeft: frontForce / 2,
            frontRight: frontForce / 2,
            rearLeft: rearForce / 2,
            rearRight: rearForce / 2
        };
        
        // Apply handbrake (rear wheels only)
        if (this.handbrakeEngaged) {
            const handbrakeForceAmount = this.maxBrakeForce * this.handbrakeForce * 0.5;
            forces.rearLeft += handbrakeForceAmount / 2;
            forces.rearRight += handbrakeForceAmount / 2;
        }
        
        return forces;
    }

    /**
     * Update brake temperatures
     * @param {number} deltaTime - Time step
     * @param {Object} forces - Current brake forces
     * @param {number} vehicleSpeed - Vehicle speed
     */
    updateTemperatures(deltaTime, forces, vehicleSpeed) {
        for (const [wheelName, wheel] of Object.entries(this.wheels)) {
            const force = forces[wheelName] ?? 0;
            
            // Heat generation from braking
            const heatInput = force * vehicleSpeed * this.heatGeneration * deltaTime;
            
            // Heat dissipation (increases with speed due to airflow)
            const airflowFactor = 1 + vehicleSpeed * 0.05;
            const ambientTemp = 25;
            const heatLoss = (wheel.temperature - ambientTemp) * 
                            this.heatDissipation * 
                            airflowFactor * 
                            deltaTime;
            
            // Update temperature
            wheel.temperature += heatInput - heatLoss;
            wheel.temperature = MathUtils.clamp(wheel.temperature, ambientTemp, 800);
            
            // Update brake pad wear
            if (force > 0 && vehicleSpeed > 1) {
                const wearRate = force * vehicleSpeed * 0.0000001;
                wheel.wear = MathUtils.clamp(wheel.wear + wearRate * deltaTime, 0, 1);
            }
        }
    }

    /**
     * Apply brake fade based on temperature
     * @param {Object} forces - Brake forces to modify
     */
    applyBrakeFade(forces) {
        for (const [wheelName, wheel] of Object.entries(this.wheels)) {
            // Calculate fade multiplier based on temperature
            if (wheel.temperature > this.fadeStartTemp) {
                const fadeProgress = MathUtils.inverseLerp(
                    this.fadeStartTemp,
                    this.fadeFullTemp,
                    wheel.temperature
                );
                wheel.fadeMultiplier = MathUtils.lerp(1.0, 0.3, fadeProgress);
            } else {
                wheel.fadeMultiplier = 1.0;
            }
            
            // Also reduce effectiveness with wear
            const wearMultiplier = 1 - wheel.wear * 0.3;
            
            // Apply multipliers
            forces[wheelName] *= wheel.fadeMultiplier * wearMultiplier;
            wheel.outputForce = forces[wheelName];
        }
    }

    /**
     * Process ABS intervention
     * @param {Object} forces - Brake forces to modify
     * @param {Object} wheelStates - Current wheel states
     */
    processABS(forces, wheelStates) {
        this.absActive = false;
        
        for (const [wheelName, wheel] of Object.entries(this.wheels)) {
            const wheelState = wheelStates[wheelName];
            if (!wheelState) continue;
            
            const slipRatio = Math.abs(wheelState.slipRatio ?? 0);
            
            // Check if ABS should intervene
            if (slipRatio > this.absThreshold) {
                wheel.absActive = true;
                this.absActive = true;
                
                // Cycle ABS
                const cycleTime = 1 / this.absFrequency;
                wheel.absPhase = (this.absTimer % cycleTime) / cycleTime;
                
                // Modulate brake force
                if (wheel.absPhase < 0.5) {
                    // Release phase
                    forces[wheelName] *= 0.3;
                } else {
                    // Apply phase
                    forces[wheelName] *= 0.8;
                }
            } else if (slipRatio < this.absRelease) {
                wheel.absActive = false;
            }
        }
    }

    /**
     * Apply damage effects to brake forces
     * @param {Object} forces - Brake forces to modify
     */
    applyDamageEffects(forces) {
        for (const [wheelName, wheel] of Object.entries(this.wheels)) {
            const damageMultiplier = 1 - (wheel.damage + this.damage) * 0.5;
            forces[wheelName] *= Math.max(0, damageMultiplier);
        }
    }

    /**
     * Convert brake forces to torques
     * @param {Object} forces - Brake forces
     * @returns {Object} Brake torques per wheel
     */
    forcesToTorques(forces) {
        const torques = {};
        
        for (const [wheelName, wheel] of Object.entries(this.wheels)) {
            // Torque = Force * effective radius (disc radius)
            const effectiveRadius = wheel.discDiameter / 2;
            torques[wheelName] = forces[wheelName] * effectiveRadius * this.padFriction;
        }
        
        return torques;
    }

    /**
     * Set brake pedal input
     * @param {number} input - Pedal input (0-1)
     */
    setBrakeInput(input) {
        this.pedalInput = MathUtils.clamp(input, 0, 1);
    }

    /**
     * Set handbrake state
     * @param {boolean} engaged - Handbrake engaged
     */
    setHandbrake(engaged) {
        this.handbrakeEngaged = engaged;
    }

    /**
     * Adjust brake bias
     * @param {number} bias - Front bias (0-1)
     */
    setBrakeBias(bias) {
        this.brakeBias = MathUtils.clamp(bias, 0.3, 0.8);
    }

    /**
     * Enable/disable ABS
     * @param {boolean} enabled - ABS enabled
     */
    setABSEnabled(enabled) {
        this.absEnabled = enabled;
    }

    /**
     * Apply damage to brakes
     * @param {string} wheel - Wheel name (or 'all' for system damage)
     * @param {number} amount - Damage amount
     */
    applyDamage(wheel, amount) {
        if (wheel === 'all') {
            this.damage = MathUtils.clamp(this.damage + amount, 0, 1);
        } else if (this.wheels[wheel]) {
            this.wheels[wheel].damage = MathUtils.clamp(
                this.wheels[wheel].damage + amount, 0, 1
            );
        }
    }

    /**
     * Get brake system state for telemetry
     * @returns {Object} Brake system state
     */
    getState() {
        return {
            pedalInput: this.pedalInput,
            handbrakeEngaged: this.handbrakeEngaged,
            brakeBias: this.brakeBias,
            absEnabled: this.absEnabled,
            absActive: this.absActive,
            systemDamage: this.damage,
            wheels: Object.fromEntries(
                Object.entries(this.wheels).map(([name, wheel]) => [
                    name,
                    {
                        temperature: wheel.temperature,
                        wear: wheel.wear,
                        damage: wheel.damage,
                        fadeMultiplier: wheel.fadeMultiplier,
                        absActive: wheel.absActive,
                        outputForce: wheel.outputForce
                    }
                ])
            )
        };
    }

    /**
     * Get average brake temperature
     * @returns {number} Average temperature
     */
    getAverageTemperature() {
        let sum = 0;
        for (const wheel of Object.values(this.wheels)) {
            sum += wheel.temperature;
        }
        return sum / 4;
    }

    /**
     * Check if brakes are overheating
     * @returns {boolean} True if any brake is overheating
     */
    isOverheating() {
        for (const wheel of Object.values(this.wheels)) {
            if (wheel.temperature > this.fadeStartTemp) {
                return true;
            }
        }
        return false;
    }

    /**
     * Reset brakes to initial state
     */
    reset() {
        this.pedalInput = 0;
        this.handbrakeEngaged = false;
        this.absActive = false;
        this.absTimer = 0;
        this.damage = 0;
        
        for (const wheel of Object.values(this.wheels)) {
            wheel.temperature = 20;
            wheel.wear = 0;
            wheel.damage = 0;
            wheel.absActive = false;
            wheel.absPhase = 0;
            wheel.outputForce = 0;
            wheel.fadeMultiplier = 1.0;
        }
    }

    /**
     * Serialize to JSON
     * @returns {Object} JSON representation
     */
    toJSON() {
        return {
            brakeBias: this.brakeBias,
            absEnabled: this.absEnabled,
            damage: this.damage,
            wheels: Object.fromEntries(
                Object.entries(this.wheels).map(([name, wheel]) => [
                    name,
                    {
                        temperature: wheel.temperature,
                        wear: wheel.wear,
                        damage: wheel.damage
                    }
                ])
            )
        };
    }

    /**
     * Create from JSON
     * @param {Object} json - JSON object
     * @returns {Brakes} New instance
     */
    static fromJSON(json) {
        const brakes = new Brakes({ 
            brakeBias: json.brakeBias,
            absEnabled: json.absEnabled
        });
        brakes.damage = json.damage ?? 0;
        
        if (json.wheels) {
            for (const [name, data] of Object.entries(json.wheels)) {
                if (brakes.wheels[name]) {
                    brakes.wheels[name].temperature = data.temperature ?? 20;
                    brakes.wheels[name].wear = data.wear ?? 0;
                    brakes.wheels[name].damage = data.damage ?? 0;
                }
            }
        }
        
        return brakes;
    }
}

export default Brakes;
