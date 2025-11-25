/**
 * TireMarks.js - Tire Mark System
 * 
 * Creates and manages tire marks on the ground during drifting,
 * burnouts, and hard braking.
 * 
 * @module drift/TireMarks
 * @author CarSim Development Team
 * @version 2.0.0
 */

import { MathUtils } from '../utils/MathUtils.js';

/**
 * @class TireMarks
 * @description Manages tire mark rendering and lifecycle
 */
export class TireMarks {
    /**
     * Creates a new TireMarks system
     * @param {THREE.Scene} scene - Three.js scene
     * @param {Object} [config] - Configuration options
     */
    constructor(scene, config = {}) {
        /** @type {THREE.Scene} Scene reference */
        this.scene = scene;
        
        // Configuration
        /** @type {number} Maximum number of tire marks */
        this.maxMarks = config.maxMarks ?? 1000;
        
        /** @type {number} Mark width in meters */
        this.markWidth = config.markWidth ?? 0.15;
        
        /** @type {number} Mark segment length in meters */
        this.segmentLength = config.segmentLength ?? 0.3;
        
        /** @type {number} Minimum distance between marks in meters */
        this.minDistance = config.minDistance ?? 0.1;
        
        /** @type {number} Fade duration in seconds */
        this.fadeDuration = config.fadeDuration ?? 30;
        
        /** @type {number} Minimum slip for marks */
        this.minSlipForMarks = config.minSlipForMarks ?? 0.1;
        
        // Mark storage
        /** @type {Array} Active tire marks */
        this.marks = [];
        
        /** @type {Map} Last positions per wheel */
        this.lastPositions = new Map();
        
        // Materials
        this.createMaterials();
        
        // Geometry pooling
        /** @type {THREE.BufferGeometry} Shared plane geometry */
        this.markGeometry = new THREE.PlaneGeometry(this.markWidth, this.segmentLength);
        this.markGeometry.rotateX(-Math.PI / 2);
        
        // Statistics
        this.totalMarksCreated = 0;
        this.activeMarks = 0;
    }

    /**
     * Create materials for tire marks
     */
    createMaterials() {
        // Standard tire mark material
        this.standardMaterial = new THREE.MeshBasicMaterial({
            color: 0x111111,
            transparent: true,
            opacity: 0.7,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        
        // Burnout mark material (darker)
        this.burnoutMaterial = new THREE.MeshBasicMaterial({
            color: 0x050505,
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        
        // Wet mark material (lighter)
        this.wetMaterial = new THREE.MeshBasicMaterial({
            color: 0x333333,
            transparent: true,
            opacity: 0.5,
            side: THREE.DoubleSide,
            depthWrite: false
        });
    }

    /**
     * Update tire marks
     * @param {number} deltaTime - Time step
     * @param {Array} wheelStates - Array of wheel states with positions and slip
     */
    update(deltaTime, wheelStates) {
        // Add new marks
        for (const wheelState of wheelStates) {
            this.processWheelMark(wheelState);
        }
        
        // Fade and remove old marks
        this.fadeMarks(deltaTime);
        
        // Enforce max marks
        this.enforceMaxMarks();
        
        this.activeMarks = this.marks.length;
    }

    /**
     * Process a wheel for potential mark creation
     * @param {Object} wheelState - Wheel state with position, slip, etc.
     */
    processWheelMark(wheelState) {
        const { 
            position, 
            slipRatio = 0, 
            slipAngle = 0, 
            onGround = true,
            id = 'unknown'
        } = wheelState;
        
        if (!onGround) return;
        
        // Calculate total slip
        const totalSlip = Math.sqrt(slipRatio * slipRatio + slipAngle * slipAngle);
        
        if (totalSlip < this.minSlipForMarks) return;
        
        // Check distance from last mark
        const lastPos = this.lastPositions.get(id);
        if (lastPos) {
            const distance = position.distanceTo(lastPos);
            if (distance < this.minDistance) return;
        }
        
        // Create new mark
        this.createMark(position, wheelState, totalSlip);
        
        // Update last position
        this.lastPositions.set(id, position.clone());
    }

    /**
     * Create a tire mark at position
     * @param {THREE.Vector3} position - World position
     * @param {Object} wheelState - Wheel state
     * @param {number} slipIntensity - Slip intensity
     */
    createMark(position, wheelState, slipIntensity) {
        // Choose material based on conditions
        let material;
        if (slipIntensity > 0.8) {
            material = this.burnoutMaterial.clone();
        } else if (wheelState.surfaceType === 'wet') {
            material = this.wetMaterial.clone();
        } else {
            material = this.standardMaterial.clone();
        }
        
        // Set initial opacity based on slip intensity
        material.opacity = MathUtils.remap(slipIntensity, this.minSlipForMarks, 1, 0.3, 0.8);
        
        // Create mesh
        const mesh = new THREE.Mesh(this.markGeometry, material);
        mesh.position.copy(position);
        mesh.position.y = 0.01; // Slightly above ground
        
        // Rotate to match wheel direction
        if (wheelState.heading !== undefined) {
            mesh.rotation.z = wheelState.heading;
        }
        
        // Add some random rotation for realism
        mesh.rotation.z += MathUtils.randomRange(-0.1, 0.1);
        
        // Store mark data
        const mark = {
            mesh,
            material,
            age: 0,
            initialOpacity: material.opacity,
            slipIntensity
        };
        
        this.marks.push(mark);
        this.scene.add(mesh);
        this.totalMarksCreated++;
    }

    /**
     * Fade and remove old marks
     * @param {number} deltaTime - Time step
     */
    fadeMarks(deltaTime) {
        for (let i = this.marks.length - 1; i >= 0; i--) {
            const mark = this.marks[i];
            mark.age += deltaTime;
            
            // Calculate fade
            const fadeProgress = mark.age / this.fadeDuration;
            
            if (fadeProgress >= 1) {
                // Remove mark
                this.removeMark(i);
            } else {
                // Update opacity
                mark.material.opacity = mark.initialOpacity * (1 - fadeProgress);
            }
        }
    }

    /**
     * Remove a mark at index
     * @param {number} index - Mark index
     */
    removeMark(index) {
        const mark = this.marks[index];
        
        // Remove from scene
        this.scene.remove(mark.mesh);
        
        // Dispose geometry and material
        mark.material.dispose();
        
        // Remove from array
        this.marks.splice(index, 1);
    }

    /**
     * Enforce maximum mark count
     */
    enforceMaxMarks() {
        while (this.marks.length > this.maxMarks) {
            this.removeMark(0); // Remove oldest
        }
    }

    /**
     * Add marks for all wheels at once (batch operation)
     * @param {Array<THREE.Vector3>} positions - Wheel positions
     * @param {number} slipIntensity - Combined slip intensity
     * @param {number} heading - Vehicle heading
     */
    addWheelMarks(positions, slipIntensity, heading) {
        if (slipIntensity < this.minSlipForMarks) return;
        
        for (let i = 0; i < positions.length; i++) {
            const wheelState = {
                position: positions[i],
                slipRatio: slipIntensity,
                slipAngle: slipIntensity,
                heading: heading,
                onGround: true,
                id: `wheel_${i}`
            };
            
            this.processWheelMark(wheelState);
        }
    }

    /**
     * Clear all tire marks
     */
    clear() {
        for (let i = this.marks.length - 1; i >= 0; i--) {
            this.removeMark(i);
        }
        this.lastPositions.clear();
    }

    /**
     * Get statistics
     * @returns {Object} Statistics
     */
    getStats() {
        return {
            activeMarks: this.activeMarks,
            totalMarksCreated: this.totalMarksCreated,
            maxMarks: this.maxMarks
        };
    }

    /**
     * Serialize mark positions (for replay)
     * @returns {Array} Mark data
     */
    serialize() {
        return this.marks.map(mark => ({
            position: mark.mesh.position.toArray(),
            rotation: mark.mesh.rotation.z,
            opacity: mark.material.opacity,
            age: mark.age
        }));
    }

    /**
     * Restore marks from serialized data
     * @param {Array} data - Serialized mark data
     */
    deserialize(data) {
        this.clear();
        
        for (const markData of data) {
            const material = this.standardMaterial.clone();
            material.opacity = markData.opacity;
            
            const mesh = new THREE.Mesh(this.markGeometry, material);
            mesh.position.fromArray(markData.position);
            mesh.rotation.z = markData.rotation;
            
            const mark = {
                mesh,
                material,
                age: markData.age,
                initialOpacity: markData.opacity * (1 + markData.age / this.fadeDuration),
                slipIntensity: 0.5
            };
            
            this.marks.push(mark);
            this.scene.add(mesh);
        }
    }

    /**
     * Dispose of all resources
     */
    dispose() {
        this.clear();
        this.markGeometry.dispose();
        this.standardMaterial.dispose();
        this.burnoutMaterial.dispose();
        this.wetMaterial.dispose();
    }
}

export default TireMarks;
