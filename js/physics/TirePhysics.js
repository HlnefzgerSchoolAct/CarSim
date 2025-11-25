/**
 * TirePhysics.js - Advanced Tire Simulation
 * 
 * Implements comprehensive tire physics including Pacejka Magic Formula,
 * thermal modeling, wear simulation, and combined slip calculations.
 * 
 * @module physics/TirePhysics
 * @author CarSim Development Team
 * @version 2.0.0
 */

import { TIRE_CONSTANTS, PHYSICS_CONSTANTS, SURFACE_TYPES } from '../core/Constants.js';
import { MathUtils } from '../utils/MathUtils.js';

/**
 * @typedef {Object} TireState
 * @property {number} slipAngle - Slip angle in radians
 * @property {number} slipRatio - Longitudinal slip ratio
 * @property {number} lateralForce - Lateral force in N
 * @property {number} longitudinalForce - Longitudinal force in N
 * @property {number} selfAligningTorque - Self-aligning torque in Nm
 * @property {number} rollingResistance - Rolling resistance force in N
 * @property {number} normalLoad - Normal load on tire in N
 * @property {number} coreTemperature - Core temperature in Celsius
 * @property {number} surfaceTemperature - Surface temperature in Celsius
 * @property {number} wear - Wear level 0-1
 * @property {number} pressure - Tire pressure in kPa
 * @property {number} gripMultiplier - Current grip multiplier
 * @property {string} surfaceType - Current surface type
 */

/**
 * @typedef {Object} TireConfig
 * @property {number} radius - Tire radius in m
 * @property {number} width - Tire width in m
 * @property {number} mass - Tire+wheel mass in kg
 * @property {number} inertia - Rotational inertia in kg·m²
 * @property {number} optimalTemperature - Optimal operating temperature in C
 * @property {number} optimalPressure - Optimal pressure in kPa
 * @property {Object} pacejka - Pacejka coefficients
 */

/**
 * TirePhysics - Full tire simulation
 */
export class TirePhysics {
    /**
     * Creates a new TirePhysics instance
     * @param {TireConfig} config - Tire configuration
     */
    constructor(config = {}) {
        // Physical properties
        this.radius = config.radius || TIRE_CONSTANTS?.TIRE_RADIUS || 0.33;
        this.width = config.width || TIRE_CONSTANTS?.TIRE_WIDTH || 0.225;
        this.mass = config.mass || TIRE_CONSTANTS?.TIRE_MASS || 12;
        this.inertia = config.inertia || TIRE_CONSTANTS?.TIRE_INERTIA || 1.2;
        
        // Optimal conditions
        this.optimalTemperature = config.optimalTemperature || 90; // Celsius
        this.optimalPressure = config.optimalPressure || 220; // kPa
        
        // Pacejka coefficients for lateral force
        this.pacejkaLateral = config.pacejkaLateral || {
            B: TIRE_CONSTANTS?.PACEJKA_LATERAL?.B || 10,
            C: TIRE_CONSTANTS?.PACEJKA_LATERAL?.C || 1.9,
            D: TIRE_CONSTANTS?.PACEJKA_LATERAL?.D || 1,
            E: TIRE_CONSTANTS?.PACEJKA_LATERAL?.E || 0.97,
            Sh: 0,      // Horizontal shift
            Sv: 0       // Vertical shift
        };
        
        // Pacejka coefficients for longitudinal force
        this.pacejkaLongitudinal = config.pacejkaLongitudinal || {
            B: TIRE_CONSTANTS?.PACEJKA_LONGITUDINAL?.B || 12,
            C: TIRE_CONSTANTS?.PACEJKA_LONGITUDINAL?.C || 1.65,
            D: TIRE_CONSTANTS?.PACEJKA_LONGITUDINAL?.D || 1,
            E: TIRE_CONSTANTS?.PACEJKA_LONGITUDINAL?.E || 0.95,
            Sh: 0,
            Sv: 0
        };
        
        // Pacejka coefficients for self-aligning torque
        this.pacejkaAligning = config.pacejkaAligning || {
            B: 8,
            C: 1.5,
            D: 0.1,
            E: -1
        };
        
        // Combined slip coefficients
        this.combinedSlip = {
            Gxa: 1.0,   // Weighting for longitudinal in combined
            Gya: 1.0,   // Weighting for lateral in combined
            rBx1: 12,   // Combined slip reduction factor
            rBy1: 10
        };
        
        // Current state
        this.state = {
            slipAngle: 0,
            slipRatio: 0,
            lateralForce: 0,
            longitudinalForce: 0,
            selfAligningTorque: 0,
            rollingResistance: 0,
            normalLoad: 0,
            coreTemperature: 25,
            surfaceTemperature: 25,
            wear: 0,
            pressure: this.optimalPressure,
            gripMultiplier: 1.0,
            surfaceType: 'asphalt',
            angularVelocity: 0,
            contactPatchArea: 0
        };
        
        // Thermal model parameters
        this.thermal = {
            coreHeatCapacity: 1200,         // J/kg·K
            surfaceHeatCapacity: 500,       // J/kg·K
            coreToSurfaceTransfer: 0.5,     // W/K
            surfaceToAirTransfer: 10,       // W/K
            frictionHeatFactor: 0.8,        // Fraction of friction work to heat
            ambientTemperature: 25          // Celsius
        };
        
        // Wear model parameters
        this.wearModel = {
            wearRate: 0.00001,              // Base wear rate per unit work
            temperatureWearFactor: 0.001,   // Additional wear from overheating
            slipWearFactor: 0.0001          // Wear from slip
        };
        
        // Surface grip coefficients
        this.surfaceGrip = {
            asphalt: { dry: 1.0, wet: 0.7, snow: 0.4, ice: 0.15 },
            concrete: { dry: 0.95, wet: 0.65, snow: 0.35, ice: 0.12 },
            gravel: { dry: 0.6, wet: 0.5, snow: 0.3, ice: 0.1 },
            dirt: { dry: 0.55, wet: 0.4, snow: 0.25, ice: 0.1 },
            grass: { dry: 0.5, wet: 0.35, snow: 0.2, ice: 0.08 },
            sand: { dry: 0.4, wet: 0.3, snow: 0.2, ice: 0.08 },
            mud: { dry: 0.3, wet: 0.2, snow: 0.15, ice: 0.05 }
        };
        
        // Rolling resistance coefficients by surface
        this.rollingResistanceCoeff = {
            asphalt: 0.015,
            concrete: 0.017,
            gravel: 0.03,
            dirt: 0.04,
            grass: 0.06,
            sand: 0.1,
            mud: 0.15
        };
        
        // Load sensitivity
        this.loadSensitivity = {
            Cy1: 1.0,       // Linear load sensitivity
            Cy2: 0.0,       // Quadratic load sensitivity
            nominalLoad: 4000  // Nominal load in N
        };
        
        // Relaxation length (tire lag)
        this.relaxationLength = {
            lateral: 0.3,       // m
            longitudinal: 0.15  // m
        };
        
        // Camber parameters
        this.camber = {
            angle: 0,           // Current camber angle in radians
            stiffness: 500      // N/rad
        };
        
        // Internal calculation caches
        this._prevSlipAngle = 0;
        this._prevSlipRatio = 0;
        this._filteredSlipAngle = 0;
        this._filteredSlipRatio = 0;
    }
    
    /**
     * Updates tire physics
     * @param {number} deltaTime - Time step in seconds
     * @param {Object} inputs - Input parameters
     * @returns {TireState}
     */
    update(deltaTime, inputs) {
        const {
            wheelSpeed,         // Wheel angular velocity (rad/s)
            vehicleSpeed,       // Vehicle speed at wheel (m/s)
            steeringAngle,      // Steering angle (rad)
            normalLoad,         // Normal force on tire (N)
            velocityVector,     // Velocity vector at wheel
            surfaceType,        // Surface type string
            wetness,            // Surface wetness 0-1
            ambientTemp         // Ambient temperature
        } = inputs;
        
        // Update ambient temperature if provided
        if (ambientTemp !== undefined) {
            this.thermal.ambientTemperature = ambientTemp;
        }
        
        // Store normal load
        this.state.normalLoad = Math.max(0, normalLoad);
        this.state.surfaceType = surfaceType || 'asphalt';
        
        // Calculate slip angle and slip ratio
        this._calculateSlip(wheelSpeed, vehicleSpeed, velocityVector, steeringAngle);
        
        // Apply relaxation length (tire dynamics lag)
        this._applyRelaxation(deltaTime, vehicleSpeed);
        
        // Calculate grip multiplier
        this._calculateGripMultiplier(surfaceType, wetness);
        
        // Calculate contact patch
        this._calculateContactPatch();
        
        // Calculate forces using Pacejka Magic Formula
        this._calculateForces();
        
        // Apply combined slip reduction
        this._applyCombinedSlip();
        
        // Calculate rolling resistance
        this._calculateRollingResistance(surfaceType);
        
        // Update thermal model
        this._updateThermal(deltaTime);
        
        // Update wear
        this._updateWear(deltaTime);
        
        // Update angular velocity
        this.state.angularVelocity = wheelSpeed;
        
        return this.state;
    }
    
    /**
     * Calculates slip angle and slip ratio
     * @private
     */
    _calculateSlip(wheelSpeed, vehicleSpeed, velocityVector, steeringAngle) {
        // Longitudinal slip ratio: κ = (ωr - v) / max(|ωr|, |v|)
        const wheelLinearSpeed = wheelSpeed * this.radius;
        const speedDenom = Math.max(Math.abs(wheelLinearSpeed), Math.abs(vehicleSpeed), 0.1);
        
        // Slip ratio
        if (Math.abs(vehicleSpeed) < 0.1) {
            // Low speed: use wheel speed for slip calculation
            this.state.slipRatio = wheelLinearSpeed > 0.1 ? 1.0 : 
                                   wheelLinearSpeed < -0.1 ? -1.0 : 0;
        } else {
            this.state.slipRatio = (wheelLinearSpeed - vehicleSpeed) / speedDenom;
        }
        
        // Clamp slip ratio
        this.state.slipRatio = MathUtils.clamp(this.state.slipRatio, -1, 1);
        
        // Slip angle from velocity vector
        if (velocityVector && velocityVector.length() > 0.1) {
            // Calculate angle between tire heading and velocity direction
            const tireHeading = new THREE.Vector3(
                Math.sin(steeringAngle),
                0,
                Math.cos(steeringAngle)
            );
            
            const velNorm = velocityVector.clone().normalize();
            
            // Slip angle is the angle between heading and velocity
            const dot = tireHeading.dot(velNorm);
            const cross = tireHeading.x * velNorm.z - tireHeading.z * velNorm.x;
            
            this.state.slipAngle = Math.atan2(cross, dot);
        } else {
            this.state.slipAngle = 0;
        }
        
        // Store for relaxation calculation
        this._prevSlipAngle = this.state.slipAngle;
        this._prevSlipRatio = this.state.slipRatio;
    }
    
    /**
     * Applies relaxation length dynamics
     * @private
     */
    _applyRelaxation(deltaTime, vehicleSpeed) {
        const speed = Math.max(Math.abs(vehicleSpeed), 1);
        
        // Time constant based on relaxation length and speed
        const tauLateral = this.relaxationLength.lateral / speed;
        const tauLongitudinal = this.relaxationLength.longitudinal / speed;
        
        // First-order filter
        const alphaLateral = deltaTime / (deltaTime + tauLateral);
        const alphaLongitudinal = deltaTime / (deltaTime + tauLongitudinal);
        
        this._filteredSlipAngle = this._filteredSlipAngle + 
            alphaLateral * (this.state.slipAngle - this._filteredSlipAngle);
        this._filteredSlipRatio = this._filteredSlipRatio + 
            alphaLongitudinal * (this.state.slipRatio - this._filteredSlipRatio);
    }
    
    /**
     * Calculates grip multiplier based on conditions
     * @private
     */
    _calculateGripMultiplier(surfaceType, wetness) {
        const surface = surfaceType || 'asphalt';
        const surfaceGrips = this.surfaceGrip[surface] || this.surfaceGrip.asphalt;
        
        // Interpolate between dry and wet grip
        const wet = wetness || 0;
        let baseGrip;
        
        if (wet < 0.3) {
            baseGrip = MathUtils.lerp(surfaceGrips.dry, surfaceGrips.wet, wet / 0.3);
        } else if (wet < 0.7) {
            baseGrip = surfaceGrips.wet;
        } else {
            // Very wet starts to behave like hydroplaning
            baseGrip = MathUtils.lerp(surfaceGrips.wet, surfaceGrips.wet * 0.5, (wet - 0.7) / 0.3);
        }
        
        // Temperature effect on grip
        const tempDiff = Math.abs(this.state.surfaceTemperature - this.optimalTemperature);
        const tempMultiplier = Math.max(0.6, 1 - tempDiff * 0.005);
        
        // Pressure effect on grip
        const pressureRatio = this.state.pressure / this.optimalPressure;
        const pressureMultiplier = 1 - Math.abs(1 - pressureRatio) * 0.3;
        
        // Wear effect on grip
        const wearMultiplier = 1 - this.state.wear * 0.4;
        
        this.state.gripMultiplier = baseGrip * tempMultiplier * pressureMultiplier * wearMultiplier;
    }
    
    /**
     * Calculates contact patch area
     * @private
     */
    _calculateContactPatch() {
        // Contact patch approximation
        // A ≈ Fz / (k * p) where k is stiffness, p is pressure
        const stiffness = 200000; // N/m² (approximate)
        const pressurePa = this.state.pressure * 1000;
        
        this.state.contactPatchArea = this.state.normalLoad / (stiffness + pressurePa);
        
        // Clamp to reasonable values
        this.state.contactPatchArea = MathUtils.clamp(
            this.state.contactPatchArea, 
            0.01, 
            this.width * 0.15
        );
    }
    
    /**
     * Calculates tire forces using Pacejka Magic Formula
     * @private
     */
    _calculateForces() {
        const Fz = this.state.normalLoad;
        
        if (Fz < 10) {
            // No load - no forces
            this.state.lateralForce = 0;
            this.state.longitudinalForce = 0;
            this.state.selfAligningTorque = 0;
            return;
        }
        
        // Load sensitivity factor
        const Fz0 = this.loadSensitivity.nominalLoad;
        const dfz = (Fz - Fz0) / Fz0;
        const loadFactor = 1 + this.loadSensitivity.Cy1 * dfz + this.loadSensitivity.Cy2 * dfz * dfz;
        
        // Apply grip multiplier to peak coefficient
        const gripD = this.state.gripMultiplier;
        
        // LATERAL FORCE (Fy)
        const alphaEff = this._filteredSlipAngle + this.pacejkaLateral.Sh;
        const Fy0 = this._pacejkaFormula(
            alphaEff,
            this.pacejkaLateral.B,
            this.pacejkaLateral.C,
            gripD * this.pacejkaLateral.D,
            this.pacejkaLateral.E
        );
        
        // Add camber thrust
        const camberThrust = this.camber.angle * this.camber.stiffness;
        
        this.state.lateralForce = (Fy0 * Fz * loadFactor + this.pacejkaLateral.Sv + camberThrust);
        
        // LONGITUDINAL FORCE (Fx)
        const kappaEff = this._filteredSlipRatio + this.pacejkaLongitudinal.Sh;
        const Fx0 = this._pacejkaFormula(
            kappaEff,
            this.pacejkaLongitudinal.B,
            this.pacejkaLongitudinal.C,
            gripD * this.pacejkaLongitudinal.D,
            this.pacejkaLongitudinal.E
        );
        
        this.state.longitudinalForce = Fx0 * Fz * loadFactor + this.pacejkaLongitudinal.Sv;
        
        // SELF-ALIGNING TORQUE (Mz)
        const Mz0 = this._pacejkaFormula(
            alphaEff,
            this.pacejkaAligning.B,
            this.pacejkaAligning.C,
            this.pacejkaAligning.D,
            this.pacejkaAligning.E
        );
        
        // Trail effect
        const pneumaticTrail = 0.05 * (1 - Math.abs(this._filteredSlipAngle) / (Math.PI / 6));
        this.state.selfAligningTorque = -this.state.lateralForce * pneumaticTrail + Mz0 * Fz;
    }
    
    /**
     * Pacejka Magic Formula
     * F = D * sin(C * atan(B*x - E*(B*x - atan(B*x))))
     * @private
     */
    _pacejkaFormula(x, B, C, D, E) {
        const Bx = B * x;
        const inner = Bx - E * (Bx - Math.atan(Bx));
        return D * Math.sin(C * Math.atan(inner));
    }
    
    /**
     * Applies combined slip reduction
     * @private
     */
    _applyCombinedSlip() {
        const alpha = Math.abs(this._filteredSlipAngle);
        const kappa = Math.abs(this._filteredSlipRatio);
        
        // Combined slip using friction ellipse
        // Reduces each force based on the other's slip
        
        if (alpha > 0.001 && kappa > 0.001) {
            // Calculate combined slip magnitude
            const combinedSlip = Math.sqrt(
                (alpha / (Math.PI / 6)) ** 2 + kappa ** 2
            );
            
            // Reduction factors using cosine weighting
            const angle = Math.atan2(alpha, kappa);
            const Gxa = Math.cos(angle);
            const Gya = Math.sin(angle);
            
            // Apply friction ellipse reduction
            const ellipseReduction = Math.min(1, 1 / combinedSlip);
            
            this.state.lateralForce *= Gya * ellipseReduction * this.combinedSlip.Gya;
            this.state.longitudinalForce *= Gxa * ellipseReduction * this.combinedSlip.Gxa;
        }
    }
    
    /**
     * Calculates rolling resistance
     * @private
     */
    _calculateRollingResistance(surfaceType) {
        const Crr = this.rollingResistanceCoeff[surfaceType] || 
                    this.rollingResistanceCoeff.asphalt;
        
        // Rolling resistance: Fr = Crr * Fz
        // Modified by speed and pressure
        const speed = Math.abs(this.state.angularVelocity * this.radius);
        const speedFactor = 1 + 0.01 * speed; // Increases with speed
        
        const pressureRatio = this.optimalPressure / Math.max(this.state.pressure, 100);
        const pressureFactor = 0.8 + 0.2 * pressureRatio; // Lower pressure = more resistance
        
        this.state.rollingResistance = Crr * this.state.normalLoad * speedFactor * pressureFactor;
    }
    
    /**
     * Updates thermal model
     * @private
     */
    _updateThermal(deltaTime) {
        // Heat generation from friction work
        const slipWork = Math.abs(this.state.lateralForce * this._filteredSlipAngle) +
                        Math.abs(this.state.longitudinalForce * this._filteredSlipRatio);
        const frictionHeat = slipWork * this.thermal.frictionHeatFactor * deltaTime;
        
        // Heat to surface
        const surfaceMass = this.mass * 0.1; // Approximate surface layer mass
        const surfaceHeatCapacity = this.thermal.surfaceHeatCapacity * surfaceMass;
        const surfaceDeltaT = frictionHeat / surfaceHeatCapacity;
        this.state.surfaceTemperature += surfaceDeltaT;
        
        // Heat transfer: surface to core
        const coreTransferRate = this.thermal.coreToSurfaceTransfer * 
            (this.state.surfaceTemperature - this.state.coreTemperature);
        const coreMass = this.mass * 0.9;
        const coreHeatCapacity = this.thermal.coreHeatCapacity * coreMass;
        
        this.state.coreTemperature += coreTransferRate * deltaTime / coreHeatCapacity;
        this.state.surfaceTemperature -= coreTransferRate * deltaTime / surfaceHeatCapacity;
        
        // Heat transfer: surface to air
        const airTransferRate = this.thermal.surfaceToAirTransfer * 
            (this.state.surfaceTemperature - this.thermal.ambientTemperature);
        
        // Speed increases air cooling
        const speed = Math.abs(this.state.angularVelocity * this.radius);
        const speedCoolingFactor = 1 + speed * 0.1;
        
        this.state.surfaceTemperature -= airTransferRate * speedCoolingFactor * deltaTime / surfaceHeatCapacity;
        
        // Core also slowly cools to ambient
        const coreCooling = 0.01 * (this.state.coreTemperature - this.thermal.ambientTemperature);
        this.state.coreTemperature -= coreCooling * deltaTime;
        
        // Clamp temperatures
        this.state.surfaceTemperature = MathUtils.clamp(
            this.state.surfaceTemperature, 
            this.thermal.ambientTemperature, 
            200
        );
        this.state.coreTemperature = MathUtils.clamp(
            this.state.coreTemperature,
            this.thermal.ambientTemperature,
            180
        );
    }
    
    /**
     * Updates tire wear
     * @private
     */
    _updateWear(deltaTime) {
        // Base wear from slip
        const slipMagnitude = Math.sqrt(
            this._filteredSlipAngle ** 2 + 
            this._filteredSlipRatio ** 2
        );
        const slipWear = slipMagnitude * this.wearModel.slipWearFactor * deltaTime;
        
        // Temperature wear (accelerated wear at high temps)
        const overTemp = Math.max(0, this.state.surfaceTemperature - this.optimalTemperature - 20);
        const tempWear = overTemp * this.wearModel.temperatureWearFactor * deltaTime;
        
        // Load-based wear
        const loadFactor = this.state.normalLoad / this.loadSensitivity.nominalLoad;
        const loadWear = loadFactor * this.wearModel.wearRate * deltaTime;
        
        // Total wear
        this.state.wear = Math.min(1, this.state.wear + slipWear + tempWear + loadWear);
    }
    
    /**
     * Gets slip angle in degrees
     * @returns {number}
     */
    getSlipAngleDegrees() {
        return this.state.slipAngle * (180 / Math.PI);
    }
    
    /**
     * Gets slip ratio as percentage
     * @returns {number}
     */
    getSlipRatioPercent() {
        return this.state.slipRatio * 100;
    }
    
    /**
     * Gets friction coefficient estimate
     * @returns {number}
     */
    getFrictionCoefficient() {
        if (this.state.normalLoad < 10) return 0;
        
        const totalForce = Math.sqrt(
            this.state.lateralForce ** 2 + 
            this.state.longitudinalForce ** 2
        );
        
        return totalForce / this.state.normalLoad;
    }
    
    /**
     * Checks if tire is overheating
     * @returns {boolean}
     */
    isOverheating() {
        return this.state.surfaceTemperature > this.optimalTemperature + 40;
    }
    
    /**
     * Checks if tire is worn out
     * @returns {boolean}
     */
    isWornOut() {
        return this.state.wear > 0.9;
    }
    
    /**
     * Gets temperature as percentage of optimal
     * @returns {number}
     */
    getTemperaturePercent() {
        return (this.state.surfaceTemperature / this.optimalTemperature) * 100;
    }
    
    /**
     * Sets tire pressure
     * @param {number} pressure - Pressure in kPa
     */
    setPressure(pressure) {
        this.state.pressure = MathUtils.clamp(pressure, 100, 300);
    }
    
    /**
     * Sets camber angle
     * @param {number} angle - Camber angle in radians
     */
    setCamber(angle) {
        this.camber.angle = MathUtils.clamp(angle, -0.1, 0.1);
    }
    
    /**
     * Resets tire to initial state
     */
    reset() {
        this.state.slipAngle = 0;
        this.state.slipRatio = 0;
        this.state.lateralForce = 0;
        this.state.longitudinalForce = 0;
        this.state.selfAligningTorque = 0;
        this.state.rollingResistance = 0;
        this.state.normalLoad = 0;
        this.state.coreTemperature = this.thermal.ambientTemperature;
        this.state.surfaceTemperature = this.thermal.ambientTemperature;
        this.state.wear = 0;
        this.state.pressure = this.optimalPressure;
        this.state.gripMultiplier = 1.0;
        this.state.angularVelocity = 0;
        
        this._prevSlipAngle = 0;
        this._prevSlipRatio = 0;
        this._filteredSlipAngle = 0;
        this._filteredSlipRatio = 0;
    }
    
    /**
     * Gets current tire state
     * @returns {TireState}
     */
    getState() {
        return { ...this.state };
    }
    
    /**
     * Gets diagnostic information
     * @returns {Object}
     */
    getDiagnostics() {
        return {
            slipAngle: this.getSlipAngleDegrees(),
            slipRatio: this.getSlipRatioPercent(),
            lateralForce: this.state.lateralForce,
            longitudinalForce: this.state.longitudinalForce,
            frictionCoeff: this.getFrictionCoefficient(),
            surfaceTemp: this.state.surfaceTemperature,
            coreTemp: this.state.coreTemperature,
            wear: this.state.wear * 100,
            pressure: this.state.pressure,
            grip: this.state.gripMultiplier,
            isOverheating: this.isOverheating(),
            isWorn: this.isWornOut()
        };
    }
}

export default TirePhysics;
