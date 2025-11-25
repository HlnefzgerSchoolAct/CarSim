/**
 * PhysicsEngine.js
 * Core physics simulation engine with fixed timestep and interpolation
 * 
 * Implements:
 * - Fixed timestep physics (240 Hz for stability)
 * - Render interpolation for smooth visuals
 * - Collision detection and response
 * - Constraint solving
 * - Performance monitoring
 * 
 * References:
 * - "Fix Your Timestep!" by Glenn Fiedler
 * - "Game Programming Patterns" by Robert Nystrom
 */

/**
 * Physics engine class
 */
class PhysicsEngine {
    /**
     * Create physics engine
     * @param {Object} config - Configuration options
     */
    constructor(config = {}) {
        // Timestep configuration
        this.fixedTimeStep = config.fixedTimeStep || 1/240; // 240 Hz physics
        this.maxSubSteps = config.maxSubSteps || 10;
        this.accumulator = 0;
        
        // Simulation state
        this.bodies = new Map();
        this.constraints = [];
        this.collisionPairs = [];
        
        // Spatial partitioning for broad-phase collision
        this.spatialHash = null; // Will be set externally
        
        // World properties
        this.gravity = new Float32Array(config.gravity || [0, -9.81, 0]); // m/s²
        this.airDensity = config.airDensity || 1.225; // kg/m³
        
        // Solver configuration
        this.solverIterations = config.solverIterations || 10;
        this.positionCorrectionIterations = config.positionCorrectionIterations || 3;
        this.baumgarteStabilization = config.baumgarteStabilization || 0.2;
        
        // Performance monitoring
        this.stats = {
            fps: 0,
            physicsTime: 0,
            collisionTime: 0,
            solverTime: 0,
            bodiesActive: 0,
            bodiesAsleep: 0,
            constraints: 0,
            collisionPairs: 0
        };
        
        // Time tracking
        this.time = 0;
        this.frameCount = 0;
        this.lastStatsUpdate = 0;
        
        // Callbacks
        this.onCollision = null; // Called when collision detected
        this.onPreStep = null; // Called before physics step
        this.onPostStep = null; // Called after physics step
        
        // State
        this.paused = false;
        this.stepOnce = false;
    }

    /**
     * Add a rigid body to the simulation
     * @param {RigidBody} body 
     * @param {string} id - Unique identifier
     */
    addBody(body, id) {
        this.bodies.set(id, body);
        
        // Add to spatial hash if available
        if (this.spatialHash) {
            this.spatialHash.insert(body, id);
        }
    }

    /**
     * Remove a rigid body from the simulation
     * @param {string} id 
     */
    removeBody(id) {
        if (this.spatialHash) {
            this.spatialHash.remove(id);
        }
        this.bodies.delete(id);
    }

    /**
     * Get a body by ID
     * @param {string} id 
     * @returns {RigidBody|null}
     */
    getBody(id) {
        return this.bodies.get(id) || null;
    }

    /**
     * Add a constraint to the simulation
     * @param {*} constraint 
     */
    addConstraint(constraint) {
        this.constraints.push(constraint);
    }

    /**
     * Remove a constraint from the simulation
     * @param {*} constraint 
     */
    removeConstraint(constraint) {
        const index = this.constraints.indexOf(constraint);
        if (index !== -1) {
            this.constraints.splice(index, 1);
        }
    }

    /**
     * Update physics simulation
     * @param {number} deltaTime - Time since last frame in seconds
     */
    update(deltaTime) {
        if (this.paused && !this.stepOnce) return;
        this.stepOnce = false;
        
        const startTime = performance.now();
        
        // Clamp delta time to prevent spiral of death
        deltaTime = Math.min(deltaTime, 0.1);
        
        // Accumulate time
        this.accumulator += deltaTime;
        
        // Fixed timestep loop
        let steps = 0;
        while (this.accumulator >= this.fixedTimeStep && steps < this.maxSubSteps) {
            this.step(this.fixedTimeStep);
            this.accumulator -= this.fixedTimeStep;
            this.time += this.fixedTimeStep;
            steps++;
        }
        
        // If we're still behind, reset accumulator to prevent spiral
        if (this.accumulator >= this.fixedTimeStep) {
            this.accumulator = 0;
        }
        
        // Calculate interpolation alpha for smooth rendering
        const alpha = this.accumulator / this.fixedTimeStep;
        
        // Interpolate visual positions (if needed by renderer)
        this.interpolateStates(alpha);
        
        // Update performance stats
        this.stats.physicsTime = performance.now() - startTime;
        this.updateStats();
    }

    /**
     * Single physics step
     * @param {number} dt - Fixed time step
     */
    step(dt) {
        // Pre-step callback
        if (this.onPreStep) {
            this.onPreStep(dt);
        }
        
        // 1. Apply forces
        this.applyForces(dt);
        
        // 2. Integrate velocities and positions
        this.integrate(dt);
        
        // 3. Update spatial partitioning
        this.updateSpatialHash();
        
        // 4. Broad-phase collision detection
        const broadPhaseTime = performance.now();
        this.broadPhaseCollision();
        
        // 5. Narrow-phase collision detection
        this.narrowPhaseCollision();
        this.stats.collisionTime = performance.now() - broadPhaseTime;
        
        // 6. Solve constraints and contacts
        const solverTime = performance.now();
        this.solveConstraints(dt);
        this.stats.solverTime = performance.now() - solverTime;
        
        // 7. Position correction
        this.correctPositions();
        
        // Post-step callback
        if (this.onPostStep) {
            this.onPostStep(dt);
        }
        
        this.frameCount++;
    }

    /**
     * Apply forces to all bodies
     * @param {number} dt 
     */
    applyForces(dt) {
        for (const [id, body] of this.bodies) {
            if (body.isStatic || body.isKinematic || !body.isAwake) continue;
            
            // Apply gravity
            const gravityForce = new Float32Array([
                this.gravity[0] * body.mass,
                this.gravity[1] * body.mass,
                this.gravity[2] * body.mass
            ]);
            body.applyForce(gravityForce);
            
            // Apply air drag (simplified)
            const speed = body.getSpeed();
            if (speed > 0.01) {
                // Drag force: F = 0.5 * ρ * v² * Cd * A
                const dragMagnitude = 0.5 * this.airDensity * speed * speed * 
                                     0.3 * 2.0; // Cd and area are approximate
                
                const dragForce = new Float32Array([
                    -body.velocity[0] / speed * dragMagnitude,
                    -body.velocity[1] / speed * dragMagnitude,
                    -body.velocity[2] / speed * dragMagnitude
                ]);
                body.applyForce(dragForce);
            }
        }
    }

    /**
     * Integrate all bodies
     * @param {number} dt 
     */
    integrate(dt) {
        let activeCount = 0;
        let asleepCount = 0;
        
        for (const [id, body] of this.bodies) {
            if (body.isAwake) {
                body.integrate(dt);
                activeCount++;
            } else {
                asleepCount++;
            }
        }
        
        this.stats.bodiesActive = activeCount;
        this.stats.bodiesAsleep = asleepCount;
    }

    /**
     * Update spatial hash with new body positions
     */
    updateSpatialHash() {
        if (!this.spatialHash) return;
        
        for (const [id, body] of this.bodies) {
            this.spatialHash.update(body, id);
        }
    }

    /**
     * Broad-phase collision detection
     */
    broadPhaseCollision() {
        this.collisionPairs = [];
        
        if (this.spatialHash) {
            // Use spatial hash for efficient broad-phase
            const potentialPairs = this.spatialHash.getAllPotentialPairsFiltered(
                (body1, body2) => {
                    // Filter static-static pairs
                    if (body1.isStatic && body2.isStatic) return false;
                    // Filter sleeping pairs
                    if (!body1.isAwake && !body2.isAwake) return false;
                    // Check collision masks
                    return (body1.collisionGroup & body2.collisionMask) !== 0 &&
                           (body2.collisionGroup & body1.collisionMask) !== 0;
                }
            );
            
            this.collisionPairs = potentialPairs;
        } else {
            // Fallback: check all pairs (O(n²) - slow!)
            const bodies = Array.from(this.bodies.values());
            for (let i = 0; i < bodies.length; i++) {
                for (let j = i + 1; j < bodies.length; j++) {
                    const body1 = bodies[i];
                    const body2 = bodies[j];
                    
                    if (body1.isStatic && body2.isStatic) continue;
                    if (!body1.isAwake && !body2.isAwake) continue;
                    
                    this.collisionPairs.push([
                        { object: body1, id: i },
                        { object: body2, id: j }
                    ]);
                }
            }
        }
        
        this.stats.collisionPairs = this.collisionPairs.length;
    }

    /**
     * Narrow-phase collision detection
     */
    narrowPhaseCollision() {
        const contacts = [];
        
        for (const [item1, item2] of this.collisionPairs) {
            const body1 = item1.object;
            const body2 = item2.object;
            
            // Simple sphere-sphere collision
            // In a full implementation, this would support multiple shapes
            const contact = this.detectCollision(body1, body2);
            if (contact) {
                contacts.push(contact);
                
                // Call collision callback
                if (this.onCollision) {
                    this.onCollision(body1, body2, contact);
                }
            }
        }
        
        // Store contacts for constraint solving
        this.contacts = contacts;
    }

    /**
     * Detect collision between two bodies
     * @param {RigidBody} body1 
     * @param {RigidBody} body2 
     * @returns {Object|null} Contact info or null
     */
    detectCollision(body1, body2) {
        // Simple sphere-sphere collision
        // Real implementation would support boxes, capsules, meshes, etc.
        
        const dx = body2.position[0] - body1.position[0];
        const dy = body2.position[1] - body1.position[1];
        const dz = body2.position[2] - body1.position[2];
        const distSq = dx * dx + dy * dy + dz * dz;
        
        const r1 = body1.boundingRadius;
        const r2 = body2.boundingRadius;
        const radiusSum = r1 + r2;
        
        if (distSq < radiusSum * radiusSum) {
            const dist = Math.sqrt(distSq);
            
            // Contact normal (from body1 to body2)
            const normal = new Float32Array([
                dx / dist,
                dy / dist,
                dz / dist
            ]);
            
            // Penetration depth
            const penetration = radiusSum - dist;
            
            // Contact point (on surface of body1)
            const contactPoint = new Float32Array([
                body1.position[0] + normal[0] * r1,
                body1.position[1] + normal[1] * r1,
                body1.position[2] + normal[2] * r1
            ]);
            
            return {
                body1,
                body2,
                normal,
                penetration,
                contactPoint
            };
        }
        
        return null;
    }

    /**
     * Solve constraints using iterative solver
     * @param {number} dt 
     */
    solveConstraints(dt) {
        // Solve velocity constraints
        for (let iter = 0; iter < this.solverIterations; iter++) {
            // Solve user constraints
            for (const constraint of this.constraints) {
                if (constraint.solve) {
                    constraint.solve(dt);
                }
            }
            
            // Solve contact constraints
            for (const contact of this.contacts || []) {
                this.solveContact(contact, dt);
            }
        }
    }

    /**
     * Solve a contact constraint
     * @param {Object} contact 
     * @param {number} dt 
     */
    solveContact(contact, dt) {
        const body1 = contact.body1;
        const body2 = contact.body2;
        const normal = contact.normal;
        const contactPoint = contact.contactPoint;
        
        // Get relative velocity at contact point
        const v1 = body1.getVelocityAtPoint(contactPoint);
        const v2 = body2.getVelocityAtPoint(contactPoint);
        
        const relVel = new Float32Array([
            v2[0] - v1[0],
            v2[1] - v1[1],
            v2[2] - v1[2]
        ]);
        
        // Velocity along normal
        const velAlongNormal = relVel[0] * normal[0] + 
                              relVel[1] * normal[1] + 
                              relVel[2] * normal[2];
        
        // Don't resolve if velocities are separating
        if (velAlongNormal > 0) return;
        
        // Calculate restitution
        const e = Math.min(body1.restitution, body2.restitution);
        
        // Calculate impulse scalar
        let j = -(1 + e) * velAlongNormal;
        j /= body1.invMass + body2.invMass;
        
        // Apply impulse
        const impulse = new Float32Array([
            normal[0] * j,
            normal[1] * j,
            normal[2] * j
        ]);
        
        body1.applyImpulseAtPoint([
            -impulse[0],
            -impulse[1],
            -impulse[2]
        ], contactPoint);
        
        body2.applyImpulseAtPoint(impulse, contactPoint);
        
        // Friction
        this.solveFriction(contact, body1, body2, relVel, normal, j);
    }

    /**
     * Solve friction for a contact
     * @param {Object} contact 
     * @param {RigidBody} body1 
     * @param {RigidBody} body2 
     * @param {Float32Array} relVel 
     * @param {Float32Array} normal 
     * @param {number} normalImpulse 
     */
    solveFriction(contact, body1, body2, relVel, normal, normalImpulse) {
        // Calculate tangent (perpendicular to normal in plane of motion)
        const velAlongNormal = relVel[0] * normal[0] + 
                              relVel[1] * normal[1] + 
                              relVel[2] * normal[2];
        
        const tangent = new Float32Array([
            relVel[0] - normal[0] * velAlongNormal,
            relVel[1] - normal[1] * velAlongNormal,
            relVel[2] - normal[2] * velAlongNormal
        ]);
        
        const tangentLen = Math.sqrt(
            tangent[0] * tangent[0] + 
            tangent[1] * tangent[1] + 
            tangent[2] * tangent[2]
        );
        
        if (tangentLen < 0.001) return;
        
        // Normalize tangent
        tangent[0] /= tangentLen;
        tangent[1] /= tangentLen;
        tangent[2] /= tangentLen;
        
        // Calculate friction impulse
        const mu = (body1.friction + body2.friction) * 0.5;
        let jt = -(tangent[0] * relVel[0] + 
                  tangent[1] * relVel[1] + 
                  tangent[2] * relVel[2]);
        jt /= body1.invMass + body2.invMass;
        
        // Coulomb's law: friction force <= μ * normal force
        if (Math.abs(jt) > Math.abs(normalImpulse) * mu) {
            jt = Math.sign(jt) * Math.abs(normalImpulse) * mu;
        }
        
        // Apply friction impulse
        const frictionImpulse = new Float32Array([
            tangent[0] * jt,
            tangent[1] * jt,
            tangent[2] * jt
        ]);
        
        body1.applyImpulse([
            -frictionImpulse[0],
            -frictionImpulse[1],
            -frictionImpulse[2]
        ]);
        
        body2.applyImpulse(frictionImpulse);
    }

    /**
     * Correct positions to resolve penetration
     */
    correctPositions() {
        const slop = 0.01; // Penetration allowance
        const percent = this.baumgarteStabilization;
        
        for (const contact of this.contacts || []) {
            if (contact.penetration <= slop) continue;
            
            const body1 = contact.body1;
            const body2 = contact.body2;
            const normal = contact.normal;
            
            const correction = Math.max(contact.penetration - slop, 0) / 
                             (body1.invMass + body2.invMass) * percent;
            
            if (!body1.isStatic && !body1.isKinematic) {
                body1.position[0] -= normal[0] * correction * body1.invMass;
                body1.position[1] -= normal[1] * correction * body1.invMass;
                body1.position[2] -= normal[2] * correction * body1.invMass;
                body1.updateDerivedQuantities();
            }
            
            if (!body2.isStatic && !body2.isKinematic) {
                body2.position[0] += normal[0] * correction * body2.invMass;
                body2.position[1] += normal[1] * correction * body2.invMass;
                body2.position[2] += normal[2] * correction * body2.invMass;
                body2.updateDerivedQuantities();
            }
        }
    }

    /**
     * Interpolate states for smooth rendering
     * @param {number} alpha - Interpolation factor [0, 1]
     */
    interpolateStates(alpha) {
        // In a full implementation, this would interpolate between
        // previous and current states for smooth rendering
        // For now, we just use current state
    }

    /**
     * Update performance statistics
     */
    updateStats() {
        const now = performance.now();
        if (now - this.lastStatsUpdate > 1000) {
            this.stats.fps = this.frameCount;
            this.frameCount = 0;
            this.lastStatsUpdate = now;
        }
        
        this.stats.constraints = this.constraints.length;
    }

    /**
     * Get statistics
     * @returns {Object}
     */
    getStats() {
        return { ...this.stats };
    }

    /**
     * Set gravity
     * @param {Float32Array|Array} gravity 
     */
    setGravity(gravity) {
        this.gravity[0] = gravity[0];
        this.gravity[1] = gravity[1];
        this.gravity[2] = gravity[2];
    }

    /**
     * Pause simulation
     */
    pause() {
        this.paused = true;
    }

    /**
     * Resume simulation
     */
    resume() {
        this.paused = false;
    }

    /**
     * Step simulation once (when paused)
     */
    singleStep() {
        this.stepOnce = true;
    }

    /**
     * Reset simulation
     */
    reset() {
        this.time = 0;
        this.accumulator = 0;
        this.frameCount = 0;
        this.collisionPairs = [];
        this.contacts = [];
        
        for (const [id, body] of this.bodies) {
            body.setVelocity([0, 0, 0]);
            body.angularVelocity[0] = 0;
            body.angularVelocity[1] = 0;
            body.angularVelocity[2] = 0;
            body.clearForces();
        }
    }

    /**
     * Clear all bodies and constraints
     */
    clear() {
        this.bodies.clear();
        this.constraints = [];
        this.collisionPairs = [];
        this.contacts = [];
        if (this.spatialHash) {
            this.spatialHash.clear();
        }
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PhysicsEngine };
}
