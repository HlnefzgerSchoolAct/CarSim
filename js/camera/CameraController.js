/**
 * CameraController.js - Advanced Camera System
 * 
 * Provides multiple camera modes with smooth transitions,
 * dynamic behavior based on speed and events.
 * 
 * @module camera/CameraController
 * @author CarSim Development Team
 * @version 2.0.0
 */

import { CAMERA_CONSTANTS } from '../core/Constants.js';
import { MathUtils } from '../utils/MathUtils.js';

/**
 * @typedef {'CHASE'|'HOOD'|'BUMPER'|'COCKPIT'|'FREE'|'CINEMATIC'} CameraMode
 */

/**
 * @class CameraController
 * @description Advanced camera system with multiple modes
 */
export class CameraController {
    /**
     * Creates a new CameraController
     * @param {THREE.PerspectiveCamera} camera - Three.js camera
     * @param {THREE.Object3D} target - Target object to follow
     * @param {Object} [config] - Configuration options
     */
    constructor(camera, target, config = {}) {
        /** @type {THREE.PerspectiveCamera} Camera instance */
        this.camera = camera;
        
        /** @type {THREE.Object3D} Target to follow */
        this.target = target;
        
        /** @type {CameraMode} Current camera mode */
        this.mode = config.initialMode ?? 'CHASE';
        
        /** @type {Array<CameraMode>} Available modes */
        this.modes = CAMERA_CONSTANTS.MODES;
        
        /** @type {number} Current mode index */
        this.modeIndex = this.modes.indexOf(this.mode);
        
        // Camera offsets for each mode
        this.offsets = {
            CHASE: new THREE.Vector3(
                CAMERA_CONSTANTS.CHASE_OFFSET.x,
                CAMERA_CONSTANTS.CHASE_OFFSET.y,
                CAMERA_CONSTANTS.CHASE_OFFSET.z
            ),
            HOOD: new THREE.Vector3(
                CAMERA_CONSTANTS.HOOD_OFFSET.x,
                CAMERA_CONSTANTS.HOOD_OFFSET.y,
                CAMERA_CONSTANTS.HOOD_OFFSET.z
            ),
            BUMPER: new THREE.Vector3(
                CAMERA_CONSTANTS.BUMPER_OFFSET.x,
                CAMERA_CONSTANTS.BUMPER_OFFSET.y,
                CAMERA_CONSTANTS.BUMPER_OFFSET.z
            ),
            COCKPIT: new THREE.Vector3(
                CAMERA_CONSTANTS.COCKPIT_OFFSET.x,
                CAMERA_CONSTANTS.COCKPIT_OFFSET.y,
                CAMERA_CONSTANTS.COCKPIT_OFFSET.z
            ),
            FREE: new THREE.Vector3(0, 10, -20),
            CINEMATIC: new THREE.Vector3(10, 5, 10)
        };
        
        // Look offsets
        this.lookOffsets = {
            CHASE: new THREE.Vector3(
                CAMERA_CONSTANTS.CHASE_LOOK_OFFSET.x,
                CAMERA_CONSTANTS.CHASE_LOOK_OFFSET.y,
                CAMERA_CONSTANTS.CHASE_LOOK_OFFSET.z
            ),
            HOOD: new THREE.Vector3(0, 1, 10),
            BUMPER: new THREE.Vector3(0, 0.5, 10),
            COCKPIT: new THREE.Vector3(0, 1, 5),
            FREE: new THREE.Vector3(0, 0, 0),
            CINEMATIC: new THREE.Vector3(0, 0, 0)
        };
        
        // Current state
        /** @type {THREE.Vector3} Current camera position */
        this.currentPosition = new THREE.Vector3();
        
        /** @type {THREE.Vector3} Current look target */
        this.currentLookAt = new THREE.Vector3();
        
        /** @type {number} Current FOV */
        this.currentFOV = CAMERA_CONSTANTS.BASE_FOV;
        
        /** @type {number} Target FOV */
        this.targetFOV = CAMERA_CONSTANTS.BASE_FOV;
        
        // Smoothing
        /** @type {number} Position smoothing factor */
        this.positionSmoothing = config.positionSmoothing ?? CAMERA_CONSTANTS.SMOOTHING_FACTOR;
        
        /** @type {number} Rotation smoothing factor */
        this.rotationSmoothing = config.rotationSmoothing ?? CAMERA_CONSTANTS.SMOOTHING_FACTOR;
        
        // Camera shake
        /** @type {THREE.Vector3} Current shake offset */
        this.shakeOffset = new THREE.Vector3();
        
        /** @type {number} Current shake intensity */
        this.shakeIntensity = 0;
        
        /** @type {number} Shake decay rate */
        this.shakeDecay = config.shakeDecay ?? CAMERA_CONSTANTS.SHAKE_DECAY;
        
        // Speed effects
        /** @type {number} Speed-based FOV multiplier */
        this.speedFOVMultiplier = config.speedFOVMultiplier ?? CAMERA_CONSTANTS.SPEED_FOV_MULTIPLIER;
        
        /** @type {number} Current vehicle speed */
        this.currentSpeed = 0;
        
        // Free camera controls
        this.freeCamera = {
            phi: 0,      // Horizontal rotation
            theta: 0.5,  // Vertical rotation (0.5 = looking forward)
            distance: 20,
            target: new THREE.Vector3()
        };
        
        // Cinematic camera
        this.cinematic = {
            timer: 0,
            angle: 0,
            distance: 15,
            height: 5,
            transitionTime: CAMERA_CONSTANTS.CINEMATIC_TRANSITION_TIME,
            autoSwitch: true
        };
        
        // Transition
        this.isTransitioning = false;
        this.transitionProgress = 0;
        this.transitionDuration = 0.5;
        this.transitionStartPos = new THREE.Vector3();
        this.transitionStartLook = new THREE.Vector3();
        
        // Initialize camera position
        if (this.target) {
            this.currentPosition.copy(this.target.position).add(this.offsets[this.mode]);
            this.currentLookAt.copy(this.target.position);
        }
    }

    /**
     * Update camera
     * @param {number} deltaTime - Time step in seconds
     * @param {Object} [vehicleState] - Vehicle state (speed, heading, etc.)
     */
    update(deltaTime, vehicleState = {}) {
        if (!this.target) return;
        
        // Update speed for effects
        this.currentSpeed = vehicleState.speed ?? 0;
        
        // Handle transition
        if (this.isTransitioning) {
            this.updateTransition(deltaTime);
        }
        
        // Update based on mode
        switch (this.mode) {
            case 'CHASE':
                this.updateChaseCamera(deltaTime, vehicleState);
                break;
            case 'HOOD':
            case 'BUMPER':
            case 'COCKPIT':
                this.updateAttachedCamera(deltaTime, vehicleState);
                break;
            case 'FREE':
                this.updateFreeCamera(deltaTime);
                break;
            case 'CINEMATIC':
                this.updateCinematicCamera(deltaTime);
                break;
        }
        
        // Update shake
        this.updateShake(deltaTime);
        
        // Update FOV based on speed
        this.updateFOV(deltaTime);
        
        // Apply final position and rotation
        this.applyCamera();
    }

    /**
     * Update chase camera
     * @param {number} deltaTime - Time step
     * @param {Object} vehicleState - Vehicle state
     */
    updateChaseCamera(deltaTime, vehicleState) {
        const targetPos = this.target.position.clone();
        const targetRot = this.target.quaternion.clone();
        
        // Calculate ideal camera position
        const offset = this.offsets.CHASE.clone();
        
        // Adjust offset based on speed (pull back at high speed)
        const speedFactor = Math.abs(this.currentSpeed) / 50;
        offset.z -= speedFactor * 3;
        offset.y += speedFactor * 0.5;
        
        // Apply target rotation to offset
        offset.applyQuaternion(targetRot);
        
        const idealPosition = targetPos.clone().add(offset);
        
        // Smooth position
        this.currentPosition.lerp(idealPosition, this.positionSmoothing);
        
        // Calculate look target
        const lookOffset = this.lookOffsets.CHASE.clone();
        lookOffset.applyQuaternion(targetRot);
        const idealLookAt = targetPos.clone().add(lookOffset);
        
        // Smooth look target
        this.currentLookAt.lerp(idealLookAt, this.rotationSmoothing);
    }

    /**
     * Update attached camera (hood, bumper, cockpit)
     * @param {number} deltaTime - Time step
     * @param {Object} vehicleState - Vehicle state
     */
    updateAttachedCamera(deltaTime, vehicleState) {
        const targetPos = this.target.position.clone();
        const targetRot = this.target.quaternion.clone();
        
        // Get offset for current mode
        const offset = this.offsets[this.mode].clone();
        
        // Apply target rotation to offset
        offset.applyQuaternion(targetRot);
        
        // Direct attachment (less smoothing for cockpit feel)
        const smoothFactor = this.mode === 'COCKPIT' ? 0.2 : 0.15;
        
        const idealPosition = targetPos.clone().add(offset);
        this.currentPosition.lerp(idealPosition, smoothFactor);
        
        // Look target
        const lookOffset = this.lookOffsets[this.mode].clone();
        lookOffset.applyQuaternion(targetRot);
        const idealLookAt = targetPos.clone().add(lookOffset);
        
        this.currentLookAt.lerp(idealLookAt, smoothFactor);
    }

    /**
     * Update free camera
     * @param {number} deltaTime - Time step
     */
    updateFreeCamera(deltaTime) {
        // Free camera orbits around target
        this.freeCamera.target.copy(this.target.position);
        
        // Calculate position from spherical coordinates
        const x = this.freeCamera.distance * Math.sin(this.freeCamera.theta) * Math.cos(this.freeCamera.phi);
        const y = this.freeCamera.distance * Math.cos(this.freeCamera.theta);
        const z = this.freeCamera.distance * Math.sin(this.freeCamera.theta) * Math.sin(this.freeCamera.phi);
        
        const idealPosition = this.freeCamera.target.clone().add(new THREE.Vector3(x, y, z));
        
        this.currentPosition.lerp(idealPosition, 0.1);
        this.currentLookAt.lerp(this.freeCamera.target, 0.1);
    }

    /**
     * Update cinematic camera
     * @param {number} deltaTime - Time step
     */
    updateCinematicCamera(deltaTime) {
        this.cinematic.timer += deltaTime;
        
        // Auto-switch camera angle periodically
        if (this.cinematic.autoSwitch && this.cinematic.timer > this.cinematic.transitionTime) {
            this.cinematic.timer = 0;
            this.cinematic.angle = MathUtils.randomRange(0, Math.PI * 2);
            this.cinematic.distance = MathUtils.randomRange(
                CAMERA_CONSTANTS.CINEMATIC_DISTANCE_RANGE[0],
                CAMERA_CONSTANTS.CINEMATIC_DISTANCE_RANGE[1]
            );
            this.cinematic.height = MathUtils.randomRange(
                CAMERA_CONSTANTS.CINEMATIC_HEIGHT_RANGE[0],
                CAMERA_CONSTANTS.CINEMATIC_HEIGHT_RANGE[1]
            );
        }
        
        // Slowly orbit
        this.cinematic.angle += deltaTime * 0.1;
        
        // Calculate position
        const x = this.cinematic.distance * Math.cos(this.cinematic.angle);
        const z = this.cinematic.distance * Math.sin(this.cinematic.angle);
        
        const targetPos = this.target.position.clone();
        const idealPosition = targetPos.clone().add(new THREE.Vector3(x, this.cinematic.height, z));
        
        this.currentPosition.lerp(idealPosition, 0.02);
        this.currentLookAt.lerp(targetPos, 0.05);
    }

    /**
     * Update transition between modes
     * @param {number} deltaTime - Time step
     */
    updateTransition(deltaTime) {
        this.transitionProgress += deltaTime / this.transitionDuration;
        
        if (this.transitionProgress >= 1) {
            this.transitionProgress = 1;
            this.isTransitioning = false;
        }
        
        // Smooth step for nice transition
        const t = MathUtils.smoothstep(0, 1, this.transitionProgress);
        
        // Interpolate position and look target
        // (handled by normal update with high smoothing during transition)
    }

    /**
     * Update camera shake
     * @param {number} deltaTime - Time step
     */
    updateShake(deltaTime) {
        if (this.shakeIntensity > 0.001) {
            // Random shake offset
            this.shakeOffset.set(
                MathUtils.randomRange(-1, 1) * this.shakeIntensity,
                MathUtils.randomRange(-1, 1) * this.shakeIntensity,
                MathUtils.randomRange(-1, 1) * this.shakeIntensity * 0.5
            );
            
            // Decay shake
            this.shakeIntensity *= Math.exp(-this.shakeDecay * deltaTime);
        } else {
            this.shakeOffset.set(0, 0, 0);
            this.shakeIntensity = 0;
        }
    }

    /**
     * Update FOV based on speed
     * @param {number} deltaTime - Time step
     */
    updateFOV(deltaTime) {
        // Calculate target FOV based on speed
        const speedKmh = Math.abs(this.currentSpeed) * 3.6;
        const fovIncrease = speedKmh * this.speedFOVMultiplier;
        
        this.targetFOV = MathUtils.clamp(
            CAMERA_CONSTANTS.BASE_FOV + fovIncrease,
            CAMERA_CONSTANTS.BASE_FOV,
            CAMERA_CONSTANTS.MAX_FOV
        );
        
        // Smooth FOV change
        this.currentFOV = MathUtils.lerp(this.currentFOV, this.targetFOV, 0.05);
        
        // Apply to camera
        this.camera.fov = this.currentFOV;
        this.camera.updateProjectionMatrix();
    }

    /**
     * Apply camera position and rotation
     */
    applyCamera() {
        // Apply shake offset
        const finalPosition = this.currentPosition.clone().add(this.shakeOffset);
        
        // Set camera position
        this.camera.position.copy(finalPosition);
        
        // Look at target
        this.camera.lookAt(this.currentLookAt);
    }

    /**
     * Add camera shake
     * @param {number} intensity - Shake intensity
     */
    addShake(intensity) {
        const maxShake = CAMERA_CONSTANTS.MAX_SHAKE_INTENSITY;
        this.shakeIntensity = Math.min(this.shakeIntensity + intensity, maxShake);
    }

    /**
     * Switch to next camera mode
     */
    nextMode() {
        this.modeIndex = (this.modeIndex + 1) % this.modes.length;
        this.setMode(this.modes[this.modeIndex]);
    }

    /**
     * Switch to previous camera mode
     */
    previousMode() {
        this.modeIndex = (this.modeIndex - 1 + this.modes.length) % this.modes.length;
        this.setMode(this.modes[this.modeIndex]);
    }

    /**
     * Set camera mode
     * @param {CameraMode} mode - New camera mode
     */
    setMode(mode) {
        if (!this.modes.includes(mode)) {
            console.warn(`Unknown camera mode: ${mode}`);
            return;
        }
        
        // Start transition
        this.isTransitioning = true;
        this.transitionProgress = 0;
        this.transitionStartPos.copy(this.currentPosition);
        this.transitionStartLook.copy(this.currentLookAt);
        
        this.mode = mode;
        this.modeIndex = this.modes.indexOf(mode);
    }

    /**
     * Handle free camera input
     * @param {number} deltaX - Mouse/input X movement
     * @param {number} deltaY - Mouse/input Y movement
     */
    handleFreeCameraInput(deltaX, deltaY) {
        if (this.mode !== 'FREE') return;
        
        this.freeCamera.phi -= deltaX * 0.01;
        this.freeCamera.theta = MathUtils.clamp(
            this.freeCamera.theta - deltaY * 0.01,
            0.1,
            Math.PI - 0.1
        );
    }

    /**
     * Handle free camera zoom
     * @param {number} delta - Zoom delta
     */
    handleFreeCameraZoom(delta) {
        if (this.mode !== 'FREE') return;
        
        this.freeCamera.distance = MathUtils.clamp(
            this.freeCamera.distance - delta,
            5,
            50
        );
    }

    /**
     * Get current camera state
     * @returns {Object} Camera state
     */
    getState() {
        return {
            mode: this.mode,
            position: this.camera.position.clone(),
            lookAt: this.currentLookAt.clone(),
            fov: this.currentFOV,
            shakeIntensity: this.shakeIntensity,
            isTransitioning: this.isTransitioning
        };
    }

    /**
     * Set target object
     * @param {THREE.Object3D} target - New target
     */
    setTarget(target) {
        this.target = target;
    }

    /**
     * Reset camera to default
     */
    reset() {
        this.mode = 'CHASE';
        this.modeIndex = 0;
        this.shakeIntensity = 0;
        this.shakeOffset.set(0, 0, 0);
        this.currentFOV = CAMERA_CONSTANTS.BASE_FOV;
        this.isTransitioning = false;
        
        if (this.target) {
            this.currentPosition.copy(this.target.position).add(this.offsets.CHASE);
            this.currentLookAt.copy(this.target.position);
        }
    }
}

export default CameraController;
