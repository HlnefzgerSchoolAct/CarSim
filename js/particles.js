/**
 * Particle System
 * Handles all particle effects: smoke, sparks, debris, skid marks
 */

// ============================================================================
// BASE PARTICLE CLASS
// ============================================================================
class Particle {
    constructor(x, y, options = {}) {
        this.x = x;
        this.y = y;
        this.vx = options.vx || 0;
        this.vy = options.vy || 0;
        this.ax = options.ax || 0;
        this.ay = options.ay || 0;
        
        this.life = options.life || 1;
        this.maxLife = this.life;
        this.size = options.size || 5;
        this.startSize = this.size;
        this.endSize = options.endSize || 0;
        
        this.color = options.color || '#ffffff';
        this.startAlpha = options.alpha || 1;
        this.endAlpha = options.endAlpha || 0;
        
        this.rotation = options.rotation || 0;
        this.rotationSpeed = options.rotationSpeed || 0;
        
        this.gravity = options.gravity || 0;
        this.friction = options.friction || 1;
        
        this.type = options.type || 'circle';
        this.dead = false;
    }

    update(deltaTime) {
        // Apply acceleration
        this.vx += this.ax * deltaTime;
        this.vy += this.ay * deltaTime;
        
        // Apply gravity
        this.vy += this.gravity * deltaTime;
        
        // Apply friction
        this.vx *= this.friction;
        this.vy *= this.friction;
        
        // Update position
        this.x += this.vx * deltaTime;
        this.y += this.vy * deltaTime;
        
        // Update rotation
        this.rotation += this.rotationSpeed * deltaTime;
        
        // Update life
        this.life -= deltaTime;
        
        // Update size based on life
        const lifeRatio = this.life / this.maxLife;
        this.size = this.endSize + (this.startSize - this.endSize) * lifeRatio;
        
        if (this.life <= 0) {
            this.dead = true;
        }
    }

    getAlpha() {
        const lifeRatio = this.life / this.maxLife;
        return this.endAlpha + (this.startAlpha - this.endAlpha) * lifeRatio;
    }

    render(ctx, camera) {
        if (this.dead) return;
        
        const screenX = (this.x - camera.x) * camera.scale + ctx.canvas.width / 2;
        const screenY = (this.y - camera.y) * camera.scale + ctx.canvas.height / 2;
        
        ctx.save();
        ctx.globalAlpha = this.getAlpha();
        ctx.translate(screenX, screenY);
        ctx.rotate(this.rotation);
        
        if (this.type === 'circle') {
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(0, 0, this.size * camera.scale, 0, Math.PI * 2);
            ctx.fill();
        } else if (this.type === 'square') {
            ctx.fillStyle = this.color;
            const s = this.size * camera.scale;
            ctx.fillRect(-s / 2, -s / 2, s, s);
        } else if (this.type === 'spark') {
            ctx.strokeStyle = this.color;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(-this.vx * 0.05 * camera.scale, -this.vy * 0.05 * camera.scale);
            ctx.stroke();
        } else if (this.type === 'debris') {
            ctx.fillStyle = this.color;
            const s = this.size * camera.scale;
            ctx.fillRect(-s / 2, -s / 2, s, s * 0.5);
        }
        
        ctx.restore();
    }
}

// ============================================================================
// SKID MARK CLASS
// ============================================================================
class SkidMark {
    constructor() {
        this.points = [];
        this.maxPoints = 500;
        this.active = false;
        this.width = 3;
        this.color = 'rgba(20, 20, 20, 0.8)';
    }

    addPoint(x, y, intensity = 1) {
        this.points.push({
            x, y,
            intensity: Math.min(1, intensity),
            alpha: Math.min(0.8, intensity * 0.8)
        });
        
        // Remove old points
        if (this.points.length > this.maxPoints) {
            this.points.shift();
        }
        
        this.active = true;
    }

    endMark() {
        this.active = false;
    }

    render(ctx, camera) {
        if (this.points.length < 2) return;
        
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        for (let i = 1; i < this.points.length; i++) {
            const p1 = this.points[i - 1];
            const p2 = this.points[i];
            
            const x1 = (p1.x - camera.x) * camera.scale + ctx.canvas.width / 2;
            const y1 = (p1.y - camera.y) * camera.scale + ctx.canvas.height / 2;
            const x2 = (p2.x - camera.x) * camera.scale + ctx.canvas.width / 2;
            const y2 = (p2.y - camera.y) * camera.scale + ctx.canvas.height / 2;
            
            ctx.beginPath();
            ctx.strokeStyle = `rgba(20, 20, 20, ${p2.alpha})`;
            ctx.lineWidth = this.width * camera.scale * p2.intensity;
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
        }
        
        ctx.restore();
    }
}

// ============================================================================
// PARTICLE EMITTER CLASS
// ============================================================================
class ParticleEmitter {
    constructor(options = {}) {
        this.x = options.x || 0;
        this.y = options.y || 0;
        this.angle = options.angle || 0;
        this.spread = options.spread || Math.PI / 4;
        
        this.particleLife = options.particleLife || 1;
        this.particleLifeVariance = options.particleLifeVariance || 0.2;
        
        this.particleSize = options.particleSize || 5;
        this.particleSizeVariance = options.particleSizeVariance || 2;
        this.particleEndSize = options.particleEndSize || 10;
        
        this.particleSpeed = options.particleSpeed || 100;
        this.particleSpeedVariance = options.particleSpeedVariance || 20;
        
        this.particleColor = options.particleColor || '#ffffff';
        this.particleAlpha = options.particleAlpha || 1;
        this.particleEndAlpha = options.particleEndAlpha || 0;
        
        this.particleGravity = options.particleGravity || 0;
        this.particleFriction = options.particleFriction || 1;
        
        this.particleType = options.particleType || 'circle';
        this.particleRotation = options.particleRotation || false;
        
        this.emissionRate = options.emissionRate || 10; // particles per second
        this.emissionAccumulator = 0;
        
        this.active = true;
        this.particles = [];
    }

    setPosition(x, y) {
        this.x = x;
        this.y = y;
    }

    setAngle(angle) {
        this.angle = angle;
    }

    emit(count = 1) {
        for (let i = 0; i < count; i++) {
            const angle = this.angle + (Math.random() - 0.5) * this.spread;
            const speed = this.particleSpeed + (Math.random() - 0.5) * this.particleSpeedVariance * 2;
            
            const particle = new Particle(this.x, this.y, {
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: this.particleLife + (Math.random() - 0.5) * this.particleLifeVariance * 2,
                size: this.particleSize + (Math.random() - 0.5) * this.particleSizeVariance * 2,
                endSize: this.particleEndSize,
                color: this.particleColor,
                alpha: this.particleAlpha,
                endAlpha: this.particleEndAlpha,
                gravity: this.particleGravity,
                friction: this.particleFriction,
                type: this.particleType,
                rotation: this.particleRotation ? Math.random() * Math.PI * 2 : 0,
                rotationSpeed: this.particleRotation ? (Math.random() - 0.5) * 10 : 0
            });
            
            this.particles.push(particle);
        }
    }

    update(deltaTime) {
        if (this.active) {
            this.emissionAccumulator += deltaTime;
            const emitCount = Math.floor(this.emissionAccumulator * this.emissionRate);
            if (emitCount > 0) {
                this.emit(emitCount);
                this.emissionAccumulator -= emitCount / this.emissionRate;
            }
        }
        
        // Update particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            this.particles[i].update(deltaTime);
            if (this.particles[i].dead) {
                this.particles.splice(i, 1);
            }
        }
    }

    render(ctx, camera) {
        for (const particle of this.particles) {
            particle.render(ctx, camera);
        }
    }
}

// ============================================================================
// PARTICLE SYSTEM CLASS
// ============================================================================
class ParticleSystem {
    constructor() {
        this.particles = [];
        this.emitters = [];
        this.skidMarks = [];
        this.maxSkidMarks = 20;
        
        // Pre-configured emitters for different effects
        this.smokeConfig = {
            particleLife: 1.5,
            particleLifeVariance: 0.5,
            particleSize: 8,
            particleSizeVariance: 3,
            particleEndSize: 25,
            particleSpeed: 30,
            particleSpeedVariance: 10,
            particleColor: 'rgba(150, 150, 150, 1)',
            particleAlpha: 0.6,
            particleEndAlpha: 0,
            particleGravity: -20,
            particleFriction: 0.98,
            particleType: 'circle',
            emissionRate: 30
        };
        
        this.sparkConfig = {
            particleLife: 0.5,
            particleLifeVariance: 0.2,
            particleSize: 3,
            particleSizeVariance: 1,
            particleEndSize: 1,
            particleSpeed: 300,
            particleSpeedVariance: 100,
            particleColor: '#ffaa00',
            particleAlpha: 1,
            particleEndAlpha: 0,
            particleGravity: 200,
            particleFriction: 0.95,
            particleType: 'spark',
            emissionRate: 100,
            spread: Math.PI / 2
        };
        
        this.debrisConfig = {
            particleLife: 1,
            particleLifeVariance: 0.3,
            particleSize: 4,
            particleSizeVariance: 2,
            particleEndSize: 2,
            particleSpeed: 200,
            particleSpeedVariance: 80,
            particleColor: '#444444',
            particleAlpha: 1,
            particleEndAlpha: 0.5,
            particleGravity: 300,
            particleFriction: 0.98,
            particleType: 'debris',
            particleRotation: true,
            emissionRate: 50,
            spread: Math.PI
        };
        
        this.dirtConfig = {
            particleLife: 0.8,
            particleLifeVariance: 0.3,
            particleSize: 5,
            particleSizeVariance: 2,
            particleEndSize: 3,
            particleSpeed: 80,
            particleSpeedVariance: 30,
            particleColor: '#8b6914',
            particleAlpha: 0.8,
            particleEndAlpha: 0,
            particleGravity: 100,
            particleFriction: 0.95,
            particleType: 'circle',
            emissionRate: 40
        };
        
        this.glassConfig = {
            particleLife: 0.6,
            particleLifeVariance: 0.2,
            particleSize: 3,
            particleSizeVariance: 2,
            particleEndSize: 1,
            particleSpeed: 150,
            particleSpeedVariance: 50,
            particleColor: '#88ccff',
            particleAlpha: 0.8,
            particleEndAlpha: 0.3,
            particleGravity: 400,
            particleFriction: 0.98,
            particleType: 'square',
            particleRotation: true,
            spread: Math.PI
        };
    }

    /**
     * Create tire smoke at position
     */
    createTireSmoke(x, y, intensity = 1, angle = 0) {
        const config = { ...this.smokeConfig };
        config.particleAlpha *= intensity;
        config.emissionRate *= intensity;
        config.particleSpeed *= (0.5 + intensity * 0.5);
        
        const emitter = new ParticleEmitter({ ...config, x, y, angle, spread: Math.PI * 0.5 });
        emitter.emit(Math.ceil(5 * intensity));
        this.emitters.push(emitter);
        
        // Auto-remove after one emission
        emitter.active = false;
    }

    /**
     * Create sparks at collision point
     */
    createSparks(x, y, angle, intensity = 1) {
        const config = { ...this.sparkConfig };
        config.emissionRate *= intensity;
        
        const emitter = new ParticleEmitter({ ...config, x, y, angle });
        emitter.emit(Math.ceil(20 * intensity));
        this.emitters.push(emitter);
        emitter.active = false;
    }

    /**
     * Create debris on collision
     */
    createDebris(x, y, angle, intensity = 1, color = '#444444') {
        const config = { ...this.debrisConfig };
        config.particleColor = color;
        config.emissionRate *= intensity;
        
        const emitter = new ParticleEmitter({ ...config, x, y, angle });
        emitter.emit(Math.ceil(15 * intensity));
        this.emitters.push(emitter);
        emitter.active = false;
    }

    /**
     * Create dirt spray (for grass/gravel)
     */
    createDirtSpray(x, y, angle, surfaceType = 'dirt') {
        const config = { ...this.dirtConfig };
        
        if (surfaceType === 'gravel') {
            config.particleColor = '#a09080';
            config.particleSize = 3;
        } else if (surfaceType === 'grass') {
            config.particleColor = '#4a6a2a';
        }
        
        const emitter = new ParticleEmitter({ ...config, x, y, angle });
        emitter.emit(5);
        this.emitters.push(emitter);
        emitter.active = false;
    }

    /**
     * Create glass shatter effect
     */
    createGlassShatter(x, y) {
        const config = { ...this.glassConfig };
        const emitter = new ParticleEmitter({ ...config, x, y, angle: 0 });
        emitter.emit(30);
        this.emitters.push(emitter);
        emitter.active = false;
    }

    /**
     * Create engine smoke (damage effect)
     */
    createEngineSmoke(x, y, damageLevel) {
        if (damageLevel < 0.5) return;
        
        const config = { ...this.smokeConfig };
        config.particleColor = damageLevel > 0.8 ? 'rgba(50, 50, 50, 1)' : 'rgba(200, 200, 200, 1)';
        config.emissionRate = damageLevel * 20;
        config.particleGravity = -50;
        
        const emitter = new ParticleEmitter({ ...config, x, y, angle: -Math.PI / 2, spread: Math.PI / 6 });
        emitter.emit(2);
        this.emitters.push(emitter);
        emitter.active = false;
    }

    /**
     * Create a new skid mark trail
     */
    createSkidMark() {
        const skidMark = new SkidMark();
        this.skidMarks.push(skidMark);
        
        // Remove old skid marks if too many
        if (this.skidMarks.length > this.maxSkidMarks) {
            this.skidMarks.shift();
        }
        
        return skidMark;
    }

    /**
     * Get or create a skid mark for a wheel
     */
    getOrCreateSkidMark(wheelId) {
        // Find existing active skid mark for this wheel
        for (const mark of this.skidMarks) {
            if (mark.wheelId === wheelId && mark.active) {
                return mark;
            }
        }
        
        // Create new one
        const mark = this.createSkidMark();
        mark.wheelId = wheelId;
        return mark;
    }

    /**
     * Add point to skid mark
     */
    addSkidPoint(wheelId, x, y, intensity) {
        if (intensity < 0.1) {
            // End the mark if intensity too low
            for (const mark of this.skidMarks) {
                if (mark.wheelId === wheelId && mark.active) {
                    mark.endMark();
                }
            }
            return;
        }
        
        const mark = this.getOrCreateSkidMark(wheelId);
        mark.addPoint(x, y, intensity);
    }

    /**
     * Update all particles and emitters
     */
    update(deltaTime) {
        // Update emitters
        for (let i = this.emitters.length - 1; i >= 0; i--) {
            const emitter = this.emitters[i];
            emitter.update(deltaTime);
            
            // Remove inactive emitters with no particles
            if (!emitter.active && emitter.particles.length === 0) {
                this.emitters.splice(i, 1);
            }
        }
        
        // Update standalone particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            this.particles[i].update(deltaTime);
            if (this.particles[i].dead) {
                this.particles.splice(i, 1);
            }
        }
    }

    /**
     * Render all particles
     */
    render(ctx, camera) {
        // Render skid marks first (on the ground)
        for (const mark of this.skidMarks) {
            mark.render(ctx, camera);
        }
        
        // Render emitter particles
        for (const emitter of this.emitters) {
            emitter.render(ctx, camera);
        }
        
        // Render standalone particles
        for (const particle of this.particles) {
            particle.render(ctx, camera);
        }
    }

    /**
     * Clear all particles
     */
    clear() {
        this.particles = [];
        this.emitters = [];
    }

    /**
     * Clear skid marks only
     */
    clearSkidMarks() {
        this.skidMarks = [];
    }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.Particle = Particle;
    window.SkidMark = SkidMark;
    window.ParticleEmitter = ParticleEmitter;
    window.ParticleSystem = ParticleSystem;
}
