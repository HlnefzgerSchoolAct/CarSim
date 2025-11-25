/**
 * MeshDeformer.js - Advanced Mesh Deformation System
 * 
 * Handles realistic vertex-based mesh deformation for collision damage.
 * Implements various deformation algorithms and preserves mesh integrity.
 * 
 * @module damage/MeshDeformer
 * @author CarSim Development Team
 * @version 2.0.0
 */

import { DEFORMATION_CONSTANTS } from '../core/Constants.js';
import { MathUtils } from '../utils/MathUtils.js';

/**
 * @class MeshDeformer
 * @description Advanced mesh deformation for crash damage visualization
 */
export class MeshDeformer {
    /**
     * Creates a new MeshDeformer instance
     * @param {THREE.Mesh|THREE.Group} mesh - The mesh to deform
     * @param {Object} [config] - Configuration options
     */
    constructor(mesh, config = {}) {
        /** @type {THREE.Mesh|THREE.Group} Target mesh */
        this.mesh = mesh;
        
        /** @type {number} Yield strength in Pascals */
        this.yieldStrength = config.yieldStrength ?? DEFORMATION_CONSTANTS.YIELD_STRENGTH;
        
        /** @type {number} Deformation resistance in N/m */
        this.deformationResistance = config.deformationResistance ?? DEFORMATION_CONSTANTS.DEFORMATION_RESISTANCE;
        
        /** @type {number} Maximum vertex displacement */
        this.maxDisplacement = config.maxDisplacement ?? DEFORMATION_CONSTANTS.MAX_VERTEX_DISPLACEMENT;
        
        /** @type {number} Energy absorption coefficient */
        this.energyAbsorption = config.energyAbsorption ?? DEFORMATION_CONSTANTS.ENERGY_ABSORPTION;
        
        /** @type {boolean} Preserve mesh volume during deformation */
        this.preserveVolume = config.preserveVolume ?? false;
        
        /** @type {boolean} Use smooth falloff for deformation */
        this.smoothFalloff = config.smoothFalloff ?? true;
        
        /** @type {number} Minimum face area before considering deleted */
        this.minFaceArea = config.minFaceArea ?? 0.001;
        
        // Internal state
        /** @type {Map<string, Float32Array>} Original vertex positions */
        this.originalPositions = new Map();
        
        /** @type {Map<string, Float32Array>} Current displacements */
        this.displacements = new Map();
        
        /** @type {Map<string, Array>} Vertex connectivity */
        this.vertexConnectivity = new Map();
        
        /** @type {Array} Deformation history */
        this.deformationHistory = [];
        
        /** @type {number} Maximum history entries */
        this.maxHistorySize = 50;
        
        /** @type {boolean} Is initialized */
        this.initialized = false;
        
        // Initialize if mesh is provided
        if (this.mesh) {
            this.initialize();
        }
    }

    /**
     * Initialize the deformer with mesh data
     */
    initialize() {
        if (this.initialized) return;
        
        this.processMesh(this.mesh);
        this.initialized = true;
    }

    /**
     * Process mesh or group and store original positions
     * @param {THREE.Object3D} object - Object to process
     */
    processMesh(object) {
        object.traverse((child) => {
            if (child.isMesh && child.geometry) {
                this.processSingleMesh(child);
            }
        });
    }

    /**
     * Process a single mesh
     * @param {THREE.Mesh} mesh - Mesh to process
     */
    processSingleMesh(mesh) {
        const geometry = mesh.geometry;
        const positions = geometry.attributes.position;
        
        if (!positions) return;
        
        // Store original positions
        const originalArray = new Float32Array(positions.array.length);
        originalArray.set(positions.array);
        this.originalPositions.set(mesh.uuid, originalArray);
        
        // Initialize displacement array
        const displacementArray = new Float32Array(positions.array.length);
        displacementArray.fill(0);
        this.displacements.set(mesh.uuid, displacementArray);
        
        // Build vertex connectivity
        this.buildVertexConnectivity(mesh);
    }

    /**
     * Build connectivity map for mesh vertices
     * @param {THREE.Mesh} mesh - Target mesh
     */
    buildVertexConnectivity(mesh) {
        const geometry = mesh.geometry;
        const positions = geometry.attributes.position;
        const index = geometry.index;
        
        const connectivity = [];
        for (let i = 0; i < positions.count; i++) {
            connectivity.push(new Set());
        }
        
        if (index) {
            // Indexed geometry
            const indices = index.array;
            for (let i = 0; i < indices.length; i += 3) {
                const a = indices[i];
                const b = indices[i + 1];
                const c = indices[i + 2];
                
                connectivity[a].add(b);
                connectivity[a].add(c);
                connectivity[b].add(a);
                connectivity[b].add(c);
                connectivity[c].add(a);
                connectivity[c].add(b);
            }
        } else {
            // Non-indexed (every 3 vertices form a triangle)
            for (let i = 0; i < positions.count; i += 3) {
                connectivity[i].add(i + 1);
                connectivity[i].add(i + 2);
                connectivity[i + 1].add(i);
                connectivity[i + 1].add(i + 2);
                connectivity[i + 2].add(i);
                connectivity[i + 2].add(i + 1);
            }
        }
        
        this.vertexConnectivity.set(mesh.uuid, connectivity);
    }

    /**
     * Deform mesh at impact point
     * @param {THREE.Vector3} impactPoint - World position of impact
     * @param {number} impactForce - Force of impact in Newtons
     * @param {THREE.Vector3} impactNormal - Direction of impact
     * @param {Object} [options] - Deformation options
     * @returns {Object} Deformation result
     */
    deform(impactPoint, impactForce, impactNormal, options = {}) {
        if (!this.initialized || !this.mesh) {
            return { success: false, error: 'Deformer not initialized' };
        }
        
        const result = {
            success: true,
            totalVerticesAffected: 0,
            maxDeformation: 0,
            energyAbsorbed: 0,
            meshesAffected: []
        };
        
        // Calculate deformation radius
        const radius = this.calculateDeformationRadius(impactForce, options);
        
        // Process each mesh in group
        this.mesh.traverse((child) => {
            if (child.isMesh && child.geometry) {
                const meshResult = this.deformSingleMesh(
                    child, impactPoint, impactForce, impactNormal, radius, options
                );
                
                if (meshResult.verticesAffected > 0) {
                    result.totalVerticesAffected += meshResult.verticesAffected;
                    result.maxDeformation = Math.max(result.maxDeformation, meshResult.maxDeformation);
                    result.energyAbsorbed += meshResult.energyAbsorbed;
                    result.meshesAffected.push(child.uuid);
                }
            }
        });
        
        // Store in history
        this.addToHistory({
            point: impactPoint.clone(),
            force: impactForce,
            normal: impactNormal.clone(),
            result
        });
        
        return result;
    }

    /**
     * Calculate deformation radius based on impact force
     * @param {number} force - Impact force
     * @param {Object} options - Additional options
     * @returns {number} Deformation radius
     */
    calculateDeformationRadius(force, options) {
        const baseRadius = Math.sqrt(force / this.deformationResistance);
        const radiusMultiplier = options.radiusMultiplier ?? 1.0;
        return baseRadius * radiusMultiplier;
    }

    /**
     * Deform a single mesh
     * @param {THREE.Mesh} mesh - Target mesh
     * @param {THREE.Vector3} impactPoint - Impact position
     * @param {number} impactForce - Impact force
     * @param {THREE.Vector3} impactNormal - Impact direction
     * @param {number} radius - Deformation radius
     * @param {Object} options - Deformation options
     * @returns {Object} Deformation result for this mesh
     */
    deformSingleMesh(mesh, impactPoint, impactForce, impactNormal, radius, options) {
        const geometry = mesh.geometry;
        const positions = geometry.attributes.position;
        const originalPositions = this.originalPositions.get(mesh.uuid);
        const displacements = this.displacements.get(mesh.uuid);
        
        if (!positions || !originalPositions || !displacements) {
            return { verticesAffected: 0, maxDeformation: 0, energyAbsorbed: 0 };
        }
        
        // Transform impact point to local space
        const localImpact = impactPoint.clone();
        mesh.worldToLocal(localImpact);
        
        // Transform normal to local space
        const normalMatrix = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
        const localNormal = impactNormal.clone().applyMatrix3(normalMatrix.invert()).normalize();
        
        let verticesAffected = 0;
        let maxDeformation = 0;
        let energyAbsorbed = 0;
        
        // Process each vertex
        for (let i = 0; i < positions.count; i++) {
            const x = positions.getX(i);
            const y = positions.getY(i);
            const z = positions.getZ(i);
            
            // Calculate distance to impact
            const dx = x - localImpact.x;
            const dy = y - localImpact.y;
            const dz = z - localImpact.z;
            const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
            
            if (distance < radius) {
                // Calculate falloff
                const falloff = this.calculateFalloff(distance, radius, options);
                
                // Calculate deformation amount
                const baseDeformation = (impactForce / this.yieldStrength) * falloff;
                
                // Apply directional scaling
                const dotProduct = (dx * localNormal.x + dy * localNormal.y + dz * localNormal.z) / (distance + 0.001);
                const directionalFactor = Math.max(0, 0.5 - dotProduct * 0.5);
                
                let deformAmount = baseDeformation * (0.3 + directionalFactor * 0.7);
                
                // Get current total displacement
                const currentDispX = displacements[i * 3];
                const currentDispY = displacements[i * 3 + 1];
                const currentDispZ = displacements[i * 3 + 2];
                const currentTotalDisp = Math.sqrt(
                    currentDispX * currentDispX +
                    currentDispY * currentDispY +
                    currentDispZ * currentDispZ
                );
                
                // Check if we can still deform
                if (currentTotalDisp < this.maxDisplacement) {
                    // Calculate remaining allowed displacement
                    const remainingDisp = this.maxDisplacement - currentTotalDisp;
                    deformAmount = Math.min(deformAmount, remainingDisp);
                    
                    // Calculate displacement vector
                    let dispX = -localNormal.x * deformAmount;
                    let dispY = -localNormal.y * deformAmount;
                    let dispZ = -localNormal.z * deformAmount;
                    
                    // Add some variation for realism
                    if (options.addNoise) {
                        const noise = MathUtils.randomGaussian(0, deformAmount * 0.1);
                        dispX += MathUtils.randomRange(-noise, noise);
                        dispY += MathUtils.randomRange(-noise, noise);
                        dispZ += MathUtils.randomRange(-noise, noise);
                    }
                    
                    // Update displacement tracking
                    displacements[i * 3] += dispX;
                    displacements[i * 3 + 1] += dispY;
                    displacements[i * 3 + 2] += dispZ;
                    
                    // Apply to vertex
                    const origX = originalPositions[i * 3];
                    const origY = originalPositions[i * 3 + 1];
                    const origZ = originalPositions[i * 3 + 2];
                    
                    positions.setXYZ(i,
                        origX + displacements[i * 3],
                        origY + displacements[i * 3 + 1],
                        origZ + displacements[i * 3 + 2]
                    );
                    
                    verticesAffected++;
                    maxDeformation = Math.max(maxDeformation, deformAmount);
                    energyAbsorbed += deformAmount * impactForce * this.energyAbsorption;
                }
            }
        }
        
        // Update geometry
        if (verticesAffected > 0) {
            positions.needsUpdate = true;
            geometry.computeVertexNormals();
            geometry.computeBoundingSphere();
            
            // Optional: propagate deformation to neighbors for smoothing
            if (options.propagate) {
                this.propagateDeformation(mesh, options.propagateIterations ?? 1);
            }
        }
        
        return { verticesAffected, maxDeformation, energyAbsorbed };
    }

    /**
     * Calculate falloff based on distance
     * @param {number} distance - Distance from impact
     * @param {number} radius - Total radius
     * @param {Object} options - Options
     * @returns {number} Falloff value (0-1)
     */
    calculateFalloff(distance, radius, options) {
        const normalized = distance / radius;
        
        if (this.smoothFalloff) {
            // Smooth cubic falloff
            return Math.pow(1 - normalized, 3);
        } else {
            // Linear falloff
            return 1 - normalized;
        }
    }

    /**
     * Propagate deformation to neighboring vertices for smoother results
     * @param {THREE.Mesh} mesh - Target mesh
     * @param {number} iterations - Number of smoothing iterations
     */
    propagateDeformation(mesh, iterations) {
        const positions = mesh.geometry.attributes.position;
        const connectivity = this.vertexConnectivity.get(mesh.uuid);
        const displacements = this.displacements.get(mesh.uuid);
        
        if (!connectivity || !displacements) return;
        
        for (let iter = 0; iter < iterations; iter++) {
            const newDisplacements = new Float32Array(displacements.length);
            newDisplacements.set(displacements);
            
            for (let i = 0; i < positions.count; i++) {
                const neighbors = connectivity[i];
                if (!neighbors || neighbors.size === 0) continue;
                
                // Average with neighbors
                let avgX = displacements[i * 3];
                let avgY = displacements[i * 3 + 1];
                let avgZ = displacements[i * 3 + 2];
                
                for (const neighborIdx of neighbors) {
                    avgX += displacements[neighborIdx * 3];
                    avgY += displacements[neighborIdx * 3 + 1];
                    avgZ += displacements[neighborIdx * 3 + 2];
                }
                
                const count = neighbors.size + 1;
                newDisplacements[i * 3] = avgX / count * 0.9 + displacements[i * 3] * 0.1;
                newDisplacements[i * 3 + 1] = avgY / count * 0.9 + displacements[i * 3 + 1] * 0.1;
                newDisplacements[i * 3 + 2] = avgZ / count * 0.9 + displacements[i * 3 + 2] * 0.1;
            }
            
            // Apply smoothed displacements
            for (let i = 0; i < positions.count; i++) {
                displacements[i * 3] = newDisplacements[i * 3];
                displacements[i * 3 + 1] = newDisplacements[i * 3 + 1];
                displacements[i * 3 + 2] = newDisplacements[i * 3 + 2];
                
                const originalPositions = this.originalPositions.get(mesh.uuid);
                positions.setXYZ(i,
                    originalPositions[i * 3] + displacements[i * 3],
                    originalPositions[i * 3 + 1] + displacements[i * 3 + 1],
                    originalPositions[i * 3 + 2] + displacements[i * 3 + 2]
                );
            }
            
            positions.needsUpdate = true;
        }
    }

    /**
     * Create crease/fold deformation
     * @param {THREE.Vector3} lineStart - Start of crease line
     * @param {THREE.Vector3} lineEnd - End of crease line
     * @param {number} depth - Crease depth
     * @param {number} width - Crease width
     */
    createCrease(lineStart, lineEnd, depth, width) {
        if (!this.mesh) return;
        
        this.mesh.traverse((child) => {
            if (!child.isMesh || !child.geometry) return;
            
            const positions = child.geometry.attributes.position;
            const originalPositions = this.originalPositions.get(child.uuid);
            const displacements = this.displacements.get(child.uuid);
            
            if (!positions || !originalPositions || !displacements) return;
            
            // Transform line to local space
            const localStart = lineStart.clone();
            const localEnd = lineEnd.clone();
            child.worldToLocal(localStart);
            child.worldToLocal(localEnd);
            
            const lineDir = new THREE.Vector3().subVectors(localEnd, localStart).normalize();
            const lineLength = localStart.distanceTo(localEnd);
            
            for (let i = 0; i < positions.count; i++) {
                const x = positions.getX(i);
                const y = positions.getY(i);
                const z = positions.getZ(i);
                
                // Project point onto line
                const pointToStart = new THREE.Vector3(
                    x - localStart.x,
                    y - localStart.y,
                    z - localStart.z
                );
                
                const t = MathUtils.clamp(pointToStart.dot(lineDir) / lineLength, 0, 1);
                const projPoint = localStart.clone().add(lineDir.clone().multiplyScalar(t * lineLength));
                
                const distToLine = Math.sqrt(
                    Math.pow(x - projPoint.x, 2) +
                    Math.pow(y - projPoint.y, 2) +
                    Math.pow(z - projPoint.z, 2)
                );
                
                if (distToLine < width) {
                    // Create V-shaped crease
                    const falloff = 1 - distToLine / width;
                    const deformY = -depth * falloff * falloff;
                    
                    const currentTotalDisp = Math.sqrt(
                        displacements[i * 3] ** 2 +
                        displacements[i * 3 + 1] ** 2 +
                        displacements[i * 3 + 2] ** 2
                    );
                    
                    if (currentTotalDisp + Math.abs(deformY) <= this.maxDisplacement) {
                        displacements[i * 3 + 1] += deformY;
                        positions.setY(i, originalPositions[i * 3 + 1] + displacements[i * 3 + 1]);
                    }
                }
            }
            
            positions.needsUpdate = true;
            child.geometry.computeVertexNormals();
        });
    }

    /**
     * Add deformation to history
     * @param {Object} entry - History entry
     */
    addToHistory(entry) {
        this.deformationHistory.push({
            ...entry,
            timestamp: Date.now()
        });
        
        // Trim history if too long
        while (this.deformationHistory.length > this.maxHistorySize) {
            this.deformationHistory.shift();
        }
    }

    /**
     * Get total deformation at a point
     * @param {THREE.Vector3} worldPoint - World position
     * @returns {number} Total displacement at point
     */
    getDeformationAt(worldPoint) {
        if (!this.mesh) return 0;
        
        let maxDeformation = 0;
        
        this.mesh.traverse((child) => {
            if (!child.isMesh || !child.geometry) return;
            
            const displacements = this.displacements.get(child.uuid);
            const positions = child.geometry.attributes.position;
            
            if (!displacements || !positions) return;
            
            const localPoint = worldPoint.clone();
            child.worldToLocal(localPoint);
            
            // Find nearest vertex
            let minDist = Infinity;
            let nearestIdx = -1;
            
            for (let i = 0; i < positions.count; i++) {
                const dist = MathUtils.distance3D(
                    localPoint.x, localPoint.y, localPoint.z,
                    positions.getX(i), positions.getY(i), positions.getZ(i)
                );
                
                if (dist < minDist) {
                    minDist = dist;
                    nearestIdx = i;
                }
            }
            
            if (nearestIdx >= 0) {
                const disp = Math.sqrt(
                    displacements[nearestIdx * 3] ** 2 +
                    displacements[nearestIdx * 3 + 1] ** 2 +
                    displacements[nearestIdx * 3 + 2] ** 2
                );
                maxDeformation = Math.max(maxDeformation, disp);
            }
        });
        
        return maxDeformation;
    }

    /**
     * Reset mesh to original state
     */
    reset() {
        if (!this.mesh) return;
        
        this.mesh.traverse((child) => {
            if (!child.isMesh || !child.geometry) return;
            
            const positions = child.geometry.attributes.position;
            const originalPositions = this.originalPositions.get(child.uuid);
            const displacements = this.displacements.get(child.uuid);
            
            if (!positions || !originalPositions || !displacements) return;
            
            // Reset positions
            positions.array.set(originalPositions);
            positions.needsUpdate = true;
            
            // Reset displacements
            displacements.fill(0);
            
            // Update geometry
            child.geometry.computeVertexNormals();
            child.geometry.computeBoundingSphere();
        });
        
        // Clear history
        this.deformationHistory = [];
    }

    /**
     * Get deformation statistics
     * @returns {Object} Deformation stats
     */
    getStats() {
        let totalVertices = 0;
        let deformedVertices = 0;
        let maxDisplacement = 0;
        let avgDisplacement = 0;
        let displacementSum = 0;
        
        this.mesh?.traverse((child) => {
            if (!child.isMesh || !child.geometry) return;
            
            const positions = child.geometry.attributes.position;
            const displacements = this.displacements.get(child.uuid);
            
            if (!positions || !displacements) return;
            
            for (let i = 0; i < positions.count; i++) {
                totalVertices++;
                
                const disp = Math.sqrt(
                    displacements[i * 3] ** 2 +
                    displacements[i * 3 + 1] ** 2 +
                    displacements[i * 3 + 2] ** 2
                );
                
                if (disp > 0.001) {
                    deformedVertices++;
                    displacementSum += disp;
                    maxDisplacement = Math.max(maxDisplacement, disp);
                }
            }
        });
        
        avgDisplacement = deformedVertices > 0 ? displacementSum / deformedVertices : 0;
        
        return {
            totalVertices,
            deformedVertices,
            deformationPercentage: (deformedVertices / totalVertices) * 100,
            maxDisplacement,
            avgDisplacement,
            historyEntries: this.deformationHistory.length
        };
    }

    /**
     * Serialize current deformation state
     * @returns {Object} Serialized state
     */
    serialize() {
        const meshStates = {};
        
        for (const [uuid, displacements] of this.displacements) {
            // Only store non-zero displacements
            const nonZeroIndices = [];
            const nonZeroValues = [];
            
            for (let i = 0; i < displacements.length; i += 3) {
                const dispMag = Math.sqrt(
                    displacements[i] ** 2 +
                    displacements[i + 1] ** 2 +
                    displacements[i + 2] ** 2
                );
                
                if (dispMag > 0.001) {
                    nonZeroIndices.push(i / 3);
                    nonZeroValues.push([
                        displacements[i],
                        displacements[i + 1],
                        displacements[i + 2]
                    ]);
                }
            }
            
            if (nonZeroIndices.length > 0) {
                meshStates[uuid] = {
                    indices: nonZeroIndices,
                    values: nonZeroValues
                };
            }
        }
        
        return {
            meshStates,
            history: this.deformationHistory.map(h => ({
                force: h.force,
                point: h.point.toArray(),
                normal: h.normal.toArray()
            }))
        };
    }

    /**
     * Deserialize and restore deformation state
     * @param {Object} data - Serialized data
     */
    deserialize(data) {
        if (!this.initialized) {
            console.warn('MeshDeformer not initialized, cannot deserialize');
            return;
        }
        
        for (const [uuid, state] of Object.entries(data.meshStates ?? {})) {
            const displacements = this.displacements.get(uuid);
            if (!displacements) continue;
            
            for (let i = 0; i < state.indices.length; i++) {
                const vertexIdx = state.indices[i];
                const values = state.values[i];
                
                displacements[vertexIdx * 3] = values[0];
                displacements[vertexIdx * 3 + 1] = values[1];
                displacements[vertexIdx * 3 + 2] = values[2];
            }
        }
        
        // Apply restored displacements to meshes
        this.mesh?.traverse((child) => {
            if (!child.isMesh || !child.geometry) return;
            
            const positions = child.geometry.attributes.position;
            const originalPositions = this.originalPositions.get(child.uuid);
            const displacements = this.displacements.get(child.uuid);
            
            if (!positions || !originalPositions || !displacements) return;
            
            for (let i = 0; i < positions.count; i++) {
                positions.setXYZ(i,
                    originalPositions[i * 3] + displacements[i * 3],
                    originalPositions[i * 3 + 1] + displacements[i * 3 + 1],
                    originalPositions[i * 3 + 2] + displacements[i * 3 + 2]
                );
            }
            
            positions.needsUpdate = true;
            child.geometry.computeVertexNormals();
        });
    }
}

export default MeshDeformer;
