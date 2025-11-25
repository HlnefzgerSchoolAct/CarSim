/**
 * Wheel.js - Individual Wheel Simulation
 * 
 * Simulates a single wheel with tire physics, rotation, temperature, and wear.
 * Integrates with Pacejka tire model for realistic force calculations.
 * 
 * @module vehicle/Wheel
 * @author CarSim Development Team
 * @version 2.0.0
 */

import { TIRE_CONSTANTS, PHYSICS_CONSTANTS } from '../core/Constants.js';
import { MathUtils } from '../utils/MathUtils.js';
import { Pacejka } from '../physics/Pacejka.js';

/**
 * @class Wheel
 * @description Simulates an individual wheel with full physics
 */
export class Wheel {
    /**
     * Creates a new Wheel instance
     * @param {Object} [config] - Wheel configuration
     * @param {string} [position='front_left'] - Wheel position on vehicle
     */
    constructor(config = {}, position = 'front_left') {
        /** @type {string} Wheel position identifier */
        this.position = position;
        
        /** @type {boolean} Is this a front wheel */
        this.isFront = position.includes('front');
        
        /** @type {boolean} Is this a left wheel */
        this.isLeft = position.includes('left');
        
        // Physical properties
        /** @type {number} Tire radius in meters */
        this.radius = config.radius ?? TIRE_CONSTANTS.TIRE_RADIUS;
        
        /** @type {number} Tire width in meters */
        this.width = config.width ?? TIRE_CONSTANTS.TIRE_WIDTH;
        
        /** @type {number} Wheel and tire mass in kg */
        this.mass = config.mass ?? TIRE_CONSTANTS.TIRE_MASS;
        
        /** @type {number} Rotational inertia in kg·m² */
        this.inertia = config.inertia ?? TIRE_CONSTANTS.TIRE_INERTIA;
        
        // Tire model
        /** @type {Pacejka} Pacejka tire model instance */
        this.tireModel = config.tireModel ?? new Pacejka();
        
        // Position and orientation
        /** @type {THREE.Vector3} World position */
        this.position3D = new THREE.Vector3();
        
        /** @type {THREE.Quaternion} World orientation */
        this.orientation = new THREE.Quaternion();
        
        /** @type {THREE.Vector3} Local offset from chassis */
        this.localOffset = config.localOffset ?? new THREE.Vector3();
        
        // Dynamic state
        /** @type {number} Angular velocity in rad/s */
        this.angularVelocity = 0;
        
        /** @type {number} Steering angle in radians (front wheels only) */
        this.steeringAngle = 0;
        
        /** @type {number} Camber angle in radians */
        this.camberAngle = config.camberAngle ?? 0;
        
        /** @type {number} Toe angle in radians */
        this.toeAngle = config.toeAngle ?? 0;
        
        // Contact patch
        /** @type {boolean} Is wheel on ground */
        this.onGround = false;
        
        /** @type {THREE.Vector3} Contact point with ground */
        this.contactPoint = new THREE.Vector3();
        
        /** @type {THREE.Vector3} Ground normal at contact */
        this.contactNormal = new THREE.Vector3(0, 1, 0);
        
        /** @type {string} Surface type at contact */
        this.surfaceType = 'asphalt';
        
        /** @type {number} Surface grip multiplier */
        this.surfaceGrip = 1.0;
        
        // Forces and slip
        /** @type {number} Vertical load on tire in N */
        this.load = 0;
        
        /** @type {number} Slip ratio (-1 to 1) */
        this.slipRatio = 0;
        
        /** @type {number} Slip angle in radians */
        this.slipAngle = 0;
        
        /** @type {number} Lateral force in N */
        this.lateralForce = 0;
        
        /** @type {number} Longitudinal force in N */
        this.longitudinalForce = 0;
        
        /** @type {number} Self-aligning torque in Nm */
        this.aligningTorque = 0;
        
        /** @type {number} Rolling resistance force in N */
        this.rollingResistance = 0;
        
        // Applied torque
        /** @type {number} Drive torque from transmission */
        this.driveTorque = 0;
        
        /** @type {number} Brake torque */
        this.brakeTorque = 0;
        
        // Tire condition
        /** @type {number} Tire temperature in Celsius */
        this.temperature = 20;
        
        /** @type {number} Tire wear (0-1, 1 = worn out) */
        this.wear = 0;
        
        /** @type {number} Tire pressure in bar */
        this.pressure = config.pressure ?? 2.2;
        
        /** @type {number} Optimal pressure in bar */
        this.optimalPressure = 2.2;
        
        // Visual/mesh reference
        /** @type {THREE.Object3D} Wheel mesh */
        this.mesh = null;
        
        /** @type {number} Visual rotation angle for rendering */
        this.visualRotation = 0;
        
        // Damage
        /** @type {number} Wheel damage (0-1) */
        this.damage = 0;
        
        /** @type {boolean} Tire is flat/punctured */
        this.isFlat = false;
        
        // Cached calculations
        this._velocityAtContact = new THREE.Vector3();
        this._forwardVector = new THREE.Vector3();
        this._rightVector = new THREE.Vector3();
    }

    /**
     * Update wheel physics
     * @param {number} deltaTime - Time step in seconds
     * @param {Object} vehicleState - Current vehicle state
     * @param {Object} suspensionState - Current suspension state for this wheel
     */
    update(deltaTime, vehicleState, suspensionState) {
        // Update ground contact
        this.updateGroundContact(vehicleState, suspensionState);
        
        // Calculate slip values
        this.calculateSlip(vehicleState);
        
        // Calculate tire forces
        this.calculateForces(vehicleState);
        
        // Update angular velocity
        this.updateAngularVelocity(deltaTime);
        
        // Update tire temperature
        this.updateTemperature(deltaTime, vehicleState);
        
        // Update tire wear
        this.updateWear(deltaTime);
        
        // Update visual rotation
        this.visualRotation += this.angularVelocity * deltaTime;
        this.visualRotation = this.visualRotation % (Math.PI * 2);
    }

    /**
     * Update ground contact state
     * @param {Object} vehicleState - Vehicle state
     * @param {Object} suspensionState - Suspension state
     */
    updateGroundContact(vehicleState, suspensionState) {
        // Determine if wheel is on ground based on suspension
        this.onGround = suspensionState?.onGround ?? true;
        this.load = suspensionState?.load ?? (this.mass * PHYSICS_CONSTANTS.GRAVITY * 4);
        
        if (suspensionState) {
            this.surfaceType = suspensionState.surfaceType ?? 'asphalt';
            this.surfaceGrip = Pacejka.getSurfaceGrip(this.surfaceType);
        }
        
        // Flat tire reduces effective radius and grip
        if (this.isFlat) {
            this.surfaceGrip *= 0.3;
        }
    }

    /**
     * Calculate slip ratio and slip angle
     * @param {Object} vehicleState - Vehicle state
     */
    calculateSlip(vehicleState) {
        if (!this.onGround || this.load <= 0) {
            this.slipRatio = 0;
            this.slipAngle = 0;
            return;
        }
        
        const velocity = vehicleState.velocity ?? 0;
        const angularVelocity = vehicleState.angularVelocity ?? 0;
        
        // Calculate wheel ground velocity
        const effectiveRadius = this.isFlat ? this.radius * 0.85 : this.radius;
        const wheelLinearVelocity = this.angularVelocity * effectiveRadius;
        
        // Calculate velocity at wheel contact patch
        // This considers vehicle velocity plus rotation around CG
        const wheelOffset = this.localOffset.clone();
        const tangentialVelocity = angularVelocity * wheelOffset.length();
        
        // Forward velocity at wheel (longitudinal)
        const forwardVelocity = velocity;
        
        // Calculate slip ratio
        if (Math.abs(forwardVelocity) > 0.5) {
            this.slipRatio = (wheelLinearVelocity - forwardVelocity) / Math.abs(forwardVelocity);
        } else if (Math.abs(wheelLinearVelocity) > 0.5) {
            this.slipRatio = (wheelLinearVelocity - forwardVelocity) / Math.abs(wheelLinearVelocity);
        } else {
            this.slipRatio = 0;
        }
        
        // Clamp slip ratio
        this.slipRatio = MathUtils.clamp(this.slipRatio, -1, 1);
        
        // Calculate slip angle
        const lateralVelocity = vehicleState.lateralVelocity ?? 0;
        const totalSteerAngle = this.steeringAngle + this.toeAngle;
        
        if (Math.abs(forwardVelocity) > 0.5) {
            // Slip angle = angle between wheel heading and velocity direction
            const velocityAngle = Math.atan2(lateralVelocity, forwardVelocity);
            this.slipAngle = totalSteerAngle - velocityAngle;
        } else {
            this.slipAngle = 0;
        }
        
        // Normalize slip angle
        this.slipAngle = MathUtils.normalizeAngle(this.slipAngle);
    }

    /**
     * Calculate tire forces using Pacejka model
     * @param {Object} vehicleState - Vehicle state
     */
    calculateForces(vehicleState) {
        if (!this.onGround || this.load <= 0) {
            this.lateralForce = 0;
            this.longitudinalForce = 0;
            this.aligningTorque = 0;
            this.rollingResistance = 0;
            return;
        }
        
        // Get tire conditions
        const conditions = {
            surfaceGrip: this.surfaceGrip,
            load: this.load / 5000, // Normalized load
            temperature: this.temperature,
            wear: this.wear,
            camber: this.camberAngle
        };
        
        // Calculate combined forces
        const forces = this.tireModel.calculateCombinedForces(
            this.slipAngle,
            this.slipRatio,
            conditions
        );
        
        // Scale by load
        this.lateralForce = forces.lateral * this.load;
        this.longitudinalForce = forces.longitudinal * this.load;
        
        // Apply damage effects
        const damageMultiplier = 1 - this.damage * 0.5;
        this.lateralForce *= damageMultiplier;
        this.longitudinalForce *= damageMultiplier;
        
        // Calculate self-aligning torque
        this.aligningTorque = this.tireModel.calculateSelfAligningTorque(
            this.slipAngle,
            this.lateralForce
        );
        
        // Calculate rolling resistance
        this.rollingResistance = this.tireModel.calculateRollingResistance(
            this.load,
            Math.abs(vehicleState.velocity ?? 0)
        );
        
        // Flat tire adds significant resistance
        if (this.isFlat) {
            this.rollingResistance *= 5;
        }
    }

    /**
     * Update wheel angular velocity
     * @param {number} deltaTime - Time step
     */
    updateAngularVelocity(deltaTime) {
        // Calculate net torque
        let netTorque = this.driveTorque - this.brakeTorque;
        
        // Add longitudinal force contribution (tire slip)
        if (this.onGround) {
            const effectiveRadius = this.isFlat ? this.radius * 0.85 : this.radius;
            netTorque -= this.longitudinalForce * effectiveRadius * this.slipRatio * 0.1;
        }
        
        // Calculate angular acceleration
        const angularAcceleration = netTorque / this.inertia;
        
        // Update angular velocity
        this.angularVelocity += angularAcceleration * deltaTime;
        
        // Apply natural deceleration when coasting
        if (Math.abs(this.driveTorque) < 1 && Math.abs(this.brakeTorque) < 1) {
            this.angularVelocity *= 0.999; // Very slight drag
        }
    }

    /**
     * Update tire temperature
     * @param {number} deltaTime - Time step
     * @param {Object} vehicleState - Vehicle state
     */
    updateTemperature(deltaTime, vehicleState) {
        const velocity = Math.abs(vehicleState.velocity ?? 0);
        
        // Heat generation from slip
        const heatGeneration = this.tireModel.calculateHeatGeneration(
            Math.abs(this.slipAngle),
            Math.abs(this.slipRatio),
            this.load,
            velocity
        );
        
        // Heat dissipation
        const ambientTemp = vehicleState.ambientTemperature ?? 25;
        const heatDissipation = this.tireModel.calculateHeatDissipation(
            this.temperature,
            ambientTemp,
            velocity
        );
        
        // Update temperature
        const thermalMass = 50; // Simplified thermal mass
        this.temperature += (heatGeneration - heatDissipation) * deltaTime / thermalMass;
        
        // Clamp temperature
        this.temperature = MathUtils.clamp(this.temperature, ambientTemp, 150);
    }

    /**
     * Update tire wear
     * @param {number} deltaTime - Time step
     */
    updateWear(deltaTime) {
        if (!this.onGround) return;
        
        const wearRate = this.tireModel.calculateWearRate(
            Math.abs(this.slipAngle),
            Math.abs(this.slipRatio),
            this.load,
            this.temperature
        );
        
        this.wear = MathUtils.clamp(this.wear + wearRate * deltaTime, 0, 1);
        
        // Check for puncture from excessive wear
        if (this.wear > 0.95 && Math.random() < 0.001 * deltaTime) {
            this.puncture();
        }
    }

    /**
     * Apply steering angle to wheel
     * @param {number} angle - Steering angle in radians
     */
    setSteeringAngle(angle) {
        if (this.isFront) {
            this.steeringAngle = angle;
        }
    }

    /**
     * Apply drive torque to wheel
     * @param {number} torque - Drive torque in Nm
     */
    setDriveTorque(torque) {
        this.driveTorque = torque;
    }

    /**
     * Apply brake torque to wheel
     * @param {number} torque - Brake torque in Nm
     */
    setBrakeTorque(torque) {
        this.brakeTorque = Math.abs(torque) * Math.sign(this.angularVelocity);
    }

    /**
     * Puncture the tire
     */
    puncture() {
        this.isFlat = true;
        this.pressure = 0;
    }

    /**
     * Repair the tire
     */
    repair() {
        this.isFlat = false;
        this.pressure = this.optimalPressure;
        this.damage = 0;
        this.wear = 0;
    }

    /**
     * Apply damage to wheel
     * @param {number} amount - Damage amount (0-1)
     */
    applyDamage(amount) {
        this.damage = MathUtils.clamp(this.damage + amount, 0, 1);
        
        // Chance of puncture from severe damage
        if (this.damage > 0.8 && Math.random() < amount) {
            this.puncture();
        }
    }

    /**
     * Get wheel state for telemetry
     * @returns {Object} Wheel state
     */
    getState() {
        return {
            position: this.position,
            angularVelocity: this.angularVelocity,
            linearVelocity: this.angularVelocity * this.radius,
            steeringAngle: this.steeringAngle,
            slipRatio: this.slipRatio,
            slipAngle: this.slipAngle,
            lateralForce: this.lateralForce,
            longitudinalForce: this.longitudinalForce,
            load: this.load,
            temperature: this.temperature,
            wear: this.wear,
            pressure: this.pressure,
            onGround: this.onGround,
            isFlat: this.isFlat,
            damage: this.damage,
            surfaceType: this.surfaceType
        };
    }

    /**
     * Get effective wheel circumference
     * @returns {number} Circumference in meters
     */
    getCircumference() {
        const effectiveRadius = this.isFlat ? this.radius * 0.85 : this.radius;
        return 2 * Math.PI * effectiveRadius;
    }

    /**
     * Get current rotation speed in RPM
     * @returns {number} Wheel RPM
     */
    getRPM() {
        return (this.angularVelocity * 60) / (2 * Math.PI);
    }

    /**
     * Update visual mesh
     */
    updateMesh() {
        if (!this.mesh) return;
        
        // Update position
        this.mesh.position.copy(this.position3D);
        
        // Update rotation (steering + spin)
        this.mesh.rotation.y = this.steeringAngle;
        this.mesh.children.forEach(child => {
            if (child.userData.isWheel) {
                child.rotation.x = this.visualRotation;
            }
        });
    }

    /**
     * Reset wheel to initial state
     */
    reset() {
        this.angularVelocity = 0;
        this.steeringAngle = 0;
        this.slipRatio = 0;
        this.slipAngle = 0;
        this.lateralForce = 0;
        this.longitudinalForce = 0;
        this.temperature = 20;
        this.wear = 0;
        this.damage = 0;
        this.isFlat = false;
        this.pressure = this.optimalPressure;
        this.driveTorque = 0;
        this.brakeTorque = 0;
        this.visualRotation = 0;
    }

    /**
     * Serialize to JSON
     * @returns {Object} JSON representation
     */
    toJSON() {
        return {
            position: this.position,
            angularVelocity: this.angularVelocity,
            temperature: this.temperature,
            wear: this.wear,
            pressure: this.pressure,
            damage: this.damage,
            isFlat: this.isFlat
        };
    }

    /**
     * Create from JSON
     * @param {Object} json - JSON object
     * @param {string} position - Wheel position
     * @returns {Wheel} New instance
     */
    static fromJSON(json, position) {
        const wheel = new Wheel({}, position);
        wheel.angularVelocity = json.angularVelocity ?? 0;
        wheel.temperature = json.temperature ?? 20;
        wheel.wear = json.wear ?? 0;
        wheel.pressure = json.pressure ?? 2.2;
        wheel.damage = json.damage ?? 0;
        wheel.isFlat = json.isFlat ?? false;
        return wheel;
    }
}

export default Wheel;
