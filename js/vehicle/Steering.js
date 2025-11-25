/**
 * Steering.js - Steering System Simulation
 * 
 * Simulates realistic steering behavior with Ackermann geometry,
 * speed-sensitive steering, and self-aligning torque.
 * 
 * @module vehicle/Steering
 * @author CarSim Development Team
 * @version 2.0.0
 */

import { STEERING_CONSTANTS, VEHICLE_CONSTANTS } from '../core/Constants.js';
import { MathUtils } from '../utils/MathUtils.js';

/**
 * @class Steering
 * @description Simulates the vehicle steering system
 */
export class Steering {
    /**
     * Creates a new Steering instance
     * @param {Object} [config] - Steering configuration
     */
    constructor(config = {}) {
        // Steering specifications
        /** @type {number} Maximum steering angle in radians */
        this.maxSteeringAngle = config.maxSteeringAngle ?? STEERING_CONSTANTS.MAX_STEERING_ANGLE;
        
        /** @type {number} Steering rack ratio */
        this.steeringRatio = config.steeringRatio ?? STEERING_CONSTANTS.STEERING_RATIO;
        
        /** @type {number} Lock-to-lock turns */
        this.lockToLock = config.lockToLock ?? STEERING_CONSTANTS.STEERING_LOCK_TO_LOCK;
        
        // Speed-sensitive steering
        /** @type {number} Speed sensitivity factor */
        this.speedSensitiveFactor = config.speedSensitiveFactor ?? STEERING_CONSTANTS.SPEED_SENSITIVE_FACTOR;
        
        /** @type {number} Minimum steering ratio at speed */
        this.minSteeringAtSpeed = config.minSteeringAtSpeed ?? STEERING_CONSTANTS.MIN_STEERING_AT_SPEED;
        
        // Power steering
        /** @type {number} Power steering assist level (0-1) */
        this.powerSteeringAssist = config.powerSteeringAssist ?? STEERING_CONSTANTS.POWER_STEERING_ASSIST;
        
        // Self-aligning
        /** @type {number} Self-aligning torque coefficient */
        this.selfAligningCoefficient = config.selfAligningCoefficient ?? STEERING_CONSTANTS.SELF_ALIGNING_TORQUE;
        
        // Steering return
        /** @type {number} Steering return rate */
        this.returnRate = config.returnRate ?? STEERING_CONSTANTS.STEERING_RETURN_RATE;
        
        // Input smoothing
        /** @type {number} Steering input smoothing factor */
        this.smoothing = config.smoothing ?? STEERING_CONSTANTS.STEERING_SMOOTHING;
        
        // Ackermann geometry
        /** @type {number} Ackermann percentage (0-1) */
        this.ackermannPercentage = config.ackermannPercentage ?? STEERING_CONSTANTS.ACKERMANN_PERCENTAGE;
        
        // Vehicle geometry
        /** @type {number} Wheelbase in meters */
        this.wheelbase = config.wheelbase ?? VEHICLE_CONSTANTS.WHEELBASE;
        
        /** @type {number} Track width in meters */
        this.trackWidth = config.trackWidth ?? VEHICLE_CONSTANTS.TRACK_WIDTH;
        
        // Current state
        /** @type {number} Steering input (-1 to 1) */
        this.input = 0;
        
        /** @type {number} Smoothed input */
        this.smoothedInput = 0;
        
        /** @type {number} Current steering angle in radians */
        this.steeringAngle = 0;
        
        /** @type {number} Steering wheel position in radians */
        this.wheelPosition = 0;
        
        /** @type {number} Self-aligning torque feedback */
        this.aligningTorque = 0;
        
        // Wheel angles (after Ackermann)
        /** @type {number} Left front wheel angle */
        this.leftWheelAngle = 0;
        
        /** @type {number} Right front wheel angle */
        this.rightWheelAngle = 0;
        
        // Damage
        /** @type {number} Steering damage (0-1) */
        this.damage = 0;
        
        /** @type {number} Steering offset from damage */
        this.damageOffset = 0;
    }

    /**
     * Update steering system
     * @param {number} deltaTime - Time step in seconds
     * @param {number} vehicleSpeed - Vehicle speed in m/s
     * @param {number} aligningTorqueFromTires - Combined aligning torque from tires
     * @returns {Object} Wheel angles
     */
    update(deltaTime, vehicleSpeed, aligningTorqueFromTires = 0) {
        // Apply input smoothing
        this.smoothedInput = MathUtils.damp(
            this.smoothedInput,
            this.input,
            1 / this.smoothing,
            deltaTime
        );
        
        // Calculate speed-sensitive steering reduction
        const speedFactor = this.calculateSpeedFactor(vehicleSpeed);
        
        // Calculate target steering angle
        const targetAngle = this.smoothedInput * this.maxSteeringAngle * speedFactor;
        
        // Apply steering with rate limiting
        const maxSteeringRate = 2.0; // rad/s
        this.steeringAngle = MathUtils.moveTowards(
            this.steeringAngle,
            targetAngle,
            maxSteeringRate * deltaTime
        );
        
        // Apply damage offset
        this.steeringAngle += this.damageOffset;
        
        // Apply damage effects (reduced responsiveness)
        this.steeringAngle *= (1 - this.damage * 0.3);
        
        // Calculate self-aligning effect
        this.aligningTorque = aligningTorqueFromTires;
        
        // Apply self-return when no input
        if (Math.abs(this.input) < 0.05 && Math.abs(vehicleSpeed) > 1) {
            const returnForce = -this.steeringAngle * this.returnRate * speedFactor;
            const aligningForce = -Math.sign(this.steeringAngle) * 
                                  Math.abs(this.aligningTorque) * 
                                  this.selfAligningCoefficient;
            
            this.steeringAngle += (returnForce + aligningForce) * deltaTime;
        }
        
        // Calculate steering wheel position
        this.wheelPosition = this.steeringAngle * this.steeringRatio;
        
        // Calculate individual wheel angles with Ackermann
        this.calculateAckermann();
        
        // Clamp final angles
        this.leftWheelAngle = MathUtils.clamp(
            this.leftWheelAngle, 
            -this.maxSteeringAngle, 
            this.maxSteeringAngle
        );
        this.rightWheelAngle = MathUtils.clamp(
            this.rightWheelAngle, 
            -this.maxSteeringAngle, 
            this.maxSteeringAngle
        );
        
        return {
            left: this.leftWheelAngle,
            right: this.rightWheelAngle,
            center: this.steeringAngle
        };
    }

    /**
     * Calculate speed-sensitive steering factor
     * @param {number} speed - Vehicle speed in m/s
     * @returns {number} Steering reduction factor (0-1)
     */
    calculateSpeedFactor(speed) {
        const speedKmh = Math.abs(speed) * 3.6;
        
        // Reduce steering at high speed
        const reduction = 1 - (speedKmh * this.speedSensitiveFactor);
        return MathUtils.clamp(reduction, this.minSteeringAtSpeed, 1);
    }

    /**
     * Calculate Ackermann steering geometry
     * Ackermann ensures both front wheels point towards the same turn center
     */
    calculateAckermann() {
        if (Math.abs(this.steeringAngle) < 0.001) {
            this.leftWheelAngle = 0;
            this.rightWheelAngle = 0;
            return;
        }
        
        // Calculate turn radius from center steering angle
        const turnRadius = this.wheelbase / Math.tan(Math.abs(this.steeringAngle));
        
        // Calculate ideal Ackermann angles
        // Inside wheel turns more, outside wheel turns less
        const innerAngle = Math.atan(this.wheelbase / (turnRadius - this.trackWidth / 2));
        const outerAngle = Math.atan(this.wheelbase / (turnRadius + this.trackWidth / 2));
        
        // Blend between parallel steering and full Ackermann
        const parallelAngle = Math.abs(this.steeringAngle);
        const ackermannInner = MathUtils.lerp(parallelAngle, innerAngle, this.ackermannPercentage);
        const ackermannOuter = MathUtils.lerp(parallelAngle, outerAngle, this.ackermannPercentage);
        
        // Apply to left/right based on turn direction
        if (this.steeringAngle > 0) {
            // Turning left
            this.leftWheelAngle = ackermannInner;
            this.rightWheelAngle = ackermannOuter;
        } else {
            // Turning right
            this.leftWheelAngle = -ackermannOuter;
            this.rightWheelAngle = -ackermannInner;
        }
    }

    /**
     * Calculate theoretical turn radius
     * @returns {number} Turn radius in meters (Infinity if going straight)
     */
    calculateTurnRadius() {
        if (Math.abs(this.steeringAngle) < 0.001) {
            return Infinity;
        }
        return this.wheelbase / Math.tan(Math.abs(this.steeringAngle));
    }

    /**
     * Calculate steering force feedback
     * @param {number} vehicleSpeed - Vehicle speed
     * @param {number} lateralG - Lateral G-force
     * @returns {number} Force feedback value (-1 to 1)
     */
    calculateForceFeedback(vehicleSpeed, lateralG) {
        let feedback = 0;
        
        // Self-aligning torque contribution
        feedback += this.aligningTorque * 0.1;
        
        // Lateral G contribution
        feedback += lateralG * 0.3;
        
        // Speed contribution (heavier at speed)
        const speedFactor = Math.min(vehicleSpeed / 30, 1);
        feedback += this.steeringAngle * speedFactor * 0.2;
        
        // Apply power steering assist reduction
        feedback *= (1 - this.powerSteeringAssist * 0.7);
        
        return MathUtils.clamp(feedback, -1, 1);
    }

    /**
     * Set steering input
     * @param {number} value - Input value (-1 to 1)
     */
    setInput(value) {
        this.input = MathUtils.clamp(value, -1, 1);
    }

    /**
     * Set steering angle directly (for AI/replay)
     * @param {number} angle - Steering angle in radians
     */
    setSteeringAngle(angle) {
        this.steeringAngle = MathUtils.clamp(angle, -this.maxSteeringAngle, this.maxSteeringAngle);
        this.input = this.steeringAngle / this.maxSteeringAngle;
        this.smoothedInput = this.input;
        this.calculateAckermann();
    }

    /**
     * Apply damage to steering
     * @param {number} amount - Damage amount (0-1)
     * @param {number} [offset=0] - Additional steering offset
     */
    applyDamage(amount, offset = 0) {
        this.damage = MathUtils.clamp(this.damage + amount, 0, 1);
        this.damageOffset += offset;
        this.damageOffset = MathUtils.clamp(this.damageOffset, -0.2, 0.2);
    }

    /**
     * Get steering state for telemetry
     * @returns {Object} Steering state
     */
    getState() {
        return {
            input: this.input,
            smoothedInput: this.smoothedInput,
            steeringAngle: this.steeringAngle,
            steeringAngleDegrees: MathUtils.radToDeg(this.steeringAngle),
            wheelPosition: this.wheelPosition,
            wheelPositionDegrees: MathUtils.radToDeg(this.wheelPosition),
            leftWheelAngle: this.leftWheelAngle,
            rightWheelAngle: this.rightWheelAngle,
            aligningTorque: this.aligningTorque,
            turnRadius: this.calculateTurnRadius(),
            damage: this.damage,
            damageOffset: this.damageOffset
        };
    }

    /**
     * Get steering angle in degrees
     * @returns {number} Steering angle in degrees
     */
    getAngleDegrees() {
        return MathUtils.radToDeg(this.steeringAngle);
    }

    /**
     * Get steering wheel rotation in degrees
     * @returns {number} Wheel rotation in degrees
     */
    getWheelRotationDegrees() {
        return MathUtils.radToDeg(this.wheelPosition);
    }

    /**
     * Reset steering to center
     */
    reset() {
        this.input = 0;
        this.smoothedInput = 0;
        this.steeringAngle = 0;
        this.wheelPosition = 0;
        this.aligningTorque = 0;
        this.leftWheelAngle = 0;
        this.rightWheelAngle = 0;
        this.damage = 0;
        this.damageOffset = 0;
    }

    /**
     * Serialize to JSON
     * @returns {Object} JSON representation
     */
    toJSON() {
        return {
            maxSteeringAngle: this.maxSteeringAngle,
            steeringRatio: this.steeringRatio,
            ackermannPercentage: this.ackermannPercentage,
            powerSteeringAssist: this.powerSteeringAssist,
            damage: this.damage,
            damageOffset: this.damageOffset
        };
    }

    /**
     * Create from JSON
     * @param {Object} json - JSON object
     * @returns {Steering} New instance
     */
    static fromJSON(json) {
        const steering = new Steering(json);
        steering.damage = json.damage ?? 0;
        steering.damageOffset = json.damageOffset ?? 0;
        return steering;
    }
}

export default Steering;
