/**
 * MaterialSystem.js
 * Material properties and behavior for realistic crash simulation
 * 
 * Implements material models for:
 * - Steel (various grades)
 * - Aluminum alloys
 * - Glass (tempered, laminated)
 * - Plastics (ABS, polycarbonate)
 * - Composites (carbon fiber, fiberglass)
 * 
 * Based on real-world material science and automotive engineering data
 * 
 * References:
 * - "Materials Science and Engineering" by William D. Callister Jr.
 * - "Automotive Engineering" by David Crolla
 * - NHTSA Crash Test Standards
 * - European NCAP Testing Protocols
 */

/**
 * Material properties class
 * All units in SI (Pa, kg/m³, etc.)
 */
class MaterialProperties {
    /**
     * Create material properties
     * @param {Object} config 
     */
    constructor(config) {
        // Basic properties
        this.name = config.name || 'Unknown';
        this.type = config.type || 'metal'; // metal, glass, plastic, composite
        
        // Physical properties
        this.density = config.density || 7850; // kg/m³
        this.mass = config.mass || 0; // kg (for specific component)
        
        // Mechanical properties
        this.elasticModulus = config.elasticModulus || 200e9; // Pa (Young's modulus)
        this.yieldStrength = config.yieldStrength || 250e6; // Pa
        this.ultimateStrength = config.ultimateStrength || 400e6; // Pa
        this.fractureStrength = config.fractureStrength || 450e6; // Pa
        this.hardness = config.hardness || 150; // Brinell hardness
        
        // Deformation behavior
        this.poissonRatio = config.poissonRatio || 0.3; // Dimensionless
        this.plasticStrain = config.plasticStrain || 0; // Current plastic strain
        this.maxPlasticStrain = config.maxPlasticStrain || 0.2; // Maximum before fracture
        this.strainHardeningExponent = config.strainHardeningExponent || 0.15;
        
        // Energy absorption
        this.energyAbsorptionRate = config.energyAbsorptionRate || 0.7; // Fraction of energy absorbed
        this.specificEnergyAbsorption = config.specificEnergyAbsorption || 50000; // J/kg
        
        // Thermal properties (relevant for high-speed impacts)
        this.thermalConductivity = config.thermalConductivity || 50; // W/(m·K)
        this.specificHeat = config.specificHeat || 500; // J/(kg·K)
        this.meltingPoint = config.meltingPoint || 1800; // K
        
        // Fatigue properties
        this.fatigueLimit = config.fatigueLimit || 200e6; // Pa
        this.fatigueAccumulation = 0; // Current fatigue damage
        
        // Damage state
        this.currentStress = 0; // Pa
        this.currentStrain = 0; // Dimensionless
        this.damaged = false;
        this.fractured = false;
        this.temperature = 293; // K (20°C ambient)
    }

    /**
     * Calculate stress from strain (constitutive model)
     * Uses elastic-plastic model with strain hardening
     * @param {number} strain - Engineering strain
     * @returns {number} Stress in Pa
     */
    calculateStress(strain) {
        const absStrain = Math.abs(strain);
        
        // Elastic region (Hooke's law)
        const elasticStrain = this.yieldStrength / this.elasticModulus;
        
        if (absStrain <= elasticStrain) {
            // Linear elastic: σ = E * ε
            return this.elasticModulus * strain;
        }
        
        // Plastic region with strain hardening
        // Ramberg-Osgood model: σ = σ_y * (ε/ε_y)^n
        const plasticStrain = absStrain - elasticStrain;
        const stress = this.yieldStrength * Math.pow(
            1 + plasticStrain / elasticStrain,
            this.strainHardeningExponent
        );
        
        // Cap at ultimate strength
        const cappedStress = Math.min(stress, this.ultimateStrength);
        
        return Math.sign(strain) * cappedStress;
    }

    /**
     * Apply load and update material state
     * @param {number} force - Applied force in N
     * @param {number} area - Cross-sectional area in m²
     * @param {number} dt - Time step in seconds
     * @returns {Object} {stress, strain, energyAbsorbed}
     */
    applyLoad(force, area, dt) {
        // Calculate stress: σ = F / A
        const stress = force / area;
        this.currentStress = stress;
        
        // Calculate strain: ε = σ / E (elastic) or use plastic model
        const elasticStrain = stress / this.elasticModulus;
        
        // Check if yielding occurs
        if (Math.abs(stress) > this.yieldStrength) {
            // Plastic deformation
            const excessStress = Math.abs(stress) - this.yieldStrength;
            const plasticIncrement = excessStress / this.elasticModulus * dt;
            this.plasticStrain += plasticIncrement;
            
            // Check for fracture
            if (this.plasticStrain > this.maxPlasticStrain || 
                Math.abs(stress) > this.fractureStrength) {
                this.fractured = true;
                this.damaged = true;
            } else if (!this.damaged) {
                this.damaged = true;
            }
        }
        
        this.currentStrain = elasticStrain + this.plasticStrain;
        
        // Calculate energy absorbed
        // E = ½ * σ * ε * V (simplified)
        const volume = this.mass / this.density;
        const energyAbsorbed = 0.5 * Math.abs(stress * this.currentStrain) * volume * 
                              this.energyAbsorptionRate;
        
        // Temperature rise from plastic deformation
        // Most plastic work converts to heat: ΔT = (energy absorbed) / (mass * c_p)
        if (this.plasticStrain > 0) {
            const plasticWork = energyAbsorbed * 0.9; // 90% of energy becomes heat
            const tempRise = plasticWork / (this.mass * this.specificHeat);
            this.temperature += tempRise;
        }
        
        return {
            stress: this.currentStress,
            strain: this.currentStrain,
            energyAbsorbed,
            yielded: Math.abs(stress) > this.yieldStrength,
            fractured: this.fractured
        };
    }

    /**
     * Calculate fatigue damage accumulation
     * Uses Palmgren-Miner rule for cumulative damage
     * @param {number} stressCycles - Number of stress cycles
     * @param {number} stressAmplitude - Stress amplitude in Pa
     */
    accumulateFatigue(stressCycles, stressAmplitude) {
        if (stressAmplitude < this.fatigueLimit) {
            return; // Below fatigue limit, infinite life
        }
        
        // S-N curve (Wöhler curve): N = C / σ^m
        // Simplified: N = (ultimate_strength / stress_amplitude)^10
        const cyclesToFailure = Math.pow(
            this.ultimateStrength / stressAmplitude,
            10
        );
        
        // Miner's rule: D = Σ(n_i / N_i)
        this.fatigueAccumulation += stressCycles / cyclesToFailure;
        
        // Check for fatigue failure
        if (this.fatigueAccumulation >= 1.0) {
            this.fractured = true;
            this.damaged = true;
        }
    }

    /**
     * Get current damage ratio [0, 1]
     * @returns {number}
     */
    getDamageRatio() {
        if (this.fractured) return 1.0;
        
        // Damage based on plastic strain
        const strainDamage = Math.min(this.plasticStrain / this.maxPlasticStrain, 1.0);
        
        // Damage based on fatigue
        const fatigueDamage = Math.min(this.fatigueAccumulation, 1.0);
        
        // Combined damage
        return Math.max(strainDamage, fatigueDamage);
    }

    /**
     * Get effective stiffness accounting for damage
     * @returns {number} Effective modulus in Pa
     */
    getEffectiveModulus() {
        if (this.fractured) return 0;
        
        const damageRatio = this.getDamageRatio();
        // Stiffness degrades with damage
        return this.elasticModulus * (1 - damageRatio * 0.8);
    }

    /**
     * Reset material state
     */
    reset() {
        this.plasticStrain = 0;
        this.fatigueAccumulation = 0;
        this.currentStress = 0;
        this.currentStrain = 0;
        this.damaged = false;
        this.fractured = false;
        this.temperature = 293;
    }

    /**
     * Clone material properties
     * @returns {MaterialProperties}
     */
    clone() {
        const config = {
            name: this.name,
            type: this.type,
            density: this.density,
            mass: this.mass,
            elasticModulus: this.elasticModulus,
            yieldStrength: this.yieldStrength,
            ultimateStrength: this.ultimateStrength,
            fractureStrength: this.fractureStrength,
            hardness: this.hardness,
            poissonRatio: this.poissonRatio,
            maxPlasticStrain: this.maxPlasticStrain,
            strainHardeningExponent: this.strainHardeningExponent,
            energyAbsorptionRate: this.energyAbsorptionRate,
            specificEnergyAbsorption: this.specificEnergyAbsorption,
            thermalConductivity: this.thermalConductivity,
            specificHeat: this.specificHeat,
            meltingPoint: this.meltingPoint,
            fatigueLimit: this.fatigueLimit
        };
        return new MaterialProperties(config);
    }
}

/**
 * Material database with predefined automotive materials
 */
class MaterialDatabase {
    constructor() {
        this.materials = new Map();
        this.initializeStandardMaterials();
    }

    /**
     * Initialize standard automotive materials
     * Based on real-world data from automotive engineering handbooks
     */
    initializeStandardMaterials() {
        // Steel materials
        
        // Low carbon steel (body panels)
        // Reference: SAE J403
        this.materials.set('steel_low_carbon', new MaterialProperties({
            name: 'Low Carbon Steel',
            type: 'metal',
            density: 7850, // kg/m³
            elasticModulus: 200e9, // Pa (200 GPa)
            yieldStrength: 250e6, // Pa (250 MPa)
            ultimateStrength: 400e6, // Pa (400 MPa)
            fractureStrength: 450e6, // Pa
            hardness: 120, // HB
            poissonRatio: 0.30,
            maxPlasticStrain: 0.25,
            strainHardeningExponent: 0.20,
            energyAbsorptionRate: 0.75,
            specificEnergyAbsorption: 50000, // J/kg
            thermalConductivity: 50, // W/(m·K)
            specificHeat: 490, // J/(kg·K)
            meltingPoint: 1808, // K (1535°C)
            fatigueLimit: 180e6 // Pa
        }));

        // High-strength steel (structural members)
        // Reference: SAE J2340 (Advanced High-Strength Steels)
        this.materials.set('steel_high_strength', new MaterialProperties({
            name: 'High-Strength Steel (HSLA)',
            type: 'metal',
            density: 7850,
            elasticModulus: 210e9, // Pa
            yieldStrength: 550e6, // Pa (550 MPa)
            ultimateStrength: 700e6, // Pa
            fractureStrength: 750e6, // Pa
            hardness: 220, // HB
            poissonRatio: 0.30,
            maxPlasticStrain: 0.15,
            strainHardeningExponent: 0.12,
            energyAbsorptionRate: 0.80,
            specificEnergyAbsorption: 75000,
            thermalConductivity: 48,
            specificHeat: 470,
            meltingPoint: 1808,
            fatigueLimit: 350e6
        }));

        // Ultra-high-strength steel (safety cage, A/B pillars)
        // Reference: Boron steel (e.g., 22MnB5)
        this.materials.set('steel_ultra_high_strength', new MaterialProperties({
            name: 'Ultra-High-Strength Steel (Boron)',
            type: 'metal',
            density: 7850,
            elasticModulus: 210e9,
            yieldStrength: 1200e6, // Pa (1200 MPa) - after hot stamping
            ultimateStrength: 1500e6, // Pa
            fractureStrength: 1600e6, // Pa
            hardness: 450, // HB
            poissonRatio: 0.30,
            maxPlasticStrain: 0.08,
            strainHardeningExponent: 0.08,
            energyAbsorptionRate: 0.85,
            specificEnergyAbsorption: 95000,
            thermalConductivity: 45,
            specificHeat: 460,
            meltingPoint: 1808,
            fatigueLimit: 600e6
        }));

        // Aluminum materials
        
        // Aluminum 6061-T6 (body panels, hood)
        // Reference: ASM Handbook, Aluminum and Aluminum Alloys
        this.materials.set('aluminum_6061', new MaterialProperties({
            name: 'Aluminum 6061-T6',
            type: 'metal',
            density: 2700, // kg/m³
            elasticModulus: 69e9, // Pa (69 GPa)
            yieldStrength: 270e6, // Pa (270 MPa)
            ultimateStrength: 310e6, // Pa
            fractureStrength: 330e6, // Pa
            hardness: 95, // HB
            poissonRatio: 0.33,
            maxPlasticStrain: 0.12,
            strainHardeningExponent: 0.10,
            energyAbsorptionRate: 0.70,
            specificEnergyAbsorption: 45000,
            thermalConductivity: 167, // W/(m·K)
            specificHeat: 896, // J/(kg·K)
            meltingPoint: 855, // K (582°C)
            fatigueLimit: 96e6
        }));

        // Aluminum 7075-T6 (high-performance applications)
        this.materials.set('aluminum_7075', new MaterialProperties({
            name: 'Aluminum 7075-T6',
            type: 'metal',
            density: 2810,
            elasticModulus: 72e9,
            yieldStrength: 500e6, // Pa
            ultimateStrength: 570e6,
            fractureStrength: 600e6,
            hardness: 150, // HB
            poissonRatio: 0.33,
            maxPlasticStrain: 0.11,
            strainHardeningExponent: 0.09,
            energyAbsorptionRate: 0.72,
            specificEnergyAbsorption: 60000,
            thermalConductivity: 130,
            specificHeat: 960,
            meltingPoint: 750,
            fatigueLimit: 160e6
        }));

        // Glass materials
        
        // Tempered glass (side windows)
        // Reference: ANSI Z26.1 (Safety glazing materials)
        this.materials.set('glass_tempered', new MaterialProperties({
            name: 'Tempered Glass',
            type: 'glass',
            density: 2500, // kg/m³
            elasticModulus: 70e9, // Pa (70 GPa)
            yieldStrength: 40e6, // Pa (very brittle, low yield)
            ultimateStrength: 120e6, // Pa (tensile strength)
            fractureStrength: 120e6, // Pa (shatters suddenly)
            hardness: 480, // Knoop hardness (different scale)
            poissonRatio: 0.22,
            maxPlasticStrain: 0.001, // Nearly zero - brittle fracture
            strainHardeningExponent: 0,
            energyAbsorptionRate: 0.15, // Poor energy absorption, shatters
            specificEnergyAbsorption: 2000,
            thermalConductivity: 1.0,
            specificHeat: 840,
            meltingPoint: 1873, // K (1600°C)
            fatigueLimit: 25e6
        }));

        // Laminated glass (windshield)
        // Two layers of glass with PVB interlayer
        this.materials.set('glass_laminated', new MaterialProperties({
            name: 'Laminated Glass',
            type: 'glass',
            density: 2500,
            elasticModulus: 70e9,
            yieldStrength: 50e6,
            ultimateStrength: 100e6,
            fractureStrength: 100e6,
            hardness: 480,
            poissonRatio: 0.22,
            maxPlasticStrain: 0.002, // PVB layer provides some ductility
            strainHardeningExponent: 0.01,
            energyAbsorptionRate: 0.35, // Better than tempered due to PVB
            specificEnergyAbsorption: 5000,
            thermalConductivity: 1.0,
            specificHeat: 840,
            meltingPoint: 1873,
            fatigueLimit: 20e6
        }));

        // Plastic materials
        
        // ABS plastic (bumper covers, interior panels)
        // Reference: Modern Plastics Handbook
        this.materials.set('plastic_abs', new MaterialProperties({
            name: 'ABS Plastic',
            type: 'plastic',
            density: 1050, // kg/m³
            elasticModulus: 2.3e9, // Pa (2.3 GPa)
            yieldStrength: 40e6, // Pa (40 MPa)
            ultimateStrength: 45e6, // Pa
            fractureStrength: 50e6, // Pa
            hardness: 20, // Shore D hardness (different scale)
            poissonRatio: 0.39,
            maxPlasticStrain: 0.05,
            strainHardeningExponent: 0.15,
            energyAbsorptionRate: 0.60,
            specificEnergyAbsorption: 25000,
            thermalConductivity: 0.2,
            specificHeat: 1400,
            meltingPoint: 378, // K (105°C)
            fatigueLimit: 15e6
        }));

        // Polycarbonate (headlight lenses, some windows)
        this.materials.set('plastic_polycarbonate', new MaterialProperties({
            name: 'Polycarbonate',
            type: 'plastic',
            density: 1200,
            elasticModulus: 2.4e9,
            yieldStrength: 60e6, // Pa
            ultimateStrength: 70e6,
            fractureStrength: 75e6,
            hardness: 75, // Rockwell M
            poissonRatio: 0.37,
            maxPlasticStrain: 0.10,
            strainHardeningExponent: 0.18,
            energyAbsorptionRate: 0.70,
            specificEnergyAbsorption: 35000,
            thermalConductivity: 0.2,
            specificHeat: 1250,
            meltingPoint: 423, // K (150°C)
            fatigueLimit: 25e6
        }));

        // Composite materials
        
        // Carbon fiber reinforced polymer (performance vehicles)
        // Reference: ASM Handbook, Composites
        this.materials.set('composite_carbon_fiber', new MaterialProperties({
            name: 'Carbon Fiber Composite (CFRP)',
            type: 'composite',
            density: 1600, // kg/m³
            elasticModulus: 150e9, // Pa (highly directional)
            yieldStrength: 600e6, // Pa (tensile)
            ultimateStrength: 1000e6, // Pa
            fractureStrength: 1000e6, // Pa (brittle fracture)
            hardness: 40, // Barcol hardness
            poissonRatio: 0.30,
            maxPlasticStrain: 0.012, // Very brittle
            strainHardeningExponent: 0.02,
            energyAbsorptionRate: 0.50, // Can delaminate
            specificEnergyAbsorption: 80000,
            thermalConductivity: 1.0,
            specificHeat: 1100,
            meltingPoint: 573, // K (300°C) - resin degrades
            fatigueLimit: 400e6
        }));

        // Fiberglass (SMC - Sheet Molding Compound)
        this.materials.set('composite_fiberglass', new MaterialProperties({
            name: 'Fiberglass Composite (SMC)',
            type: 'composite',
            density: 1800,
            elasticModulus: 15e9, // Pa
            yieldStrength: 100e6, // Pa
            ultimateStrength: 150e6,
            fractureStrength: 160e6,
            hardness: 35,
            poissonRatio: 0.32,
            maxPlasticStrain: 0.02,
            strainHardeningExponent: 0.05,
            energyAbsorptionRate: 0.55,
            specificEnergyAbsorption: 40000,
            thermalConductivity: 0.3,
            specificHeat: 1200,
            meltingPoint: 473, // K (200°C) - resin softens
            fatigueLimit: 50e6
        }));

        // Rubber (bumper foam, seals)
        this.materials.set('rubber_foam', new MaterialProperties({
            name: 'Foam Rubber',
            type: 'plastic',
            density: 200, // kg/m³ (low density foam)
            elasticModulus: 1e6, // Pa (1 MPa) - very soft
            yieldStrength: 0.3e6, // Pa
            ultimateStrength: 1e6,
            fractureStrength: 1.5e6,
            hardness: 5, // Shore A
            poissonRatio: 0.48, // Nearly incompressible
            maxPlasticStrain: 0.80, // Highly deformable
            strainHardeningExponent: 0.30,
            energyAbsorptionRate: 0.85, // Excellent energy absorption
            specificEnergyAbsorption: 15000,
            thermalConductivity: 0.05,
            specificHeat: 1500,
            meltingPoint: 373, // K (100°C)
            fatigueLimit: 0.1e6
        }));
    }

    /**
     * Get material by name
     * @param {string} name 
     * @returns {MaterialProperties|null}
     */
    getMaterial(name) {
        return this.materials.get(name) || null;
    }

    /**
     * Get material clone (for independent state tracking)
     * @param {string} name 
     * @returns {MaterialProperties|null}
     */
    getMaterialClone(name) {
        const material = this.materials.get(name);
        return material ? material.clone() : null;
    }

    /**
     * Add custom material
     * @param {string} name 
     * @param {MaterialProperties} material 
     */
    addMaterial(name, material) {
        this.materials.set(name, material);
    }

    /**
     * List all available materials
     * @returns {Array} Array of material names
     */
    listMaterials() {
        return Array.from(this.materials.keys());
    }

    /**
     * Get materials by type
     * @param {string} type - 'metal', 'glass', 'plastic', 'composite'
     * @returns {Array}
     */
    getMaterialsByType(type) {
        const result = [];
        for (const [name, material] of this.materials) {
            if (material.type === type) {
                result.push({ name, material });
            }
        }
        return result;
    }
}

/**
 * Material interaction calculator
 * Calculates contact behavior between different materials
 */
class MaterialInteraction {
    /**
     * Calculate coefficient of restitution between two materials
     * @param {MaterialProperties} mat1 
     * @param {MaterialProperties} mat2 
     * @returns {number} Coefficient of restitution [0, 1]
     */
    static calculateRestitution(mat1, mat2) {
        // Restitution depends on material damping and plasticity
        // More plastic materials have lower restitution
        
        const damping1 = 1 - mat1.energyAbsorptionRate;
        const damping2 = 1 - mat2.energyAbsorptionRate;
        
        // Combined damping (geometric mean)
        const combinedDamping = Math.sqrt(damping1 * damping2);
        
        // Adjust for damage
        const damage1 = mat1.getDamageRatio();
        const damage2 = mat2.getDamageRatio();
        const damageFactor = 1 - (damage1 + damage2) * 0.25;
        
        return combinedDamping * damageFactor;
    }

    /**
     * Calculate friction coefficient between two materials
     * @param {MaterialProperties} mat1 
     * @param {MaterialProperties} mat2 
     * @returns {number} Friction coefficient
     */
    static calculateFriction(mat1, mat2) {
        // Simplified friction model
        // Friction depends on material hardness and surface properties
        
        // Base friction values by material type
        const baseFriction = {
            'metal-metal': 0.6,
            'metal-glass': 0.4,
            'metal-plastic': 0.3,
            'metal-composite': 0.4,
            'glass-glass': 0.9,
            'glass-plastic': 0.5,
            'glass-composite': 0.6,
            'plastic-plastic': 0.4,
            'plastic-composite': 0.4,
            'composite-composite': 0.5
        };
        
        // Get interaction key
        const types = [mat1.type, mat2.type].sort();
        const key = types.join('-');
        
        const friction = baseFriction[key] || 0.5;
        
        // Adjust for damage (rougher surfaces increase friction)
        const damage1 = mat1.getDamageRatio();
        const damage2 = mat2.getDamageRatio();
        const damageFactor = 1 + (damage1 + damage2) * 0.2;
        
        return friction * damageFactor;
    }

    /**
     * Calculate energy transfer ratio during impact
     * @param {MaterialProperties} mat1 - Impacting material
     * @param {MaterialProperties} mat2 - Impacted material
     * @returns {number} Energy transfer ratio [0, 1]
     */
    static calculateEnergyTransfer(mat1, mat2) {
        // Energy transfer depends on impedance matching
        // Z = ρ * c, where c = sqrt(E/ρ) is wave speed
        
        const c1 = Math.sqrt(mat1.elasticModulus / mat1.density);
        const c2 = Math.sqrt(mat2.elasticModulus / mat2.density);
        
        const z1 = mat1.density * c1;
        const z2 = mat2.density * c2;
        
        // Transmission coefficient
        const transmission = (2 * z2) / (z1 + z2);
        
        return Math.min(Math.abs(transmission), 1.0);
    }

    /**
     * Calculate relative hardness factor
     * Determines which material deforms more
     * @param {MaterialProperties} mat1 
     * @param {MaterialProperties} mat2 
     * @returns {Object} {factor1, factor2} - deformation factors
     */
    static calculateDeformationRatio(mat1, mat2) {
        // Softer material deforms more
        const hardnessRatio = mat1.hardness / mat2.hardness;
        
        // Normalize to deformation factors
        const total = 1 + hardnessRatio;
        const factor1 = hardnessRatio / total; // mat1 deformation factor
        const factor2 = 1 / total; // mat2 deformation factor
        
        return { factor1, factor2 };
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        MaterialProperties,
        MaterialDatabase,
        MaterialInteraction
    };
}
