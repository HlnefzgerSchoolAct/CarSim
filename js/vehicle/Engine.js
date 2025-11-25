/**
 * Engine.js - Engine Simulation System
 * 
 * Simulates a realistic internal combustion engine with torque curves,
 * RPM management, turbo/supercharger simulation, and thermal management.
 * 
 * @module vehicle/Engine
 * @author CarSim Development Team
 * @version 2.0.0
 */

import { ENGINE_CONSTANTS } from '../core/Constants.js';
import { MathUtils } from '../utils/MathUtils.js';

/**
 * @class Engine
 * @description Simulates a vehicle engine with realistic torque curves and dynamics
 */
export class Engine {
    /**
     * Creates a new Engine instance
     * @param {Object} [config] - Engine configuration
     */
    constructor(config = {}) {
        // Engine specifications
        /** @type {number} Maximum torque in Nm */
        this.maxTorque = config.maxTorque ?? ENGINE_CONSTANTS.MAX_TORQUE;
        
        /** @type {number} RPM at which max torque occurs */
        this.maxTorqueRPM = config.maxTorqueRPM ?? ENGINE_CONSTANTS.MAX_TORQUE_RPM;
        
        /** @type {number} Maximum power in kW */
        this.maxPower = config.maxPower ?? ENGINE_CONSTANTS.MAX_POWER;
        
        /** @type {number} RPM at which max power occurs */
        this.maxPowerRPM = config.maxPowerRPM ?? ENGINE_CONSTANTS.MAX_POWER_RPM;
        
        /** @type {number} Idle RPM */
        this.idleRPM = config.idleRPM ?? ENGINE_CONSTANTS.IDLE_RPM;
        
        /** @type {number} Redline RPM */
        this.redlineRPM = config.redlineRPM ?? ENGINE_CONSTANTS.REDLINE_RPM;
        
        /** @type {number} Rev limiter RPM */
        this.revLimiterRPM = config.revLimiterRPM ?? ENGINE_CONSTANTS.REV_LIMITER_RPM;
        
        /** @type {number} Engine moment of inertia in kg·m² */
        this.inertia = config.inertia ?? ENGINE_CONSTANTS.ENGINE_INERTIA;
        
        /** @type {number} Flywheel inertia in kg·m² */
        this.flywheelInertia = config.flywheelInertia ?? ENGINE_CONSTANTS.FLYWHEEL_INERTIA;
        
        /** @type {number} Engine friction coefficient */
        this.friction = config.friction ?? ENGINE_CONSTANTS.ENGINE_FRICTION;
        
        /** @type {Array} Torque curve lookup table */
        this.torqueCurve = config.torqueCurve ?? ENGINE_CONSTANTS.TORQUE_CURVE;
        
        // Turbo/supercharger configuration
        /** @type {number} Turbo boost pressure in bar (0 = N/A) */
        this.turboBoost = config.turboBoost ?? ENGINE_CONSTANTS.TURBO_BOOST;
        
        /** @type {number} Turbo lag time constant */
        this.turboLag = config.turboLag ?? ENGINE_CONSTANTS.TURBO_LAG;
        
        /** @type {number} Turbo spool rate */
        this.turboSpoolRate = config.turboSpoolRate ?? ENGINE_CONSTANTS.TURBO_SPOOL_RATE;
        
        // Current state
        /** @type {number} Current RPM */
        this.rpm = this.idleRPM;
        
        /** @type {number} Current throttle position (0-1) */
        this.throttle = 0;
        
        /** @type {number} Current turbo pressure (0-1 of max boost) */
        this.turboPressure = 0;
        
        /** @type {boolean} Engine running state */
        this.running = true;
        
        /** @type {boolean} Rev limiter active */
        this.revLimiterActive = false;
        
        /** @type {number} Engine temperature in Celsius */
        this.temperature = 80;
        
        /** @type {number} Optimal operating temperature */
        this.optimalTemperature = config.optimalTemperature ?? 90;
        
        /** @type {number} Overheat temperature */
        this.overheatTemperature = config.overheatTemperature ?? 120;
        
        /** @type {number} Engine oil pressure (normalized 0-1) */
        this.oilPressure = 1.0;
        
        /** @type {number} Fuel consumption rate in L/h at current state */
        this.fuelConsumption = 0;
        
        /** @type {number} Engine damage level (0-1) */
        this.damage = 0;
        
        // Internal calculations
        this._totalInertia = this.inertia + this.flywheelInertia;
        this._lastTorque = 0;
        this._lastPower = 0;
        
        // Rev limiter timing
        this._revLimiterCutTime = 0;
        this._revLimiterCutDuration = 0.05; // 50ms fuel cut
    }

    /**
     * Update engine state
     * @param {number} deltaTime - Time step in seconds
     * @param {number} throttleInput - Throttle input (0-1)
     * @param {number} clutchEngaged - Clutch engagement (0-1)
     * @param {number} resistanceTorque - Torque resisting engine from drivetrain
     */
    update(deltaTime, throttleInput, clutchEngaged, resistanceTorque = 0) {
        if (!this.running) {
            this.rpm = 0;
            return;
        }
        
        // Apply throttle with damage effects
        this.throttle = throttleInput * (1 - this.damage * 0.5);
        
        // Update turbo pressure
        this.updateTurbo(deltaTime);
        
        // Check rev limiter
        this.updateRevLimiter(deltaTime);
        
        // Calculate engine torque output
        let outputTorque = this.calculateTorque(this.rpm, this.throttle);
        
        // Apply rev limiter (fuel cut)
        if (this.revLimiterActive) {
            outputTorque *= 0.1; // Dramatic torque reduction
        }
        
        // Calculate net torque (output - friction - resistance from drivetrain)
        const frictionTorque = this.calculateFrictionTorque(this.rpm);
        const netTorque = outputTorque - frictionTorque - (resistanceTorque * clutchEngaged);
        
        // Update RPM based on angular acceleration
        const angularAcceleration = netTorque / this._totalInertia;
        this.rpm += angularAcceleration * deltaTime * (60 / (2 * Math.PI)); // Convert rad/s² to RPM/s
        
        // Apply idle control
        if (this.rpm < this.idleRPM && this.throttle < 0.1) {
            const idleCorrection = (this.idleRPM - this.rpm) * 5;
            this.rpm += idleCorrection * deltaTime;
        }
        
        // Clamp RPM
        this.rpm = MathUtils.clamp(this.rpm, 0, this.revLimiterRPM + 100);
        
        // Stall detection
        if (this.rpm < 300 && clutchEngaged > 0.5) {
            this.running = false;
            this.rpm = 0;
        }
        
        // Update temperature
        this.updateTemperature(deltaTime);
        
        // Calculate fuel consumption
        this.calculateFuelConsumption();
        
        // Store last values
        this._lastTorque = outputTorque;
        this._lastPower = this.calculatePower(this.rpm, outputTorque);
    }

    /**
     * Calculate torque at given RPM and throttle
     * @param {number} rpm - Engine RPM
     * @param {number} throttle - Throttle position (0-1)
     * @returns {number} Torque in Nm
     */
    calculateTorque(rpm, throttle) {
        // Get base torque from curve
        const baseTorque = this.sampleTorqueCurve(rpm) * this.maxTorque;
        
        // Apply throttle
        let torque = baseTorque * throttle;
        
        // Apply turbo boost
        if (this.turboBoost > 0) {
            const boostMultiplier = 1 + this.turboPressure * this.turboBoost * 0.3;
            torque *= boostMultiplier;
        }
        
        // Temperature effects
        const tempEffect = this.getTemperatureEffect();
        torque *= tempEffect;
        
        // Damage effects
        torque *= (1 - this.damage * 0.4);
        
        return torque;
    }

    /**
     * Sample the torque curve at a given RPM
     * @param {number} rpm - Engine RPM
     * @returns {number} Torque multiplier (0-1)
     */
    sampleTorqueCurve(rpm) {
        return MathUtils.sampleLookupTable(this.torqueCurve, rpm);
    }

    /**
     * Calculate engine power
     * @param {number} rpm - Engine RPM
     * @param {number} torque - Torque in Nm
     * @returns {number} Power in kW
     */
    calculatePower(rpm, torque) {
        // P = T * ω = T * (2π * RPM / 60) / 1000 for kW
        return (torque * 2 * Math.PI * rpm / 60) / 1000;
    }

    /**
     * Calculate friction torque
     * @param {number} rpm - Engine RPM
     * @returns {number} Friction torque in Nm
     */
    calculateFrictionTorque(rpm) {
        // Friction increases with RPM
        const baseFriction = this.friction * this.maxTorque;
        const rpmFactor = rpm / this.redlineRPM;
        return baseFriction * (1 + rpmFactor);
    }

    /**
     * Update turbo state
     * @param {number} deltaTime - Time step
     */
    updateTurbo(deltaTime) {
        if (this.turboBoost <= 0) return;
        
        // Target turbo pressure based on RPM and throttle
        const rpmFactor = MathUtils.clamp((this.rpm - 2000) / 4000, 0, 1);
        const targetPressure = this.throttle * rpmFactor;
        
        // Spool up/down with lag
        const spoolRate = targetPressure > this.turboPressure 
            ? this.turboSpoolRate 
            : this.turboSpoolRate * 2; // Faster spool down
        
        this.turboPressure = MathUtils.damp(
            this.turboPressure, 
            targetPressure, 
            spoolRate / this.turboLag, 
            deltaTime
        );
    }

    /**
     * Update rev limiter state
     * @param {number} deltaTime - Time step
     */
    updateRevLimiter(deltaTime) {
        if (this.rpm >= this.revLimiterRPM) {
            this.revLimiterActive = true;
            this._revLimiterCutTime = this._revLimiterCutDuration;
        } else if (this._revLimiterCutTime > 0) {
            this._revLimiterCutTime -= deltaTime;
            if (this._revLimiterCutTime <= 0) {
                this.revLimiterActive = false;
            }
        }
    }

    /**
     * Update engine temperature
     * @param {number} deltaTime - Time step
     */
    updateTemperature(deltaTime) {
        // Heat generation from operation
        const heatGeneration = (this.throttle * this.rpm / this.redlineRPM) * 50;
        
        // Cooling (simplified - assumes radiator working)
        const ambientTemp = 25;
        const coolingRate = 0.5 * (this.temperature - ambientTemp);
        
        // Damage affects cooling
        const coolingEfficiency = 1 - this.damage * 0.5;
        
        // Update temperature
        this.temperature += (heatGeneration - coolingRate * coolingEfficiency) * deltaTime;
        this.temperature = MathUtils.clamp(this.temperature, ambientTemp, 150);
        
        // Overheating damage
        if (this.temperature > this.overheatTemperature) {
            this.damage += (this.temperature - this.overheatTemperature) * 0.0001 * deltaTime;
            this.damage = MathUtils.clamp(this.damage, 0, 1);
        }
    }

    /**
     * Get temperature effect on performance
     * @returns {number} Performance multiplier (0.5-1.1)
     */
    getTemperatureEffect() {
        if (this.temperature < 60) {
            // Cold engine - reduced performance
            return MathUtils.remap(this.temperature, 20, 60, 0.7, 1.0);
        } else if (this.temperature > 100) {
            // Hot engine - reduced performance
            return MathUtils.remap(this.temperature, 100, 130, 1.0, 0.6);
        }
        // Optimal temperature
        return 1.0;
    }

    /**
     * Calculate fuel consumption
     */
    calculateFuelConsumption() {
        // Base consumption at idle
        const idleConsumption = 1.5; // L/h
        
        // Additional consumption based on load and RPM
        const loadFactor = this.throttle * (this._lastTorque / this.maxTorque);
        const rpmFactor = this.rpm / this.redlineRPM;
        
        this.fuelConsumption = idleConsumption + loadFactor * rpmFactor * 30;
    }

    /**
     * Set throttle input
     * @param {number} value - Throttle value (0-1)
     */
    setThrottle(value) {
        this.throttle = MathUtils.clamp(value, 0, 1);
    }

    /**
     * Start the engine
     */
    start() {
        if (this.damage < 0.9) {
            this.running = true;
            this.rpm = this.idleRPM;
        }
    }

    /**
     * Stop the engine
     */
    stop() {
        this.running = false;
    }

    /**
     * Apply damage to engine
     * @param {number} amount - Damage amount (0-1)
     */
    applyDamage(amount) {
        this.damage = MathUtils.clamp(this.damage + amount, 0, 1);
        
        // Severe damage can stop engine
        if (this.damage > 0.9 && Math.random() < 0.1) {
            this.stop();
        }
    }

    /**
     * Get current RPM
     * @returns {number} Current RPM
     */
    getRPM() {
        return this.rpm;
    }

    /**
     * Get current torque output
     * @returns {number} Current torque in Nm
     */
    getTorque() {
        return this._lastTorque;
    }

    /**
     * Get current power output
     * @returns {number} Current power in kW
     */
    getPower() {
        return this._lastPower;
    }

    /**
     * Get RPM as percentage of redline
     * @returns {number} RPM percentage (0-1+)
     */
    getRPMPercentage() {
        return this.rpm / this.redlineRPM;
    }

    /**
     * Check if in redline zone
     * @returns {boolean} True if RPM is near redline
     */
    isInRedline() {
        return this.rpm > this.redlineRPM * 0.9;
    }

    /**
     * Get engine angular velocity in rad/s
     * @returns {number} Angular velocity
     */
    getAngularVelocity() {
        return this.rpm * 2 * Math.PI / 60;
    }

    /**
     * Get total rotational inertia
     * @returns {number} Inertia in kg·m²
     */
    getTotalInertia() {
        return this._totalInertia;
    }

    /**
     * Generate power curve data for visualization
     * @returns {Array<{rpm: number, torque: number, power: number}>} Power curve data
     */
    generatePowerCurve() {
        const data = [];
        const steps = 100;
        
        for (let i = 0; i <= steps; i++) {
            const rpm = (i / steps) * this.revLimiterRPM;
            const torque = this.calculateTorque(rpm, 1.0);
            const power = this.calculatePower(rpm, torque);
            
            data.push({ rpm, torque, power });
        }
        
        return data;
    }

    /**
     * Reset engine to initial state
     */
    reset() {
        this.rpm = this.idleRPM;
        this.throttle = 0;
        this.turboPressure = 0;
        this.temperature = 80;
        this.damage = 0;
        this.running = true;
        this.revLimiterActive = false;
    }

    /**
     * Serialize to JSON
     * @returns {Object} JSON representation
     */
    toJSON() {
        return {
            maxTorque: this.maxTorque,
            maxTorqueRPM: this.maxTorqueRPM,
            idleRPM: this.idleRPM,
            redlineRPM: this.redlineRPM,
            revLimiterRPM: this.revLimiterRPM,
            turboBoost: this.turboBoost,
            torqueCurve: this.torqueCurve,
            // Current state
            rpm: this.rpm,
            temperature: this.temperature,
            damage: this.damage,
            running: this.running
        };
    }

    /**
     * Create from JSON
     * @param {Object} json - JSON object
     * @returns {Engine} New Engine instance
     */
    static fromJSON(json) {
        const engine = new Engine(json);
        engine.rpm = json.rpm ?? engine.idleRPM;
        engine.temperature = json.temperature ?? 80;
        engine.damage = json.damage ?? 0;
        engine.running = json.running ?? true;
        return engine;
    }
}

export default Engine;
