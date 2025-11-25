/**
 * Suspension.js - Suspension System Simulation
 * 
 * Simulates individual wheel suspension with spring, damper, and anti-roll bar physics.
 * Affects ride quality, handling, and weight transfer.
 * 
 * @module vehicle/Suspension
 * @author CarSim Development Team
 * @version 2.0.0
 */

import { SUSPENSION_CONSTANTS, PHYSICS_CONSTANTS } from '../core/Constants.js';
import { MathUtils } from '../utils/MathUtils.js';

/**
 * @class Suspension
 * @description Simulates a single wheel's suspension system
 */
export class Suspension {
    /**
     * Creates a new Suspension instance for a wheel
     * @param {Object} [config] - Suspension configuration
     * @param {string} [position='front_left'] - Wheel position
     */
    constructor(config = {}, position = 'front_left') {
        this.position = position;
        const isFront = position.includes('front');
        
        // Spring properties
        /** @type {number} Spring rate in N/m */
        this.springRate = config.springRate ?? 
            (isFront ? SUSPENSION_CONSTANTS.SPRING_RATE_FRONT : SUSPENSION_CONSTANTS.SPRING_RATE_REAR);
        
        /** @type {number} Spring preload in N */
        this.springPreload = config.springPreload ?? 0;
        
        // Damper properties
        /** @type {number} Compression damping in Ns/m */
        this.dampingCompression = config.dampingCompression ?? 
            (isFront ? SUSPENSION_CONSTANTS.DAMPING_COMPRESSION_FRONT : SUSPENSION_CONSTANTS.DAMPING_COMPRESSION_REAR);
        
        /** @type {number} Rebound damping in Ns/m */
        this.dampingRebound = config.dampingRebound ?? 
            (isFront ? SUSPENSION_CONSTANTS.DAMPING_REBOUND_FRONT : SUSPENSION_CONSTANTS.DAMPING_REBOUND_REAR);
        
        // Travel limits
        /** @type {number} Maximum travel (droop) in meters */
        this.maxTravel = config.maxTravel ?? SUSPENSION_CONSTANTS.MAX_TRAVEL;
        
        /** @type {number} Minimum travel (bump stop) in meters */
        this.minTravel = config.minTravel ?? SUSPENSION_CONSTANTS.MIN_TRAVEL;
        
        /** @type {number} Rest position as percentage of travel */
        this.restPosition = config.restPosition ?? SUSPENSION_CONSTANTS.REST_POSITION;
        
        // Anti-roll bar
        /** @type {number} Anti-roll bar stiffness in N/rad */
        this.antiRollStiffness = config.antiRollStiffness ?? 
            (isFront ? SUSPENSION_CONSTANTS.ANTI_ROLL_BAR_FRONT : SUSPENSION_CONSTANTS.ANTI_ROLL_BAR_REAR);
        
        // Alignment
        /** @type {number} Static camber angle in radians */
        this.staticCamber = config.staticCamber ?? 
            (isFront ? SUSPENSION_CONSTANTS.STATIC_CAMBER_FRONT : SUSPENSION_CONSTANTS.STATIC_CAMBER_REAR);
        
        /** @type {number} Static toe angle in radians */
        this.staticToe = config.staticToe ?? 
            (isFront ? SUSPENSION_CONSTANTS.STATIC_TOE_FRONT : SUSPENSION_CONSTANTS.STATIC_TOE_REAR);
        
        /** @type {number} Caster angle in radians */
        this.caster = config.caster ?? SUSPENSION_CONSTANTS.CASTER_ANGLE;
        
        // Geometry
        /** @type {number} Camber gain per meter of travel */
        this.camberGain = config.camberGain ?? -0.5;
        
        /** @type {number} Bump steer coefficient */
        this.bumpSteer = config.bumpSteer ?? 0;
        
        // Current state
        /** @type {number} Current compression (0 = full droop, 1 = full bump) */
        this.compression = this.restPosition;
        
        /** @type {number} Compression velocity in m/s */
        this.velocity = 0;
        
        /** @type {number} Current force output in N */
        this.force = 0;
        
        /** @type {boolean} Is at bump stop */
        this.atBumpStop = false;
        
        /** @type {boolean} Is at full droop */
        this.atDroop = false;
        
        // Calculated values
        /** @type {number} Current camber angle */
        this.currentCamber = this.staticCamber;
        
        /** @type {number} Current toe angle */
        this.currentToe = this.staticToe;
        
        // Damage
        /** @type {number} Suspension damage (0-1) */
        this.damage = 0;
        
        // Calculate rest force (force at rest position supporting static load)
        this._restCompression = this.maxTravel * this.restPosition;
        this._travelRange = this.maxTravel - this.minTravel;
    }

    /**
     * Update suspension state
     * @param {number} deltaTime - Time step in seconds
     * @param {number} groundHeight - Ground height at wheel position
     * @param {number} chassisHeight - Chassis height at suspension mount
     * @param {number} staticLoad - Static weight on this corner in N
     * @param {number} oppositeCompression - Compression of opposite wheel (for anti-roll)
     * @returns {number} Force applied to chassis
     */
    update(deltaTime, groundHeight, chassisHeight, staticLoad, oppositeCompression = null) {
        // Calculate suspension displacement
        const wheelRadius = 0.33; // Should come from wheel config
        const naturalLength = this.maxTravel * (1 - this.restPosition);
        
        // Target position based on ground and chassis
        const targetDisplacement = chassisHeight - groundHeight - wheelRadius - naturalLength;
        
        // Calculate compression change
        const previousCompression = this.compression;
        const compressionMeters = MathUtils.clamp(
            targetDisplacement,
            this.minTravel - this.maxTravel * (1 - this.restPosition),
            this.maxTravel * this.restPosition
        );
        
        // Convert to normalized compression (0-1)
        this.compression = (compressionMeters + this.maxTravel * (1 - this.restPosition)) / this._travelRange;
        this.compression = MathUtils.clamp(this.compression, 0, 1);
        
        // Calculate velocity
        const displacementChange = (this.compression - previousCompression) * this._travelRange;
        this.velocity = displacementChange / deltaTime;
        
        // Check limits
        this.atBumpStop = this.compression >= 0.98;
        this.atDroop = this.compression <= 0.02;
        
        // Calculate spring force
        const springDisplacement = (this.compression - this.restPosition) * this._travelRange;
        let springForce = this.springRate * springDisplacement + this.springPreload;
        
        // Bump stop force (progressive)
        if (this.atBumpStop) {
            const bumpStopPenetration = (this.compression - 0.98) * this._travelRange;
            springForce += bumpStopPenetration * this.springRate * 5; // 5x progressive
        }
        
        // Droop stop force
        if (this.atDroop) {
            const droopExtension = (0.02 - this.compression) * this._travelRange;
            springForce -= droopExtension * this.springRate * 2;
        }
        
        // Calculate damping force
        const damping = this.velocity > 0 ? this.dampingCompression : this.dampingRebound;
        const dampingForce = damping * this.velocity;
        
        // Anti-roll bar force
        let antiRollForce = 0;
        if (oppositeCompression !== null) {
            const rollAngle = (this.compression - oppositeCompression) * this._travelRange / 1.6; // Track width
            antiRollForce = this.antiRollStiffness * rollAngle;
        }
        
        // Total force
        this.force = springForce + dampingForce + antiRollForce;
        
        // Apply damage effects
        this.force *= (1 - this.damage * 0.3);
        
        // Add some noise if damaged
        if (this.damage > 0.3) {
            this.force += MathUtils.randomGaussian(0, this.damage * 500);
        }
        
        // Update geometry
        this.updateGeometry();
        
        return this.force;
    }

    /**
     * Update suspension geometry (camber, toe) based on compression
     */
    updateGeometry() {
        // Camber changes with compression
        const compressionOffset = (this.compression - this.restPosition) * this._travelRange;
        this.currentCamber = this.staticCamber + compressionOffset * this.camberGain;
        
        // Toe changes with compression (bump steer)
        this.currentToe = this.staticToe + compressionOffset * this.bumpSteer;
    }

    /**
     * Calculate wheel position relative to chassis
     * @returns {{x: number, y: number, z: number}} Wheel position offset
     */
    getWheelPosition() {
        const compressionMeters = this.compression * this._travelRange - this.maxTravel * (1 - this.restPosition);
        
        return {
            x: 0, // Lateral offset from geometry (ignored for simple model)
            y: -compressionMeters, // Vertical offset
            z: 0  // Longitudinal offset from geometry
        };
    }

    /**
     * Get current compression in meters
     * @returns {number} Compression in meters
     */
    getCompressionMeters() {
        return this.compression * this._travelRange;
    }

    /**
     * Get compression as percentage
     * @returns {number} Compression percentage (0-100)
     */
    getCompressionPercent() {
        return this.compression * 100;
    }

    /**
     * Apply external force to suspension
     * @param {number} force - Force in N
     * @param {number} deltaTime - Time step
     */
    applyForce(force, deltaTime) {
        // Calculate acceleration from force (simplified)
        const effectiveMass = 50; // Unsprung mass estimate
        const acceleration = force / effectiveMass;
        
        this.velocity += acceleration * deltaTime;
    }

    /**
     * Set spring rate
     * @param {number} rate - New spring rate in N/m
     */
    setSpringRate(rate) {
        this.springRate = MathUtils.clamp(rate, 10000, 100000);
    }

    /**
     * Set damping
     * @param {number} compression - Compression damping in Ns/m
     * @param {number} rebound - Rebound damping in Ns/m
     */
    setDamping(compression, rebound) {
        this.dampingCompression = MathUtils.clamp(compression, 1000, 10000);
        this.dampingRebound = MathUtils.clamp(rebound, 1000, 12000);
    }

    /**
     * Set ride height
     * @param {number} height - Ride height adjustment in meters
     */
    setRideHeight(height) {
        this.springPreload = height * this.springRate;
    }

    /**
     * Apply damage to suspension
     * @param {number} amount - Damage amount (0-1)
     */
    applyDamage(amount) {
        this.damage = MathUtils.clamp(this.damage + amount, 0, 1);
        
        // Damage affects alignment
        if (this.damage > 0.5) {
            this.staticCamber += MathUtils.randomGaussian(0, this.damage * 0.05);
            this.staticToe += MathUtils.randomGaussian(0, this.damage * 0.02);
        }
    }

    /**
     * Get suspension state for telemetry
     * @returns {Object} Suspension state
     */
    getState() {
        return {
            position: this.position,
            compression: this.compression,
            compressionMeters: this.getCompressionMeters(),
            velocity: this.velocity,
            force: this.force,
            camber: this.currentCamber,
            toe: this.currentToe,
            atBumpStop: this.atBumpStop,
            atDroop: this.atDroop,
            damage: this.damage
        };
    }

    /**
     * Reset to initial state
     */
    reset() {
        this.compression = this.restPosition;
        this.velocity = 0;
        this.force = 0;
        this.damage = 0;
        this.atBumpStop = false;
        this.atDroop = false;
        this.updateGeometry();
    }

    /**
     * Serialize to JSON
     * @returns {Object} JSON representation
     */
    toJSON() {
        return {
            position: this.position,
            springRate: this.springRate,
            dampingCompression: this.dampingCompression,
            dampingRebound: this.dampingRebound,
            staticCamber: this.staticCamber,
            staticToe: this.staticToe,
            compression: this.compression,
            damage: this.damage
        };
    }

    /**
     * Create from JSON
     * @param {Object} json - JSON object
     * @returns {Suspension} New instance
     */
    static fromJSON(json) {
        const susp = new Suspension(json, json.position);
        susp.compression = json.compression ?? susp.restPosition;
        susp.damage = json.damage ?? 0;
        return susp;
    }
}

/**
 * @class SuspensionSystem
 * @description Manages all four wheel suspensions together
 */
export class SuspensionSystem {
    /**
     * Creates a complete suspension system
     * @param {Object} [config] - Configuration for all corners
     */
    constructor(config = {}) {
        this.frontLeft = new Suspension(config.frontLeft ?? config, 'front_left');
        this.frontRight = new Suspension(config.frontRight ?? config, 'front_right');
        this.rearLeft = new Suspension(config.rearLeft ?? config, 'rear_left');
        this.rearRight = new Suspension(config.rearRight ?? config, 'rear_right');
        
        // Cached states
        this._forces = {
            frontLeft: 0,
            frontRight: 0,
            rearLeft: 0,
            rearRight: 0
        };
        
        // Body motion
        this.pitch = 0;
        this.roll = 0;
        this.heave = 0;
    }

    /**
     * Update all suspensions
     * @param {number} deltaTime - Time step
     * @param {Object} groundHeights - Ground height at each wheel
     * @param {Object} chassisHeights - Chassis height at each mount
     * @param {Object} staticLoads - Static load at each corner
     * @returns {Object} Forces at each corner
     */
    update(deltaTime, groundHeights, chassisHeights, staticLoads) {
        // Update each suspension with anti-roll bar coupling
        this._forces.frontLeft = this.frontLeft.update(
            deltaTime,
            groundHeights.frontLeft ?? 0,
            chassisHeights.frontLeft ?? 0.5,
            staticLoads.frontLeft ?? 3500,
            this.frontRight.compression
        );
        
        this._forces.frontRight = this.frontRight.update(
            deltaTime,
            groundHeights.frontRight ?? 0,
            chassisHeights.frontRight ?? 0.5,
            staticLoads.frontRight ?? 3500,
            this.frontLeft.compression
        );
        
        this._forces.rearLeft = this.rearLeft.update(
            deltaTime,
            groundHeights.rearLeft ?? 0,
            chassisHeights.rearLeft ?? 0.5,
            staticLoads.rearLeft ?? 3500,
            this.rearRight.compression
        );
        
        this._forces.rearRight = this.rearRight.update(
            deltaTime,
            groundHeights.rearRight ?? 0,
            chassisHeights.rearRight ?? 0.5,
            staticLoads.rearRight ?? 3500,
            this.rearLeft.compression
        );
        
        // Calculate body motion
        this.calculateBodyMotion();
        
        return this._forces;
    }

    /**
     * Calculate body pitch and roll from suspension compression
     */
    calculateBodyMotion() {
        const wheelbase = 2.7;
        const trackWidth = 1.6;
        
        // Pitch from front/rear compression difference
        const frontAvg = (this.frontLeft.compression + this.frontRight.compression) / 2;
        const rearAvg = (this.rearLeft.compression + this.rearRight.compression) / 2;
        this.pitch = Math.atan2((frontAvg - rearAvg) * this.frontLeft._travelRange, wheelbase);
        
        // Roll from left/right compression difference
        const leftAvg = (this.frontLeft.compression + this.rearLeft.compression) / 2;
        const rightAvg = (this.frontRight.compression + this.rearRight.compression) / 2;
        this.roll = Math.atan2((rightAvg - leftAvg) * this.frontLeft._travelRange, trackWidth);
        
        // Heave from average compression
        const avgCompression = (this.frontLeft.compression + this.frontRight.compression +
                               this.rearLeft.compression + this.rearRight.compression) / 4;
        this.heave = (avgCompression - this.frontLeft.restPosition) * this.frontLeft._travelRange;
    }

    /**
     * Get all suspension compressions
     * @returns {Object} Compression values
     */
    getCompressions() {
        return {
            frontLeft: this.frontLeft.compression,
            frontRight: this.frontRight.compression,
            rearLeft: this.rearLeft.compression,
            rearRight: this.rearRight.compression
        };
    }

    /**
     * Get all suspension forces
     * @returns {Object} Force values
     */
    getForces() {
        return { ...this._forces };
    }

    /**
     * Get body motion angles
     * @returns {{pitch: number, roll: number, heave: number}} Body motion
     */
    getBodyMotion() {
        return {
            pitch: this.pitch,
            roll: this.roll,
            heave: this.heave
        };
    }

    /**
     * Get telemetry for all corners
     * @returns {Object} Full suspension telemetry
     */
    getTelemetry() {
        return {
            frontLeft: this.frontLeft.getState(),
            frontRight: this.frontRight.getState(),
            rearLeft: this.rearLeft.getState(),
            rearRight: this.rearRight.getState(),
            body: this.getBodyMotion()
        };
    }

    /**
     * Apply damage to specific corner
     * @param {string} corner - Corner name
     * @param {number} amount - Damage amount
     */
    applyDamage(corner, amount) {
        if (this[corner]) {
            this[corner].applyDamage(amount);
        }
    }

    /**
     * Reset all suspensions
     */
    reset() {
        this.frontLeft.reset();
        this.frontRight.reset();
        this.rearLeft.reset();
        this.rearRight.reset();
        this.pitch = 0;
        this.roll = 0;
        this.heave = 0;
    }

    /**
     * Serialize to JSON
     * @returns {Object} JSON representation
     */
    toJSON() {
        return {
            frontLeft: this.frontLeft.toJSON(),
            frontRight: this.frontRight.toJSON(),
            rearLeft: this.rearLeft.toJSON(),
            rearRight: this.rearRight.toJSON()
        };
    }

    /**
     * Create from JSON
     * @param {Object} json - JSON object
     * @returns {SuspensionSystem} New instance
     */
    static fromJSON(json) {
        const sys = new SuspensionSystem();
        sys.frontLeft = Suspension.fromJSON(json.frontLeft);
        sys.frontRight = Suspension.fromJSON(json.frontRight);
        sys.rearLeft = Suspension.fromJSON(json.rearLeft);
        sys.rearRight = Suspension.fromJSON(json.rearRight);
        return sys;
    }
}

export default SuspensionSystem;
