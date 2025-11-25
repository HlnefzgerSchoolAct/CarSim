/**
 * Transmission.js - Transmission and Drivetrain System
 * 
 * Simulates a realistic vehicle transmission with gear ratios, clutch physics,
 * differential behavior, and automatic/manual shifting.
 * 
 * @module vehicle/Transmission
 * @author CarSim Development Team
 * @version 2.0.0
 */

import { TRANSMISSION_CONSTANTS, VEHICLE_CONSTANTS, TIRE_CONSTANTS } from '../core/Constants.js';
import { MathUtils } from '../utils/MathUtils.js';

/**
 * @class Transmission
 * @description Simulates vehicle transmission and drivetrain
 */
export class Transmission {
    /**
     * Creates a new Transmission instance
     * @param {Object} [config] - Transmission configuration
     */
    constructor(config = {}) {
        // Gear configuration
        /** @type {Array<number>} Gear ratios (index 0 = reverse) */
        this.gearRatios = config.gearRatios ?? TRANSMISSION_CONSTANTS.GEAR_RATIOS;
        
        /** @type {number} Final drive ratio */
        this.finalDrive = config.finalDrive ?? TRANSMISSION_CONSTANTS.FINAL_DRIVE;
        
        /** @type {number} Transmission efficiency (0-1) */
        this.efficiency = config.efficiency ?? TRANSMISSION_CONSTANTS.TRANSMISSION_EFFICIENCY;
        
        /** @type {number} Current gear (0 = neutral, negative = reverse) */
        this.currentGear = 1;
        
        /** @type {number} Number of forward gears */
        this.numGears = this.gearRatios.length - 2; // Exclude reverse and neutral
        
        // Clutch configuration
        /** @type {number} Clutch engagement time in seconds */
        this.clutchEngagementTime = config.clutchEngagementTime ?? TRANSMISSION_CONSTANTS.CLUTCH_ENGAGEMENT_TIME;
        
        /** @type {number} Current clutch engagement (0-1, 1 = fully engaged) */
        this.clutchEngagement = 1;
        
        /** @type {number} Target clutch engagement */
        this.targetClutchEngagement = 1;
        
        /** @type {number} Clutch wear (0-1) */
        this.clutchWear = 0;
        
        // Shifting
        /** @type {number} Shift time in seconds */
        this.shiftTime = config.shiftTime ?? TRANSMISSION_CONSTANTS.SHIFT_TIME;
        
        /** @type {number} Optimal upshift RPM */
        this.optimalUpshiftRPM = config.optimalUpshiftRPM ?? TRANSMISSION_CONSTANTS.OPTIMAL_UPSHIFT_RPM;
        
        /** @type {number} Optimal downshift RPM */
        this.optimalDownshiftRPM = config.optimalDownshiftRPM ?? TRANSMISSION_CONSTANTS.OPTIMAL_DOWNSHIFT_RPM;
        
        /** @type {boolean} Currently shifting */
        this.isShifting = false;
        
        /** @type {number} Shift progress (0-1) */
        this.shiftProgress = 0;
        
        /** @type {number} Target gear for shift */
        this.targetGear = 1;
        
        // Differential configuration
        /** @type {string} Differential type: 'open', 'lsd', 'locked' */
        this.differentialType = config.differentialType ?? TRANSMISSION_CONSTANTS.DIFFERENTIAL_TYPE;
        
        /** @type {number} LSD preload torque in Nm */
        this.lsdPreload = config.lsdPreload ?? TRANSMISSION_CONSTANTS.LSD_PRELOAD;
        
        /** @type {number} LSD acceleration lock coefficient */
        this.lsdAccelLock = config.lsdAccelLock ?? TRANSMISSION_CONSTANTS.LSD_ACCELERATION_LOCK;
        
        /** @type {number} LSD deceleration lock coefficient */
        this.lsdDecelLock = config.lsdDecelLock ?? TRANSMISSION_CONSTANTS.LSD_DECELERATION_LOCK;
        
        // Drivetrain configuration
        /** @type {string} Drivetrain type: 'rwd', 'fwd', 'awd' */
        this.drivetrainType = config.drivetrainType ?? TRANSMISSION_CONSTANTS.DRIVETRAIN;
        
        /** @type {number} AWD front torque bias (0-1) */
        this.awdFrontBias = config.awdFrontBias ?? TRANSMISSION_CONSTANTS.AWD_FRONT_BIAS;
        
        // Auto transmission settings
        /** @type {boolean} Auto transmission enabled */
        this.autoMode = config.autoMode ?? false;
        
        /** @type {number} Time since last auto shift */
        this.autoShiftTimer = 0;
        
        /** @type {number} Minimum time between auto shifts */
        this.autoShiftCooldown = 0.5;
        
        // Damage
        /** @type {number} Transmission damage (0-1) */
        this.damage = 0;
        
        // Output torque distribution
        this._outputTorque = {
            frontLeft: 0,
            frontRight: 0,
            rearLeft: 0,
            rearRight: 0
        };
        
        // Tire radius for speed calculations
        this.tireRadius = config.tireRadius ?? TIRE_CONSTANTS.TIRE_RADIUS;
    }

    /**
     * Update transmission state
     * @param {number} deltaTime - Time step in seconds
     * @param {number} engineRPM - Current engine RPM
     * @param {number} engineTorque - Current engine torque
     * @param {number} vehicleSpeed - Current vehicle speed in m/s
     * @param {Object} wheelSpeeds - Angular velocities of driven wheels
     * @returns {Object} Output torque distribution
     */
    update(deltaTime, engineRPM, engineTorque, vehicleSpeed, wheelSpeeds) {
        // Update shifting
        if (this.isShifting) {
            this.updateShift(deltaTime);
        }
        
        // Update clutch
        this.updateClutch(deltaTime);
        
        // Auto-shift logic
        if (this.autoMode && !this.isShifting) {
            this.autoShiftTimer += deltaTime;
            if (this.autoShiftTimer >= this.autoShiftCooldown) {
                this.checkAutoShift(engineRPM, vehicleSpeed);
            }
        }
        
        // Calculate output torque
        const outputTorque = this.calculateOutputTorque(engineTorque);
        
        // Distribute torque to wheels
        this.distributeTorque(outputTorque, wheelSpeeds);
        
        return this._outputTorque;
    }

    /**
     * Calculate total gear ratio for current gear
     * @returns {number} Total gear ratio
     */
    getCurrentGearRatio() {
        if (this.currentGear === 0) return 0; // Neutral
        
        const gearIndex = this.currentGear < 0 ? 0 : this.currentGear;
        const gearRatio = this.gearRatios[gearIndex] ?? 0;
        
        return gearRatio * this.finalDrive;
    }

    /**
     * Calculate output torque at wheels
     * @param {number} engineTorque - Engine torque in Nm
     * @returns {number} Total output torque in Nm
     */
    calculateOutputTorque(engineTorque) {
        const totalRatio = this.getCurrentGearRatio();
        
        if (totalRatio === 0) return 0;
        
        // Apply gear ratio, clutch, and efficiency
        let outputTorque = engineTorque * totalRatio * this.clutchEngagement * this.efficiency;
        
        // Apply damage effects
        outputTorque *= (1 - this.damage * 0.3);
        
        // During shift, reduce torque
        if (this.isShifting) {
            outputTorque *= (1 - this.shiftProgress);
        }
        
        return outputTorque;
    }

    /**
     * Distribute torque to individual wheels based on drivetrain type
     * @param {number} totalTorque - Total torque to distribute
     * @param {Object} wheelSpeeds - Angular velocities of wheels
     */
    distributeTorque(totalTorque, wheelSpeeds) {
        // Reset output
        this._outputTorque.frontLeft = 0;
        this._outputTorque.frontRight = 0;
        this._outputTorque.rearLeft = 0;
        this._outputTorque.rearRight = 0;
        
        if (totalTorque === 0) return;
        
        switch (this.drivetrainType) {
            case 'rwd':
                this.distributeToAxle(totalTorque, wheelSpeeds.rearLeft, wheelSpeeds.rearRight, 'rear');
                break;
                
            case 'fwd':
                this.distributeToAxle(totalTorque, wheelSpeeds.frontLeft, wheelSpeeds.frontRight, 'front');
                break;
                
            case 'awd':
                const frontTorque = totalTorque * this.awdFrontBias;
                const rearTorque = totalTorque * (1 - this.awdFrontBias);
                this.distributeToAxle(frontTorque, wheelSpeeds.frontLeft, wheelSpeeds.frontRight, 'front');
                this.distributeToAxle(rearTorque, wheelSpeeds.rearLeft, wheelSpeeds.rearRight, 'rear');
                break;
        }
    }

    /**
     * Distribute torque to an axle based on differential type
     * @param {number} axleTorque - Total torque for axle
     * @param {number} leftSpeed - Left wheel angular velocity
     * @param {number} rightSpeed - Right wheel angular velocity
     * @param {string} axle - 'front' or 'rear'
     */
    distributeToAxle(axleTorque, leftSpeed, rightSpeed, axle) {
        let leftTorque, rightTorque;
        
        switch (this.differentialType) {
            case 'open':
                // Open diff: torque split 50/50, speed difference allowed
                leftTorque = axleTorque / 2;
                rightTorque = axleTorque / 2;
                break;
                
            case 'lsd':
                // Limited slip: some torque bias based on speed difference
                const speedDiff = Math.abs(leftSpeed - rightSpeed);
                const isAccelerating = axleTorque > 0;
                const lockFactor = isAccelerating ? this.lsdAccelLock : this.lsdDecelLock;
                const lockTorque = Math.min(
                    this.lsdPreload + speedDiff * lockFactor * 100,
                    Math.abs(axleTorque) * 0.4
                );
                
                // Bias torque towards slower wheel
                if (leftSpeed < rightSpeed) {
                    leftTorque = axleTorque / 2 + lockTorque / 2;
                    rightTorque = axleTorque / 2 - lockTorque / 2;
                } else {
                    leftTorque = axleTorque / 2 - lockTorque / 2;
                    rightTorque = axleTorque / 2 + lockTorque / 2;
                }
                break;
                
            case 'locked':
                // Locked diff: equal torque, forced equal speed
                leftTorque = axleTorque / 2;
                rightTorque = axleTorque / 2;
                break;
                
            default:
                leftTorque = axleTorque / 2;
                rightTorque = axleTorque / 2;
        }
        
        if (axle === 'front') {
            this._outputTorque.frontLeft = leftTorque;
            this._outputTorque.frontRight = rightTorque;
        } else {
            this._outputTorque.rearLeft = leftTorque;
            this._outputTorque.rearRight = rightTorque;
        }
    }

    /**
     * Update clutch state
     * @param {number} deltaTime - Time step
     */
    updateClutch(deltaTime) {
        if (this.clutchEngagement !== this.targetClutchEngagement) {
            const rate = 1 / this.clutchEngagementTime;
            this.clutchEngagement = MathUtils.moveTowards(
                this.clutchEngagement,
                this.targetClutchEngagement,
                rate * deltaTime
            );
        }
    }

    /**
     * Update shift progress
     * @param {number} deltaTime - Time step
     */
    updateShift(deltaTime) {
        this.shiftProgress += deltaTime / this.shiftTime;
        
        if (this.shiftProgress >= 1) {
            this.completeShift();
        }
    }

    /**
     * Complete the shift operation
     */
    completeShift() {
        this.currentGear = this.targetGear;
        this.isShifting = false;
        this.shiftProgress = 0;
        this.targetClutchEngagement = 1;
    }

    /**
     * Initiate upshift
     * @returns {boolean} True if shift initiated
     */
    shiftUp() {
        if (this.isShifting) return false;
        if (this.currentGear >= this.numGears) return false;
        if (this.currentGear < 0) {
            // From reverse to neutral
            this.targetGear = 0;
        } else {
            this.targetGear = this.currentGear + 1;
        }
        
        this.initiateShift();
        return true;
    }

    /**
     * Initiate downshift
     * @returns {boolean} True if shift initiated
     */
    shiftDown() {
        if (this.isShifting) return false;
        if (this.currentGear <= -1) return false;
        if (this.currentGear === 0) {
            // From neutral to reverse
            this.targetGear = -1;
        } else if (this.currentGear === 1) {
            // From 1st to neutral
            this.targetGear = 0;
        } else {
            this.targetGear = this.currentGear - 1;
        }
        
        this.initiateShift();
        return true;
    }

    /**
     * Shift to specific gear
     * @param {number} gear - Target gear
     * @returns {boolean} True if shift initiated
     */
    shiftTo(gear) {
        if (this.isShifting) return false;
        if (gear < -1 || gear > this.numGears) return false;
        if (gear === this.currentGear) return false;
        
        this.targetGear = gear;
        this.initiateShift();
        return true;
    }

    /**
     * Initiate shift process
     */
    initiateShift() {
        this.isShifting = true;
        this.shiftProgress = 0;
        this.targetClutchEngagement = 0;
        this.autoShiftTimer = 0;
    }

    /**
     * Check if auto-shift is needed
     * @param {number} rpm - Current engine RPM
     * @param {number} speed - Vehicle speed in m/s
     */
    checkAutoShift(rpm, speed) {
        // Upshift check
        if (rpm > this.optimalUpshiftRPM && this.currentGear > 0 && this.currentGear < this.numGears) {
            this.shiftUp();
            return;
        }
        
        // Downshift check
        if (rpm < this.optimalDownshiftRPM && this.currentGear > 1) {
            // Check if downshift won't over-rev
            const lowerGearRatio = this.gearRatios[this.currentGear - 1] * this.finalDrive;
            const estimatedRPM = (speed / this.tireRadius) * lowerGearRatio * 60 / (2 * Math.PI);
            
            if (estimatedRPM < this.optimalUpshiftRPM * 0.95) {
                this.shiftDown();
            }
        }
    }

    /**
     * Set clutch position (for manual control)
     * @param {number} position - Clutch position (0 = disengaged, 1 = engaged)
     */
    setClutch(position) {
        this.targetClutchEngagement = MathUtils.clamp(position, 0, 1);
    }

    /**
     * Calculate engine RPM from wheel speed
     * @param {number} wheelAngularVelocity - Wheel angular velocity in rad/s
     * @returns {number} Corresponding engine RPM
     */
    calculateEngineRPM(wheelAngularVelocity) {
        const totalRatio = this.getCurrentGearRatio();
        if (totalRatio === 0) return 0;
        
        return wheelAngularVelocity * totalRatio * 60 / (2 * Math.PI);
    }

    /**
     * Calculate wheel speed from engine RPM
     * @param {number} engineRPM - Engine RPM
     * @returns {number} Wheel angular velocity in rad/s
     */
    calculateWheelSpeed(engineRPM) {
        const totalRatio = this.getCurrentGearRatio();
        if (totalRatio === 0) return 0;
        
        return engineRPM * 2 * Math.PI / (60 * totalRatio);
    }

    /**
     * Calculate vehicle speed from engine RPM
     * @param {number} engineRPM - Engine RPM
     * @returns {number} Vehicle speed in m/s
     */
    calculateVehicleSpeed(engineRPM) {
        return this.calculateWheelSpeed(engineRPM) * this.tireRadius;
    }

    /**
     * Get current gear name
     * @returns {string} Gear name (R, N, 1, 2, etc.)
     */
    getGearName() {
        if (this.currentGear < 0) return 'R';
        if (this.currentGear === 0) return 'N';
        return this.currentGear.toString();
    }

    /**
     * Get theoretical top speed in current gear
     * @param {number} redlineRPM - Engine redline RPM
     * @returns {number} Top speed in m/s
     */
    getTopSpeedInGear(redlineRPM) {
        return this.calculateVehicleSpeed(redlineRPM);
    }

    /**
     * Apply transmission damage
     * @param {number} amount - Damage amount (0-1)
     */
    applyDamage(amount) {
        this.damage = MathUtils.clamp(this.damage + amount, 0, 1);
        
        // Severe damage can cause stuck gears
        if (this.damage > 0.8 && Math.random() < 0.05) {
            // Random gear lock
        }
    }

    /**
     * Wear the clutch
     * @param {number} amount - Wear amount
     */
    wearClutch(amount) {
        this.clutchWear = MathUtils.clamp(this.clutchWear + amount, 0, 1);
        
        // Worn clutch slips more
        if (this.clutchWear > 0.5) {
            this.efficiency -= this.clutchWear * 0.1;
        }
    }

    /**
     * Get output torque distribution
     * @returns {Object} Torque at each wheel
     */
    getOutputTorque() {
        return { ...this._outputTorque };
    }

    /**
     * Enable/disable auto mode
     * @param {boolean} enabled - Auto mode state
     */
    setAutoMode(enabled) {
        this.autoMode = enabled;
    }

    /**
     * Reset to initial state
     */
    reset() {
        this.currentGear = 1;
        this.clutchEngagement = 1;
        this.targetClutchEngagement = 1;
        this.isShifting = false;
        this.shiftProgress = 0;
        this.damage = 0;
        this.clutchWear = 0;
    }

    /**
     * Serialize to JSON
     * @returns {Object} JSON representation
     */
    toJSON() {
        return {
            gearRatios: this.gearRatios,
            finalDrive: this.finalDrive,
            differentialType: this.differentialType,
            drivetrainType: this.drivetrainType,
            currentGear: this.currentGear,
            damage: this.damage,
            clutchWear: this.clutchWear,
            autoMode: this.autoMode
        };
    }

    /**
     * Create from JSON
     * @param {Object} json - JSON object
     * @returns {Transmission} New instance
     */
    static fromJSON(json) {
        const trans = new Transmission(json);
        trans.currentGear = json.currentGear ?? 1;
        trans.damage = json.damage ?? 0;
        trans.clutchWear = json.clutchWear ?? 0;
        trans.autoMode = json.autoMode ?? false;
        return trans;
    }
}

export default Transmission;
