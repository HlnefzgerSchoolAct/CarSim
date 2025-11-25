/**
 * Input Controls Handler
 * Manages keyboard input for the car simulator
 * Supports multiple input methods and action callbacks
 */
class InputControls {
    constructor() {
        // Key states
        this.keys = {
            forward: false,
            backward: false,
            left: false,
            right: false,
            handbrake: false,
            reset: false,
            cameraChange: false,
            pause: false,
            debug: false
        };

        // Action callbacks
        this.callbacks = {
            onReset: null,
            onCameraChange: null,
            onPause: null,
            onDebugToggle: null
        };

        // Analog input values (for smoother steering)
        this.steeringInput = 0;
        this.throttleInput = 0;
        this.brakeInput = 0;

        // Input smoothing
        this.steeringSmoothness = 8;
        this.throttleSmoothness = 10;
        this.brakeSmoothness = 15;

        // Touch controls state (for mobile)
        this.touchControls = {
            left: null,
            right: null,
            accelerator: null,
            brake: null
        };

        this.setupEventListeners();
    }

    setupEventListeners() {
        // Keyboard events
        document.addEventListener('keydown', (e) => this.onKeyDown(e));
        document.addEventListener('keyup', (e) => this.onKeyUp(e));
        
        // Prevent default for game keys
        document.addEventListener('keydown', (e) => {
            if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
                e.preventDefault();
            }
        });

        // Blur handling - reset keys when window loses focus
        window.addEventListener('blur', () => this.resetAllKeys());
    }

    onKeyDown(event) {
        const changed = this.updateKey(event.code, true);
        
        // Handle single-press actions
        if (changed) {
            switch (event.code) {
                case 'KeyR':
                    if (this.callbacks.onReset) this.callbacks.onReset();
                    break;
                case 'KeyC':
                    if (this.callbacks.onCameraChange) this.callbacks.onCameraChange();
                    break;
                case 'KeyP':
                case 'Escape':
                    if (this.callbacks.onPause) this.callbacks.onPause();
                    break;
                case 'F3':
                    if (this.callbacks.onDebugToggle) this.callbacks.onDebugToggle();
                    event.preventDefault();
                    break;
            }
        }
    }

    onKeyUp(event) {
        this.updateKey(event.code, false);
    }

    updateKey(code, isPressed) {
        let changed = false;
        
        switch (code) {
            case 'KeyW':
            case 'ArrowUp':
                changed = this.keys.forward !== isPressed;
                this.keys.forward = isPressed;
                break;
            case 'KeyS':
            case 'ArrowDown':
                changed = this.keys.backward !== isPressed;
                this.keys.backward = isPressed;
                break;
            case 'KeyA':
            case 'ArrowLeft':
                changed = this.keys.left !== isPressed;
                this.keys.left = isPressed;
                break;
            case 'KeyD':
            case 'ArrowRight':
                changed = this.keys.right !== isPressed;
                this.keys.right = isPressed;
                break;
            case 'Space':
                changed = this.keys.handbrake !== isPressed;
                this.keys.handbrake = isPressed;
                break;
            case 'KeyR':
                changed = this.keys.reset !== isPressed;
                this.keys.reset = isPressed;
                break;
            case 'KeyC':
                changed = this.keys.cameraChange !== isPressed;
                this.keys.cameraChange = isPressed;
                break;
            case 'KeyP':
            case 'Escape':
                changed = this.keys.pause !== isPressed;
                this.keys.pause = isPressed;
                break;
            case 'F3':
                changed = this.keys.debug !== isPressed;
                this.keys.debug = isPressed;
                break;
        }
        
        return changed;
    }

    resetAllKeys() {
        for (const key in this.keys) {
            this.keys[key] = false;
        }
        this.steeringInput = 0;
        this.throttleInput = 0;
        this.brakeInput = 0;
    }

    /**
     * Update smooth analog inputs based on digital key states
     * Call this every frame for smooth input response
     */
    update(deltaTime) {
        // Target values from keys
        const targetSteering = (this.keys.left ? -1 : 0) + (this.keys.right ? 1 : 0);
        const targetThrottle = this.keys.forward ? 1 : 0;
        const targetBrake = this.keys.backward ? 1 : 0;

        // Smooth interpolation
        this.steeringInput = this.lerp(
            this.steeringInput,
            targetSteering,
            this.steeringSmoothness * deltaTime
        );
        
        this.throttleInput = this.lerp(
            this.throttleInput,
            targetThrottle,
            this.throttleSmoothness * deltaTime
        );
        
        this.brakeInput = this.lerp(
            this.brakeInput,
            targetBrake,
            this.brakeSmoothness * deltaTime
        );

        // Snap to zero if very close
        if (Math.abs(this.steeringInput) < 0.01) this.steeringInput = 0;
        if (Math.abs(this.throttleInput) < 0.01) this.throttleInput = 0;
        if (Math.abs(this.brakeInput) < 0.01) this.brakeInput = 0;
    }

    lerp(current, target, factor) {
        return current + (target - current) * Math.min(1, factor);
    }

    // Register callbacks
    onReset(callback) {
        this.callbacks.onReset = callback;
    }

    onCameraChange(callback) {
        this.callbacks.onCameraChange = callback;
    }

    onPause(callback) {
        this.callbacks.onPause = callback;
    }

    onDebugToggle(callback) {
        this.callbacks.onDebugToggle = callback;
    }

    // Getters for direct key states
    get isAccelerating() {
        return this.keys.forward;
    }

    get isBraking() {
        return this.keys.backward;
    }

    get isSteeringLeft() {
        return this.keys.left;
    }

    get isSteeringRight() {
        return this.keys.right;
    }

    get isHandbrake() {
        return this.keys.handbrake;
    }

    // Getters for smooth analog values
    get steering() {
        return this.steeringInput;
    }

    get throttle() {
        return this.throttleInput;
    }

    get brake() {
        return this.brakeInput;
    }

    /**
     * Get current input state summary for debugging
     */
    getDebugInfo() {
        return {
            steering: this.steeringInput.toFixed(2),
            throttle: this.throttleInput.toFixed(2),
            brake: this.brakeInput.toFixed(2),
            handbrake: this.keys.handbrake
        };
    }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.InputControls = InputControls;
}