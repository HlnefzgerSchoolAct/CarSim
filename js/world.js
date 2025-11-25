/**
 * World Class
 * Creates the game environment including roads, obstacles, and surface types
 * Inspired by BeamNG.drive open world design
 */
class World {
    constructor() {
        // World dimensions
        this.width = 4000;
        this.height = 4000;
        
        // Collections
        this.obstacles = [];
        this.walls = [];
        this.surfaceZones = [];
        this.driftZones = [];
        this.cones = [];
        this.trees = [];
        this.buildings = [];
        
        // Track elements
        this.roads = [];
        this.roadMarkings = [];
        this.curbs = [];
        
        // Static car obstacles
        this.parkedCars = [];
        
        // Create world elements
        this.createTrack();
        this.createObstacles();
        this.createDriftZones();
        this.createScenery();
    }

    createTrack() {
        // Main oval track
        const trackWidth = 120;
        
        // Define road segments (center points)
        // Main circuit
        this.roads.push({
            type: 'straight',
            x1: -800, y1: -600,
            x2: 800, y2: -600,
            width: trackWidth
        });
        
        this.roads.push({
            type: 'straight',
            x1: -800, y1: 600,
            x2: 800, y2: 600,
            width: trackWidth
        });
        
        // Cross roads
        this.roads.push({
            type: 'straight',
            x1: 0, y1: -1000,
            x2: 0, y2: 1000,
            width: trackWidth * 0.8
        });
        
        // Additional roads
        this.roads.push({
            type: 'straight',
            x1: -1200, y1: 0,
            x2: 1200, y2: 0,
            width: trackWidth * 0.8
        });
        
        // Corners (curves represented as arcs)
        this.roads.push({
            type: 'curve',
            cx: 800, cy: 0,
            radius: 600,
            startAngle: -Math.PI/2,
            endAngle: Math.PI/2,
            width: trackWidth
        });
        
        this.roads.push({
            type: 'curve',
            cx: -800, cy: 0,
            radius: 600,
            startAngle: Math.PI/2,
            endAngle: 3*Math.PI/2,
            width: trackWidth
        });
        
        // Outer boundary walls
        this.createBoundaryWalls();
        
        // Track barriers
        this.createTrackBarriers();
    }

    createBoundaryWalls() {
        const halfW = this.width / 2;
        const halfH = this.height / 2;
        const wallThickness = 50;
        
        // North wall
        this.walls.push({
            type: 'concrete',
            x: 0, y: -halfH,
            width: this.width, height: wallThickness,
            angle: 0,
            damage: 1.0 // High damage on impact
        });
        
        // South wall
        this.walls.push({
            type: 'concrete',
            x: 0, y: halfH,
            width: this.width, height: wallThickness,
            angle: 0,
            damage: 1.0
        });
        
        // East wall
        this.walls.push({
            type: 'concrete',
            x: halfW, y: 0,
            width: wallThickness, height: this.height,
            angle: 0,
            damage: 1.0
        });
        
        // West wall
        this.walls.push({
            type: 'concrete',
            x: -halfW, y: 0,
            width: wallThickness, height: this.height,
            angle: 0,
            damage: 1.0
        });
    }

    createTrackBarriers() {
        // Inner track barriers - tire barriers (softer)
        const innerBarriers = [
            { x: 0, y: 0, width: 100, height: 600, angle: 0 },
            { x: 500, y: 300, width: 200, height: 30, angle: Math.PI/6 },
            { x: -500, y: -300, width: 200, height: 30, angle: -Math.PI/6 }
        ];
        
        for (const b of innerBarriers) {
            this.walls.push({
                type: 'tire',
                x: b.x, y: b.y,
                width: b.width, height: b.height,
                angle: b.angle,
                damage: 0.3 // Lower damage
            });
        }
    }

    createObstacles() {
        // Create cones around track
        const conePositions = [
            { x: -50, y: -550 }, { x: 50, y: -550 },
            { x: -50, y: 550 }, { x: 50, y: 550 },
            { x: -100, y: -500 }, { x: 100, y: -500 },
            { x: -100, y: 500 }, { x: 100, y: 500 },
            { x: 750, y: -50 }, { x: 750, y: 50 },
            { x: -750, y: -50 }, { x: -750, y: 50 }
        ];
        
        for (const pos of conePositions) {
            this.cones.push({
                x: pos.x, y: pos.y,
                radius: 8,
                knocked: false,
                knockAngle: 0,
                color: '#ff6600'
            });
        }
        
        // Add to obstacles list for collision
        for (const cone of this.cones) {
            this.obstacles.push({
                type: 'cone',
                x: cone.x, y: cone.y,
                radius: cone.radius,
                data: cone
            });
        }
    }

    createDriftZones() {
        // Designated drift areas with scoring
        this.driftZones.push({
            x: 800, y: 0,
            width: 400, height: 300,
            angle: 0,
            multiplier: 2.0,
            name: 'Turn 1'
        });
        
        this.driftZones.push({
            x: -800, y: 0,
            width: 400, height: 300,
            angle: 0,
            multiplier: 2.0,
            name: 'Turn 2'
        });
        
        this.driftZones.push({
            x: 0, y: 0,
            width: 200, height: 200,
            angle: Math.PI/4,
            multiplier: 1.5,
            name: 'Center'
        });
    }

    createScenery() {
        // Trees scattered around the map
        const treePositions = [];
        const numTrees = 50;
        
        for (let i = 0; i < numTrees; i++) {
            // Random position avoiding roads
            let x, y;
            do {
                x = (Math.random() - 0.5) * this.width * 0.9;
                y = (Math.random() - 0.5) * this.height * 0.9;
            } while (this.isOnRoad(x, y));
            
            treePositions.push({ x, y });
        }
        
        for (const pos of treePositions) {
            const tree = {
                x: pos.x, y: pos.y,
                radius: 15 + Math.random() * 10,
                height: 30 + Math.random() * 20,
                type: Math.random() > 0.5 ? 'pine' : 'oak'
            };
            this.trees.push(tree);
            
            // Add as obstacle
            this.obstacles.push({
                type: 'tree',
                x: tree.x, y: tree.y,
                radius: tree.radius * 0.4, // Trunk radius
                data: tree
            });
        }
        
        // Buildings in corners
        const buildingPositions = [
            { x: 1500, y: 1500, w: 200, h: 150 },
            { x: -1500, y: 1500, w: 180, h: 200 },
            { x: 1500, y: -1500, w: 150, h: 180 },
            { x: -1500, y: -1500, w: 220, h: 160 }
        ];
        
        for (const b of buildingPositions) {
            this.buildings.push({
                x: b.x, y: b.y,
                width: b.w, height: b.h,
                color: `hsl(${Math.random() * 30 + 20}, 20%, ${40 + Math.random() * 20}%)`
            });
            
            // Add as wall obstacle
            this.walls.push({
                type: 'building',
                x: b.x, y: b.y,
                width: b.w, height: b.h,
                angle: 0,
                damage: 1.0
            });
        }
        
        // Parked cars as obstacles
        const parkedCarPositions = [
            { x: 300, y: -700, angle: 0 },
            { x: -300, y: 700, angle: Math.PI },
            { x: 1100, y: 200, angle: Math.PI/2 },
            { x: -1100, y: -200, angle: -Math.PI/2 }
        ];
        
        for (const pc of parkedCarPositions) {
            this.parkedCars.push({
                x: pc.x, y: pc.y,
                width: 40, height: 80,
                angle: pc.angle,
                color: `hsl(${Math.random() * 360}, 60%, 50%)`
            });
            
            this.obstacles.push({
                type: 'car',
                x: pc.x, y: pc.y,
                width: 40, height: 80,
                angle: pc.angle
            });
        }
    }

    /**
     * Check if a point is on a road
     */
    isOnRoad(x, y) {
        // Simple check for main roads
        const roadHalfWidth = 70;
        
        // Horizontal main roads
        if (Math.abs(y - (-600)) < roadHalfWidth && Math.abs(x) < 900) return true;
        if (Math.abs(y - 600) < roadHalfWidth && Math.abs(x) < 900) return true;
        
        // Vertical roads
        if (Math.abs(x) < roadHalfWidth * 0.8 && Math.abs(y) < 1100) return true;
        if (Math.abs(y) < roadHalfWidth * 0.8 && Math.abs(x) < 1300) return true;
        
        // Curved sections - use squared distances for performance
        const dx1 = x - 800;
        const dx2 = x + 800;
        const dist1Sq = dx1 * dx1 + y * y;
        const dist2Sq = dx2 * dx2 + y * y;
        const minRadiusSq = (600 - roadHalfWidth) * (600 - roadHalfWidth);
        const maxRadiusSq = (600 + roadHalfWidth) * (600 + roadHalfWidth);
        if (dist1Sq > minRadiusSq && dist1Sq < maxRadiusSq) return true;
        if (dist2Sq > minRadiusSq && dist2Sq < maxRadiusSq) return true;
        
        return false;
    }

    /**
     * Get surface type at position
     */
    getSurfaceAt(x, y) {
        // Check for specific surface zones first
        for (const zone of this.surfaceZones) {
            if (this.pointInRect(x, y, zone)) {
                return zone.surface;
            }
        }
        
        // Check if on road
        if (this.isOnRoad(x, y)) {
            return SurfaceType.ASPHALT;
        }
        
        // Check for gravel areas (around track edges) - use squared distances
        const distFromCenterSq = x * x + y * y;
        const innerGravelSq = 1600 * 1600;
        const outerGravelSq = 1800 * 1800;
        if (distFromCenterSq > innerGravelSq && distFromCenterSq < outerGravelSq) {
            return SurfaceType.GRAVEL;
        }
        
        // Default to grass
        return SurfaceType.GRASS;
    }

    pointInRect(px, py, rect) {
        const dx = px - rect.x;
        const dy = py - rect.y;
        const cos = Math.cos(-rect.angle || 0);
        const sin = Math.sin(-rect.angle || 0);
        const localX = dx * cos - dy * sin;
        const localY = dx * sin + dy * cos;
        
        return Math.abs(localX) < rect.width / 2 && Math.abs(localY) < rect.height / 2;
    }

    /**
     * Check if car is in drift zone
     */
    getDriftZoneAt(x, y) {
        for (const zone of this.driftZones) {
            if (this.pointInRect(x, y, zone)) {
                return zone;
            }
        }
        return null;
    }

    /**
     * Get all collidable obstacles near a position
     */
    getObstaclesNear(x, y, radius) {
        const result = [];
        
        // Check circular obstacles
        for (const obs of this.obstacles) {
            const dx = obs.x - x;
            const dy = obs.y - y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            
            if (dist < radius + (obs.radius || 50)) {
                result.push(obs);
            }
        }
        
        // Check walls
        for (const wall of this.walls) {
            const dx = wall.x - x;
            const dy = wall.y - y;
            const maxDim = Math.max(wall.width, wall.height);
            const dist = Math.sqrt(dx*dx + dy*dy);
            
            if (dist < radius + maxDim) {
                result.push({
                    type: 'wall',
                    ...wall
                });
            }
        }
        
        return result;
    }

    /**
     * Handle cone collision - knock it over
     */
    knockCone(cone, velocity) {
        cone.knocked = true;
        cone.knockAngle = Math.atan2(velocity.y, velocity.x);
        cone.knockSpeed = velocity.length() * 0.3;
    }

    /**
     * Update dynamic world elements
     */
    update(deltaTime) {
        // Update knocked cones
        for (const cone of this.cones) {
            if (cone.knocked && cone.knockSpeed > 0) {
                cone.x += Math.cos(cone.knockAngle) * cone.knockSpeed * deltaTime;
                cone.y += Math.sin(cone.knockAngle) * cone.knockSpeed * deltaTime;
                cone.knockSpeed *= 0.95; // Friction
            }
        }
    }

    /**
     * Render the world
     */
    render(ctx, camera) {
        const canvasW = ctx.canvas.width;
        const canvasH = ctx.canvas.height;
        
        // Calculate visible area
        const viewLeft = camera.x - canvasW / 2 / camera.scale;
        const viewRight = camera.x + canvasW / 2 / camera.scale;
        const viewTop = camera.y - canvasH / 2 / camera.scale;
        const viewBottom = camera.y + canvasH / 2 / camera.scale;
        
        // Draw grass background
        ctx.fillStyle = '#3a7d3a';
        ctx.fillRect(0, 0, canvasW, canvasH);
        
        // Draw grass texture (simple pattern)
        this.renderGrassTexture(ctx, camera);
        
        // Draw gravel areas
        this.renderGravelAreas(ctx, camera);
        
        // Draw roads
        this.renderRoads(ctx, camera);
        
        // Draw drift zones
        this.renderDriftZones(ctx, camera);
        
        // Draw road markings
        this.renderRoadMarkings(ctx, camera);
        
        // Draw walls/barriers
        this.renderWalls(ctx, camera);
        
        // Draw buildings
        this.renderBuildings(ctx, camera);
        
        // Draw trees
        this.renderTrees(ctx, camera);
        
        // Draw parked cars
        this.renderParkedCars(ctx, camera);
        
        // Draw cones
        this.renderCones(ctx, camera);
    }

    renderGrassTexture(ctx, camera) {
        // Simple grass variation
        ctx.fillStyle = '#327532';
        const gridSize = 200;
        
        for (let x = -this.width/2; x < this.width/2; x += gridSize) {
            for (let y = -this.height/2; y < this.height/2; y += gridSize) {
                if ((Math.floor(x/gridSize) + Math.floor(y/gridSize)) % 2 === 0) {
                    const screenX = (x - camera.x) * camera.scale + ctx.canvas.width / 2;
                    const screenY = (y - camera.y) * camera.scale + ctx.canvas.height / 2;
                    ctx.fillRect(screenX, screenY, gridSize * camera.scale, gridSize * camera.scale);
                }
            }
        }
    }

    renderGravelAreas(ctx, camera) {
        ctx.fillStyle = '#8b7355';
        
        // Ring of gravel around outer edge
        const screenCX = (0 - camera.x) * camera.scale + ctx.canvas.width / 2;
        const screenCY = (0 - camera.y) * camera.scale + ctx.canvas.height / 2;
        
        ctx.beginPath();
        ctx.arc(screenCX, screenCY, 1800 * camera.scale, 0, Math.PI * 2);
        ctx.arc(screenCX, screenCY, 1600 * camera.scale, 0, Math.PI * 2, true);
        ctx.fill();
    }

    renderRoads(ctx, camera) {
        ctx.fillStyle = '#333333';
        ctx.strokeStyle = '#222222';
        ctx.lineWidth = 2;
        
        for (const road of this.roads) {
            if (road.type === 'straight') {
                // Calculate road rectangle
                const dx = road.x2 - road.x1;
                const dy = road.y2 - road.y1;
                const len = Math.sqrt(dx*dx + dy*dy);
                const angle = Math.atan2(dy, dx);
                
                const cx = (road.x1 + road.x2) / 2;
                const cy = (road.y1 + road.y2) / 2;
                
                const screenX = (cx - camera.x) * camera.scale + ctx.canvas.width / 2;
                const screenY = (cy - camera.y) * camera.scale + ctx.canvas.height / 2;
                
                ctx.save();
                ctx.translate(screenX, screenY);
                ctx.rotate(angle);
                ctx.fillRect(-len/2 * camera.scale, -road.width/2 * camera.scale, 
                            len * camera.scale, road.width * camera.scale);
                ctx.restore();
            } else if (road.type === 'curve') {
                const screenCX = (road.cx - camera.x) * camera.scale + ctx.canvas.width / 2;
                const screenCY = (road.cy - camera.y) * camera.scale + ctx.canvas.height / 2;
                
                ctx.beginPath();
                ctx.arc(screenCX, screenCY, (road.radius + road.width/2) * camera.scale, 
                       road.startAngle, road.endAngle);
                ctx.arc(screenCX, screenCY, (road.radius - road.width/2) * camera.scale, 
                       road.endAngle, road.startAngle, true);
                ctx.closePath();
                ctx.fill();
            }
        }
    }

    renderDriftZones(ctx, camera) {
        ctx.globalAlpha = 0.3;
        
        for (const zone of this.driftZones) {
            const screenX = (zone.x - camera.x) * camera.scale + ctx.canvas.width / 2;
            const screenY = (zone.y - camera.y) * camera.scale + ctx.canvas.height / 2;
            
            ctx.save();
            ctx.translate(screenX, screenY);
            ctx.rotate(zone.angle);
            
            // Gradient fill
            const gradient = ctx.createLinearGradient(
                -zone.width/2 * camera.scale, 0, zone.width/2 * camera.scale, 0
            );
            gradient.addColorStop(0, '#ff6600');
            gradient.addColorStop(0.5, '#ffaa00');
            gradient.addColorStop(1, '#ff6600');
            
            ctx.fillStyle = gradient;
            ctx.fillRect(-zone.width/2 * camera.scale, -zone.height/2 * camera.scale,
                        zone.width * camera.scale, zone.height * camera.scale);
            
            // Border
            ctx.strokeStyle = '#ff6600';
            ctx.lineWidth = 3;
            ctx.setLineDash([10, 5]);
            ctx.strokeRect(-zone.width/2 * camera.scale, -zone.height/2 * camera.scale,
                          zone.width * camera.scale, zone.height * camera.scale);
            ctx.setLineDash([]);
            
            ctx.restore();
        }
        
        ctx.globalAlpha = 1;
    }

    renderRoadMarkings(ctx, camera) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3 * camera.scale;
        ctx.setLineDash([20 * camera.scale, 15 * camera.scale]);
        
        // Center lines for straight roads
        for (const road of this.roads) {
            if (road.type === 'straight') {
                const x1 = (road.x1 - camera.x) * camera.scale + ctx.canvas.width / 2;
                const y1 = (road.y1 - camera.y) * camera.scale + ctx.canvas.height / 2;
                const x2 = (road.x2 - camera.x) * camera.scale + ctx.canvas.width / 2;
                const y2 = (road.y2 - camera.y) * camera.scale + ctx.canvas.height / 2;
                
                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.stroke();
            }
        }
        
        ctx.setLineDash([]);
        
        // Edge lines (solid)
        ctx.lineWidth = 2 * camera.scale;
        for (const road of this.roads) {
            if (road.type === 'straight') {
                const dx = road.x2 - road.x1;
                const dy = road.y2 - road.y1;
                const len = Math.sqrt(dx*dx + dy*dy);
                const nx = -dy / len * road.width / 2;
                const ny = dx / len * road.width / 2;
                
                // Left edge
                const lx1 = (road.x1 + nx - camera.x) * camera.scale + ctx.canvas.width / 2;
                const ly1 = (road.y1 + ny - camera.y) * camera.scale + ctx.canvas.height / 2;
                const lx2 = (road.x2 + nx - camera.x) * camera.scale + ctx.canvas.width / 2;
                const ly2 = (road.y2 + ny - camera.y) * camera.scale + ctx.canvas.height / 2;
                
                ctx.beginPath();
                ctx.moveTo(lx1, ly1);
                ctx.lineTo(lx2, ly2);
                ctx.stroke();
                
                // Right edge
                const rx1 = (road.x1 - nx - camera.x) * camera.scale + ctx.canvas.width / 2;
                const ry1 = (road.y1 - ny - camera.y) * camera.scale + ctx.canvas.height / 2;
                const rx2 = (road.x2 - nx - camera.x) * camera.scale + ctx.canvas.width / 2;
                const ry2 = (road.y2 - ny - camera.y) * camera.scale + ctx.canvas.height / 2;
                
                ctx.beginPath();
                ctx.moveTo(rx1, ry1);
                ctx.lineTo(rx2, ry2);
                ctx.stroke();
            }
        }
    }

    renderWalls(ctx, camera) {
        for (const wall of this.walls) {
            const screenX = (wall.x - camera.x) * camera.scale + ctx.canvas.width / 2;
            const screenY = (wall.y - camera.y) * camera.scale + ctx.canvas.height / 2;
            
            ctx.save();
            ctx.translate(screenX, screenY);
            ctx.rotate(wall.angle);
            
            // Different colors for wall types
            if (wall.type === 'concrete') {
                ctx.fillStyle = '#666666';
                ctx.strokeStyle = '#444444';
            } else if (wall.type === 'tire') {
                ctx.fillStyle = '#333333';
                ctx.strokeStyle = '#222222';
            } else if (wall.type === 'building') {
                ctx.fillStyle = '#555555';
                ctx.strokeStyle = '#333333';
            }
            
            ctx.lineWidth = 2;
            ctx.fillRect(-wall.width/2 * camera.scale, -wall.height/2 * camera.scale,
                        wall.width * camera.scale, wall.height * camera.scale);
            ctx.strokeRect(-wall.width/2 * camera.scale, -wall.height/2 * camera.scale,
                          wall.width * camera.scale, wall.height * camera.scale);
            
            // Tire barrier pattern
            if (wall.type === 'tire') {
                ctx.fillStyle = '#444444';
                const spacing = 20 * camera.scale;
                for (let i = -wall.width/2 * camera.scale + spacing/2; 
                     i < wall.width/2 * camera.scale; i += spacing) {
                    ctx.beginPath();
                    ctx.arc(i, 0, 8 * camera.scale, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
            
            ctx.restore();
        }
    }

    renderBuildings(ctx, camera) {
        for (const building of this.buildings) {
            const screenX = (building.x - camera.x) * camera.scale + ctx.canvas.width / 2;
            const screenY = (building.y - camera.y) * camera.scale + ctx.canvas.height / 2;
            
            // Building shadow
            ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
            ctx.fillRect(
                screenX - building.width/2 * camera.scale + 10,
                screenY - building.height/2 * camera.scale + 10,
                building.width * camera.scale,
                building.height * camera.scale
            );
            
            // Building body
            ctx.fillStyle = building.color;
            ctx.fillRect(
                screenX - building.width/2 * camera.scale,
                screenY - building.height/2 * camera.scale,
                building.width * camera.scale,
                building.height * camera.scale
            );
            
            // Building outline
            ctx.strokeStyle = '#333333';
            ctx.lineWidth = 2;
            ctx.strokeRect(
                screenX - building.width/2 * camera.scale,
                screenY - building.height/2 * camera.scale,
                building.width * camera.scale,
                building.height * camera.scale
            );
            
            // Windows
            ctx.fillStyle = 'rgba(200, 220, 255, 0.6)';
            const windowSize = 15 * camera.scale;
            const windowGap = 25 * camera.scale;
            
            for (let wx = screenX - building.width/2 * camera.scale + windowGap;
                 wx < screenX + building.width/2 * camera.scale - windowSize;
                 wx += windowGap) {
                for (let wy = screenY - building.height/2 * camera.scale + windowGap;
                     wy < screenY + building.height/2 * camera.scale - windowSize;
                     wy += windowGap) {
                    ctx.fillRect(wx, wy, windowSize, windowSize);
                }
            }
        }
    }

    renderTrees(ctx, camera) {
        for (const tree of this.trees) {
            const screenX = (tree.x - camera.x) * camera.scale + ctx.canvas.width / 2;
            const screenY = (tree.y - camera.y) * camera.scale + ctx.canvas.height / 2;
            
            // Tree shadow
            ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
            ctx.beginPath();
            ctx.ellipse(screenX + 5, screenY + 5, 
                       tree.radius * camera.scale, tree.radius * camera.scale * 0.6,
                       0, 0, Math.PI * 2);
            ctx.fill();
            
            // Tree trunk
            ctx.fillStyle = '#5c4033';
            ctx.beginPath();
            ctx.arc(screenX, screenY, tree.radius * 0.3 * camera.scale, 0, Math.PI * 2);
            ctx.fill();
            
            // Tree foliage
            if (tree.type === 'pine') {
                ctx.fillStyle = '#1a5c1a';
                ctx.beginPath();
                ctx.moveTo(screenX, screenY - tree.height * camera.scale * 0.5);
                ctx.lineTo(screenX - tree.radius * camera.scale, screenY + tree.radius * 0.5 * camera.scale);
                ctx.lineTo(screenX + tree.radius * camera.scale, screenY + tree.radius * 0.5 * camera.scale);
                ctx.closePath();
                ctx.fill();
            } else {
                ctx.fillStyle = '#2d7a2d';
                ctx.beginPath();
                ctx.arc(screenX, screenY - tree.radius * 0.3 * camera.scale, 
                       tree.radius * camera.scale, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    renderParkedCars(ctx, camera) {
        for (const car of this.parkedCars) {
            const screenX = (car.x - camera.x) * camera.scale + ctx.canvas.width / 2;
            const screenY = (car.y - camera.y) * camera.scale + ctx.canvas.height / 2;
            
            ctx.save();
            ctx.translate(screenX, screenY);
            ctx.rotate(-car.angle);
            
            // Car shadow
            ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
            ctx.fillRect(-car.width/2 * camera.scale + 3, -car.height/2 * camera.scale + 3,
                        car.width * camera.scale, car.height * camera.scale);
            
            // Car body
            ctx.fillStyle = car.color;
            ctx.fillRect(-car.width/2 * camera.scale, -car.height/2 * camera.scale,
                        car.width * camera.scale, car.height * camera.scale);
            
            // Car outline
            ctx.strokeStyle = '#222222';
            ctx.lineWidth = 2;
            ctx.strokeRect(-car.width/2 * camera.scale, -car.height/2 * camera.scale,
                          car.width * camera.scale, car.height * camera.scale);
            
            // Windshield
            ctx.fillStyle = 'rgba(100, 150, 200, 0.7)';
            ctx.fillRect(-8 * camera.scale, -20 * camera.scale, 16 * camera.scale, 15 * camera.scale);
            
            ctx.restore();
        }
    }

    renderCones(ctx, camera) {
        for (const cone of this.cones) {
            const screenX = (cone.x - camera.x) * camera.scale + ctx.canvas.width / 2;
            const screenY = (cone.y - camera.y) * camera.scale + ctx.canvas.height / 2;
            
            ctx.save();
            ctx.translate(screenX, screenY);
            
            if (cone.knocked) {
                ctx.rotate(cone.knockAngle + Math.PI/2);
                // Lying cone
                ctx.fillStyle = cone.color;
                ctx.fillRect(-cone.radius * camera.scale, -3 * camera.scale,
                            cone.radius * 2 * camera.scale, 6 * camera.scale);
            } else {
                // Standing cone
                ctx.fillStyle = cone.color;
                ctx.beginPath();
                ctx.moveTo(0, -cone.radius * camera.scale);
                ctx.lineTo(-cone.radius * camera.scale * 0.7, cone.radius * camera.scale * 0.5);
                ctx.lineTo(cone.radius * camera.scale * 0.7, cone.radius * camera.scale * 0.5);
                ctx.closePath();
                ctx.fill();
                
                // White stripe
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.moveTo(0, -cone.radius * camera.scale * 0.3);
                ctx.lineTo(-cone.radius * camera.scale * 0.4, cone.radius * camera.scale * 0.1);
                ctx.lineTo(cone.radius * camera.scale * 0.4, cone.radius * camera.scale * 0.1);
                ctx.closePath();
                ctx.fill();
            }
            
            ctx.restore();
        }
    }

    /**
     * Get obstacles for collision testing
     */
    getObstacles() {
        return this.obstacles;
    }

    /**
     * Get walls for collision testing
     */
    getWalls() {
        return this.walls;
    }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.World = World;
}