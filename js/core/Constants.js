/**
 * Constants.js - Physics and Game Constants
 * 
 * This file contains all physics constants used throughout the car simulator.
 * Values are based on real-world units for realistic simulation.
 * 
 * @module core/Constants
 * @author CarSim Development Team
 * @version 2.0.0
 */

/**
 * @namespace VEHICLE_CONSTANTS
 * @description Core vehicle physical properties
 */
export const VEHICLE_CONSTANTS = {
    /** Mass of the car in kilograms */
    CAR_MASS: 1400,
    
    /** Distance between front and rear axles in meters */
    WHEELBASE: 2.7,
    
    /** Distance between left and right wheels in meters */
    TRACK_WIDTH: 1.6,
    
    /** Height of center of gravity in meters */
    CG_HEIGHT: 0.5,
    
    /** Distance from front axle to center of gravity in meters */
    CG_TO_FRONT: 1.35,
    
    /** Distance from rear axle to center of gravity in meters */
    CG_TO_REAR: 1.35,
    
    /** Frontal area of the car in square meters */
    FRONTAL_AREA: 2.2,
    
    /** Aerodynamic drag coefficient */
    DRAG_COEFFICIENT: 0.32,
    
    /** Lift coefficient (negative for downforce) */
    LIFT_COEFFICIENT: -0.15,
    
    /** Moment of inertia around vertical axis in kg·m² */
    MOMENT_OF_INERTIA_YAW: 2800,
    
    /** Moment of inertia around longitudinal axis in kg·m² */
    MOMENT_OF_INERTIA_ROLL: 600,
    
    /** Moment of inertia around lateral axis in kg·m² */
    MOMENT_OF_INERTIA_PITCH: 2200,
    
    /** Coefficient of restitution for collisions */
    RESTITUTION: 0.3,
    
    /** Maximum vehicle speed in m/s */
    MAX_SPEED: 83.33, // 300 km/h
    
    /** Maximum reverse speed in m/s */
    MAX_REVERSE_SPEED: 11.11, // 40 km/h
};

/**
 * @namespace TIRE_CONSTANTS
 * @description Tire properties and Pacejka Magic Formula coefficients
 */
export const TIRE_CONSTANTS = {
    /** Tire radius in meters */
    TIRE_RADIUS: 0.33,
    
    /** Tire width in meters */
    TIRE_WIDTH: 0.225,
    
    /** Tire mass in kilograms */
    TIRE_MASS: 12,
    
    /** Tire moment of inertia in kg·m² */
    TIRE_INERTIA: 1.2,
    
    /** Rolling resistance coefficient */
    ROLLING_RESISTANCE: 0.015,
    
    /** 
     * Pacejka Magic Formula coefficients for lateral force
     * F = D * sin(C * atan(B*x - E*(B*x - atan(B*x))))
     */
    PACEJKA_LATERAL: {
        /** Stiffness factor */
        B: 10,
        /** Shape factor */
        C: 1.9,
        /** Peak value */
        D: 1,
        /** Curvature factor */
        E: 0.97
    },
    
    /**
     * Pacejka Magic Formula coefficients for longitudinal force
     */
    PACEJKA_LONGITUDINAL: {
        /** Stiffness factor */
        B: 12,
        /** Shape factor */
        C: 2.3,
        /** Peak value */
        D: 1,
        /** Curvature factor */
        E: 0.9
    },
    
    /** Peak slip angle for maximum lateral force in radians */
    PEAK_SLIP_ANGLE: 0.15,
    
    /** Peak slip ratio for maximum longitudinal force */
    PEAK_SLIP_RATIO: 0.12,
    
    /** Optimal tire temperature in Celsius */
    OPTIMAL_TEMPERATURE: 90,
    
    /** Temperature range for optimal grip */
    TEMPERATURE_RANGE: 30,
    
    /** Tire wear rate coefficient */
    WEAR_RATE: 0.0001,
    
    /** Tire heat generation coefficient */
    HEAT_GENERATION: 0.05,
    
    /** Tire heat dissipation coefficient */
    HEAT_DISSIPATION: 0.02,
};

/**
 * @namespace SUSPENSION_CONSTANTS
 * @description Suspension system properties per wheel
 */
export const SUSPENSION_CONSTANTS = {
    /** Spring rate in N/m */
    SPRING_RATE_FRONT: 35000,
    SPRING_RATE_REAR: 32000,
    
    /** Damping coefficient in Ns/m */
    DAMPING_COMPRESSION_FRONT: 3500,
    DAMPING_REBOUND_FRONT: 4200,
    DAMPING_COMPRESSION_REAR: 3200,
    DAMPING_REBOUND_REAR: 3800,
    
    /** Maximum suspension travel in meters */
    MAX_TRAVEL: 0.15,
    
    /** Minimum suspension travel in meters (bump stop) */
    MIN_TRAVEL: 0.02,
    
    /** Rest position of suspension (percentage of travel) */
    REST_POSITION: 0.5,
    
    /** Anti-roll bar stiffness in N/rad */
    ANTI_ROLL_BAR_FRONT: 15000,
    ANTI_ROLL_BAR_REAR: 10000,
    
    /** Camber angle in radians (negative = leaned inward at top) */
    STATIC_CAMBER_FRONT: -0.5 * Math.PI / 180,
    STATIC_CAMBER_REAR: -1.0 * Math.PI / 180,
    
    /** Toe angle in radians */
    STATIC_TOE_FRONT: 0,
    STATIC_TOE_REAR: 0.2 * Math.PI / 180,
    
    /** Caster angle in radians */
    CASTER_ANGLE: 5 * Math.PI / 180,
};

/**
 * @namespace ENGINE_CONSTANTS
 * @description Engine properties and torque curve
 */
export const ENGINE_CONSTANTS = {
    /** Maximum engine torque in Nm */
    MAX_TORQUE: 400,
    
    /** RPM at which maximum torque occurs */
    MAX_TORQUE_RPM: 4500,
    
    /** Maximum engine power in kW */
    MAX_POWER: 220,
    
    /** RPM at which maximum power occurs */
    MAX_POWER_RPM: 6500,
    
    /** Idle RPM */
    IDLE_RPM: 800,
    
    /** Redline RPM */
    REDLINE_RPM: 7500,
    
    /** Rev limiter RPM */
    REV_LIMITER_RPM: 7800,
    
    /** Engine moment of inertia in kg·m² */
    ENGINE_INERTIA: 0.25,
    
    /** Flywheel moment of inertia in kg·m² */
    FLYWHEEL_INERTIA: 0.15,
    
    /** Engine friction coefficient */
    ENGINE_FRICTION: 0.02,
    
    /** Turbo boost pressure in bar (0 = naturally aspirated) */
    TURBO_BOOST: 0.8,
    
    /** Turbo lag time constant in seconds */
    TURBO_LAG: 0.3,
    
    /** Turbo spool up rate */
    TURBO_SPOOL_RATE: 2.0,
    
    /**
     * Torque curve lookup table
     * Format: [RPM, TorqueMultiplier]
     */
    TORQUE_CURVE: [
        [0, 0],
        [800, 0.4],
        [1500, 0.65],
        [2500, 0.8],
        [3500, 0.92],
        [4500, 1.0],
        [5500, 0.95],
        [6500, 0.88],
        [7500, 0.75],
        [7800, 0.65]
    ],
};

/**
 * @namespace TRANSMISSION_CONSTANTS
 * @description Transmission and drivetrain properties
 */
export const TRANSMISSION_CONSTANTS = {
    /** Gear ratios (index 0 = reverse) */
    GEAR_RATIOS: [-3.2, 0, 3.5, 2.3, 1.7, 1.3, 1.0, 0.8],
    
    /** Final drive ratio */
    FINAL_DRIVE: 3.7,
    
    /** Transmission efficiency (0-1) */
    TRANSMISSION_EFFICIENCY: 0.92,
    
    /** Clutch engagement time in seconds */
    CLUTCH_ENGAGEMENT_TIME: 0.3,
    
    /** Shift time in seconds */
    SHIFT_TIME: 0.15,
    
    /** Optimal shift RPM for upshift */
    OPTIMAL_UPSHIFT_RPM: 6800,
    
    /** Optimal shift RPM for downshift */
    OPTIMAL_DOWNSHIFT_RPM: 3500,
    
    /** Differential type: 'open', 'lsd', 'locked' */
    DIFFERENTIAL_TYPE: 'lsd',
    
    /** LSD preload torque in Nm */
    LSD_PRELOAD: 50,
    
    /** LSD lock coefficient for acceleration */
    LSD_ACCELERATION_LOCK: 0.6,
    
    /** LSD lock coefficient for deceleration */
    LSD_DECELERATION_LOCK: 0.4,
    
    /** Drivetrain type: 'rwd', 'fwd', 'awd' */
    DRIVETRAIN: 'rwd',
    
    /** AWD torque split (front percentage) */
    AWD_FRONT_BIAS: 0.3,
};

/**
 * @namespace BRAKE_CONSTANTS
 * @description Brake system properties
 */
export const BRAKE_CONSTANTS = {
    /** Maximum brake force in N */
    MAX_BRAKE_FORCE: 25000,
    
    /** Brake bias (percentage to front) */
    BRAKE_BIAS: 0.65,
    
    /** ABS intervention threshold (slip ratio) */
    ABS_THRESHOLD: 0.15,
    
    /** ABS release threshold */
    ABS_RELEASE: 0.10,
    
    /** ABS cycle frequency in Hz */
    ABS_FREQUENCY: 15,
    
    /** Brake disc diameter front in meters */
    BRAKE_DISC_DIAMETER_FRONT: 0.35,
    
    /** Brake disc diameter rear in meters */
    BRAKE_DISC_DIAMETER_REAR: 0.30,
    
    /** Brake pad friction coefficient */
    BRAKE_PAD_FRICTION: 0.45,
    
    /** Brake fluid boiling temperature in Celsius */
    BRAKE_FLUID_BOILING_POINT: 230,
    
    /** Brake fade temperature start in Celsius */
    BRAKE_FADE_TEMP_START: 400,
    
    /** Brake fade temperature full in Celsius */
    BRAKE_FADE_TEMP_FULL: 600,
    
    /** Brake heat generation coefficient */
    BRAKE_HEAT_GENERATION: 0.8,
    
    /** Brake heat dissipation coefficient */
    BRAKE_HEAT_DISSIPATION: 0.1,
    
    /** Handbrake force multiplier */
    HANDBRAKE_FORCE_MULTIPLIER: 0.8,
};

/**
 * @namespace STEERING_CONSTANTS
 * @description Steering system properties
 */
export const STEERING_CONSTANTS = {
    /** Maximum steering angle in radians */
    MAX_STEERING_ANGLE: 0.6, // ~35 degrees
    
    /** Steering rack ratio */
    STEERING_RATIO: 14,
    
    /** Steering wheel lock-to-lock turns */
    STEERING_LOCK_TO_LOCK: 2.5,
    
    /** Speed-sensitive steering reduction factor */
    SPEED_SENSITIVE_FACTOR: 0.005,
    
    /** Minimum steering angle at high speed (percentage) */
    MIN_STEERING_AT_SPEED: 0.3,
    
    /** Power steering assistance level (0-1) */
    POWER_STEERING_ASSIST: 0.7,
    
    /** Self-aligning torque coefficient */
    SELF_ALIGNING_TORQUE: 0.1,
    
    /** Steering return rate */
    STEERING_RETURN_RATE: 4.0,
    
    /** Steering input smoothing */
    STEERING_SMOOTHING: 0.15,
    
    /** Ackermann percentage (1 = full Ackermann, 0 = parallel) */
    ACKERMANN_PERCENTAGE: 0.8,
};

/**
 * @namespace AERODYNAMICS_CONSTANTS
 * @description Aerodynamic properties
 */
export const AERODYNAMICS_CONSTANTS = {
    /** Air density at sea level in kg/m³ */
    AIR_DENSITY: 1.225,
    
    /** Frontal area in m² */
    FRONTAL_AREA: 2.2,
    
    /** Drag coefficient */
    DRAG_COEFFICIENT: 0.32,
    
    /** Lift coefficient (negative for downforce) */
    LIFT_COEFFICIENT: -0.15,
    
    /** Downforce distribution (front percentage) */
    DOWNFORCE_DISTRIBUTION: 0.45,
    
    /** Side force coefficient for crosswind */
    SIDE_FORCE_COEFFICIENT: 0.6,
    
    /** Yaw moment coefficient for crosswind */
    YAW_MOMENT_COEFFICIENT: 0.15,
    
    /** Reference height for ground effect in meters */
    GROUND_EFFECT_HEIGHT: 0.1,
    
    /** Ground effect multiplier */
    GROUND_EFFECT_MULTIPLIER: 1.5,
};

/**
 * @namespace DEFORMATION_CONSTANTS
 * @description Crash deformation physics properties
 */
export const DEFORMATION_CONSTANTS = {
    /** Yield strength of car body in Pascals */
    YIELD_STRENGTH: 250e6,
    
    /** Deformation resistance in N/m */
    DEFORMATION_RESISTANCE: 50000,
    
    /** Maximum vertex displacement in meters */
    MAX_VERTEX_DISPLACEMENT: 0.3,
    
    /** Minimum impact force for deformation in N */
    MIN_DEFORMATION_FORCE: 10000,
    
    /** Energy absorption coefficient */
    ENERGY_ABSORPTION: 0.7,
    
    /** Crumple zone length front in meters */
    CRUMPLE_ZONE_FRONT: 0.8,
    
    /** Crumple zone length rear in meters */
    CRUMPLE_ZONE_REAR: 0.5,
    
    /** Component detachment threshold (damage percentage) */
    COMPONENT_DETACHMENT_THRESHOLD: 0.6,
    
    /** Glass shatter threshold (impact force in N) */
    GLASS_SHATTER_THRESHOLD: 15000,
    
    /** Structural integrity loss per impact */
    STRUCTURAL_INTEGRITY_LOSS: 0.05,
    
    /**
     * Damage zones with their properties
     * multiplier: how much damage is amplified in this zone
     * structuralImportance: how much structural integrity is affected
     */
    DAMAGE_ZONES: {
        FRONT: { multiplier: 1.0, structuralImportance: 0.8, crumple: true },
        REAR: { multiplier: 1.0, structuralImportance: 0.6, crumple: true },
        LEFT: { multiplier: 1.2, structuralImportance: 0.9, crumple: false },
        RIGHT: { multiplier: 1.2, structuralImportance: 0.9, crumple: false },
        ROOF: { multiplier: 1.5, structuralImportance: 1.0, crumple: false },
        FLOOR: { multiplier: 0.8, structuralImportance: 0.7, crumple: false },
    },
    
    /**
     * Mechanical component damage thresholds (percentage)
     */
    MECHANICAL_DAMAGE: {
        ENGINE: { threshold: 0.4, performanceImpact: 0.5 },
        RADIATOR: { threshold: 0.3, overheatingRate: 0.1 },
        TRANSMISSION: { threshold: 0.5, shiftDelay: 0.3 },
        STEERING: { threshold: 0.35, angleReduction: 0.3 },
        SUSPENSION: { threshold: 0.25, handlingImpact: 0.4 },
        BRAKES: { threshold: 0.3, forceReduction: 0.4 },
    },
};

/**
 * @namespace DRIFT_CONSTANTS
 * @description Drifting physics and scoring properties
 */
export const DRIFT_CONSTANTS = {
    /** Minimum slip angle to register as drift in radians */
    DRIFT_ANGLE_THRESHOLD: 0.15,
    
    /** Minimum speed for drifting in m/s */
    DRIFT_SPEED_THRESHOLD: 5,
    
    /** Maximum drift angle before spin out in radians */
    MAX_DRIFT_ANGLE: 1.2,
    
    /** Counter-steer effectiveness multiplier */
    COUNTER_STEER_FACTOR: 1.5,
    
    /** Drift initiation force multiplier */
    DRIFT_INITIATION_FORCE: 2.0,
    
    /** Drift sustainability factor */
    DRIFT_SUSTAINABILITY: 0.95,
    
    /** Score multiplier per degree of drift angle */
    SCORE_ANGLE_MULTIPLIER: 100,
    
    /** Score multiplier per m/s of speed */
    SCORE_SPEED_MULTIPLIER: 2,
    
    /** Score multiplier for drift duration */
    SCORE_DURATION_MULTIPLIER: 0.5,
    
    /** Maximum duration bonus multiplier */
    MAX_DURATION_BONUS: 2,
    
    /** Combo increment per 2 seconds */
    COMBO_INCREMENT: 0.5,
    
    /** Maximum combo multiplier */
    MAX_COMBO: 10,
    
    /** Time after drift ends to bank score in seconds */
    SCORE_BANK_DELAY: 1.0,
    
    /** Score loss on collision percentage */
    COLLISION_SCORE_LOSS: 0.5,
    
    /** Wall proximity bonus distance in meters */
    WALL_PROXIMITY_DISTANCE: 2,
    
    /** Wall proximity bonus multiplier */
    WALL_PROXIMITY_BONUS: 1.5,
};

/**
 * @namespace SURFACE_CONSTANTS
 * @description Different surface types and their properties
 */
export const SURFACE_CONSTANTS = {
    ASPHALT: {
        gripMultiplier: 1.0,
        rollingResistance: 0.015,
        dustGeneration: 0,
        color: 0x333333,
    },
    CONCRETE: {
        gripMultiplier: 0.95,
        rollingResistance: 0.018,
        dustGeneration: 0.1,
        color: 0x888888,
    },
    GRAVEL: {
        gripMultiplier: 0.6,
        rollingResistance: 0.04,
        dustGeneration: 0.8,
        color: 0x9c8b7a,
    },
    DIRT: {
        gripMultiplier: 0.5,
        rollingResistance: 0.05,
        dustGeneration: 0.9,
        color: 0x6b5344,
    },
    GRASS: {
        gripMultiplier: 0.4,
        rollingResistance: 0.1,
        dustGeneration: 0.2,
        color: 0x3a7d3a,
    },
    ICE: {
        gripMultiplier: 0.1,
        rollingResistance: 0.005,
        dustGeneration: 0,
        color: 0xccddee,
    },
    SNOW: {
        gripMultiplier: 0.25,
        rollingResistance: 0.06,
        dustGeneration: 0.4,
        color: 0xffffff,
    },
    WET_ASPHALT: {
        gripMultiplier: 0.7,
        rollingResistance: 0.02,
        dustGeneration: 0,
        color: 0x222222,
    },
};

/**
 * @namespace WEATHER_CONSTANTS
 * @description Weather system properties
 */
export const WEATHER_CONSTANTS = {
    /** Clear weather properties */
    CLEAR: {
        visibility: 1000,
        gripMultiplier: 1.0,
        lightIntensity: 1.0,
        fogDensity: 0,
    },
    
    /** Cloudy weather properties */
    CLOUDY: {
        visibility: 800,
        gripMultiplier: 1.0,
        lightIntensity: 0.7,
        fogDensity: 0.001,
    },
    
    /** Light rain properties */
    RAIN_LIGHT: {
        visibility: 400,
        gripMultiplier: 0.75,
        lightIntensity: 0.5,
        fogDensity: 0.003,
        particleCount: 1000,
        particleSpeed: 15,
    },
    
    /** Heavy rain properties */
    RAIN_HEAVY: {
        visibility: 200,
        gripMultiplier: 0.5,
        lightIntensity: 0.3,
        fogDensity: 0.005,
        particleCount: 3000,
        particleSpeed: 25,
    },
    
    /** Light snow properties */
    SNOW_LIGHT: {
        visibility: 300,
        gripMultiplier: 0.4,
        lightIntensity: 0.6,
        fogDensity: 0.004,
        particleCount: 500,
        particleSpeed: 3,
    },
    
    /** Heavy snow properties */
    SNOW_HEAVY: {
        visibility: 100,
        gripMultiplier: 0.2,
        lightIntensity: 0.4,
        fogDensity: 0.008,
        particleCount: 2000,
        particleSpeed: 5,
    },
    
    /** Fog properties */
    FOG: {
        visibility: 50,
        gripMultiplier: 0.9,
        lightIntensity: 0.6,
        fogDensity: 0.02,
    },
    
    /** Wind speed range in m/s */
    WIND_SPEED_RANGE: [0, 20],
    
    /** Wind direction change rate */
    WIND_DIRECTION_CHANGE_RATE: 0.01,
    
    /** Weather transition time in seconds */
    WEATHER_TRANSITION_TIME: 30,
};

/**
 * @namespace DAY_NIGHT_CONSTANTS
 * @description Day/night cycle properties
 */
export const DAY_NIGHT_CONSTANTS = {
    /** Duration of a full day cycle in seconds (real time) */
    DAY_CYCLE_DURATION: 600,
    
    /** Sunrise time (0-1, where 0.25 = 6:00 AM) */
    SUNRISE_TIME: 0.25,
    
    /** Sunset time (0-1, where 0.75 = 6:00 PM) */
    SUNSET_TIME: 0.75,
    
    /** Dawn duration (percentage of day) */
    DAWN_DURATION: 0.05,
    
    /** Dusk duration (percentage of day) */
    DUSK_DURATION: 0.05,
    
    /** Day sky color */
    DAY_SKY_COLOR: 0x87ceeb,
    
    /** Night sky color */
    NIGHT_SKY_COLOR: 0x0a0a20,
    
    /** Sunrise/sunset sky color */
    SUNSET_SKY_COLOR: 0xff7744,
    
    /** Day ambient light intensity */
    DAY_AMBIENT_INTENSITY: 0.5,
    
    /** Night ambient light intensity */
    NIGHT_AMBIENT_INTENSITY: 0.1,
    
    /** Day directional light intensity */
    DAY_DIRECTIONAL_INTENSITY: 1.0,
    
    /** Night directional light intensity (moon) */
    NIGHT_DIRECTIONAL_INTENSITY: 0.2,
    
    /** Headlight activation threshold (time of day) */
    HEADLIGHT_THRESHOLD: 0.2,
    
    /** Moon phase cycle in days */
    MOON_PHASE_CYCLE: 28,
};

/**
 * @namespace PARTICLE_CONSTANTS
 * @description Particle system properties
 */
export const PARTICLE_CONSTANTS = {
    /** Maximum tire smoke particles */
    MAX_TIRE_SMOKE: 200,
    
    /** Maximum collision sparks */
    MAX_COLLISION_SPARKS: 100,
    
    /** Maximum debris particles */
    MAX_DEBRIS: 50,
    
    /** Maximum rain particles */
    MAX_RAIN_PARTICLES: 5000,
    
    /** Maximum snow particles */
    MAX_SNOW_PARTICLES: 3000,
    
    /** Smoke particle lifetime in seconds */
    SMOKE_LIFETIME: 2.0,
    
    /** Spark particle lifetime in seconds */
    SPARK_LIFETIME: 0.5,
    
    /** Debris particle lifetime in seconds */
    DEBRIS_LIFETIME: 3.0,
    
    /** Smoke particle initial size */
    SMOKE_INITIAL_SIZE: 0.3,
    
    /** Smoke particle growth rate */
    SMOKE_GROWTH_RATE: 1.5,
    
    /** Spark particle size */
    SPARK_SIZE: 0.05,
    
    /** Spark gravity multiplier */
    SPARK_GRAVITY: 9.8,
    
    /** Object pool sizes */
    POOL_SIZES: {
        SMOKE: 300,
        SPARK: 150,
        DEBRIS: 100,
        RAIN: 6000,
        SNOW: 4000,
    },
};

/**
 * @namespace CAMERA_CONSTANTS
 * @description Camera system properties
 */
export const CAMERA_CONSTANTS = {
    /** Camera modes available */
    MODES: ['CHASE', 'HOOD', 'BUMPER', 'COCKPIT', 'FREE', 'CINEMATIC'],
    
    /** Chase camera offset from car */
    CHASE_OFFSET: { x: 0, y: 5, z: -10 },
    
    /** Chase camera look offset */
    CHASE_LOOK_OFFSET: { x: 0, y: 1, z: 5 },
    
    /** Hood camera offset */
    HOOD_OFFSET: { x: 0, y: 1.2, z: 1.5 },
    
    /** Bumper camera offset */
    BUMPER_OFFSET: { x: 0, y: 0.5, z: 2.2 },
    
    /** Cockpit camera offset */
    COCKPIT_OFFSET: { x: 0, y: 1.0, z: 0 },
    
    /** Camera smoothing factor (0-1) */
    SMOOTHING_FACTOR: 0.05,
    
    /** Camera shake decay rate */
    SHAKE_DECAY: 5,
    
    /** Maximum camera shake intensity */
    MAX_SHAKE_INTENSITY: 2,
    
    /** Speed-based camera FOV change */
    SPEED_FOV_MULTIPLIER: 0.1,
    
    /** Base FOV in degrees */
    BASE_FOV: 60,
    
    /** Maximum FOV in degrees */
    MAX_FOV: 90,
    
    /** Cinematic camera distance range */
    CINEMATIC_DISTANCE_RANGE: [10, 30],
    
    /** Cinematic camera height range */
    CINEMATIC_HEIGHT_RANGE: [2, 15],
    
    /** Cinematic camera transition time in seconds */
    CINEMATIC_TRANSITION_TIME: 5,
};

/**
 * @namespace AUDIO_CONSTANTS
 * @description Audio system properties
 */
export const AUDIO_CONSTANTS = {
    /** Master volume (0-1) */
    MASTER_VOLUME: 1.0,
    
    /** Engine volume (0-1) */
    ENGINE_VOLUME: 0.8,
    
    /** Effects volume (0-1) */
    EFFECTS_VOLUME: 0.7,
    
    /** Environment volume (0-1) */
    ENVIRONMENT_VOLUME: 0.5,
    
    /** Doppler effect factor */
    DOPPLER_FACTOR: 1.0,
    
    /** Speed of sound in m/s */
    SPEED_OF_SOUND: 343,
    
    /** Engine sound layers based on RPM ranges */
    ENGINE_LAYERS: [
        { rpmMin: 0, rpmMax: 2000, file: 'engine_low' },
        { rpmMin: 1500, rpmMax: 4000, file: 'engine_mid' },
        { rpmMin: 3500, rpmMax: 6000, file: 'engine_high' },
        { rpmMin: 5500, rpmMax: 8000, file: 'engine_top' },
    ],
    
    /** Tire squeal volume curve (slip angle vs volume) */
    TIRE_SQUEAL_CURVE: [
        { slipAngle: 0, volume: 0 },
        { slipAngle: 0.1, volume: 0 },
        { slipAngle: 0.2, volume: 0.3 },
        { slipAngle: 0.5, volume: 0.8 },
        { slipAngle: 1.0, volume: 1.0 },
    ],
    
    /** Collision sound volume curve (impact force vs volume) */
    COLLISION_VOLUME_CURVE: [
        { force: 0, volume: 0 },
        { force: 5000, volume: 0.3 },
        { force: 15000, volume: 0.6 },
        { force: 30000, volume: 1.0 },
    ],
};

/**
 * @namespace HUD_CONSTANTS
 * @description HUD display properties
 */
export const HUD_CONSTANTS = {
    /** Speedometer max value in km/h */
    SPEEDOMETER_MAX: 300,
    
    /** Tachometer max RPM */
    TACHOMETER_MAX: 8000,
    
    /** Tachometer redline start */
    TACHOMETER_REDLINE: 7000,
    
    /** G-force meter max G */
    G_FORCE_MAX: 2.0,
    
    /** Damage display update rate in Hz */
    DAMAGE_UPDATE_RATE: 10,
    
    /** Drift score display duration after drift ends */
    DRIFT_SCORE_DISPLAY_DURATION: 3,
    
    /** Mini-map scale (pixels per meter) */
    MINIMAP_SCALE: 2,
    
    /** Mini-map size in pixels */
    MINIMAP_SIZE: 200,
    
    /** HUD opacity */
    HUD_OPACITY: 0.9,
    
    /** Animation duration for score popups */
    SCORE_POPUP_DURATION: 1.5,
};

/**
 * @namespace INPUT_CONSTANTS
 * @description Input handling properties
 */
export const INPUT_CONSTANTS = {
    /** Keyboard input smoothing */
    KEYBOARD_SMOOTHING: 0.1,
    
    /** Gamepad deadzone */
    GAMEPAD_DEADZONE: 0.1,
    
    /** Gamepad steering sensitivity */
    GAMEPAD_STEERING_SENSITIVITY: 1.0,
    
    /** Gamepad throttle sensitivity */
    GAMEPAD_THROTTLE_SENSITIVITY: 1.0,
    
    /** Gamepad brake sensitivity */
    GAMEPAD_BRAKE_SENSITIVITY: 1.0,
    
    /** Default key bindings */
    DEFAULT_BINDINGS: {
        ACCELERATE: ['KeyW', 'ArrowUp'],
        BRAKE: ['KeyS', 'ArrowDown'],
        STEER_LEFT: ['KeyA', 'ArrowLeft'],
        STEER_RIGHT: ['KeyD', 'ArrowRight'],
        HANDBRAKE: ['Space'],
        SHIFT_UP: ['KeyE', 'ShiftRight'],
        SHIFT_DOWN: ['KeyQ', 'ShiftLeft'],
        CAMERA_NEXT: ['KeyC'],
        CAMERA_PREV: ['KeyV'],
        PAUSE: ['Escape'],
        RESET: ['KeyR'],
        HEADLIGHTS: ['KeyL'],
        HORN: ['KeyH'],
    },
};

/**
 * @namespace REPLAY_CONSTANTS
 * @description Replay system properties
 */
export const REPLAY_CONSTANTS = {
    /** Capture rate in Hz */
    CAPTURE_RATE: 30,
    
    /** Maximum replay duration in seconds */
    MAX_DURATION: 300,
    
    /** Playback speeds available */
    PLAYBACK_SPEEDS: [0.25, 0.5, 1.0, 2.0, 4.0],
    
    /** Default playback speed */
    DEFAULT_PLAYBACK_SPEED: 1.0,
    
    /** Data compression enabled */
    COMPRESSION_ENABLED: true,
    
    /** Interpolation enabled for smooth playback */
    INTERPOLATION_ENABLED: true,
};

/**
 * @namespace PHYSICS_CONSTANTS
 * @description General physics properties
 */
export const PHYSICS_CONSTANTS = {
    /** Gravitational acceleration in m/s² */
    GRAVITY: 9.81,
    
    /** Fixed time step for physics simulation in seconds */
    FIXED_TIME_STEP: 1 / 120,
    
    /** Maximum time step accumulation */
    MAX_TIME_ACCUMULATION: 0.1,
    
    /** Velocity sleep threshold in m/s */
    VELOCITY_SLEEP_THRESHOLD: 0.01,
    
    /** Angular velocity sleep threshold in rad/s */
    ANGULAR_SLEEP_THRESHOLD: 0.01,
    
    /** Collision skin width in meters */
    COLLISION_SKIN: 0.01,
    
    /** Position correction factor (Baumgarte) */
    POSITION_CORRECTION: 0.2,
    
    /** Penetration slop in meters */
    PENETRATION_SLOP: 0.01,
};

/**
 * @namespace WORLD_CONSTANTS
 * @description World and environment properties
 */
export const WORLD_CONSTANTS = {
    /** World size in meters */
    WORLD_SIZE: 500,
    
    /** Road width in meters */
    ROAD_WIDTH: 15,
    
    /** Number of grid cells for spatial partitioning */
    GRID_CELLS: 50,
    
    /** Maximum destructible objects */
    MAX_DESTRUCTIBLES: 100,
    
    /** Traffic vehicle count */
    TRAFFIC_COUNT: 10,
    
    /** Traffic spawn distance */
    TRAFFIC_SPAWN_DISTANCE: 100,
    
    /** Traffic despawn distance */
    TRAFFIC_DESPAWN_DISTANCE: 150,
    
    /** Ramp height range in meters */
    RAMP_HEIGHT_RANGE: [0.5, 3],
    
    /** Ramp length range in meters */
    RAMP_LENGTH_RANGE: [5, 15],
};

/**
 * @namespace PERFORMANCE_CONSTANTS
 * @description Performance optimization settings
 */
export const PERFORMANCE_CONSTANTS = {
    /** Target frame rate */
    TARGET_FPS: 60,
    
    /** LOD distances in meters */
    LOD_DISTANCES: [20, 50, 100],
    
    /** Shadow map size */
    SHADOW_MAP_SIZE: 2048,
    
    /** Maximum draw calls per frame */
    MAX_DRAW_CALLS: 500,
    
    /** Particle LOD threshold */
    PARTICLE_LOD_THRESHOLD: 50,
    
    /** Physics substeps */
    PHYSICS_SUBSTEPS: 4,
    
    /** Frustum culling enabled */
    FRUSTUM_CULLING: true,
    
    /** Occlusion culling enabled */
    OCCLUSION_CULLING: true,
    
    /** Maximum active particles */
    MAX_ACTIVE_PARTICLES: 1000,
};

// Export all constants as a single object for convenience
export const ALL_CONSTANTS = {
    VEHICLE: VEHICLE_CONSTANTS,
    TIRE: TIRE_CONSTANTS,
    SUSPENSION: SUSPENSION_CONSTANTS,
    ENGINE: ENGINE_CONSTANTS,
    TRANSMISSION: TRANSMISSION_CONSTANTS,
    BRAKE: BRAKE_CONSTANTS,
    STEERING: STEERING_CONSTANTS,
    AERODYNAMICS: AERODYNAMICS_CONSTANTS,
    DEFORMATION: DEFORMATION_CONSTANTS,
    DRIFT: DRIFT_CONSTANTS,
    SURFACE: SURFACE_CONSTANTS,
    WEATHER: WEATHER_CONSTANTS,
    DAY_NIGHT: DAY_NIGHT_CONSTANTS,
    PARTICLE: PARTICLE_CONSTANTS,
    CAMERA: CAMERA_CONSTANTS,
    AUDIO: AUDIO_CONSTANTS,
    HUD: HUD_CONSTANTS,
    INPUT: INPUT_CONSTANTS,
    REPLAY: REPLAY_CONSTANTS,
    PHYSICS: PHYSICS_CONSTANTS,
    WORLD: WORLD_CONSTANTS,
    PERFORMANCE: PERFORMANCE_CONSTANTS,
};

export default ALL_CONSTANTS;
