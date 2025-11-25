/**
 * DriftController.js - Drift Physics Controller
 * 
 * Manages drift state, initiation, maintenance, and physics calculations
 * for realistic drifting behavior.
 * 
 * @module drift/DriftController
 * @author CarSim Development Team
 * @version 2.0.0
 */

import { DRIFT_CONSTANTS, TIRE_CONSTANTS } from '../core/Constants.js';
import { MathUtils } from '../utils/MathUtils.js';

/**
 * @class DriftController
 * @description Controls drift mechanics and physics
 */
export class DriftController {
    /**
     * Creates a new DriftController instance
     * @param {Object} [config] - Configuration options
     */
    constructor(config = {}) {
        // Drift thresholds
        /** @type {number} Minimum slip angle for drift in radians */
        this.driftAngleThreshold = config.driftAngleThreshold ?? DRIFT_CONSTANTS.DRIFT_ANGLE_THRESHOLD;
        
        /** @type {number} Minimum speed for drifting in m/s */
        this.driftSpeedThreshold = config.driftSpeedThreshold ?? DRIFT_CONSTANTS.DRIFT_SPEED_THRESHOLD;
        
        /** @type {number} Maximum drift angle before spin in radians */
        this.maxDriftAngle = config.maxDriftAngle ?? DRIFT_CONSTANTS.MAX_DRIFT_ANGLE;
        
        // Physics parameters
        /** @type {number} Counter-steer effectiveness */
        this.counterSteerFactor = config.counterSteerFactor ?? DRIFT_CONSTANTS.COUNTER_STEER_FACTOR;
        
        /** @type {number} Drift initiation force multiplier */
        this.initiationForce = config.initiationForce ?? DRIFT_CONSTANTS.DRIFT_INITIATION_FORCE;
        
        /** @type {number} Drift sustainability factor */
        this.sustainability = config.sustainability ?? DRIFT_CONSTANTS.DRIFT_SUSTAINABILITY;
        
        // Rear grip modifiers
        /** @type {number} Normal rear grip coefficient */
        this.normalRearGrip = config.normalRearGrip ?? 0.95;
        
        /** @type {number} Handbrake rear grip coefficient */
        this.handbrakeRearGrip = config.handbrakeRearGrip ?? 0.4;
        
        /** @type {number} Current rear grip coefficient */
        this.currentRearGrip = this.normalRearGrip;
        
        // Drift state
        /** @type {boolean} Currently drifting */
        this.isDrifting = false;
        
        /** @type {number} Current slip angle in radians */
        this.slipAngle = 0;
        
        /** @type {number} Drift direction (-1 = left, 1 = right) */
        this.driftDirection = 0;
        
        /** @type {number} Drift intensity (0-1) */
        this.driftIntensity = 0;
        
        /** @type {number} Time spent in current drift */
        this.driftDuration = 0;
        
        /** @type {boolean} Handbrake engaged */
        this.handbrakeActive = false;
        
        // Angular momentum
        /** @type {number} Additional angular velocity from drift */
        this.driftAngularVelocity = 0;
        
        // Velocity tracking
        /** @type {number} Forward velocity component */
        this.forwardVelocity = 0;
        
        /** @type {number} Lateral velocity component */
        this.lateralVelocity = 0;
        
        // Counter-steering detection
        /** @type {boolean} Is counter-steering */
        this.isCounterSteering = false;
        
        /** @type {number} Counter-steer amount */
        this.counterSteerAmount = 0;
        
        // Stability tracking
        /** @type {number} Stability factor (higher = more stable drift) */
        this.stability = 1.0;
        
        /** @type {boolean} About to spin out */
        this.spinoutWarning = false;
        
        // History for smoothing
        this._slipHistory = [];
        this._historyLength = 5;
        
        // Callbacks
        this.onDriftStart = config.onDriftStart ?? null;
        this.onDriftEnd = config.onDriftEnd ?? null;
        this.onSpinout = config.onSpinout ?? null;
    }

    /**
     * Update drift state
     * @param {number} deltaTime - Time step in seconds
     * @param {Object} vehicleState - Current vehicle state
     * @param {Object} inputs - Current control inputs
     * @returns {Object} Drift physics modifications
     */
    update(deltaTime, vehicleState, inputs) {
        const {
            velocity = 0,
            angularVelocity = 0,
            heading = 0,
            lateralVelocity = 0
        } = vehicleState;
        
        const {
            steeringAngle = 0,
            handbrake = false,
            throttle = 0
        } = inputs;
        
        // Update handbrake state
        this.handbrakeActive = handbrake;
        this.currentRearGrip = handbrake ? this.handbrakeRearGrip : this.normalRearGrip;
        
        // Store velocity components
        this.forwardVelocity = velocity;
        this.lateralVelocity = lateralVelocity;
        
        // Calculate slip angle
        this.calculateSlipAngle(velocity, lateralVelocity, heading, angularVelocity);
        
        // Detect counter-steering
        this.detectCounterSteering(steeringAngle);
        
        // Check drift state transition
        const wasDrifting = this.isDrifting;
        this.checkDriftState(velocity, throttle);
        
        // Handle state transitions
        if (this.isDrifting && !wasDrifting) {
            this.onDriftStarted();
        } else if (!this.isDrifting && wasDrifting) {
            this.onDriftEnded();
        }
        
        // Update drift duration
        if (this.isDrifting) {
            this.driftDuration += deltaTime;
        }
        
        // Calculate drift physics modifications
        const modifications = this.calculateDriftModifications(
            deltaTime, velocity, steeringAngle, throttle, angularVelocity
        );
        
        // Check for spinout
        this.checkSpinout();
        
        return modifications;
    }

    /**
     * Calculate current slip angle
     * @param {number} velocity - Forward velocity
     * @param {number} lateralVelocity - Lateral velocity
     * @param {number} heading - Vehicle heading
     * @param {number} angularVelocity - Angular velocity
     */
    calculateSlipAngle(velocity, lateralVelocity, heading, angularVelocity) {
        const speed = Math.sqrt(velocity * velocity + lateralVelocity * lateralVelocity);
        
        if (speed < 1) {
            this.slipAngle = 0;
            return;
        }
        
        // Calculate velocity direction vs heading
        const velocityAngle = Math.atan2(lateralVelocity, velocity);
        this.slipAngle = velocityAngle;
        
        // Normalize to -PI to PI
        this.slipAngle = MathUtils.normalizeAngle(this.slipAngle);
        
        // Update history for smoothing
        this._slipHistory.push(this.slipAngle);
        if (this._slipHistory.length > this._historyLength) {
            this._slipHistory.shift();
        }
        
        // Determine drift direction
        this.driftDirection = Math.sign(this.slipAngle);
        
        // Calculate drift intensity
        this.driftIntensity = MathUtils.clamp(
            Math.abs(this.slipAngle) / this.maxDriftAngle,
            0, 1
        );
    }

    /**
     * Detect if driver is counter-steering
     * @param {number} steeringAngle - Current steering angle
     */
    detectCounterSteering(steeringAngle) {
        // Counter-steering is when steering opposite to drift direction
        const steerDirection = Math.sign(steeringAngle);
        
        this.isCounterSteering = this.isDrifting && 
                                 steerDirection !== 0 &&
                                 steerDirection !== this.driftDirection;
        
        if (this.isCounterSteering) {
            this.counterSteerAmount = Math.abs(steeringAngle);
        } else {
            this.counterSteerAmount = 0;
        }
    }

    /**
     * Check and update drift state
     * @param {number} velocity - Current velocity
     * @param {number} throttle - Throttle input
     */
    checkDriftState(velocity, throttle) {
        const speed = Math.abs(velocity);
        const absSlipAngle = Math.abs(this.slipAngle);
        
        // Drift start conditions
        if (!this.isDrifting) {
            const canDrift = speed > this.driftSpeedThreshold &&
                           (absSlipAngle > this.driftAngleThreshold ||
                            (this.handbrakeActive && throttle > 0.5));
            
            if (canDrift) {
                this.isDrifting = true;
                this.driftDuration = 0;
            }
        }
        // Drift end conditions
        else {
            const shouldEndDrift = speed < this.driftSpeedThreshold * 0.5 ||
                                   absSlipAngle < this.driftAngleThreshold * 0.3 ||
                                   absSlipAngle > this.maxDriftAngle;
            
            if (shouldEndDrift) {
                this.isDrifting = false;
            }
        }
    }

    /**
     * Calculate physics modifications for drift
     * @param {number} deltaTime - Time step
     * @param {number} velocity - Forward velocity
     * @param {number} steeringAngle - Steering angle
     * @param {number} throttle - Throttle input
     * @param {number} angularVelocity - Current angular velocity
     * @returns {Object} Physics modifications
     */
    calculateDriftModifications(deltaTime, velocity, steeringAngle, throttle, angularVelocity) {
        const modifications = {
            rearGripMultiplier: this.currentRearGrip,
            angularVelocityDelta: 0,
            lateralForceDelta: 0,
            additionalSlide: 0
        };
        
        if (!this.isDrifting) {
            this.driftAngularVelocity *= 0.9; // Decay
            return modifications;
        }
        
        // Counter-steering effect
        if (this.isCounterSteering) {
            // Effective counter-steer reduces slip angle
            const counterSteerEffect = this.counterSteerAmount * this.counterSteerFactor;
            modifications.angularVelocityDelta -= counterSteerEffect * deltaTime;
            
            // Counter-steer helps maintain stability
            this.stability = MathUtils.clamp(
                this.stability + counterSteerEffect * deltaTime * 0.5,
                0, 1.2
            );
        } else {
            // Not counter-steering reduces stability
            this.stability = MathUtils.clamp(
                this.stability - deltaTime * 0.3,
                0.3, 1
            );
        }
        
        // Throttle affects drift
        if (throttle > 0.5 && this.handbrakeActive) {
            // Power oversteer
            const oversteerForce = (throttle - 0.5) * 2 * this.initiationForce;
            modifications.angularVelocityDelta += this.driftDirection * oversteerForce * deltaTime;
        }
        
        // Calculate drift angular momentum
        const targetAngularVelocity = Math.sin(this.slipAngle) * velocity * 0.3;
        this.driftAngularVelocity = MathUtils.lerp(
            this.driftAngularVelocity,
            targetAngularVelocity,
            deltaTime * 2
        );
        
        // Add angular velocity from drift
        modifications.angularVelocityDelta += this.driftAngularVelocity * this.sustainability * deltaTime;
        
        // Lateral slide amount
        modifications.additionalSlide = Math.sin(this.slipAngle) * velocity * 0.3;
        
        // Rear grip reduction during drift
        modifications.rearGripMultiplier *= this.stability;
        
        return modifications;
    }

    /**
     * Check for spinout condition
     */
    checkSpinout() {
        const absSlipAngle = Math.abs(this.slipAngle);
        
        // Warning threshold (80% of max)
        this.spinoutWarning = absSlipAngle > this.maxDriftAngle * 0.8;
        
        // Actual spinout
        if (absSlipAngle > this.maxDriftAngle) {
            this.isDrifting = false;
            if (this.onSpinout) {
                this.onSpinout();
            }
        }
    }

    /**
     * Called when drift starts
     */
    onDriftStarted() {
        this.stability = 1.0;
        if (this.onDriftStart) {
            this.onDriftStart({
                direction: this.driftDirection,
                slipAngle: this.slipAngle
            });
        }
    }

    /**
     * Called when drift ends
     */
    onDriftEnded() {
        const driftData = {
            duration: this.driftDuration,
            maxSlipAngle: Math.abs(this.slipAngle),
            direction: this.driftDirection
        };
        
        this.driftDuration = 0;
        this.driftAngularVelocity = 0;
        
        if (this.onDriftEnd) {
            this.onDriftEnd(driftData);
        }
    }

    /**
     * Initiate a drift (for AI or assists)
     * @param {number} direction - Drift direction (-1 or 1)
     */
    initiateDrift(direction) {
        this.driftDirection = Math.sign(direction);
        this.slipAngle = direction * this.driftAngleThreshold * 1.5;
        this.isDrifting = true;
        this.driftDuration = 0;
        this.stability = 1.0;
    }

    /**
     * Get current drift state
     * @returns {Object} Drift state
     */
    getState() {
        return {
            isDrifting: this.isDrifting,
            slipAngle: this.slipAngle,
            slipAngleDegrees: MathUtils.radToDeg(this.slipAngle),
            driftDirection: this.driftDirection,
            driftIntensity: this.driftIntensity,
            driftDuration: this.driftDuration,
            isCounterSteering: this.isCounterSteering,
            counterSteerAmount: this.counterSteerAmount,
            stability: this.stability,
            spinoutWarning: this.spinoutWarning,
            handbrakeActive: this.handbrakeActive,
            currentRearGrip: this.currentRearGrip
        };
    }

    /**
     * Get smoothed slip angle
     * @returns {number} Smoothed slip angle
     */
    getSmoothedSlipAngle() {
        if (this._slipHistory.length === 0) return this.slipAngle;
        
        let sum = 0;
        for (const angle of this._slipHistory) {
            sum += angle;
        }
        return sum / this._slipHistory.length;
    }

    /**
     * Reset drift controller
     */
    reset() {
        this.isDrifting = false;
        this.slipAngle = 0;
        this.driftDirection = 0;
        this.driftIntensity = 0;
        this.driftDuration = 0;
        this.handbrakeActive = false;
        this.currentRearGrip = this.normalRearGrip;
        this.driftAngularVelocity = 0;
        this.isCounterSteering = false;
        this.counterSteerAmount = 0;
        this.stability = 1.0;
        this.spinoutWarning = false;
        this._slipHistory = [];
    }

    /**
     * Serialize to JSON
     * @returns {Object} JSON representation
     */
    toJSON() {
        return {
            isDrifting: this.isDrifting,
            slipAngle: this.slipAngle,
            driftDirection: this.driftDirection,
            driftDuration: this.driftDuration,
            stability: this.stability
        };
    }

    /**
     * Create from JSON
     * @param {Object} json - JSON object
     * @returns {DriftController} New instance
     */
    static fromJSON(json) {
        const controller = new DriftController();
        controller.isDrifting = json.isDrifting ?? false;
        controller.slipAngle = json.slipAngle ?? 0;
        controller.driftDirection = json.driftDirection ?? 0;
        controller.driftDuration = json.driftDuration ?? 0;
        controller.stability = json.stability ?? 1.0;
        return controller;
    }
}

export default DriftController;
