/**
 * DamageSystem.js - Vehicle Damage Management System
 * 
 * Manages all aspects of vehicle damage including visual deformation,
 * mechanical failures, and component detachment.
 * 
 * @module damage/DamageSystem
 * @author CarSim Development Team
 * @version 2.0.0
 */

import { DEFORMATION_CONSTANTS } from '../core/Constants.js';
import { MathUtils } from '../utils/MathUtils.js';

/**
 * @class DamageSystem
 * @description Central damage management for the vehicle
 */
export class DamageSystem {
    /**
     * Creates a new DamageSystem instance
     * @param {THREE.Group} vehicleMesh - The vehicle mesh group
     * @param {Object} [config] - Configuration options
     */
    constructor(vehicleMesh, config = {}) {
        /** @type {THREE.Group} Vehicle mesh reference */
        this.vehicleMesh = vehicleMesh;
        
        /** @type {THREE.Scene} Scene reference */
        this.scene = config.scene ?? null;
        
        // Damage thresholds
        /** @type {number} Minimum force for damage in N */
        this.minDamageForce = config.minDamageForce ?? DEFORMATION_CONSTANTS.MIN_DEFORMATION_FORCE;
        
        /** @type {number} Maximum vertex displacement in meters */
        this.maxVertexDisplacement = config.maxVertexDisplacement ?? DEFORMATION_CONSTANTS.MAX_VERTEX_DISPLACEMENT;
        
        /** @type {number} Deformation resistance */
        this.deformationResistance = config.deformationResistance ?? DEFORMATION_CONSTANTS.DEFORMATION_RESISTANCE;
        
        /** @type {number} Component detachment threshold */
        this.detachmentThreshold = config.detachmentThreshold ?? DEFORMATION_CONSTANTS.COMPONENT_DETACHMENT_THRESHOLD;
        
        // Damage zones
        this.damageZones = {
            FRONT: { damage: 0, vertices: [], bounds: { zMin: 1.0, zMax: 2.5 } },
            REAR: { damage: 0, vertices: [], bounds: { zMin: -2.5, zMax: -1.0 } },
            LEFT: { damage: 0, vertices: [], bounds: { xMin: -1.5, xMax: -0.8 } },
            RIGHT: { damage: 0, vertices: [], bounds: { xMin: 0.8, xMax: 1.5 } },
            ROOF: { damage: 0, vertices: [], bounds: { yMin: 1.0, yMax: 1.5 } },
            FLOOR: { damage: 0, vertices: [], bounds: { yMin: 0, yMax: 0.3 } }
        };
        
        // Mechanical damage state
        this.mechanicalDamage = {
            engine: 0,
            radiator: 0,
            transmission: 0,
            steering: 0,
            suspension: { frontLeft: 0, frontRight: 0, rearLeft: 0, rearRight: 0 },
            brakes: { frontLeft: 0, frontRight: 0, rearLeft: 0, rearRight: 0 }
        };
        
        // Component state
        this.detachedComponents = new Set();
        this.components = {
            hood: { attached: true, damage: 0, mesh: null },
            trunk: { attached: true, damage: 0, mesh: null },
            frontBumper: { attached: true, damage: 0, mesh: null },
            rearBumper: { attached: true, damage: 0, mesh: null },
            leftDoor: { attached: true, damage: 0, mesh: null },
            rightDoor: { attached: true, damage: 0, mesh: null },
            leftMirror: { attached: true, damage: 0, mesh: null },
            rightMirror: { attached: true, damage: 0, mesh: null },
            windshield: { attached: true, damage: 0, shattered: false },
            rearWindow: { attached: true, damage: 0, shattered: false },
            leftWindow: { attached: true, damage: 0, shattered: false },
            rightWindow: { attached: true, damage: 0, shattered: false }
        };
        
        // Overall vehicle state
        /** @type {number} Overall structural integrity (0-1) */
        this.structuralIntegrity = 1.0;
        
        /** @type {number} Total damage percentage (0-100) */
        this.totalDamage = 0;
        
        /** @type {boolean} Vehicle is totaled */
        this.isTotaled = false;
        
        // Visual effects
        /** @type {Array} Active smoke emitters */
        this.smokeEmitters = [];
        
        /** @type {Array} Active fire particles */
        this.fireParticles = [];
        
        /** @type {boolean} Vehicle is on fire */
        this.onFire = false;
        
        // Deformation tracking
        /** @type {Map} Original vertex positions */
        this.originalVertices = new Map();
        
        /** @type {Array} Deformation history for undo */
        this.deformationHistory = [];
        
        // Callbacks
        this.onDamage = config.onDamage ?? null;
        this.onComponentDetach = config.onComponentDetach ?? null;
        this.onTotaled = config.onTotaled ?? null;
        
        // Initialize
        this.initializeVertexTracking();
    }

    /**
     * Initialize vertex position tracking for mesh deformation
     */
    initializeVertexTracking() {
        if (!this.vehicleMesh) return;
        
        this.vehicleMesh.traverse((child) => {
            if (child.isMesh && child.geometry) {
                const positions = child.geometry.attributes.position;
                if (positions) {
                    // Store original positions
                    const originalPositions = new Float32Array(positions.array.length);
                    originalPositions.set(positions.array);
                    this.originalVertices.set(child.uuid, originalPositions);
                    
                    // Categorize vertices by zone
                    this.categorizeVertices(child, positions);
                }
            }
        });
    }

    /**
     * Categorize vertices into damage zones
     * @param {THREE.Mesh} mesh - The mesh to categorize
     * @param {THREE.BufferAttribute} positions - Position attribute
     */
    categorizeVertices(mesh, positions) {
        for (let i = 0; i < positions.count; i++) {
            const x = positions.getX(i);
            const y = positions.getY(i);
            const z = positions.getZ(i);
            
            // Categorize by position
            for (const [zoneName, zone] of Object.entries(this.damageZones)) {
                const bounds = zone.bounds;
                let inZone = true;
                
                if (bounds.xMin !== undefined && x < bounds.xMin) inZone = false;
                if (bounds.xMax !== undefined && x > bounds.xMax) inZone = false;
                if (bounds.yMin !== undefined && y < bounds.yMin) inZone = false;
                if (bounds.yMax !== undefined && y > bounds.yMax) inZone = false;
                if (bounds.zMin !== undefined && z < bounds.zMin) inZone = false;
                if (bounds.zMax !== undefined && z > bounds.zMax) inZone = false;
                
                if (inZone) {
                    zone.vertices.push({ mesh, index: i });
                }
            }
        }
    }

    /**
     * Process a collision and apply damage
     * @param {THREE.Vector3} impactPoint - World position of impact
     * @param {THREE.Vector3} impactNormal - Normal direction of impact
     * @param {number} impactForce - Force of impact in Newtons
     * @param {number} impactVelocity - Velocity at impact in m/s
     * @returns {Object} Damage result
     */
    processCollision(impactPoint, impactNormal, impactForce, impactVelocity) {
        if (impactForce < this.minDamageForce) {
            return { damaged: false, amount: 0 };
        }
        
        // Determine damage zone
        const localImpact = this.worldToLocal(impactPoint);
        const zone = this.determineZone(localImpact);
        
        // Calculate base damage
        const energyFactor = 0.5 * impactVelocity * impactVelocity;
        const damageAmount = (impactForce / this.deformationResistance) * 
                            (energyFactor / 1000) * 
                            (DEFORMATION_CONSTANTS.DAMAGE_ZONES[zone]?.multiplier ?? 1.0);
        
        // Apply visual deformation
        const deformationResult = this.deformMesh(impactPoint, impactForce, impactNormal);
        
        // Apply zone damage
        this.applyZoneDamage(zone, damageAmount);
        
        // Apply mechanical damage based on zone
        this.applyMechanicalDamage(zone, damageAmount);
        
        // Check for component detachment
        this.checkComponentDetachment(zone, damageAmount);
        
        // Check for glass breakage
        this.checkGlassBreakage(impactPoint, impactForce);
        
        // Update overall damage
        this.updateTotalDamage();
        
        // Trigger smoke/fire effects if severe
        this.updateEffects(zone, damageAmount);
        
        // Callback
        if (this.onDamage) {
            this.onDamage({
                zone,
                amount: damageAmount,
                point: impactPoint,
                totalDamage: this.totalDamage
            });
        }
        
        return {
            damaged: true,
            amount: damageAmount,
            zone,
            deformation: deformationResult
        };
    }

    /**
     * Deform the mesh at impact point
     * @param {THREE.Vector3} impactPoint - World position of impact
     * @param {number} impactForce - Force of impact
     * @param {THREE.Vector3} impactNormal - Direction of impact
     * @returns {Object} Deformation details
     */
    deformMesh(impactPoint, impactForce, impactNormal) {
        if (!this.vehicleMesh) return { verticesAffected: 0 };
        
        const maxRadius = Math.sqrt(impactForce / this.deformationResistance);
        let verticesAffected = 0;
        
        this.vehicleMesh.traverse((child) => {
            if (!child.isMesh || !child.geometry) return;
            
            const positions = child.geometry.attributes.position;
            const originalPositions = this.originalVertices.get(child.uuid);
            
            if (!positions || !originalPositions) return;
            
            // Transform impact point to local space
            const localImpact = impactPoint.clone();
            child.worldToLocal(localImpact);
            
            // Transform impact normal to local space
            const localNormal = impactNormal.clone();
            const normalMatrix = new THREE.Matrix3().getNormalMatrix(child.matrixWorld);
            localNormal.applyMatrix3(normalMatrix.invert()).normalize();
            
            for (let i = 0; i < positions.count; i++) {
                const vx = positions.getX(i);
                const vy = positions.getY(i);
                const vz = positions.getZ(i);
                
                // Calculate distance to impact
                const dx = vx - localImpact.x;
                const dy = vy - localImpact.y;
                const dz = vz - localImpact.z;
                const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
                
                if (distance < maxRadius) {
                    // Calculate falloff
                    const falloff = Math.pow(1 - distance / maxRadius, 2);
                    
                    // Calculate deformation amount
                    const deformAmount = (impactForce / DEFORMATION_CONSTANTS.YIELD_STRENGTH) * falloff;
                    const clampedDeform = Math.min(deformAmount, this.maxVertexDisplacement);
                    
                    // Apply displacement in impact direction
                    const newX = vx - localNormal.x * clampedDeform;
                    const newY = vy - localNormal.y * clampedDeform;
                    const newZ = vz - localNormal.z * clampedDeform;
                    
                    // Calculate maximum allowed displacement from original
                    const origX = originalPositions[i * 3];
                    const origY = originalPositions[i * 3 + 1];
                    const origZ = originalPositions[i * 3 + 2];
                    
                    const totalDispX = newX - origX;
                    const totalDispY = newY - origY;
                    const totalDispZ = newZ - origZ;
                    const totalDisp = Math.sqrt(totalDispX * totalDispX + 
                                               totalDispY * totalDispY + 
                                               totalDispZ * totalDispZ);
                    
                    if (totalDisp <= this.maxVertexDisplacement) {
                        positions.setXYZ(i, newX, newY, newZ);
                        verticesAffected++;
                    } else {
                        // Clamp to max displacement
                        const scale = this.maxVertexDisplacement / totalDisp;
                        positions.setXYZ(i,
                            origX + totalDispX * scale,
                            origY + totalDispY * scale,
                            origZ + totalDispZ * scale
                        );
                        verticesAffected++;
                    }
                }
            }
            
            if (verticesAffected > 0) {
                positions.needsUpdate = true;
                child.geometry.computeVertexNormals();
                child.geometry.computeBoundingSphere();
            }
        });
        
        return { verticesAffected, radius: maxRadius };
    }

    /**
     * Convert world position to local vehicle position
     * @param {THREE.Vector3} worldPos - World position
     * @returns {THREE.Vector3} Local position
     */
    worldToLocal(worldPos) {
        if (!this.vehicleMesh) return worldPos.clone();
        const local = worldPos.clone();
        this.vehicleMesh.worldToLocal(local);
        return local;
    }

    /**
     * Determine which damage zone a point is in
     * @param {THREE.Vector3} localPos - Local position
     * @returns {string} Zone name
     */
    determineZone(localPos) {
        // Priority order: check front/rear first, then sides, then vertical
        if (localPos.z > 1.0) return 'FRONT';
        if (localPos.z < -1.0) return 'REAR';
        if (localPos.x < -0.8) return 'LEFT';
        if (localPos.x > 0.8) return 'RIGHT';
        if (localPos.y > 1.0) return 'ROOF';
        if (localPos.y < 0.3) return 'FLOOR';
        
        return 'FRONT'; // Default
    }

    /**
     * Apply damage to a specific zone
     * @param {string} zone - Zone name
     * @param {number} amount - Damage amount (0-1)
     */
    applyZoneDamage(zone, amount) {
        if (this.damageZones[zone]) {
            this.damageZones[zone].damage = MathUtils.clamp(
                this.damageZones[zone].damage + amount, 0, 1
            );
            
            // Structural integrity loss
            const zoneConfig = DEFORMATION_CONSTANTS.DAMAGE_ZONES[zone];
            if (zoneConfig) {
                this.structuralIntegrity -= amount * 
                    zoneConfig.structuralImportance * 
                    DEFORMATION_CONSTANTS.STRUCTURAL_INTEGRITY_LOSS;
                this.structuralIntegrity = MathUtils.clamp(this.structuralIntegrity, 0, 1);
            }
        }
    }

    /**
     * Apply mechanical damage based on impact zone
     * @param {string} zone - Damage zone
     * @param {number} amount - Damage amount
     */
    applyMechanicalDamage(zone, amount) {
        const mechConfig = DEFORMATION_CONSTANTS.MECHANICAL_DAMAGE;
        
        switch (zone) {
            case 'FRONT':
                // Front impacts affect engine, radiator
                this.mechanicalDamage.engine += amount * 0.5;
                this.mechanicalDamage.radiator += amount * 0.8;
                this.mechanicalDamage.steering += amount * 0.3;
                this.mechanicalDamage.suspension.frontLeft += amount * 0.4;
                this.mechanicalDamage.suspension.frontRight += amount * 0.4;
                break;
                
            case 'REAR':
                // Rear impacts affect trunk area, fuel system
                this.mechanicalDamage.transmission += amount * 0.2;
                this.mechanicalDamage.suspension.rearLeft += amount * 0.4;
                this.mechanicalDamage.suspension.rearRight += amount * 0.4;
                break;
                
            case 'LEFT':
                this.mechanicalDamage.suspension.frontLeft += amount * 0.6;
                this.mechanicalDamage.suspension.rearLeft += amount * 0.4;
                this.mechanicalDamage.brakes.frontLeft += amount * 0.3;
                this.mechanicalDamage.brakes.rearLeft += amount * 0.3;
                break;
                
            case 'RIGHT':
                this.mechanicalDamage.suspension.frontRight += amount * 0.6;
                this.mechanicalDamage.suspension.rearRight += amount * 0.4;
                this.mechanicalDamage.brakes.frontRight += amount * 0.3;
                this.mechanicalDamage.brakes.rearRight += amount * 0.3;
                break;
                
            case 'ROOF':
            case 'FLOOR':
                // Chassis damage
                this.structuralIntegrity -= amount * 0.2;
                break;
        }
        
        // Clamp all mechanical damage values
        this.clampMechanicalDamage();
    }

    /**
     * Clamp all mechanical damage values to 0-1
     */
    clampMechanicalDamage() {
        for (const [key, value] of Object.entries(this.mechanicalDamage)) {
            if (typeof value === 'number') {
                this.mechanicalDamage[key] = MathUtils.clamp(value, 0, 1);
            } else if (typeof value === 'object') {
                for (const [subKey, subValue] of Object.entries(value)) {
                    this.mechanicalDamage[key][subKey] = MathUtils.clamp(subValue, 0, 1);
                }
            }
        }
    }

    /**
     * Check if components should detach
     * @param {string} zone - Impact zone
     * @param {number} damageAmount - Damage from this impact
     */
    checkComponentDetachment(zone, damageAmount) {
        const zoneDamage = this.damageZones[zone]?.damage ?? 0;
        
        // Front zone components
        if (zone === 'FRONT') {
            if (!this.detachedComponents.has('frontBumper') && 
                zoneDamage > this.detachmentThreshold) {
                this.detachComponent('frontBumper');
            }
            if (!this.detachedComponents.has('hood') && 
                zoneDamage > this.detachmentThreshold * 1.2) {
                this.detachComponent('hood');
            }
        }
        
        // Rear zone components
        if (zone === 'REAR') {
            if (!this.detachedComponents.has('rearBumper') && 
                zoneDamage > this.detachmentThreshold) {
                this.detachComponent('rearBumper');
            }
            if (!this.detachedComponents.has('trunk') && 
                zoneDamage > this.detachmentThreshold * 1.2) {
                this.detachComponent('trunk');
            }
        }
        
        // Side components
        if (zone === 'LEFT') {
            if (!this.detachedComponents.has('leftMirror') && 
                zoneDamage > this.detachmentThreshold * 0.5) {
                this.detachComponent('leftMirror');
            }
            if (!this.detachedComponents.has('leftDoor') && 
                zoneDamage > this.detachmentThreshold * 1.5) {
                this.detachComponent('leftDoor');
            }
        }
        
        if (zone === 'RIGHT') {
            if (!this.detachedComponents.has('rightMirror') && 
                zoneDamage > this.detachmentThreshold * 0.5) {
                this.detachComponent('rightMirror');
            }
            if (!this.detachedComponents.has('rightDoor') && 
                zoneDamage > this.detachmentThreshold * 1.5) {
                this.detachComponent('rightDoor');
            }
        }
    }

    /**
     * Detach a component from the vehicle
     * @param {string} componentName - Name of component
     */
    detachComponent(componentName) {
        if (this.detachedComponents.has(componentName)) return;
        
        const component = this.components[componentName];
        if (!component) return;
        
        component.attached = false;
        this.detachedComponents.add(componentName);
        
        // If mesh exists, animate detachment
        if (component.mesh && this.scene) {
            this.animateDetachment(component.mesh);
        }
        
        // Callback
        if (this.onComponentDetach) {
            this.onComponentDetach(componentName);
        }
    }

    /**
     * Animate component detachment
     * @param {THREE.Mesh} mesh - Component mesh
     */
    animateDetachment(mesh) {
        if (!this.scene) return;
        
        // Remove from vehicle, add to scene
        const worldPos = new THREE.Vector3();
        mesh.getWorldPosition(worldPos);
        const worldRot = new THREE.Quaternion();
        mesh.getWorldQuaternion(worldRot);
        
        mesh.parent.remove(mesh);
        this.scene.add(mesh);
        mesh.position.copy(worldPos);
        mesh.quaternion.copy(worldRot);
        
        // Add physics (simplified - just fall and rotate)
        const velocity = new THREE.Vector3(
            MathUtils.randomRange(-2, 2),
            MathUtils.randomRange(2, 5),
            MathUtils.randomRange(-2, 2)
        );
        const angularVel = new THREE.Vector3(
            MathUtils.randomRange(-3, 3),
            MathUtils.randomRange(-3, 3),
            MathUtils.randomRange(-3, 3)
        );
        
        // Store for animation
        mesh.userData.detachVelocity = velocity;
        mesh.userData.detachAngularVel = angularVel;
        mesh.userData.detachTime = 0;
    }

    /**
     * Check for glass breakage
     * @param {THREE.Vector3} impactPoint - Impact position
     * @param {number} impactForce - Impact force
     */
    checkGlassBreakage(impactPoint, impactForce) {
        if (impactForce < DEFORMATION_CONSTANTS.GLASS_SHATTER_THRESHOLD) return;
        
        const localImpact = this.worldToLocal(impactPoint);
        
        // Check proximity to each window
        const windowChecks = [
            { name: 'windshield', pos: { x: 0, y: 1.0, z: 0.7 }, radius: 0.8 },
            { name: 'rearWindow', pos: { x: 0, y: 1.0, z: -1.3 }, radius: 0.7 },
            { name: 'leftWindow', pos: { x: -0.9, y: 1.0, z: 0 }, radius: 0.5 },
            { name: 'rightWindow', pos: { x: 0.9, y: 1.0, z: 0 }, radius: 0.5 }
        ];
        
        for (const check of windowChecks) {
            const distance = MathUtils.distance3D(
                localImpact.x, localImpact.y, localImpact.z,
                check.pos.x, check.pos.y, check.pos.z
            );
            
            if (distance < check.radius) {
                this.shatterGlass(check.name);
            }
        }
    }

    /**
     * Shatter a glass component
     * @param {string} windowName - Window component name
     */
    shatterGlass(windowName) {
        const component = this.components[windowName];
        if (!component || component.shattered) return;
        
        component.shattered = true;
        component.damage = 1;
        
        // TODO: Spawn glass particle effects
        // TODO: Modify window mesh opacity/texture
    }

    /**
     * Update visual effects based on damage
     * @param {string} zone - Damage zone
     * @param {number} damageAmount - Recent damage
     */
    updateEffects(zone, damageAmount) {
        // Start smoke from engine if radiator damaged
        if (this.mechanicalDamage.radiator > 0.5) {
            this.startSmoke('engine');
        }
        
        // Fire from severe damage
        if (this.mechanicalDamage.engine > 0.9 || this.structuralIntegrity < 0.2) {
            this.startFire();
        }
    }

    /**
     * Start smoke effect
     * @param {string} source - Source location
     */
    startSmoke(source) {
        // Smoke emitter would be added here
        if (!this.smokeEmitters.includes(source)) {
            this.smokeEmitters.push(source);
        }
    }

    /**
     * Start fire effect
     */
    startFire() {
        this.onFire = true;
        // Fire particle system would be activated here
    }

    /**
     * Update total damage calculation
     */
    updateTotalDamage() {
        // Calculate from zone damages
        let zoneDamageSum = 0;
        let zoneCount = 0;
        
        for (const zone of Object.values(this.damageZones)) {
            zoneDamageSum += zone.damage;
            zoneCount++;
        }
        
        // Factor in structural integrity
        const zoneDamageAvg = zoneDamageSum / zoneCount;
        const structuralFactor = 1 - this.structuralIntegrity;
        
        this.totalDamage = (zoneDamageAvg * 60 + structuralFactor * 40);
        
        // Check for totaled
        if (this.totalDamage >= 90 || this.structuralIntegrity < 0.1) {
            this.isTotaled = true;
            if (this.onTotaled) {
                this.onTotaled();
            }
        }
    }

    /**
     * Get overall damage percentage
     * @returns {number} Damage percentage (0-100)
     */
    getDamagePercentage() {
        return this.totalDamage;
    }

    /**
     * Get damage for a specific zone
     * @param {string} zone - Zone name
     * @returns {number} Zone damage (0-1)
     */
    getZoneDamage(zone) {
        return this.damageZones[zone]?.damage ?? 0;
    }

    /**
     * Get all mechanical damage values
     * @returns {Object} Mechanical damage state
     */
    getMechanicalDamage() {
        return { ...this.mechanicalDamage };
    }

    /**
     * Check if vehicle is driveable
     * @returns {boolean} True if still driveable
     */
    isDriveable() {
        return !this.isTotaled && 
               this.mechanicalDamage.engine < 1.0 &&
               this.mechanicalDamage.transmission < 1.0;
    }

    /**
     * Reset damage system
     */
    reset() {
        // Reset zone damage
        for (const zone of Object.values(this.damageZones)) {
            zone.damage = 0;
        }
        
        // Reset mechanical damage
        this.mechanicalDamage.engine = 0;
        this.mechanicalDamage.radiator = 0;
        this.mechanicalDamage.transmission = 0;
        this.mechanicalDamage.steering = 0;
        this.mechanicalDamage.suspension = { frontLeft: 0, frontRight: 0, rearLeft: 0, rearRight: 0 };
        this.mechanicalDamage.brakes = { frontLeft: 0, frontRight: 0, rearLeft: 0, rearRight: 0 };
        
        // Reset components
        for (const component of Object.values(this.components)) {
            component.attached = true;
            component.damage = 0;
            component.shattered = false;
        }
        this.detachedComponents.clear();
        
        // Reset state
        this.structuralIntegrity = 1.0;
        this.totalDamage = 0;
        this.isTotaled = false;
        this.onFire = false;
        this.smokeEmitters = [];
        
        // Restore original mesh vertices
        this.restoreOriginalMesh();
    }

    /**
     * Restore mesh to original state
     */
    restoreOriginalMesh() {
        if (!this.vehicleMesh) return;
        
        this.vehicleMesh.traverse((child) => {
            if (child.isMesh && child.geometry) {
                const originalPositions = this.originalVertices.get(child.uuid);
                if (originalPositions) {
                    const positions = child.geometry.attributes.position;
                    positions.array.set(originalPositions);
                    positions.needsUpdate = true;
                    child.geometry.computeVertexNormals();
                }
            }
        });
    }

    /**
     * Serialize to JSON
     * @returns {Object} JSON representation
     */
    toJSON() {
        return {
            damageZones: Object.fromEntries(
                Object.entries(this.damageZones).map(([k, v]) => [k, { damage: v.damage }])
            ),
            mechanicalDamage: this.mechanicalDamage,
            structuralIntegrity: this.structuralIntegrity,
            totalDamage: this.totalDamage,
            isTotaled: this.isTotaled,
            detachedComponents: Array.from(this.detachedComponents),
            components: Object.fromEntries(
                Object.entries(this.components).map(([k, v]) => [k, {
                    attached: v.attached,
                    damage: v.damage,
                    shattered: v.shattered ?? false
                }])
            )
        };
    }

    /**
     * Load state from JSON
     * @param {Object} json - JSON object
     */
    loadFromJSON(json) {
        if (json.damageZones) {
            for (const [zone, data] of Object.entries(json.damageZones)) {
                if (this.damageZones[zone]) {
                    this.damageZones[zone].damage = data.damage;
                }
            }
        }
        
        if (json.mechanicalDamage) {
            this.mechanicalDamage = { ...this.mechanicalDamage, ...json.mechanicalDamage };
        }
        
        if (json.structuralIntegrity !== undefined) {
            this.structuralIntegrity = json.structuralIntegrity;
        }
        
        if (json.totalDamage !== undefined) {
            this.totalDamage = json.totalDamage;
        }
        
        if (json.isTotaled !== undefined) {
            this.isTotaled = json.isTotaled;
        }
        
        if (json.detachedComponents) {
            this.detachedComponents = new Set(json.detachedComponents);
        }
        
        if (json.components) {
            for (const [name, data] of Object.entries(json.components)) {
                if (this.components[name]) {
                    this.components[name].attached = data.attached;
                    this.components[name].damage = data.damage;
                    this.components[name].shattered = data.shattered ?? false;
                }
            }
        }
    }
}

export default DamageSystem;
