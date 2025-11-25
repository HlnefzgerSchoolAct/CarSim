/**
 * InputManager.js - Enhanced Input Handling
 * @module input/InputManager
 */

export class InputManager {
    constructor(options = {}) {
        this.keys = {};
        this.gamepad = null;
        this.mousePosition = { x: 0, y: 0 };
        this.mouseDelta = { x: 0, y: 0 };
        this.isMouseLocked = false;
        
        this.bindings = {
            accelerate: ['KeyW', 'ArrowUp'],
            brake: ['KeyS', 'ArrowDown'],
            steerLeft: ['KeyA', 'ArrowLeft'],
            steerRight: ['KeyD', 'ArrowRight'],
            handbrake: ['Space'],
            gearUp: ['ShiftLeft', 'ShiftRight'],
            gearDown: ['ControlLeft', 'ControlRight'],
            camera: ['KeyC'],
            reset: ['KeyR'],
            horn: ['KeyH'],
            headlights: ['KeyL'],
            pause: ['Escape']
        };
        
        this.actions = {};
        this.previousActions = {};
        
        this.deadzone = options.deadzone || 0.1;
        this.steeringSensitivity = options.steeringSensitivity || 1.0;
        
        this._setupEventListeners();
    }
    
    _setupEventListeners() {
        document.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
            e.preventDefault();
        });
        
        document.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });
        
        document.addEventListener('mousemove', (e) => {
            if (this.isMouseLocked) {
                this.mouseDelta.x = e.movementX;
                this.mouseDelta.y = e.movementY;
            }
            this.mousePosition.x = e.clientX;
            this.mousePosition.y = e.clientY;
        });
        
        window.addEventListener('gamepadconnected', (e) => {
            this.gamepad = e.gamepad;
            console.log('Gamepad connected:', e.gamepad.id);
        });
        
        window.addEventListener('gamepaddisconnected', () => {
            this.gamepad = null;
        });
    }
    
    update() {
        this.previousActions = { ...this.actions };
        
        // Update actions from keyboard
        for (const [action, keys] of Object.entries(this.bindings)) {
            this.actions[action] = keys.some(key => this.keys[key]);
        }
        
        // Update from gamepad
        if (this.gamepad) {
            const gamepads = navigator.getGamepads();
            const gp = gamepads[this.gamepad.index];
            
            if (gp) {
                // Right trigger = accelerate
                if (gp.buttons[7]?.value > 0.1) {
                    this.actions.accelerate = true;
                    this.actions.throttleValue = gp.buttons[7].value;
                }
                
                // Left trigger = brake
                if (gp.buttons[6]?.value > 0.1) {
                    this.actions.brake = true;
                    this.actions.brakeValue = gp.buttons[6].value;
                }
                
                // Left stick = steering
                const steerX = gp.axes[0];
                if (Math.abs(steerX) > this.deadzone) {
                    this.actions.steerValue = steerX * this.steeringSensitivity;
                    this.actions.steerLeft = steerX < -this.deadzone;
                    this.actions.steerRight = steerX > this.deadzone;
                }
                
                // A button = handbrake
                if (gp.buttons[0]?.pressed) this.actions.handbrake = true;
                
                // B button = gear down, X button = gear up
                if (gp.buttons[1]?.pressed) this.actions.gearDown = true;
                if (gp.buttons[2]?.pressed) this.actions.gearUp = true;
            }
        }
        
        // Reset mouse delta
        this.mouseDelta.x = 0;
        this.mouseDelta.y = 0;
    }
    
    isActionPressed(action) {
        return this.actions[action] && !this.previousActions[action];
    }
    
    isActionHeld(action) {
        return !!this.actions[action];
    }
    
    isActionReleased(action) {
        return !this.actions[action] && this.previousActions[action];
    }
    
    getThrottle() {
        if (this.actions.throttleValue !== undefined) {
            return this.actions.throttleValue;
        }
        return this.actions.accelerate ? 1.0 : 0.0;
    }
    
    getBrake() {
        if (this.actions.brakeValue !== undefined) {
            return this.actions.brakeValue;
        }
        return this.actions.brake ? 1.0 : 0.0;
    }
    
    getSteering() {
        if (this.actions.steerValue !== undefined) {
            return this.actions.steerValue;
        }
        if (this.actions.steerLeft) return -1.0;
        if (this.actions.steerRight) return 1.0;
        return 0.0;
    }
    
    rebind(action, newKeys) {
        if (this.bindings[action]) {
            this.bindings[action] = Array.isArray(newKeys) ? newKeys : [newKeys];
        }
    }
    
    lockMouse() {
        document.body.requestPointerLock();
        this.isMouseLocked = true;
    }
    
    unlockMouse() {
        document.exitPointerLock();
        this.isMouseLocked = false;
    }
    
    dispose() {
        this.keys = {};
        this.actions = {};
    }
}

export default InputManager;
