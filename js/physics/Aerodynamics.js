/**
 * Aerodynamics.js - Vehicle Aerodynamics Simulation
 * 
 * Calculates aerodynamic forces including drag, lift/downforce, and side forces.
 * Affects high-speed handling and stability.
 * 
 * @module physics/Aerodynamics
 * @author CarSim Development Team
 * @version 2.0.0
 */

import { AERODYNAMICS_CONSTANTS, VEHICLE_CONSTANTS } from '../core/Constants.js';
import { MathUtils } from '../utils/MathUtils.js';

/**
 * @class Aerodynamics
 * @description Calculates aerodynamic forces on the vehicle
 */
export class Aerodynamics {
    /**
     * Creates a new Aerodynamics calculator
     * @param {Object} [config] - Configuration options
     */
    constructor(config = {}) {
        /** @type {number} Air density in kg/m³ */
        this.airDensity = config.airDensity ?? AERODYNAMICS_CONSTANTS.AIR_DENSITY;
        
        /** @type {number} Frontal area in m² */
        this.frontalArea = config.frontalArea ?? AERODYNAMICS_CONSTANTS.FRONTAL_AREA;
        
        /** @type {number} Drag coefficient */
        this.dragCoefficient = config.dragCoefficient ?? AERODYNAMICS_CONSTANTS.DRAG_COEFFICIENT;
        
        /** @type {number} Lift coefficient (negative for downforce) */
        this.liftCoefficient = config.liftCoefficient ?? AERODYNAMICS_CONSTANTS.LIFT_COEFFICIENT;
        
        /** @type {number} Downforce distribution (front percentage, 0-1) */
        this.downforceDistribution = config.downforceDistribution ?? AERODYNAMICS_CONSTANTS.DOWNFORCE_DISTRIBUTION;
        
        /** @type {number} Side force coefficient for crosswind */
        this.sideForceCoefficient = config.sideForceCoefficient ?? AERODYNAMICS_CONSTANTS.SIDE_FORCE_COEFFICIENT;
        
        /** @type {number} Yaw moment coefficient for crosswind */
        this.yawMomentCoefficient = config.yawMomentCoefficient ?? AERODYNAMICS_CONSTANTS.YAW_MOMENT_COEFFICIENT;
        
        /** @type {number} Reference height for ground effect */
        this.groundEffectHeight = config.groundEffectHeight ?? AERODYNAMICS_CONSTANTS.GROUND_EFFECT_HEIGHT;
        
        /** @type {number} Ground effect multiplier */
        this.groundEffectMultiplier = config.groundEffectMultiplier ?? AERODYNAMICS_CONSTANTS.GROUND_EFFECT_MULTIPLIER;
        
        /** @type {number} Vehicle wheelbase for yaw moment calculation */
        this.wheelbase = config.wheelbase ?? VEHICLE_CONSTANTS.WHEELBASE;
        
        /** @type {number} Side area for crosswind calculation */
        this.sideArea = config.sideArea ?? 4.0; // m²
        
        /** @type {number} Spoiler down force coefficient */
        this.spoilerDownforce = config.spoilerDownforce ?? 0;
        
        /** @type {number} Wing angle of attack in degrees */
        this.wingAngle = config.wingAngle ?? 0;
        
        // Current forces (cached for performance)
        this._forces = {
            drag: 0,
            lift: 0,
            sideForce: 0,
            yawMoment: 0,
            frontDownforce: 0,
            rearDownforce: 0
        };
        
        // Wind state
        this._wind = {
            speed: 0,
            direction: 0 // radians, 0 = headwind
        };
    }

    /**
     * Calculate dynamic pressure
     * @param {number} velocity - Vehicle velocity relative to air in m/s
     * @returns {number} Dynamic pressure in Pa
     */
    calculateDynamicPressure(velocity) {
        return 0.5 * this.airDensity * velocity * velocity;
    }

    /**
     * Calculate drag force
     * @param {number} velocity - Vehicle velocity in m/s
     * @param {number} [yawAngle=0] - Vehicle yaw angle relative to direction of travel
     * @returns {number} Drag force in N (always positive, opposing motion)
     */
    calculateDragForce(velocity, yawAngle = 0) {
        const q = this.calculateDynamicPressure(Math.abs(velocity));
        
        // Drag coefficient increases with yaw angle
        const yawFactor = 1 + Math.abs(Math.sin(yawAngle)) * 0.3;
        const effectiveCd = this.dragCoefficient * yawFactor;
        
        const drag = q * effectiveCd * this.frontalArea;
        
        this._forces.drag = drag;
        return drag;
    }

    /**
     * Calculate lift/downforce
     * @param {number} velocity - Vehicle velocity in m/s
     * @param {number} [rideHeight=0.15] - Current ride height in meters
     * @returns {number} Lift force in N (negative = downforce)
     */
    calculateLiftForce(velocity, rideHeight = 0.15) {
        const q = this.calculateDynamicPressure(velocity);
        
        // Base lift/downforce
        let effectiveCl = this.liftCoefficient;
        
        // Ground effect increases downforce as car gets lower
        if (rideHeight < this.groundEffectHeight * 2) {
            const groundEffectFactor = MathUtils.remap(
                rideHeight,
                0.02, // Minimum ride height
                this.groundEffectHeight * 2,
                this.groundEffectMultiplier,
                1.0
            );
            effectiveCl *= groundEffectFactor;
        }
        
        // Add active aero (spoiler/wing)
        effectiveCl -= this.spoilerDownforce * Math.sin(MathUtils.degToRad(this.wingAngle));
        
        const lift = q * effectiveCl * this.frontalArea;
        
        this._forces.lift = lift;
        return lift;
    }

    /**
     * Calculate side force from crosswind
     * @param {number} vehicleVelocity - Vehicle velocity in m/s
     * @param {number} vehicleDirection - Vehicle heading in radians
     * @returns {number} Side force in N
     */
    calculateSideForce(vehicleVelocity, vehicleDirection) {
        // Calculate relative wind
        const relativeWind = this.calculateRelativeWind(vehicleVelocity, vehicleDirection);
        
        if (relativeWind.speed < 1) {
            this._forces.sideForce = 0;
            return 0;
        }
        
        const q = this.calculateDynamicPressure(relativeWind.speed);
        
        // Side force depends on yaw angle relative to airflow
        const yawToWind = relativeWind.angle;
        const sideForce = q * this.sideForceCoefficient * this.sideArea * Math.sin(yawToWind);
        
        this._forces.sideForce = sideForce;
        return sideForce;
    }

    /**
     * Calculate yaw moment from asymmetric air forces
     * @param {number} vehicleVelocity - Vehicle velocity in m/s
     * @param {number} vehicleDirection - Vehicle heading in radians
     * @returns {number} Yaw moment in Nm
     */
    calculateYawMoment(vehicleVelocity, vehicleDirection) {
        const relativeWind = this.calculateRelativeWind(vehicleVelocity, vehicleDirection);
        
        if (relativeWind.speed < 1) {
            this._forces.yawMoment = 0;
            return 0;
        }
        
        const q = this.calculateDynamicPressure(relativeWind.speed);
        const yawToWind = relativeWind.angle;
        
        // Yaw moment arm is roughly wheelbase/2
        const momentArm = this.wheelbase / 2;
        const yawMoment = q * this.yawMomentCoefficient * this.sideArea * 
                          Math.sin(yawToWind) * momentArm;
        
        this._forces.yawMoment = yawMoment;
        return yawMoment;
    }

    /**
     * Calculate all aerodynamic forces
     * @param {number} velocity - Vehicle velocity in m/s
     * @param {number} heading - Vehicle heading in radians
     * @param {number} [yawAngle=0] - Slip angle in radians
     * @param {number} [rideHeight=0.15] - Current ride height in meters
     * @returns {Object} All aerodynamic forces
     */
    calculateAllForces(velocity, heading, yawAngle = 0, rideHeight = 0.15) {
        const drag = this.calculateDragForce(velocity, yawAngle);
        const lift = this.calculateLiftForce(velocity, rideHeight);
        const sideForce = this.calculateSideForce(velocity, heading);
        const yawMoment = this.calculateYawMoment(velocity, heading);
        
        // Distribute downforce between front and rear
        const downforce = -lift; // Convert lift (negative) to downforce (positive)
        const frontDownforce = downforce * this.downforceDistribution;
        const rearDownforce = downforce * (1 - this.downforceDistribution);
        
        this._forces.frontDownforce = frontDownforce;
        this._forces.rearDownforce = rearDownforce;
        
        return {
            drag,
            lift,
            downforce,
            frontDownforce,
            rearDownforce,
            sideForce,
            yawMoment,
            dynamicPressure: this.calculateDynamicPressure(velocity)
        };
    }

    /**
     * Calculate relative wind vector
     * @param {number} vehicleVelocity - Vehicle velocity in m/s
     * @param {number} vehicleDirection - Vehicle heading in radians
     * @returns {{speed: number, angle: number}} Relative wind speed and angle
     */
    calculateRelativeWind(vehicleVelocity, vehicleDirection) {
        // Vehicle velocity components
        const vx = vehicleVelocity * Math.sin(vehicleDirection);
        const vz = vehicleVelocity * Math.cos(vehicleDirection);
        
        // Wind velocity components
        const wx = this._wind.speed * Math.sin(this._wind.direction);
        const wz = this._wind.speed * Math.cos(this._wind.direction);
        
        // Relative wind (wind relative to vehicle)
        const rx = wx - vx;
        const rz = wz - vz;
        
        const relativeSpeed = Math.sqrt(rx * rx + rz * rz);
        const relativeAngle = Math.atan2(rx, rz) - vehicleDirection;
        
        return {
            speed: relativeSpeed,
            angle: MathUtils.normalizeAngle(relativeAngle)
        };
    }

    /**
     * Set wind conditions
     * @param {number} speed - Wind speed in m/s
     * @param {number} direction - Wind direction in radians (0 = from front)
     */
    setWind(speed, direction) {
        this._wind.speed = speed;
        this._wind.direction = direction;
    }

    /**
     * Update wind with turbulence
     * @param {number} deltaTime - Time step
     * @param {number} turbulenceIntensity - Turbulence level (0-1)
     */
    updateWind(deltaTime, turbulenceIntensity = 0.1) {
        // Add random turbulence
        this._wind.speed += (Math.random() - 0.5) * turbulenceIntensity * deltaTime * 10;
        this._wind.speed = Math.max(0, this._wind.speed);
        
        this._wind.direction += (Math.random() - 0.5) * turbulenceIntensity * deltaTime;
    }

    /**
     * Calculate power required to overcome drag
     * @param {number} velocity - Vehicle velocity in m/s
     * @returns {number} Power in Watts
     */
    calculateDragPower(velocity) {
        const dragForce = this.calculateDragForce(velocity);
        return dragForce * Math.abs(velocity);
    }

    /**
     * Calculate theoretical top speed based on available power
     * @param {number} maxPower - Maximum available power in Watts
     * @param {number} [tolerance=0.1] - Velocity tolerance in m/s
     * @returns {number} Theoretical top speed in m/s
     */
    calculateTopSpeed(maxPower, tolerance = 0.1) {
        // Iteratively find velocity where drag power equals available power
        let low = 0;
        let high = 200; // m/s max search range
        
        while (high - low > tolerance) {
            const mid = (low + high) / 2;
            const dragPower = this.calculateDragPower(mid);
            
            if (dragPower < maxPower) {
                low = mid;
            } else {
                high = mid;
            }
        }
        
        return (low + high) / 2;
    }

    /**
     * Get current forces
     * @returns {Object} Current aerodynamic forces
     */
    getForces() {
        return { ...this._forces };
    }

    /**
     * Get current wind state
     * @returns {Object} Wind speed and direction
     */
    getWind() {
        return { ...this._wind };
    }

    /**
     * Set active aero configuration
     * @param {number} spoilerAngle - Spoiler/wing angle in degrees
     * @param {number} spoilerDownforce - Additional downforce coefficient
     */
    setActiveAero(spoilerAngle, spoilerDownforce) {
        this.wingAngle = spoilerAngle;
        this.spoilerDownforce = spoilerDownforce;
    }

    /**
     * Calculate DRS (drag reduction system) effect
     * @param {boolean} drsOpen - Whether DRS is open
     * @returns {Object} Modified drag and downforce coefficients
     */
    calculateDRSEffect(drsOpen) {
        if (drsOpen) {
            return {
                dragReduction: 0.15, // 15% drag reduction
                downforceReduction: 0.3 // 30% downforce reduction
            };
        }
        return { dragReduction: 0, downforceReduction: 0 };
    }

    /**
     * Calculate cooling drag (radiator, brake ducts)
     * @param {number} velocity - Vehicle velocity in m/s
     * @param {number} coolingDemand - Cooling demand (0-1)
     * @returns {number} Additional drag force in N
     */
    calculateCoolingDrag(velocity, coolingDemand) {
        const q = this.calculateDynamicPressure(velocity);
        const coolingArea = 0.2; // m² of cooling openings
        const coolingCd = 0.5 * coolingDemand; // Variable based on cooling needs
        
        return q * coolingCd * coolingArea;
    }

    /**
     * Update for altitude (affects air density)
     * @param {number} altitude - Altitude in meters above sea level
     */
    updateForAltitude(altitude) {
        // Barometric formula approximation
        const seaLevelDensity = 1.225;
        const scaleHeight = 8500; // m
        this.airDensity = seaLevelDensity * Math.exp(-altitude / scaleHeight);
    }

    /**
     * Update for temperature (affects air density)
     * @param {number} temperature - Air temperature in Celsius
     */
    updateForTemperature(temperature) {
        // Standard atmosphere at sea level, adjusted for temperature
        const standardTemp = 15; // °C
        const standardDensity = 1.225;
        
        // Air density decreases as temperature increases
        this.airDensity = standardDensity * (273.15 + standardTemp) / (273.15 + temperature);
    }

    /**
     * Serialize to JSON
     * @returns {Object} JSON representation
     */
    toJSON() {
        return {
            airDensity: this.airDensity,
            frontalArea: this.frontalArea,
            dragCoefficient: this.dragCoefficient,
            liftCoefficient: this.liftCoefficient,
            downforceDistribution: this.downforceDistribution,
            sideForceCoefficient: this.sideForceCoefficient,
            yawMomentCoefficient: this.yawMomentCoefficient,
            groundEffectHeight: this.groundEffectHeight,
            groundEffectMultiplier: this.groundEffectMultiplier,
            spoilerDownforce: this.spoilerDownforce,
            wingAngle: this.wingAngle
        };
    }

    /**
     * Create from JSON
     * @param {Object} json - JSON object
     * @returns {Aerodynamics} New instance
     */
    static fromJSON(json) {
        return new Aerodynamics(json);
    }
}

export default Aerodynamics;
