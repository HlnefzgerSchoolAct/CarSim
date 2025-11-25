/**
 * Input Controls Handler
 * Manages keyboard input for the car simulator
 */
class InputControls {
    constructor() {
        this.keys = {
            forward: false,
            backward: false,
            left: false,
            right: false,
            brake: false,
            reset: false,
            cameraToggle: false
        };
        
        // Camera toggle state (triggered once per press)
        this.cameraSwitchPressed = false;
        this.resetPressed = false;

        this.setupEventListeners();
    }

    setupEventListeners() {
        document.addEventListener('keydown', (e) => this.onKeyDown(e));
        document.addEventListener('keyup', (e) => this.onKeyUp(e));
    }

    onKeyDown(event) {
        this.updateKey(event.code, true);
    }

    onKeyUp(event) {
        this.updateKey(event.code, false);
    }

    updateKey(code, isPressed) {
        switch (code) {
            case 'KeyW':
            case 'ArrowUp':
                this.keys.forward = isPressed;
                break;
            case 'KeyS':
            case 'ArrowDown':
                this.keys.backward = isPressed;
                break;
            case 'KeyA':
            case 'ArrowLeft':
                this.keys.left = isPressed;
                break;
            case 'KeyD':
            case 'ArrowRight':
                this.keys.right = isPressed;
                break;
            case 'Space':
                this.keys.brake = isPressed;
                break;
            case 'KeyR':
                this.keys.reset = isPressed;
                break;
            case 'KeyC':
                this.keys.cameraToggle = isPressed;
                break;
        }
    }

    // Getters for cleaner access
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
        return this.keys.brake;
    }
    
    get shouldReset() {
        // Trigger only once per press
        if (this.keys.reset && !this.resetPressed) {
            this.resetPressed = true;
            return true;
        }
        if (!this.keys.reset) {
            this.resetPressed = false;
        }
        return false;
    }
    
    get shouldToggleCamera() {
        // Trigger only once per press
        if (this.keys.cameraToggle && !this.cameraSwitchPressed) {
            this.cameraSwitchPressed = true;
            return true;
        }
        if (!this.keys.cameraToggle) {
            this.cameraSwitchPressed = false;
        }
        return false;
    }
}