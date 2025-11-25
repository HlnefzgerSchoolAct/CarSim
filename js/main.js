/**
 * Main Game Controller
 * Initializes and runs the car driving simulator
 * Uses HTML5 Canvas for rendering (no external libraries)
 */
class Game {
    constructor() {
        // Canvas and context
        this.canvas = null;
        this.ctx = null;
        
        // Game components
        this.car = null;
        this.world = null;
        this.controls = null;
        this.particles = null;
        
        // Camera system
        this.camera = {
            x: 0,
            y: 0,
            targetX: 0,
            targetY: 0,
            scale: 1,
            targetScale: 1,
            shakeX: 0,
            shakeY: 0,
            shakeIntensity: 0,
            mode: 0 // 0: follow, 1: fixed, 2: zoomed out
        };
        this.cameraModes = ['Follow', 'Fixed', 'Overview'];
        this.cameraLerp = 0.08;
        
        // Time tracking
        this.lastTime = 0;
        this.deltaTime = 0;
        this.fps = 0;
        this.frameCount = 0;
        this.fpsTimer = 0;
        
        // Game state
        this.paused = false;
        this.debugMode = false;
        
        // Lap timing
        this.lapStartTime = 0;
        this.currentLapTime = 0;
        this.bestLapTime = Infinity;
        this.lapCount = 0;
        
        // Screen shake state
        this.screenShake = {
            intensity: 0,
            duration: 0,
            decay: 5
        };
        
        this.init();
    }

    init() {
        this.createCanvas();
        this.createGameObjects();
        this.setupEventListeners();
        this.resetGame();
        
        // Start game loop
        requestAnimationFrame((time) => this.gameLoop(time));
    }

    createCanvas() {
        // Create canvas element
        this.canvas = document.createElement('canvas');
        this.canvas.id = 'game-canvas';
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        
        // Get 2D context
        this.ctx = this.canvas.getContext('2d');
        
        // Add to container
        const container = document.getElementById('game-container');
        container.innerHTML = ''; // Clear any existing content
        container.appendChild(this.canvas);
    }

    createGameObjects() {
        // Create input controls
        this.controls = new InputControls();
        
        // Create world environment
        this.world = new World();
        
        // Create player car
        this.car = new Car();
        
        // Create particle system
        this.particles = new ParticleSystem();
        
        // Setup control callbacks
        this.controls.onReset(() => this.resetCar());
        this.controls.onCameraChange(() => this.cycleCamera());
        this.controls.onPause(() => this.togglePause());
        this.controls.onDebugToggle(() => this.debugMode = !this.debugMode);
    }

    setupEventListeners() {
        // Window resize
        window.addEventListener('resize', () => this.onWindowResize());
        
        // Prevent context menu on right click
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    onWindowResize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    resetGame() {
        this.resetCar();
        this.lapCount = 0;
        this.bestLapTime = Infinity;
        this.particles.clearSkidMarks();
    }

    resetCar() {
        this.car.reset(0, 0, 0);
        this.camera.x = 0;
        this.camera.y = 0;
        this.lapStartTime = performance.now();
    }

    cycleCamera() {
        this.camera.mode = (this.camera.mode + 1) % this.cameraModes.length;
        
        // Set target scale based on mode
        switch (this.camera.mode) {
            case 0: // Follow
                this.camera.targetScale = 1;
                break;
            case 1: // Fixed
                this.camera.targetScale = 0.8;
                break;
            case 2: // Overview
                this.camera.targetScale = 0.3;
                break;
        }
    }

    togglePause() {
        this.paused = !this.paused;
    }

    /**
     * Main game loop
     */
    gameLoop(currentTime) {
        // Calculate delta time
        this.deltaTime = Math.min((currentTime - this.lastTime) / 1000, 0.1);
        this.lastTime = currentTime;
        
        // FPS calculation
        this.frameCount++;
        this.fpsTimer += this.deltaTime;
        if (this.fpsTimer >= 1) {
            this.fps = this.frameCount;
            this.frameCount = 0;
            this.fpsTimer = 0;
        }
        
        if (!this.paused) {
            this.update(this.deltaTime);
        }
        
        this.render();
        
        // Continue loop
        requestAnimationFrame((time) => this.gameLoop(time));
    }

    /**
     * Update game state
     */
    update(deltaTime) {
        // Update car physics
        this.car.update(deltaTime, this.controls, this.world);
        
        // Check collisions
        this.checkCollisions();
        
        // Update world
        this.world.update(deltaTime);
        
        // Update particles
        this.updateParticles(deltaTime);
        
        // Update camera
        this.updateCamera(deltaTime);
        
        // Update lap timer
        this.currentLapTime = (performance.now() - this.lapStartTime) / 1000;
    }

    /**
     * Check and handle collisions
     */
    checkCollisions() {
        const carPos = this.car.position;
        const carCorners = this.car.getCorners();
        
        // Get nearby obstacles
        const nearbyObstacles = this.world.getObstaclesNear(carPos.x, carPos.y, 150);
        
        for (const obs of nearbyObstacles) {
            let collision = null;
            
            if (obs.type === 'wall' || obs.type === 'building') {
                // Rectangle-rectangle collision
                collision = this.checkWallCollision(carCorners, obs);
            } else if (obs.type === 'tree') {
                // Circle collision for trees
                collision = this.checkCircleCollision(carPos, obs);
            } else if (obs.type === 'cone') {
                // Cone collision
                collision = this.checkCircleCollision(carPos, obs);
                if (collision) {
                    this.world.knockCone(obs.data, this.car.velocity);
                    continue; // Cones don't stop the car
                }
            } else if (obs.type === 'car') {
                // Parked car collision
                collision = this.checkCarCollision(carCorners, obs);
            }
            
            if (collision) {
                this.handleCollision(collision, obs);
            }
        }
    }

    checkWallCollision(carCorners, wall) {
        const wallCorners = CollisionSystem.getCorners(
            new Vector2(wall.x, wall.y),
            wall.width, wall.height, wall.angle || 0
        );
        
        const satResult = CollisionSystem.checkSAT(carCorners, wallCorners);
        
        if (satResult) {
            // Find collision point (average of overlapping corners)
            let collisionPoint = new Vector2(0, 0);
            let count = 0;
            
            for (const corner of carCorners) {
                if (CollisionSystem.pointInPolygon(corner, wallCorners)) {
                    collisionPoint = collisionPoint.add(corner);
                    count++;
                }
            }
            
            if (count > 0) {
                collisionPoint = collisionPoint.divide(count);
            } else {
                collisionPoint = this.car.position;
            }
            
            return {
                point: collisionPoint,
                normal: satResult.axis,
                overlap: satResult.overlap
            };
        }
        
        return null;
    }

    checkCircleCollision(carPos, obs) {
        const dx = carPos.x - obs.x;
        const dy = carPos.y - obs.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const minDist = obs.radius + 30; // Car half-width approximation
        
        if (dist < minDist) {
            const normal = new Vector2(dx, dy).normalize();
            return {
                point: new Vector2(obs.x + normal.x * obs.radius, obs.y + normal.y * obs.radius),
                normal: normal,
                overlap: minDist - dist
            };
        }
        
        return null;
    }

    checkCarCollision(carCorners, obs) {
        const obsCorners = CollisionSystem.getCorners(
            new Vector2(obs.x, obs.y),
            obs.width, obs.height, obs.angle || 0
        );
        
        const satResult = CollisionSystem.checkSAT(carCorners, obsCorners);
        
        if (satResult) {
            return {
                point: new Vector2(obs.x, obs.y),
                normal: satResult.axis,
                overlap: satResult.overlap
            };
        }
        
        return null;
    }

    handleCollision(collision, obstacle) {
        const impactSpeed = this.car.velocity.length();
        const impactForce = this.car.mass * impactSpeed;
        
        // Apply collision response to car
        const collisionResult = this.car.applyCollision(
            collision.point,
            collision.normal,
            impactForce
        );
        
        // Separate car from obstacle
        this.car.position = this.car.position.add(
            collision.normal.multiply(collision.overlap * 1.1)
        );
        
        // Create collision effects
        if (impactSpeed > 5) {
            // Screen shake
            this.addScreenShake(Math.min(impactSpeed * 0.5, 20));
            
            // Sparks on wall collision
            if (obstacle.type === 'wall' || obstacle.type === 'concrete') {
                this.particles.createSparks(
                    collision.point.x, collision.point.y,
                    Math.atan2(collision.normal.y, collision.normal.x),
                    impactSpeed / 20
                );
            }
            
            // Debris
            this.particles.createDebris(
                collision.point.x, collision.point.y,
                Math.atan2(-this.car.velocity.y, -this.car.velocity.x),
                impactSpeed / 30
            );
        }
        
        // Break combo on hard impact
        if (impactSpeed > 15) {
            this.car.driftCombo = 1;
            this.car.currentDriftScore = 0;
        }
    }

    addScreenShake(intensity) {
        this.screenShake.intensity = Math.max(this.screenShake.intensity, intensity);
        this.screenShake.duration = 0.3;
    }

    updateParticles(deltaTime) {
        this.particles.update(deltaTime);
        
        // Create tire smoke and skid marks when drifting
        if (this.car.smokeIntensity > 0.2) {
            for (let i = 2; i < 4; i++) { // Rear wheels only
                const wheel = this.car.wheels[i];
                const wheelPos = this.car.position.add(
                    wheel.localPosition.multiply(20).rotate(this.car.angle)
                );
                
                // Smoke
                if (this.car.smokeIntensity > 0.3) {
                    this.particles.createTireSmoke(
                        wheelPos.x, wheelPos.y,
                        this.car.smokeIntensity,
                        this.car.angle + Math.PI
                    );
                }
                
                // Skid marks
                this.particles.addSkidPoint(
                    i, wheelPos.x, wheelPos.y,
                    this.car.smokeIntensity
                );
            }
        }
        
        // Dirt spray on grass/gravel
        if (this.car.currentSurface !== SurfaceType.ASPHALT && this.car.getSpeed() > 10) {
            for (let i = 2; i < 4; i++) {
                const wheel = this.car.wheels[i];
                const wheelPos = this.car.position.add(
                    wheel.localPosition.multiply(20).rotate(this.car.angle)
                );
                
                this.particles.createDirtSpray(
                    wheelPos.x, wheelPos.y,
                    this.car.angle + Math.PI,
                    this.car.currentSurface.name
                );
            }
        }
        
        // Engine smoke if damaged
        if (this.car.damage.engine > 0.5) {
            const frontPos = this.car.position.add(
                new Vector2(0, -30).rotate(this.car.angle)
            );
            this.particles.createEngineSmoke(
                frontPos.x, frontPos.y,
                this.car.damage.engine
            );
        }
    }

    updateCamera(deltaTime) {
        // Calculate target position based on mode
        switch (this.camera.mode) {
            case 0: // Follow
                // Look ahead based on velocity
                const lookAhead = this.car.velocity.multiply(0.5);
                this.camera.targetX = this.car.position.x + lookAhead.x;
                this.camera.targetY = this.car.position.y + lookAhead.y;
                break;
            case 1: // Fixed
                // Stay at current position
                break;
            case 2: // Overview
                this.camera.targetX = 0;
                this.camera.targetY = 0;
                break;
        }
        
        // Smooth camera movement
        this.camera.x += (this.camera.targetX - this.camera.x) * this.cameraLerp;
        this.camera.y += (this.camera.targetY - this.camera.y) * this.cameraLerp;
        
        // Smooth zoom
        this.camera.scale += (this.camera.targetScale - this.camera.scale) * 0.05;
        
        // Update screen shake
        if (this.screenShake.duration > 0) {
            this.screenShake.duration -= deltaTime;
            this.screenShake.intensity *= 0.9;
            
            this.camera.shakeX = (Math.random() - 0.5) * this.screenShake.intensity;
            this.camera.shakeY = (Math.random() - 0.5) * this.screenShake.intensity;
        } else {
            this.camera.shakeX = 0;
            this.camera.shakeY = 0;
        }
    }

    /**
     * Render everything
     */
    render() {
        const ctx = this.ctx;
        
        // Apply screen shake offset
        ctx.save();
        ctx.translate(this.camera.shakeX, this.camera.shakeY);
        
        // Clear canvas
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Get camera with shake applied
        const camera = {
            x: this.camera.x,
            y: this.camera.y,
            scale: this.camera.scale
        };
        
        // Render world
        this.world.render(ctx, camera);
        
        // Render particles (behind car)
        this.particles.render(ctx, camera);
        
        // Render car
        this.car.render(ctx, camera);
        
        ctx.restore();
        
        // Render HUD (not affected by camera)
        this.renderHUD();
        
        // Render pause overlay
        if (this.paused) {
            this.renderPauseOverlay();
        }
        
        // Render debug info
        if (this.debugMode) {
            this.renderDebugInfo();
        }
    }

    renderHUD() {
        const ctx = this.ctx;
        const hudData = this.car.getHUDData();
        
        // Main gauges background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(this.canvas.width - 220, this.canvas.height - 180, 210, 170);
        
        // Speedometer
        this.renderSpeedometer(ctx, this.canvas.width - 115, this.canvas.height - 90, 70, hudData.speed);
        
        // Tachometer
        this.renderTachometer(ctx, this.canvas.width - 180, this.canvas.height - 130, 40, hudData.rpm);
        
        // Gear indicator
        ctx.fillStyle = '#00ff88';
        ctx.font = 'bold 32px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(hudData.gear === 0 ? 'N' : hudData.gear.toString(), this.canvas.width - 50, this.canvas.height - 100);
        ctx.font = '12px Arial';
        ctx.fillText('GEAR', this.canvas.width - 50, this.canvas.height - 80);
        
        // Drift HUD
        this.renderDriftHUD(ctx, hudData);
        
        // G-Force meter
        this.renderGForceMeter(ctx, 30, this.canvas.height - 120, hudData.gForce);
        
        // Damage display
        this.renderDamageDisplay(ctx, 30, 150, hudData.damage);
        
        // Tire indicators
        this.renderTireIndicators(ctx, 30, 280, hudData.wheels);
        
        // Controls info
        this.renderControlsInfo(ctx);
        
        // Mini-map
        this.renderMiniMap(ctx);
        
        // Lap timer
        this.renderLapTimer(ctx);
    }

    renderSpeedometer(ctx, x, y, radius, speed) {
        // Background arc
        ctx.beginPath();
        ctx.arc(x, y, radius, Math.PI * 0.75, Math.PI * 2.25);
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 10;
        ctx.stroke();
        
        // Speed arc
        const speedRatio = Math.min(speed / 300, 1);
        const endAngle = Math.PI * 0.75 + speedRatio * Math.PI * 1.5;
        
        ctx.beginPath();
        ctx.arc(x, y, radius, Math.PI * 0.75, endAngle);
        
        // Color based on speed
        if (speed < 100) {
            ctx.strokeStyle = '#00ff88';
        } else if (speed < 200) {
            ctx.strokeStyle = '#ffaa00';
        } else {
            ctx.strokeStyle = '#ff4444';
        }
        ctx.lineWidth = 10;
        ctx.stroke();
        
        // Speed text
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 28px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(speed.toString(), x, y + 5);
        ctx.font = '12px Arial';
        ctx.fillText('km/h', x, y + 20);
    }

    renderTachometer(ctx, x, y, radius, rpm) {
        // Background
        ctx.beginPath();
        ctx.arc(x, y, radius, Math.PI * 0.75, Math.PI * 2.25);
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 6;
        ctx.stroke();
        
        // RPM arc
        const rpmRatio = Math.min(rpm / 8000, 1);
        const endAngle = Math.PI * 0.75 + rpmRatio * Math.PI * 1.5;
        
        ctx.beginPath();
        ctx.arc(x, y, radius, Math.PI * 0.75, endAngle);
        
        // Redline color
        if (rpm > 7000) {
            ctx.strokeStyle = '#ff0000';
        } else if (rpm > 5500) {
            ctx.strokeStyle = '#ffaa00';
        } else {
            ctx.strokeStyle = '#00aaff';
        }
        ctx.lineWidth = 6;
        ctx.stroke();
        
        // RPM text
        ctx.fillStyle = '#ffffff';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(Math.round(rpm / 1000) + 'k', x, y + 5);
    }

    renderDriftHUD(ctx, hudData) {
        if (!hudData.isDrifting && hudData.currentDrift < 10) return;
        
        const x = this.canvas.width / 2;
        const y = 80;
        
        // Drift angle display
        ctx.fillStyle = hudData.isDrifting ? '#ffaa00' : '#666666';
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(Math.abs(hudData.driftAngle) + '°', x, y);
        
        // Current drift score
        ctx.font = 'bold 24px Arial';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(hudData.currentDrift.toLocaleString(), x, y + 35);
        
        // Combo multiplier
        if (hudData.driftCombo > 1) {
            ctx.fillStyle = '#ff6600';
            ctx.font = 'bold 18px Arial';
            ctx.fillText('x' + hudData.driftCombo, x + 80, y + 35);
        }
        
        // Total drift score and best
        ctx.font = '14px Arial';
        ctx.fillStyle = '#aaaaaa';
        ctx.fillText('Total: ' + hudData.driftScore.toLocaleString(), x, y + 55);
        ctx.fillText('Best: ' + hudData.bestDrift.toLocaleString(), x, y + 72);
    }

    renderGForceMeter(ctx, x, y, gForce) {
        const size = 80;
        
        // Background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(x, y, size, size);
        
        // Grid
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + size/2, y);
        ctx.lineTo(x + size/2, y + size);
        ctx.moveTo(x, y + size/2);
        ctx.lineTo(x + size, y + size/2);
        ctx.stroke();
        
        // G-force dot
        const dotX = x + size/2 + gForce.x * 20;
        const dotY = y + size/2 - gForce.y * 20;
        
        ctx.fillStyle = '#ff4444';
        ctx.beginPath();
        ctx.arc(
            Math.max(x + 5, Math.min(x + size - 5, dotX)),
            Math.max(y + 5, Math.min(y + size - 5, dotY)),
            5, 0, Math.PI * 2
        );
        ctx.fill();
        
        // Label
        ctx.fillStyle = '#ffffff';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('G-FORCE', x + size/2, y + size + 12);
    }

    renderDamageDisplay(ctx, x, y, damage) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(x, y, 100, 110);
        
        // Title
        ctx.fillStyle = '#ffffff';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('DAMAGE', x + 50, y + 15);
        
        // Car outline
        const carX = x + 50;
        const carY = y + 60;
        const carW = 30;
        const carH = 50;
        
        // Draw car zones with damage colors
        const zones = [
            { name: 'front', x: carX - carW/2, y: carY - carH/2, w: carW, h: carH/4 },
            { name: 'rear', x: carX - carW/2, y: carY + carH/4, w: carW, h: carH/4 },
            { name: 'left', x: carX - carW/2, y: carY - carH/4, w: carW/3, h: carH/2 },
            { name: 'right', x: carX + carW/6, y: carY - carH/4, w: carW/3, h: carH/2 }
        ];
        
        for (const zone of zones) {
            const dmg = damage[zone.name];
            let color;
            if (dmg < 0.25) color = '#00ff00';
            else if (dmg < 0.5) color = '#ffff00';
            else if (dmg < 0.75) color = '#ff8800';
            else color = '#ff0000';
            
            ctx.fillStyle = color;
            ctx.fillRect(zone.x, zone.y, zone.w, zone.h);
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 1;
            ctx.strokeRect(zone.x, zone.y, zone.w, zone.h);
        }
        
        // Total damage percentage
        ctx.fillStyle = '#ffffff';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(Math.round(damage.total * 100) + '%', x + 50, y + 105);
    }

    renderTireIndicators(ctx, x, y, wheels) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(x, y, 100, 90);
        
        ctx.fillStyle = '#ffffff';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('TIRES', x + 50, y + 15);
        
        const positions = [
            { x: x + 25, y: y + 35 },
            { x: x + 75, y: y + 35 },
            { x: x + 25, y: y + 65 },
            { x: x + 75, y: y + 65 }
        ];
        
        for (let i = 0; i < 4; i++) {
            const wheel = wheels[i];
            const pos = positions[i];
            
            // Grip bar
            const barH = 20;
            const gripH = wheel.grip * barH;
            
            ctx.fillStyle = '#333';
            ctx.fillRect(pos.x - 8, pos.y, 16, barH);
            
            // Grip color based on temperature
            let gripColor;
            if (wheel.temp < 50) gripColor = '#4444ff';
            else if (wheel.temp < 80) gripColor = '#00ff00';
            else if (wheel.temp < 100) gripColor = '#ffff00';
            else gripColor = '#ff4444';
            
            ctx.fillStyle = gripColor;
            ctx.fillRect(pos.x - 8, pos.y + barH - gripH, 16, gripH);
        }
    }

    renderControlsInfo(ctx) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(10, 10, 150, 130);
        
        ctx.fillStyle = '#ffffff';
        ctx.font = '11px Arial';
        ctx.textAlign = 'left';
        
        const controls = [
            'W/↑ - Accelerate',
            'S/↓ - Brake/Reverse',
            'A/← - Steer Left',
            'D/→ - Steer Right',
            'SPACE - Handbrake',
            'R - Reset Car',
            'C - Camera (' + this.cameraModes[this.camera.mode] + ')',
            'P/ESC - Pause'
        ];
        
        controls.forEach((text, i) => {
            ctx.fillText(text, 20, 28 + i * 14);
        });
    }

    renderMiniMap(ctx) {
        const mapSize = 150;
        const mapX = this.canvas.width - mapSize - 20;
        const mapY = 20;
        const scale = mapSize / this.world.width;
        
        // Background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(mapX, mapY, mapSize, mapSize);
        
        // Draw roads (simplified)
        ctx.strokeStyle = '#555555';
        ctx.lineWidth = 3;
        
        // Horizontal roads
        ctx.beginPath();
        ctx.moveTo(mapX, mapY + mapSize/2 - 20 * scale * 600);
        ctx.lineTo(mapX + mapSize, mapY + mapSize/2 - 20 * scale * 600);
        ctx.moveTo(mapX, mapY + mapSize/2 + 20 * scale * 600);
        ctx.lineTo(mapX + mapSize, mapY + mapSize/2 + 20 * scale * 600);
        ctx.stroke();
        
        // Vertical road
        ctx.beginPath();
        ctx.moveTo(mapX + mapSize/2, mapY);
        ctx.lineTo(mapX + mapSize/2, mapY + mapSize);
        ctx.stroke();
        
        // Car position
        const carMapX = mapX + mapSize/2 + this.car.position.x * scale;
        const carMapY = mapY + mapSize/2 + this.car.position.y * scale;
        
        ctx.save();
        ctx.translate(carMapX, carMapY);
        ctx.rotate(-this.car.angle);
        
        ctx.fillStyle = '#ff4444';
        ctx.beginPath();
        ctx.moveTo(0, -4);
        ctx.lineTo(-3, 4);
        ctx.lineTo(3, 4);
        ctx.closePath();
        ctx.fill();
        
        ctx.restore();
    }

    renderLapTimer(ctx) {
        const x = this.canvas.width / 2;
        const y = 30;
        
        ctx.fillStyle = '#ffffff';
        ctx.font = '20px Arial';
        ctx.textAlign = 'center';
        
        // Current lap time
        const minutes = Math.floor(this.currentLapTime / 60);
        const seconds = (this.currentLapTime % 60).toFixed(2);
        ctx.fillText(`${minutes}:${seconds.padStart(5, '0')}`, x, y);
        
        // Best lap
        if (this.bestLapTime < Infinity) {
            ctx.font = '14px Arial';
            ctx.fillStyle = '#00ff88';
            const bestMin = Math.floor(this.bestLapTime / 60);
            const bestSec = (this.bestLapTime % 60).toFixed(2);
            ctx.fillText(`Best: ${bestMin}:${bestSec.padStart(5, '0')}`, x, y + 20);
        }
    }

    renderPauseOverlay() {
        const ctx = this.ctx;
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('PAUSED', this.canvas.width/2, this.canvas.height/2);
        
        ctx.font = '20px Arial';
        ctx.fillText('Press P or ESC to resume', this.canvas.width/2, this.canvas.height/2 + 40);
    }

    renderDebugInfo() {
        const ctx = this.ctx;
        const x = this.canvas.width - 200;
        const y = 200;
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(x, y, 190, 180);
        
        ctx.fillStyle = '#00ff00';
        ctx.font = '12px monospace';
        ctx.textAlign = 'left';
        
        const info = [
            `FPS: ${this.fps}`,
            `Pos: ${this.car.position.x.toFixed(0)}, ${this.car.position.y.toFixed(0)}`,
            `Vel: ${this.car.velocity.length().toFixed(1)} m/s`,
            `Angle: ${(this.car.angle * 180 / Math.PI).toFixed(1)}°`,
            `Drift: ${this.car.driftAngle.toFixed(1)}°`,
            `RPM: ${this.car.engineRPM.toFixed(0)}`,
            `Gear: ${this.car.gear}`,
            `Surface: ${this.car.currentSurface.name}`,
            `Particles: ${this.particles.emitters.length}`,
            `Skids: ${this.particles.skidMarks.length}`,
            `Damage: ${(this.car.damage.total * 100).toFixed(0)}%`
        ];
        
        info.forEach((text, i) => {
            ctx.fillText(text, x + 10, y + 20 + i * 15);
        });
    }
}

// Start the game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.game = new Game();
});