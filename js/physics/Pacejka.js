/**
 * Pacejka.js - Pacejka Magic Formula Tire Model
 * 
 * Implements the Pacejka Magic Formula for calculating tire forces.
 * This is the industry-standard tire model used in professional racing simulations.
 * 
 * The Magic Formula: F = D * sin(C * atan(B*x - E*(B*x - atan(B*x))))
 * Where:
 *   B = Stiffness factor
 *   C = Shape factor
 *   D = Peak value
 *   E = Curvature factor
 *   x = Slip angle (lateral) or slip ratio (longitudinal)
 * 
 * @module physics/Pacejka
 * @author CarSim Development Team
 * @version 2.0.0
 */

import { TIRE_CONSTANTS, SURFACE_CONSTANTS } from '../core/Constants.js';
import { MathUtils } from '../utils/MathUtils.js';

/**
 * @class Pacejka
 * @description Implements Pacejka Magic Formula tire model
 */
export class Pacejka {
    /**
     * Creates a new Pacejka tire model instance
     * @param {Object} [config] - Configuration options
     */
    constructor(config = {}) {
        // Lateral force coefficients
        this.lateralB = config.lateralB ?? TIRE_CONSTANTS.PACEJKA_LATERAL.B;
        this.lateralC = config.lateralC ?? TIRE_CONSTANTS.PACEJKA_LATERAL.C;
        this.lateralD = config.lateralD ?? TIRE_CONSTANTS.PACEJKA_LATERAL.D;
        this.lateralE = config.lateralE ?? TIRE_CONSTANTS.PACEJKA_LATERAL.E;
        
        // Longitudinal force coefficients
        this.longitudinalB = config.longitudinalB ?? TIRE_CONSTANTS.PACEJKA_LONGITUDINAL.B;
        this.longitudinalC = config.longitudinalC ?? TIRE_CONSTANTS.PACEJKA_LONGITUDINAL.C;
        this.longitudinalD = config.longitudinalD ?? TIRE_CONSTANTS.PACEJKA_LONGITUDINAL.D;
        this.longitudinalE = config.longitudinalE ?? TIRE_CONSTANTS.PACEJKA_LONGITUDINAL.E;
        
        // Combined force scaling
        this.combinedFactor = config.combinedFactor ?? 0.9;
        
        // Temperature effects
        this.optimalTemperature = config.optimalTemperature ?? TIRE_CONSTANTS.OPTIMAL_TEMPERATURE;
        this.temperatureRange = config.temperatureRange ?? TIRE_CONSTANTS.TEMPERATURE_RANGE;
        
        // Wear effects
        this.wearFactor = config.wearFactor ?? 1.0;
        
        // Tire pressure effects (normalized, 1.0 = optimal)
        this.pressureFactor = config.pressureFactor ?? 1.0;
        
        // Camber thrust coefficient
        this.camberStiffness = config.camberStiffness ?? 0.1;
        
        // Cache for performance
        this._cache = {
            lastLateralSlip: null,
            lastLateralForce: null,
            lastLongSlip: null,
            lastLongForce: null
        };
    }

    /**
     * Calculate the Magic Formula
     * @param {number} slip - Slip value (angle or ratio)
     * @param {number} B - Stiffness factor
     * @param {number} C - Shape factor
     * @param {number} D - Peak value
     * @param {number} E - Curvature factor
     * @returns {number} Normalized force coefficient
     */
    magicFormula(slip, B, C, D, E) {
        const Bx = B * slip;
        const Ex = E * (Bx - Math.atan(Bx));
        return D * Math.sin(C * Math.atan(Bx - Ex));
    }

    /**
     * Calculate lateral (cornering) force coefficient
     * @param {number} slipAngle - Slip angle in radians
     * @param {Object} [conditions] - Surface and tire conditions
     * @returns {number} Lateral force coefficient (-1 to 1)
     */
    calculateLateralForce(slipAngle, conditions = {}) {
        const {
            surfaceGrip = 1.0,
            load = 1.0,
            temperature = this.optimalTemperature,
            wear = 0,
            camber = 0
        } = conditions;
        
        // Apply load sensitivity (tire generates relatively less force at higher loads)
        const loadSensitivity = Math.pow(load, 0.9);
        
        // Temperature effect on grip
        const tempEffect = this.getTemperatureEffect(temperature);
        
        // Wear effect
        const wearEffect = 1.0 - wear * 0.3;
        
        // Calculate base lateral force
        let lateralForce = this.magicFormula(
            slipAngle,
            this.lateralB,
            this.lateralC,
            this.lateralD * loadSensitivity,
            this.lateralE
        );
        
        // Add camber thrust
        const camberThrust = camber * this.camberStiffness * loadSensitivity;
        lateralForce += camberThrust;
        
        // Apply conditions
        lateralForce *= surfaceGrip * tempEffect * wearEffect * this.pressureFactor;
        
        return MathUtils.clamp(lateralForce, -1.5, 1.5);
    }

    /**
     * Calculate longitudinal (acceleration/braking) force coefficient
     * @param {number} slipRatio - Slip ratio (-1 to 1)
     * @param {Object} [conditions] - Surface and tire conditions
     * @returns {number} Longitudinal force coefficient (-1 to 1)
     */
    calculateLongitudinalForce(slipRatio, conditions = {}) {
        const {
            surfaceGrip = 1.0,
            load = 1.0,
            temperature = this.optimalTemperature,
            wear = 0
        } = conditions;
        
        // Apply load sensitivity
        const loadSensitivity = Math.pow(load, 0.9);
        
        // Temperature effect on grip
        const tempEffect = this.getTemperatureEffect(temperature);
        
        // Wear effect
        const wearEffect = 1.0 - wear * 0.3;
        
        // Calculate longitudinal force
        let longForce = this.magicFormula(
            slipRatio,
            this.longitudinalB,
            this.longitudinalC,
            this.longitudinalD * loadSensitivity,
            this.longitudinalE
        );
        
        // Apply conditions
        longForce *= surfaceGrip * tempEffect * wearEffect * this.pressureFactor;
        
        return MathUtils.clamp(longForce, -1.5, 1.5);
    }

    /**
     * Calculate combined lateral and longitudinal forces
     * When both forces are present, they compete for available grip (friction circle)
     * @param {number} slipAngle - Slip angle in radians
     * @param {number} slipRatio - Slip ratio
     * @param {Object} [conditions] - Surface and tire conditions
     * @returns {{lateral: number, longitudinal: number}} Force coefficients
     */
    calculateCombinedForces(slipAngle, slipRatio, conditions = {}) {
        // Calculate pure lateral and longitudinal forces
        const pureLateral = this.calculateLateralForce(slipAngle, conditions);
        const pureLongitudinal = this.calculateLongitudinalForce(slipRatio, conditions);
        
        // Combined slip magnitude
        const combinedSlip = Math.sqrt(slipAngle * slipAngle + slipRatio * slipRatio);
        
        if (combinedSlip < 0.001) {
            return { lateral: 0, longitudinal: 0 };
        }
        
        // Calculate force scaling based on friction circle/ellipse
        const maxForce = Math.sqrt(pureLateral * pureLateral + pureLongitudinal * pureLongitudinal);
        
        if (maxForce < 0.001) {
            return { lateral: 0, longitudinal: 0 };
        }
        
        // Friction ellipse limiting
        const lateralPortion = Math.abs(slipAngle) / combinedSlip;
        const longPortion = Math.abs(slipRatio) / combinedSlip;
        
        // Calculate available grip for each direction
        const gripLimit = 1.0;
        const currentGrip = Math.sqrt(
            Math.pow(pureLateral * lateralPortion, 2) + 
            Math.pow(pureLongitudinal * longPortion, 2)
        );
        
        let scale = 1.0;
        if (currentGrip > gripLimit) {
            scale = gripLimit / currentGrip * this.combinedFactor;
        }
        
        return {
            lateral: pureLateral * scale,
            longitudinal: pureLongitudinal * scale
        };
    }

    /**
     * Calculate self-aligning torque (feedback to steering)
     * @param {number} slipAngle - Slip angle in radians
     * @param {number} lateralForce - Calculated lateral force
     * @param {number} pneumaticTrail - Pneumatic trail length in meters
     * @returns {number} Self-aligning torque in Nm
     */
    calculateSelfAligningTorque(slipAngle, lateralForce, pneumaticTrail = 0.03) {
        // Pneumatic trail reduces with slip angle
        const trailReduction = Math.cos(slipAngle * 2);
        const effectiveTrail = pneumaticTrail * Math.max(0, trailReduction);
        
        return -lateralForce * effectiveTrail;
    }

    /**
     * Calculate rolling resistance force
     * @param {number} load - Vertical load in N
     * @param {number} speed - Vehicle speed in m/s
     * @returns {number} Rolling resistance force in N
     */
    calculateRollingResistance(load, speed) {
        const baseCoeff = TIRE_CONSTANTS.ROLLING_RESISTANCE;
        
        // Speed-dependent component
        const speedFactor = 1 + 0.001 * speed * speed;
        
        return load * baseCoeff * speedFactor;
    }

    /**
     * Calculate temperature effect on grip
     * @param {number} temperature - Tire temperature in Celsius
     * @returns {number} Grip multiplier (0.5 to 1.2)
     */
    getTemperatureEffect(temperature) {
        const deviation = Math.abs(temperature - this.optimalTemperature);
        const normalizedDev = deviation / this.temperatureRange;
        
        // Bell curve around optimal temperature
        // Peak at 1.0, reduces when too hot or cold
        if (temperature < this.optimalTemperature - this.temperatureRange) {
            // Too cold - reduced grip
            return 0.5 + 0.5 * (1 - normalizedDev);
        } else if (temperature > this.optimalTemperature + this.temperatureRange) {
            // Too hot - grip falls off faster
            return Math.max(0.4, 1.0 - (normalizedDev - 1) * 0.4);
        } else {
            // Near optimal - full grip with slight boost
            const nearOptimal = 1 - normalizedDev;
            return 0.95 + 0.25 * nearOptimal * nearOptimal;
        }
    }

    /**
     * Calculate tire heat generation from slip
     * @param {number} slipAngle - Slip angle in radians
     * @param {number} slipRatio - Slip ratio
     * @param {number} load - Vertical load in N
     * @param {number} speed - Vehicle speed in m/s
     * @returns {number} Heat generation rate in Watts
     */
    calculateHeatGeneration(slipAngle, slipRatio, load, speed) {
        const slipWork = (Math.abs(slipAngle) + Math.abs(slipRatio)) * load * speed;
        return slipWork * TIRE_CONSTANTS.HEAT_GENERATION;
    }

    /**
     * Calculate tire heat dissipation
     * @param {number} tireTemp - Current tire temperature in Celsius
     * @param {number} ambientTemp - Ambient temperature in Celsius
     * @param {number} speed - Vehicle speed in m/s
     * @returns {number} Heat dissipation rate in Watts
     */
    calculateHeatDissipation(tireTemp, ambientTemp, speed) {
        const tempDiff = tireTemp - ambientTemp;
        const airflowFactor = 1 + speed * 0.1;
        return tempDiff * TIRE_CONSTANTS.HEAT_DISSIPATION * airflowFactor;
    }

    /**
     * Calculate tire wear rate
     * @param {number} slipAngle - Slip angle in radians
     * @param {number} slipRatio - Slip ratio
     * @param {number} load - Vertical load in N
     * @param {number} temperature - Tire temperature
     * @returns {number} Wear rate (0 to 1 per second)
     */
    calculateWearRate(slipAngle, slipRatio, load, temperature) {
        const slipMagnitude = Math.sqrt(slipAngle * slipAngle + slipRatio * slipRatio);
        const loadFactor = load / 5000; // Normalized load
        
        // Temperature affects wear rate
        const tempFactor = temperature > this.optimalTemperature + 20 
            ? 1.5 
            : 1.0;
        
        return slipMagnitude * loadFactor * TIRE_CONSTANTS.WEAR_RATE * tempFactor;
    }

    /**
     * Get surface grip multiplier
     * @param {string} surfaceType - Type of surface
     * @returns {number} Grip multiplier
     */
    static getSurfaceGrip(surfaceType) {
        const surface = SURFACE_CONSTANTS[surfaceType.toUpperCase()];
        return surface ? surface.gripMultiplier : 1.0;
    }

    /**
     * Calculate peak slip angle for maximum lateral force
     * @returns {number} Peak slip angle in radians
     */
    getPeakSlipAngle() {
        // Approximate peak slip angle from Magic Formula coefficients
        return Math.atan(1 / this.lateralB);
    }

    /**
     * Calculate peak slip ratio for maximum longitudinal force
     * @returns {number} Peak slip ratio
     */
    getPeakSlipRatio() {
        // Approximate peak slip ratio from Magic Formula coefficients
        return Math.atan(1 / this.longitudinalB) / this.longitudinalB;
    }

    /**
     * Create a Pacejka model with specific tire compound characteristics
     * @param {string} compound - Tire compound type ('soft', 'medium', 'hard')
     * @returns {Pacejka} Configured Pacejka instance
     */
    static createForCompound(compound) {
        const compounds = {
            soft: {
                lateralB: 12,
                lateralC: 2.0,
                lateralD: 1.1,
                lateralE: 0.95,
                longitudinalB: 14,
                longitudinalC: 2.4,
                longitudinalD: 1.1,
                longitudinalE: 0.88,
                optimalTemperature: 85,
                temperatureRange: 25
            },
            medium: {
                lateralB: 10,
                lateralC: 1.9,
                lateralD: 1.0,
                lateralE: 0.97,
                longitudinalB: 12,
                longitudinalC: 2.3,
                longitudinalD: 1.0,
                longitudinalE: 0.9,
                optimalTemperature: 90,
                temperatureRange: 30
            },
            hard: {
                lateralB: 8,
                lateralC: 1.8,
                lateralD: 0.95,
                lateralE: 0.98,
                longitudinalB: 10,
                longitudinalC: 2.2,
                longitudinalD: 0.95,
                longitudinalE: 0.92,
                optimalTemperature: 100,
                temperatureRange: 40
            }
        };
        
        const config = compounds[compound] || compounds.medium;
        return new Pacejka(config);
    }

    /**
     * Generate a grip curve for visualization
     * @param {number} maxSlip - Maximum slip value
     * @param {number} steps - Number of data points
     * @param {string} type - 'lateral' or 'longitudinal'
     * @returns {Array<{slip: number, force: number}>} Grip curve data
     */
    generateGripCurve(maxSlip = 0.5, steps = 50, type = 'lateral') {
        const curve = [];
        
        for (let i = 0; i <= steps; i++) {
            const slip = (i / steps) * maxSlip;
            let force;
            
            if (type === 'lateral') {
                force = this.calculateLateralForce(slip);
            } else {
                force = this.calculateLongitudinalForce(slip);
            }
            
            curve.push({ slip, force });
        }
        
        return curve;
    }

    /**
     * Update coefficients dynamically
     * @param {Object} updates - Coefficient updates
     */
    updateCoefficients(updates) {
        if (updates.lateralB !== undefined) this.lateralB = updates.lateralB;
        if (updates.lateralC !== undefined) this.lateralC = updates.lateralC;
        if (updates.lateralD !== undefined) this.lateralD = updates.lateralD;
        if (updates.lateralE !== undefined) this.lateralE = updates.lateralE;
        if (updates.longitudinalB !== undefined) this.longitudinalB = updates.longitudinalB;
        if (updates.longitudinalC !== undefined) this.longitudinalC = updates.longitudinalC;
        if (updates.longitudinalD !== undefined) this.longitudinalD = updates.longitudinalD;
        if (updates.longitudinalE !== undefined) this.longitudinalE = updates.longitudinalE;
        
        // Clear cache when coefficients change
        this._cache = {
            lastLateralSlip: null,
            lastLateralForce: null,
            lastLongSlip: null,
            lastLongForce: null
        };
    }

    /**
     * Clone this Pacejka instance
     * @returns {Pacejka} New Pacejka instance with same coefficients
     */
    clone() {
        return new Pacejka({
            lateralB: this.lateralB,
            lateralC: this.lateralC,
            lateralD: this.lateralD,
            lateralE: this.lateralE,
            longitudinalB: this.longitudinalB,
            longitudinalC: this.longitudinalC,
            longitudinalD: this.longitudinalD,
            longitudinalE: this.longitudinalE,
            combinedFactor: this.combinedFactor,
            optimalTemperature: this.optimalTemperature,
            temperatureRange: this.temperatureRange,
            pressureFactor: this.pressureFactor,
            camberStiffness: this.camberStiffness
        });
    }

    /**
     * Serialize to JSON
     * @returns {Object} JSON representation
     */
    toJSON() {
        return {
            lateralB: this.lateralB,
            lateralC: this.lateralC,
            lateralD: this.lateralD,
            lateralE: this.lateralE,
            longitudinalB: this.longitudinalB,
            longitudinalC: this.longitudinalC,
            longitudinalD: this.longitudinalD,
            longitudinalE: this.longitudinalE,
            combinedFactor: this.combinedFactor,
            optimalTemperature: this.optimalTemperature,
            temperatureRange: this.temperatureRange,
            pressureFactor: this.pressureFactor,
            camberStiffness: this.camberStiffness
        };
    }

    /**
     * Create from JSON
     * @param {Object} json - JSON object
     * @returns {Pacejka} New Pacejka instance
     */
    static fromJSON(json) {
        return new Pacejka(json);
    }
}

export default Pacejka;
