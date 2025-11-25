/**
 * WeightTransfer.js - Vehicle Weight Transfer Calculator
 * 
 * Calculates dynamic weight transfer during acceleration, braking, and cornering.
 * This affects tire loads and consequently grip levels for realistic handling.
 * 
 * @module physics/WeightTransfer
 * @author CarSim Development Team
 * @version 2.0.0
 */

import { VEHICLE_CONSTANTS, PHYSICS_CONSTANTS } from '../core/Constants.js';
import { MathUtils } from '../utils/MathUtils.js';

/**
 * @class WeightTransfer
 * @description Calculates vehicle weight transfer during dynamic maneuvers
 */
export class WeightTransfer {
    /**
     * Creates a new WeightTransfer calculator
     * @param {Object} [config] - Vehicle configuration
     */
    constructor(config = {}) {
        /** @type {number} Vehicle mass in kg */
        this.mass = config.mass ?? VEHICLE_CONSTANTS.CAR_MASS;
        
        /** @type {number} Wheelbase in meters */
        this.wheelbase = config.wheelbase ?? VEHICLE_CONSTANTS.WHEELBASE;
        
        /** @type {number} Track width in meters */
        this.trackWidth = config.trackWidth ?? VEHICLE_CONSTANTS.TRACK_WIDTH;
        
        /** @type {number} Center of gravity height in meters */
        this.cgHeight = config.cgHeight ?? VEHICLE_CONSTANTS.CG_HEIGHT;
        
        /** @type {number} Distance from front axle to CG in meters */
        this.cgToFront = config.cgToFront ?? VEHICLE_CONSTANTS.CG_TO_FRONT;
        
        /** @type {number} Distance from rear axle to CG in meters */
        this.cgToRear = config.cgToRear ?? VEHICLE_CONSTANTS.CG_TO_REAR;
        
        /** @type {number} Static weight on front axle percentage (0-1) */
        this.frontWeightBias = this.cgToRear / this.wheelbase;
        
        /** @type {number} Static weight on rear axle percentage (0-1) */
        this.rearWeightBias = this.cgToFront / this.wheelbase;
        
        /** @type {number} Roll stiffness distribution (front percentage) */
        this.rollStiffnessDist = config.rollStiffnessDist ?? 0.55;
        
        /** @type {number} Gravitational acceleration */
        this.gravity = PHYSICS_CONSTANTS.GRAVITY;
        
        /** @type {number} Total static weight in N */
        this.totalWeight = this.mass * this.gravity;
        
        // Cache for wheel loads
        this._wheelLoads = {
            frontLeft: 0,
            frontRight: 0,
            rearLeft: 0,
            rearRight: 0
        };
        
        // Calculate static loads
        this.calculateStaticLoads();
    }

    /**
     * Calculate static wheel loads (vehicle at rest)
     */
    calculateStaticLoads() {
        const frontLoad = this.totalWeight * this.frontWeightBias;
        const rearLoad = this.totalWeight * this.rearWeightBias;
        
        this._wheelLoads.frontLeft = frontLoad / 2;
        this._wheelLoads.frontRight = frontLoad / 2;
        this._wheelLoads.rearLeft = rearLoad / 2;
        this._wheelLoads.rearRight = rearLoad / 2;
        
        this._staticLoads = { ...this._wheelLoads };
    }

    /**
     * Calculate longitudinal weight transfer (acceleration/braking)
     * @param {number} acceleration - Longitudinal acceleration in m/s² (positive = accelerating)
     * @returns {{front: number, rear: number}} Weight transfer to each axle
     */
    calculateLongitudinalTransfer(acceleration) {
        // Weight transfer = mass * acceleration * CG height / wheelbase
        const transfer = (this.mass * acceleration * this.cgHeight) / this.wheelbase;
        
        return {
            // Acceleration transfers weight to rear
            // Braking transfers weight to front
            front: -transfer,
            rear: transfer
        };
    }

    /**
     * Calculate lateral weight transfer (cornering)
     * @param {number} lateralAcceleration - Lateral acceleration in m/s² (positive = right turn)
     * @returns {{left: number, right: number, frontTransfer: number, rearTransfer: number}} Weight transfer
     */
    calculateLateralTransfer(lateralAcceleration) {
        // Total lateral weight transfer
        const totalTransfer = (this.mass * lateralAcceleration * this.cgHeight) / this.trackWidth;
        
        // Distribute between front and rear based on roll stiffness
        const frontTransfer = totalTransfer * this.rollStiffnessDist;
        const rearTransfer = totalTransfer * (1 - this.rollStiffnessDist);
        
        return {
            // Turning right transfers weight to left
            left: totalTransfer,
            right: -totalTransfer,
            frontTransfer,
            rearTransfer
        };
    }

    /**
     * Calculate all wheel loads with combined weight transfer
     * @param {number} longitudinalAcc - Longitudinal acceleration in m/s²
     * @param {number} lateralAcc - Lateral acceleration in m/s²
     * @returns {Object} Load on each wheel in Newtons
     */
    calculateWheelLoads(longitudinalAcc, lateralAcc) {
        // Start with static loads
        const loads = { ...this._staticLoads };
        
        // Apply longitudinal transfer
        const longTransfer = this.calculateLongitudinalTransfer(longitudinalAcc);
        const frontLongTransfer = longTransfer.front / 2;
        const rearLongTransfer = longTransfer.rear / 2;
        
        loads.frontLeft += frontLongTransfer;
        loads.frontRight += frontLongTransfer;
        loads.rearLeft += rearLongTransfer;
        loads.rearRight += rearLongTransfer;
        
        // Apply lateral transfer
        const latTransfer = this.calculateLateralTransfer(lateralAcc);
        
        // Front axle lateral transfer
        loads.frontLeft += latTransfer.frontTransfer;
        loads.frontRight -= latTransfer.frontTransfer;
        
        // Rear axle lateral transfer
        loads.rearLeft += latTransfer.rearTransfer;
        loads.rearRight -= latTransfer.rearTransfer;
        
        // Ensure no negative loads (wheel lift-off)
        loads.frontLeft = Math.max(0, loads.frontLeft);
        loads.frontRight = Math.max(0, loads.frontRight);
        loads.rearLeft = Math.max(0, loads.rearLeft);
        loads.rearRight = Math.max(0, loads.rearRight);
        
        this._wheelLoads = loads;
        
        return loads;
    }

    /**
     * Calculate wheel loads with pitch and roll angles
     * @param {number} longitudinalAcc - Longitudinal acceleration in m/s²
     * @param {number} lateralAcc - Lateral acceleration in m/s²
     * @param {number} pitch - Pitch angle in radians (positive = nose up)
     * @param {number} roll - Roll angle in radians (positive = right roll)
     * @returns {Object} Load on each wheel in Newtons
     */
    calculateWheelLoadsWithAngles(longitudinalAcc, lateralAcc, pitch, roll) {
        // Get base loads from acceleration
        const loads = this.calculateWheelLoads(longitudinalAcc, lateralAcc);
        
        // Additional transfer from body angles
        // Pitch effect
        const pitchTransfer = this.totalWeight * Math.sin(pitch) * this.cgHeight / this.wheelbase;
        loads.frontLeft -= pitchTransfer / 2;
        loads.frontRight -= pitchTransfer / 2;
        loads.rearLeft += pitchTransfer / 2;
        loads.rearRight += pitchTransfer / 2;
        
        // Roll effect
        const rollTransfer = this.totalWeight * Math.sin(roll) * this.cgHeight / this.trackWidth;
        loads.frontLeft -= rollTransfer * this.rollStiffnessDist;
        loads.frontRight += rollTransfer * this.rollStiffnessDist;
        loads.rearLeft -= rollTransfer * (1 - this.rollStiffnessDist);
        loads.rearRight += rollTransfer * (1 - this.rollStiffnessDist);
        
        // Clamp to positive values
        loads.frontLeft = Math.max(0, loads.frontLeft);
        loads.frontRight = Math.max(0, loads.frontRight);
        loads.rearLeft = Math.max(0, loads.rearLeft);
        loads.rearRight = Math.max(0, loads.rearRight);
        
        return loads;
    }

    /**
     * Calculate if any wheel is about to lift off
     * @param {Object} loads - Current wheel loads
     * @returns {Object} Lift-off status for each wheel
     */
    checkWheelLiftOff(loads) {
        const threshold = 100; // N, minimum load before considered lifted
        
        return {
            frontLeft: loads.frontLeft < threshold,
            frontRight: loads.frontRight < threshold,
            rearLeft: loads.rearLeft < threshold,
            rearRight: loads.rearRight < threshold,
            anyLifted: loads.frontLeft < threshold || 
                       loads.frontRight < threshold || 
                       loads.rearLeft < threshold || 
                       loads.rearRight < threshold
        };
    }

    /**
     * Calculate G-forces from accelerations
     * @param {number} longitudinalAcc - Longitudinal acceleration in m/s²
     * @param {number} lateralAcc - Lateral acceleration in m/s²
     * @returns {{longitudinal: number, lateral: number, total: number}} G-forces
     */
    calculateGForces(longitudinalAcc, lateralAcc) {
        const longG = longitudinalAcc / this.gravity;
        const latG = lateralAcc / this.gravity;
        const totalG = Math.sqrt(longG * longG + latG * latG);
        
        return {
            longitudinal: longG,
            lateral: latG,
            total: totalG
        };
    }

    /**
     * Calculate pitch angle from longitudinal weight transfer
     * @param {number} longitudinalAcc - Longitudinal acceleration in m/s²
     * @param {number} frontSpringRate - Front suspension spring rate in N/m
     * @param {number} rearSpringRate - Rear suspension spring rate in N/m
     * @returns {number} Pitch angle in radians
     */
    calculatePitchAngle(longitudinalAcc, frontSpringRate, rearSpringRate) {
        const transfer = this.calculateLongitudinalTransfer(longitudinalAcc);
        
        // Front compression/extension
        const frontDisplacement = transfer.front / frontSpringRate;
        
        // Rear compression/extension
        const rearDisplacement = transfer.rear / rearSpringRate;
        
        // Calculate pitch angle
        const pitch = Math.atan((rearDisplacement - frontDisplacement) / this.wheelbase);
        
        return pitch;
    }

    /**
     * Calculate roll angle from lateral weight transfer
     * @param {number} lateralAcc - Lateral acceleration in m/s²
     * @param {number} rollStiffness - Combined roll stiffness in Nm/rad
     * @returns {number} Roll angle in radians
     */
    calculateRollAngle(lateralAcc, rollStiffness) {
        // Roll moment from lateral acceleration
        const rollMoment = this.mass * lateralAcc * this.cgHeight;
        
        // Roll angle (limited by suspension geometry)
        const rollAngle = MathUtils.clamp(
            rollMoment / rollStiffness,
            -0.15, // Max 8.6 degrees
            0.15
        );
        
        return rollAngle;
    }

    /**
     * Calculate axle loads
     * @param {Object} wheelLoads - Individual wheel loads
     * @returns {{front: number, rear: number}} Axle loads in N
     */
    calculateAxleLoads(wheelLoads) {
        return {
            front: wheelLoads.frontLeft + wheelLoads.frontRight,
            rear: wheelLoads.rearLeft + wheelLoads.rearRight
        };
    }

    /**
     * Calculate load transfer ratio for each axle
     * @param {Object} wheelLoads - Current wheel loads
     * @returns {{front: number, rear: number}} Load transfer ratios (-1 to 1)
     */
    calculateLoadTransferRatio(wheelLoads) {
        const frontTotal = wheelLoads.frontLeft + wheelLoads.frontRight;
        const rearTotal = wheelLoads.rearLeft + wheelLoads.rearRight;
        
        return {
            front: frontTotal > 0 
                ? (wheelLoads.frontRight - wheelLoads.frontLeft) / frontTotal 
                : 0,
            rear: rearTotal > 0 
                ? (wheelLoads.rearRight - wheelLoads.rearLeft) / rearTotal 
                : 0
        };
    }

    /**
     * Calculate weight distribution percentage
     * @param {Object} wheelLoads - Current wheel loads
     * @returns {Object} Weight distribution percentages
     */
    calculateWeightDistribution(wheelLoads) {
        const total = wheelLoads.frontLeft + wheelLoads.frontRight + 
                     wheelLoads.rearLeft + wheelLoads.rearRight;
        
        if (total === 0) {
            return {
                frontLeft: 25,
                frontRight: 25,
                rearLeft: 25,
                rearRight: 25,
                front: 50,
                rear: 50,
                left: 50,
                right: 50
            };
        }
        
        return {
            frontLeft: (wheelLoads.frontLeft / total) * 100,
            frontRight: (wheelLoads.frontRight / total) * 100,
            rearLeft: (wheelLoads.rearLeft / total) * 100,
            rearRight: (wheelLoads.rearRight / total) * 100,
            front: ((wheelLoads.frontLeft + wheelLoads.frontRight) / total) * 100,
            rear: ((wheelLoads.rearLeft + wheelLoads.rearRight) / total) * 100,
            left: ((wheelLoads.frontLeft + wheelLoads.rearLeft) / total) * 100,
            right: ((wheelLoads.frontRight + wheelLoads.rearRight) / total) * 100
        };
    }

    /**
     * Get normalized wheel loads (0-1 based on static load)
     * @param {Object} wheelLoads - Current wheel loads
     * @returns {Object} Normalized loads
     */
    getNormalizedLoads(wheelLoads) {
        const avgStatic = this.totalWeight / 4;
        
        return {
            frontLeft: wheelLoads.frontLeft / avgStatic,
            frontRight: wheelLoads.frontRight / avgStatic,
            rearLeft: wheelLoads.rearLeft / avgStatic,
            rearRight: wheelLoads.rearRight / avgStatic
        };
    }

    /**
     * Update vehicle mass (for damage/fuel consumption simulation)
     * @param {number} newMass - New vehicle mass in kg
     */
    updateMass(newMass) {
        this.mass = newMass;
        this.totalWeight = this.mass * this.gravity;
        this.calculateStaticLoads();
    }

    /**
     * Update CG position (for load changes)
     * @param {number} cgHeight - New CG height in meters
     * @param {number} cgToFront - New distance from front axle to CG
     */
    updateCG(cgHeight, cgToFront) {
        this.cgHeight = cgHeight;
        this.cgToFront = cgToFront;
        this.cgToRear = this.wheelbase - cgToFront;
        this.frontWeightBias = this.cgToRear / this.wheelbase;
        this.rearWeightBias = this.cgToFront / this.wheelbase;
        this.calculateStaticLoads();
    }

    /**
     * Get current wheel loads
     * @returns {Object} Current wheel loads
     */
    getWheelLoads() {
        return { ...this._wheelLoads };
    }

    /**
     * Get static wheel loads
     * @returns {Object} Static wheel loads
     */
    getStaticLoads() {
        return { ...this._staticLoads };
    }

    /**
     * Calculate maximum lateral acceleration before rollover
     * @returns {number} Maximum lateral acceleration in m/s²
     */
    calculateRolloverThreshold() {
        // Simplified rollover threshold
        // ay_max = g * trackWidth / (2 * cgHeight)
        return this.gravity * this.trackWidth / (2 * this.cgHeight);
    }

    /**
     * Calculate maximum braking deceleration before rear wheel lift
     * @returns {number} Maximum braking deceleration in m/s²
     */
    calculateMaxBrakingDeceleration() {
        // Max deceleration before rear wheels lift
        // a_max = g * cgToRear / cgHeight
        return this.gravity * this.cgToRear / this.cgHeight;
    }

    /**
     * Calculate maximum acceleration before front wheel lift (for RWD)
     * @returns {number} Maximum acceleration in m/s²
     */
    calculateMaxAcceleration() {
        // Max acceleration before front wheels lift
        // a_max = g * cgToFront / cgHeight
        return this.gravity * this.cgToFront / this.cgHeight;
    }

    /**
     * Serialize to JSON
     * @returns {Object} JSON representation
     */
    toJSON() {
        return {
            mass: this.mass,
            wheelbase: this.wheelbase,
            trackWidth: this.trackWidth,
            cgHeight: this.cgHeight,
            cgToFront: this.cgToFront,
            cgToRear: this.cgToRear,
            rollStiffnessDist: this.rollStiffnessDist
        };
    }

    /**
     * Create from JSON
     * @param {Object} json - JSON object
     * @returns {WeightTransfer} New instance
     */
    static fromJSON(json) {
        return new WeightTransfer(json);
    }
}

export default WeightTransfer;
