/**
 * ScreenEffects.js - Post-Processing and Screen Effects
 * 
 * Implements comprehensive post-processing effects including bloom,
 * motion blur, depth of field, screen shake, speed lines, and vignette.
 * 
 * @module effects/ScreenEffects
 * @author CarSim Development Team
 * @version 2.0.0
 */

/**
 * ScreenEffects - Post-processing effects manager
 */
export class ScreenEffects {
    /**
     * Creates a new ScreenEffects system
     * @param {THREE.WebGLRenderer} renderer - Three.js renderer
     * @param {THREE.Scene} scene - Three.js scene
     * @param {THREE.Camera} camera - Three.js camera
     * @param {Object} options - Configuration options
     */
    constructor(renderer, scene, camera, options = {}) {
        /** @type {THREE.WebGLRenderer} */
        this.renderer = renderer;
        
        /** @type {THREE.Scene} */
        this.scene = scene;
        
        /** @type {THREE.Camera} */
        this.camera = camera;
        
        /**
         * Effect composer (if using post-processing)
         * @type {Object}
         */
        this.composer = null;
        
        /**
         * Effect passes
         * @type {Object}
         */
        this.passes = {};
        
        /**
         * Effect states
         * @type {Object}
         */
        this.effects = {
            bloom: {
                enabled: options.bloom !== false,
                strength: 0.5,
                radius: 0.4,
                threshold: 0.8
            },
            motionBlur: {
                enabled: options.motionBlur || false,
                intensity: 0.5,
                samples: 8
            },
            dof: {
                enabled: options.dof || false,
                focus: 10,
                aperture: 0.025,
                maxBlur: 0.01
            },
            vignette: {
                enabled: options.vignette !== false,
                darkness: 0.5,
                offset: 0.5
            },
            chromaticAberration: {
                enabled: options.chromaticAberration || false,
                intensity: 0.003
            },
            filmGrain: {
                enabled: options.filmGrain || false,
                intensity: 0.1,
                animated: true
            }
        };
        
        /**
         * Screen shake state
         * @type {Object}
         */
        this.screenShake = {
            active: false,
            intensity: 0,
            decay: 5,
            frequency: 20,
            time: 0,
            originalPosition: new THREE.Vector3(),
            offset: new THREE.Vector3()
        };
        
        /**
         * Speed lines state
         * @type {Object}
         */
        this.speedLines = {
            enabled: true,
            threshold: 30, // m/s
            maxOpacity: 0.6,
            lineCount: 50,
            mesh: null,
            material: null
        };
        
        /**
         * Impact flash state
         * @type {Object}
         */
        this.impactFlash = {
            active: false,
            intensity: 0,
            color: new THREE.Color(1, 1, 1),
            decay: 10
        };
        
        /**
         * Damage vignette
         * @type {Object}
         */
        this.damageVignette = {
            enabled: true,
            intensity: 0,
            color: new THREE.Color(0.8, 0, 0),
            pulseSpeed: 2
        };
        
        /**
         * Overlay canvas for 2D effects
         * @type {HTMLCanvasElement}
         */
        this.overlayCanvas = null;
        this.overlayContext = null;
        
        /**
         * Time tracking
         * @type {number}
         */
        this.time = 0;
        
        /**
         * Current vehicle speed for effects
         * @type {number}
         */
        this.currentSpeed = 0;
        
        /**
         * Current damage level 0-100
         * @type {number}
         */
        this.currentDamage = 0;
        
        // Initialize
        this._initializeOverlay();
        this._initializeSpeedLines();
    }
    
    /**
     * Initializes overlay canvas for 2D effects
     * @private
     */
    _initializeOverlay() {
        this.overlayCanvas = document.createElement('canvas');
        this.overlayCanvas.id = 'effect-overlay';
        this.overlayCanvas.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 100;
        `;
        
        this.overlayContext = this.overlayCanvas.getContext('2d');
        document.body.appendChild(this.overlayCanvas);
        
        // Handle resize
        this._resizeOverlay();
        window.addEventListener('resize', () => this._resizeOverlay());
    }
    
    /**
     * Resizes overlay canvas
     * @private
     */
    _resizeOverlay() {
        this.overlayCanvas.width = window.innerWidth;
        this.overlayCanvas.height = window.innerHeight;
    }
    
    /**
     * Initializes speed lines effect
     * @private
     */
    _initializeSpeedLines() {
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(this.speedLines.lineCount * 6); // 2 vertices per line
        const alphas = new Float32Array(this.speedLines.lineCount * 2);
        
        for (let i = 0; i < this.speedLines.lineCount; i++) {
            // Random position on screen edges
            const angle = Math.random() * Math.PI * 2;
            const radius = 2 + Math.random() * 3;
            
            const startX = Math.cos(angle) * radius;
            const startY = Math.sin(angle) * radius;
            const startZ = -5;
            
            const endX = Math.cos(angle) * (radius - 0.5 - Math.random() * 1.5);
            const endY = Math.sin(angle) * (radius - 0.5 - Math.random() * 1.5);
            const endZ = -3;
            
            positions[i * 6] = startX;
            positions[i * 6 + 1] = startY;
            positions[i * 6 + 2] = startZ;
            positions[i * 6 + 3] = endX;
            positions[i * 6 + 4] = endY;
            positions[i * 6 + 5] = endZ;
            
            alphas[i * 2] = Math.random();
            alphas[i * 2 + 1] = 0;
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1));
        
        this.speedLines.material = new THREE.ShaderMaterial({
            uniforms: {
                color: { value: new THREE.Color(0xffffff) },
                opacity: { value: 0 }
            },
            vertexShader: `
                attribute float alpha;
                varying float vAlpha;
                
                void main() {
                    vAlpha = alpha;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 color;
                uniform float opacity;
                varying float vAlpha;
                
                void main() {
                    gl_FragColor = vec4(color, opacity * vAlpha);
                }
            `,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        
        this.speedLines.mesh = new THREE.LineSegments(geometry, this.speedLines.material);
        this.speedLines.mesh.visible = false;
        this.speedLines.mesh.renderOrder = 999;
        this.speedLines.mesh.frustumCulled = false;
        
        // Add to camera so it moves with view
        this.camera.add(this.speedLines.mesh);
    }
    
    /**
     * Triggers screen shake
     * @param {number} intensity - Shake intensity
     * @param {number} duration - Optional duration override
     */
    triggerScreenShake(intensity, duration = null) {
        this.screenShake.active = true;
        this.screenShake.intensity = Math.max(this.screenShake.intensity, intensity);
        this.screenShake.time = 0;
        
        if (!this.screenShake.originalPosition.equals(new THREE.Vector3())) {
            this.screenShake.originalPosition.copy(this.camera.position);
        }
    }
    
    /**
     * Triggers impact flash effect
     * @param {number} intensity - Flash intensity 0-1
     * @param {THREE.Color} color - Flash color
     */
    triggerImpactFlash(intensity = 1, color = null) {
        this.impactFlash.active = true;
        this.impactFlash.intensity = intensity;
        if (color) {
            this.impactFlash.color.copy(color);
        }
    }
    
    /**
     * Sets damage level for damage vignette
     * @param {number} damage - Damage level 0-100
     */
    setDamageLevel(damage) {
        this.currentDamage = damage;
        this.damageVignette.intensity = damage > 50 ? (damage - 50) / 50 : 0;
    }
    
    /**
     * Sets current vehicle speed for speed effects
     * @param {number} speed - Speed in m/s
     */
    setSpeed(speed) {
        this.currentSpeed = Math.abs(speed);
    }
    
    /**
     * Updates all screen effects
     * @param {number} deltaTime - Time step in seconds
     */
    update(deltaTime) {
        this.time += deltaTime;
        
        // Update screen shake
        this._updateScreenShake(deltaTime);
        
        // Update speed lines
        this._updateSpeedLines();
        
        // Update impact flash
        this._updateImpactFlash(deltaTime);
        
        // Render overlay effects
        this._renderOverlay();
    }
    
    /**
     * Updates screen shake effect
     * @private
     */
    _updateScreenShake(deltaTime) {
        if (!this.screenShake.active) return;
        
        this.screenShake.time += deltaTime;
        
        // Calculate shake offset
        const shakeX = (Math.random() - 0.5) * 2 * this.screenShake.intensity;
        const shakeY = (Math.random() - 0.5) * 2 * this.screenShake.intensity;
        const shakeZ = (Math.random() - 0.5) * this.screenShake.intensity;
        
        // Apply high frequency shake
        const freq = this.screenShake.frequency;
        const noise = Math.sin(this.screenShake.time * freq) * Math.cos(this.screenShake.time * freq * 1.3);
        
        this.screenShake.offset.set(
            shakeX * noise,
            shakeY * Math.abs(noise),
            shakeZ * noise
        );
        
        // Decay intensity
        this.screenShake.intensity -= this.screenShake.decay * deltaTime;
        
        if (this.screenShake.intensity <= 0) {
            this.screenShake.active = false;
            this.screenShake.intensity = 0;
            this.screenShake.offset.set(0, 0, 0);
        }
    }
    
    /**
     * Gets current screen shake offset
     * @returns {THREE.Vector3}
     */
    getScreenShakeOffset() {
        return this.screenShake.offset.clone();
    }
    
    /**
     * Updates speed lines effect
     * @private
     */
    _updateSpeedLines() {
        if (!this.speedLines.enabled || !this.speedLines.mesh) return;
        
        const speedRatio = (this.currentSpeed - this.speedLines.threshold) / 
                          (50 - this.speedLines.threshold);
        
        if (speedRatio > 0) {
            this.speedLines.mesh.visible = true;
            this.speedLines.material.uniforms.opacity.value = 
                Math.min(speedRatio, 1) * this.speedLines.maxOpacity;
            
            // Animate line positions
            const positions = this.speedLines.mesh.geometry.attributes.position.array;
            for (let i = 0; i < this.speedLines.lineCount; i++) {
                // Move lines inward
                const idx = i * 6;
                const speed = 0.1 + speedRatio * 0.2;
                
                // Start point moves toward center
                const angle = Math.atan2(positions[idx + 1], positions[idx]);
                positions[idx] -= Math.cos(angle) * speed;
                positions[idx + 1] -= Math.sin(angle) * speed;
                
                // End point follows
                positions[idx + 3] -= Math.cos(angle) * speed * 0.8;
                positions[idx + 4] -= Math.sin(angle) * speed * 0.8;
                
                // Reset if too close to center
                const dist = Math.sqrt(positions[idx] ** 2 + positions[idx + 1] ** 2);
                if (dist < 0.5) {
                    const newAngle = Math.random() * Math.PI * 2;
                    const radius = 2 + Math.random() * 3;
                    
                    positions[idx] = Math.cos(newAngle) * radius;
                    positions[idx + 1] = Math.sin(newAngle) * radius;
                    positions[idx + 3] = Math.cos(newAngle) * (radius - 0.5 - Math.random() * 1.5);
                    positions[idx + 4] = Math.sin(newAngle) * (radius - 0.5 - Math.random() * 1.5);
                }
            }
            this.speedLines.mesh.geometry.attributes.position.needsUpdate = true;
        } else {
            this.speedLines.mesh.visible = false;
        }
    }
    
    /**
     * Updates impact flash effect
     * @private
     */
    _updateImpactFlash(deltaTime) {
        if (!this.impactFlash.active) return;
        
        this.impactFlash.intensity -= this.impactFlash.decay * deltaTime;
        
        if (this.impactFlash.intensity <= 0) {
            this.impactFlash.active = false;
            this.impactFlash.intensity = 0;
        }
    }
    
    /**
     * Renders 2D overlay effects
     * @private
     */
    _renderOverlay() {
        const ctx = this.overlayContext;
        const w = this.overlayCanvas.width;
        const h = this.overlayCanvas.height;
        
        // Clear canvas
        ctx.clearRect(0, 0, w, h);
        
        // Impact flash
        if (this.impactFlash.active && this.impactFlash.intensity > 0) {
            const c = this.impactFlash.color;
            ctx.fillStyle = `rgba(${c.r * 255}, ${c.g * 255}, ${c.b * 255}, ${this.impactFlash.intensity * 0.5})`;
            ctx.fillRect(0, 0, w, h);
        }
        
        // Vignette effect
        if (this.effects.vignette.enabled) {
            this._drawVignette(ctx, w, h);
        }
        
        // Damage vignette (pulsing red)
        if (this.damageVignette.enabled && this.damageVignette.intensity > 0) {
            this._drawDamageVignette(ctx, w, h);
        }
    }
    
    /**
     * Draws vignette effect
     * @private
     */
    _drawVignette(ctx, w, h) {
        const gradient = ctx.createRadialGradient(
            w / 2, h / 2, 0,
            w / 2, h / 2, Math.max(w, h) * 0.7
        );
        
        gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
        gradient.addColorStop(0.5, 'rgba(0, 0, 0, 0)');
        gradient.addColorStop(1, `rgba(0, 0, 0, ${this.effects.vignette.darkness})`);
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, w, h);
    }
    
    /**
     * Draws damage vignette effect
     * @private
     */
    _drawDamageVignette(ctx, w, h) {
        const pulse = Math.sin(this.time * this.damageVignette.pulseSpeed) * 0.3 + 0.7;
        const intensity = this.damageVignette.intensity * pulse;
        
        const c = this.damageVignette.color;
        
        const gradient = ctx.createRadialGradient(
            w / 2, h / 2, 0,
            w / 2, h / 2, Math.max(w, h) * 0.6
        );
        
        gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
        gradient.addColorStop(0.3, 'rgba(0, 0, 0, 0)');
        gradient.addColorStop(1, `rgba(${c.r * 255}, ${c.g * 255}, ${c.b * 255}, ${intensity * 0.6})`);
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, w, h);
    }
    
    /**
     * Enables/disables bloom effect
     * @param {boolean} enabled
     */
    setBloomEnabled(enabled) {
        this.effects.bloom.enabled = enabled;
    }
    
    /**
     * Sets bloom parameters
     * @param {number} strength
     * @param {number} radius
     * @param {number} threshold
     */
    setBloomParams(strength, radius, threshold) {
        this.effects.bloom.strength = strength;
        this.effects.bloom.radius = radius;
        this.effects.bloom.threshold = threshold;
    }
    
    /**
     * Enables/disables motion blur
     * @param {boolean} enabled
     */
    setMotionBlurEnabled(enabled) {
        this.effects.motionBlur.enabled = enabled;
    }
    
    /**
     * Enables/disables depth of field
     * @param {boolean} enabled
     */
    setDOFEnabled(enabled) {
        this.effects.dof.enabled = enabled;
    }
    
    /**
     * Sets DOF focus distance
     * @param {number} distance
     */
    setDOFFocus(distance) {
        this.effects.dof.focus = distance;
    }
    
    /**
     * Gets current effect states
     * @returns {Object}
     */
    getEffectStates() {
        return {
            ...this.effects,
            screenShake: { ...this.screenShake },
            speedLines: {
                enabled: this.speedLines.enabled,
                visible: this.speedLines.mesh?.visible
            },
            impactFlash: { ...this.impactFlash },
            damageVignette: { ...this.damageVignette }
        };
    }
    
    /**
     * Resets all effects
     */
    reset() {
        this.screenShake.active = false;
        this.screenShake.intensity = 0;
        this.screenShake.offset.set(0, 0, 0);
        
        this.impactFlash.active = false;
        this.impactFlash.intensity = 0;
        
        this.damageVignette.intensity = 0;
        
        this.currentSpeed = 0;
        this.currentDamage = 0;
        
        if (this.speedLines.mesh) {
            this.speedLines.mesh.visible = false;
        }
    }
    
    /**
     * Disposes all resources
     */
    dispose() {
        if (this.overlayCanvas && this.overlayCanvas.parentNode) {
            this.overlayCanvas.parentNode.removeChild(this.overlayCanvas);
        }
        
        if (this.speedLines.mesh) {
            this.camera.remove(this.speedLines.mesh);
            this.speedLines.mesh.geometry.dispose();
            this.speedLines.material.dispose();
        }
        
        window.removeEventListener('resize', this._resizeOverlay);
    }
}

export default ScreenEffects;
