/**
 * Physics Engine
 * Advanced physics calculations for the car simulator
 * Includes tire model, collisions, weight transfer, and friction calculations
 */

// ============================================================================
// VECTOR2 CLASS - Basic 2D vector math
// ============================================================================
class Vector2 {
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    }

    add(v) {
        return new Vector2(this.x + v.x, this.y + v.y);
    }

    subtract(v) {
        return new Vector2(this.x - v.x, this.y - v.y);
    }

    multiply(scalar) {
        return new Vector2(this.x * scalar, this.y * scalar);
    }

    divide(scalar) {
        if (scalar === 0) return new Vector2(0, 0);
        return new Vector2(this.x / scalar, this.y / scalar);
    }

    dot(v) {
        return this.x * v.x + this.y * v.y;
    }

    cross(v) {
        return this.x * v.y - this.y * v.x;
    }

    length() {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    }

    lengthSquared() {
        return this.x * this.x + this.y * this.y;
    }

    normalize() {
        const len = this.length();
        if (len === 0) return new Vector2(0, 0);
        return this.divide(len);
    }

    rotate(angle) {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        return new Vector2(
            this.x * cos - this.y * sin,
            this.x * sin + this.y * cos
        );
    }

    perpendicular() {
        return new Vector2(-this.y, this.x);
    }

    clone() {
        return new Vector2(this.x, this.y);
    }

    static fromAngle(angle, length = 1) {
        return new Vector2(Math.cos(angle) * length, Math.sin(angle) * length);
    }

    static lerp(a, b, t) {
        return new Vector2(
            a.x + (b.x - a.x) * t,
            a.y + (b.y - a.y) * t
        );
    }
}

// ============================================================================
// TIRE PHYSICS - Pacejka Magic Formula (simplified)
// ============================================================================
class TirePhysics {
    constructor() {
        // Pacejka Magic Formula coefficients (simplified)
        this.B = 10;   // Stiffness factor
        this.C = 1.9;  // Shape factor
        this.D = 1.0;  // Peak factor
        this.E = 0.97; // Curvature factor
    }

    /**
     * Calculate lateral force using simplified Pacejka formula
     * @param {number} slipAngle - Slip angle in radians
     * @param {number} load - Vertical load on tire
     * @param {number} surfaceGrip - Surface grip coefficient
     * @returns {number} Lateral force
     */
    calculateLateralForce(slipAngle, load, surfaceGrip = 1.0) {
        // Simplified Pacejka Magic Formula: F = D * sin(C * atan(B * slip))
        // Work directly with radians using adjusted coefficient
        const slipFactor = slipAngle * 5.73; // ~180/PI * 0.1 combined
        const force = this.D * Math.sin(this.C * Math.atan(this.B * slipFactor));
        return force * load * surfaceGrip;
    }

    /**
     * Calculate longitudinal force (traction/braking)
     * @param {number} slipRatio - Slip ratio (wheel speed vs ground speed)
     * @param {number} load - Vertical load on tire
     * @param {number} surfaceGrip - Surface grip coefficient
     * @returns {number} Longitudinal force
     */
    calculateLongitudinalForce(slipRatio, load, surfaceGrip = 1.0) {
        // Similar to lateral, but for forward/backward forces
        const force = this.D * Math.sin(this.C * Math.atan(this.B * slipRatio * 10));
        return force * load * surfaceGrip;
    }

    /**
     * Calculate combined grip using friction circle concept
     * @param {number} lateralForce - Lateral force
     * @param {number} longitudinalForce - Longitudinal force
     * @param {number} maxGrip - Maximum available grip
     * @returns {{lateral: number, longitudinal: number}} Adjusted forces
     */
    applyFrictionCircle(lateralForce, longitudinalForce, maxGrip) {
        const totalForce = Math.sqrt(lateralForce * lateralForce + longitudinalForce * longitudinalForce);
        
        if (totalForce > maxGrip) {
            const scale = maxGrip / totalForce;
            return {
                lateral: lateralForce * scale,
                longitudinal: longitudinalForce * scale
            };
        }
        
        return { lateral: lateralForce, longitudinal: longitudinalForce };
    }
}

// ============================================================================
// WHEEL CLASS - Individual wheel physics
// ============================================================================
class Wheel {
    constructor(localPosition, isFront = false, isLeft = false) {
        this.localPosition = localPosition; // Position relative to car center
        this.isFront = isFront;
        this.isLeft = isLeft;
        
        // Wheel state
        this.angularVelocity = 0;
        this.slipAngle = 0;
        this.slipRatio = 0;
        this.load = 0;
        this.grip = 1.0;
        
        // Temperature (affects grip)
        this.temperature = 50; // Celsius, optimal is 80-100
        this.minTemp = 20;
        this.maxTemp = 120;
        
        // Damage
        this.damage = 0; // 0-1
        this.alignment = 0; // Wheel alignment offset
        
        // Visual
        this.rotation = 0;
        this.steerAngle = 0;
        this.skidMark = null;
    }

    /**
     * Update wheel temperature based on slip
     */
    updateTemperature(slip, deltaTime) {
        // Heat up from slipping, cool down over time
        const heatGeneration = Math.abs(slip) * 50;
        const cooling = (this.temperature - 30) * 0.5;
        
        this.temperature += (heatGeneration - cooling) * deltaTime;
        this.temperature = Math.max(this.minTemp, Math.min(this.maxTemp, this.temperature));
    }

    /**
     * Get grip multiplier based on temperature
     */
    getTemperatureGripMultiplier() {
        // Optimal grip at 80-100 degrees
        if (this.temperature < 50) {
            return 0.7 + (this.temperature - 20) / 100;
        } else if (this.temperature > 100) {
            return 1.0 - (this.temperature - 100) / 50;
        }
        return 1.0;
    }

    /**
     * Get total grip including temperature and damage
     */
    getTotalGrip(surfaceGrip) {
        const tempMultiplier = this.getTemperatureGripMultiplier();
        const damageMultiplier = 1 - this.damage * 0.5;
        return surfaceGrip * tempMultiplier * damageMultiplier;
    }
}

// ============================================================================
// COLLISION SYSTEM
// ============================================================================
class CollisionSystem {
    /**
     * AABB collision check (broad phase)
     */
    static checkAABB(boxA, boxB) {
        return boxA.minX < boxB.maxX &&
               boxA.maxX > boxB.minX &&
               boxA.minY < boxB.maxY &&
               boxA.maxY > boxB.minY;
    }

    /**
     * Get AABB from rotated rectangle
     */
    static getAABB(position, width, height, angle) {
        const corners = CollisionSystem.getCorners(position, width, height, angle);
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;
        
        for (const corner of corners) {
            minX = Math.min(minX, corner.x);
            minY = Math.min(minY, corner.y);
            maxX = Math.max(maxX, corner.x);
            maxY = Math.max(maxY, corner.y);
        }
        
        return { minX, minY, maxX, maxY };
    }

    /**
     * Get corners of a rotated rectangle
     */
    static getCorners(position, width, height, angle) {
        const hw = width / 2;
        const hh = height / 2;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        
        return [
            new Vector2(
                position.x + (-hw * cos - (-hh) * sin),
                position.y + (-hw * sin + (-hh) * cos)
            ),
            new Vector2(
                position.x + (hw * cos - (-hh) * sin),
                position.y + (hw * sin + (-hh) * cos)
            ),
            new Vector2(
                position.x + (hw * cos - hh * sin),
                position.y + (hw * sin + hh * cos)
            ),
            new Vector2(
                position.x + (-hw * cos - hh * sin),
                position.y + (-hw * sin + hh * cos)
            )
        ];
    }

    /**
     * Separating Axis Theorem collision detection
     */
    static checkSAT(cornersA, cornersB) {
        const axes = [];
        
        // Get axes from both polygons
        for (let i = 0; i < cornersA.length; i++) {
            const j = (i + 1) % cornersA.length;
            const edge = cornersA[j].subtract(cornersA[i]);
            axes.push(edge.perpendicular().normalize());
        }
        
        for (let i = 0; i < cornersB.length; i++) {
            const j = (i + 1) % cornersB.length;
            const edge = cornersB[j].subtract(cornersB[i]);
            axes.push(edge.perpendicular().normalize());
        }
        
        let minOverlap = Infinity;
        let smallestAxis = null;
        
        for (const axis of axes) {
            const projA = CollisionSystem.projectPolygon(cornersA, axis);
            const projB = CollisionSystem.projectPolygon(cornersB, axis);
            
            const overlap = Math.min(projA.max, projB.max) - Math.max(projA.min, projB.min);
            
            if (overlap <= 0) {
                return null; // No collision
            }
            
            if (overlap < minOverlap) {
                minOverlap = overlap;
                smallestAxis = axis;
            }
        }
        
        return {
            overlap: minOverlap,
            axis: smallestAxis
        };
    }

    /**
     * Project polygon onto axis
     */
    static projectPolygon(corners, axis) {
        let min = Infinity;
        let max = -Infinity;
        
        for (const corner of corners) {
            const projection = corner.dot(axis);
            min = Math.min(min, projection);
            max = Math.max(max, projection);
        }
        
        return { min, max };
    }

    /**
     * Check circle-rectangle collision
     */
    static checkCircleRect(circlePos, circleRadius, rectPos, rectWidth, rectHeight, rectAngle) {
        // Transform circle position to rectangle's local space
        const relPos = circlePos.subtract(rectPos);
        const cos = Math.cos(-rectAngle);
        const sin = Math.sin(-rectAngle);
        const localPos = new Vector2(
            relPos.x * cos - relPos.y * sin,
            relPos.x * sin + relPos.y * cos
        );
        
        // Find closest point on rectangle
        const hw = rectWidth / 2;
        const hh = rectHeight / 2;
        const closestX = Math.max(-hw, Math.min(hw, localPos.x));
        const closestY = Math.max(-hh, Math.min(hh, localPos.y));
        
        // Check distance
        const dx = localPos.x - closestX;
        const dy = localPos.y - closestY;
        const distSq = dx * dx + dy * dy;
        
        if (distSq < circleRadius * circleRadius) {
            const dist = Math.sqrt(distSq);
            // Transform collision normal back to world space
            const localNormal = new Vector2(dx, dy).normalize();
            const worldNormal = new Vector2(
                localNormal.x * Math.cos(rectAngle) - localNormal.y * Math.sin(rectAngle),
                localNormal.x * Math.sin(rectAngle) + localNormal.y * Math.cos(rectAngle)
            );
            
            return {
                collision: true,
                overlap: circleRadius - dist,
                normal: worldNormal,
                point: new Vector2(
                    rectPos.x + closestX * Math.cos(rectAngle) - closestY * Math.sin(rectAngle),
                    rectPos.y + closestX * Math.sin(rectAngle) + closestY * Math.cos(rectAngle)
                )
            };
        }
        
        return null;
    }

    /**
     * Check point inside polygon
     */
    static pointInPolygon(point, corners) {
        let inside = false;
        for (let i = 0, j = corners.length - 1; i < corners.length; j = i++) {
            const xi = corners[i].x, yi = corners[i].y;
            const xj = corners[j].x, yj = corners[j].y;
            
            if (((yi > point.y) !== (yj > point.y)) &&
                (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi)) {
                inside = !inside;
            }
        }
        return inside;
    }

    /**
     * Line segment intersection
     */
    static lineIntersection(p1, p2, p3, p4) {
        const d1 = p2.subtract(p1);
        const d2 = p4.subtract(p3);
        const d3 = p1.subtract(p3);
        
        const cross = d1.x * d2.y - d1.y * d2.x;
        if (Math.abs(cross) < 0.0001) return null;
        
        const t = (d3.x * d2.y - d3.y * d2.x) / cross;
        const u = (d3.x * d1.y - d3.y * d1.x) / cross;
        
        if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
            return new Vector2(
                p1.x + t * d1.x,
                p1.y + t * d1.y
            );
        }
        
        return null;
    }
}

// ============================================================================
// PHYSICS ENGINE
// ============================================================================
class PhysicsEngine {
    constructor() {
        this.tirePhysics = new TirePhysics();
        this.gravity = 9.81;
        this.airDensity = 1.225; // kg/m³
    }

    /**
     * Calculate weight transfer under acceleration/braking
     * @param {number} mass - Car mass in kg
     * @param {number} acceleration - Current acceleration
     * @param {number} wheelbase - Distance between axles
     * @param {number} cgHeight - Center of gravity height
     * @returns {{front: number, rear: number}} Load on front and rear axles
     */
    calculateWeightTransfer(mass, acceleration, wheelbase, cgHeight) {
        const staticWeight = mass * this.gravity / 2;
        const transfer = (mass * acceleration * cgHeight) / wheelbase;
        
        return {
            front: staticWeight - transfer,
            rear: staticWeight + transfer
        };
    }

    /**
     * Calculate lateral weight transfer in corners
     */
    calculateLateralWeightTransfer(mass, lateralAcceleration, trackWidth, cgHeight) {
        const staticWeight = mass * this.gravity / 2;
        const transfer = (mass * lateralAcceleration * cgHeight) / trackWidth;
        
        return {
            inside: staticWeight - transfer,
            outside: staticWeight + transfer
        };
    }

    /**
     * Calculate air resistance (drag)
     */
    calculateDrag(velocity, dragCoefficient, frontalArea) {
        const speedSq = velocity.lengthSquared();
        const dragMagnitude = 0.5 * this.airDensity * dragCoefficient * frontalArea * speedSq;
        
        if (velocity.length() < 0.01) return new Vector2(0, 0);
        return velocity.normalize().multiply(-dragMagnitude);
    }

    /**
     * Calculate downforce
     */
    calculateDownforce(speed, downforceCoefficient, frontalArea) {
        return 0.5 * this.airDensity * downforceCoefficient * frontalArea * speed * speed;
    }

    /**
     * Calculate collision response
     * @param {Object} bodyA - First body
     * @param {Object} bodyB - Second body
     * @param {Vector2} collisionNormal - Normal at collision point
     * @param {number} overlap - Penetration depth
     * @param {number} restitution - Coefficient of restitution (bounciness)
     * @returns {Object} Impulse and position correction
     */
    calculateCollisionResponse(bodyA, bodyB, collisionNormal, overlap, restitution = 0.3) {
        // Relative velocity
        const relVel = bodyA.velocity.subtract(bodyB.velocity || new Vector2(0, 0));
        const velAlongNormal = relVel.dot(collisionNormal);
        
        // Don't resolve if velocities are separating
        if (velAlongNormal > 0) {
            return { impulse: new Vector2(0, 0), correction: new Vector2(0, 0) };
        }
        
        // Calculate impulse scalar
        const invMassA = 1 / bodyA.mass;
        const invMassB = bodyB.mass ? 1 / bodyB.mass : 0;
        const j = -(1 + restitution) * velAlongNormal / (invMassA + invMassB);
        
        // Apply impulse
        const impulse = collisionNormal.multiply(j);
        
        // Position correction to prevent sinking
        const percent = 0.8; // Penetration percentage to correct
        const slop = 0.01; // Penetration allowance
        const correction = collisionNormal.multiply(
            Math.max(overlap - slop, 0) * percent / (invMassA + invMassB) * invMassA
        );
        
        return { impulse, correction };
    }

    /**
     * Calculate angular impulse from off-center collision
     */
    calculateAngularImpulse(collisionPoint, carCenter, impulse, inertia) {
        const r = collisionPoint.subtract(carCenter);
        const torque = r.cross(impulse);
        return torque / inertia;
    }

    /**
     * Calculate impact damage
     */
    calculateImpactDamage(impactForce, threshold = 5000) {
        if (impactForce < threshold) return 0;
        return Math.min(1, (impactForce - threshold) / 50000);
    }

    /**
     * Apply deformation based on impact
     */
    calculateDeformation(impactPoint, carCenter, carAngle, impactForce) {
        // Determine which zone was hit
        const localPoint = impactPoint.subtract(carCenter).rotate(-carAngle);
        
        let zone = 'center';
        if (localPoint.y > 15) zone = 'front';
        else if (localPoint.y < -15) zone = 'rear';
        else if (localPoint.x < -10) zone = 'left';
        else if (localPoint.x > 10) zone = 'right';
        
        const deformationAmount = Math.min(10, impactForce / 10000);
        
        return {
            zone,
            amount: deformationAmount,
            direction: impactPoint.subtract(carCenter).normalize()
        };
    }
}

// ============================================================================
// SURFACE TYPES
// ============================================================================
const SurfaceType = {
    ASPHALT: {
        name: 'asphalt',
        grip: 1.0,
        color: '#333333',
        particles: null
    },
    GRASS: {
        name: 'grass',
        grip: 0.5,
        color: '#3a7d3a',
        particles: 'dirt'
    },
    GRAVEL: {
        name: 'gravel',
        grip: 0.7,
        color: '#8b7355',
        particles: 'gravel'
    },
    WET: {
        name: 'wet',
        grip: 0.6,
        color: '#3a3a4a',
        particles: 'spray'
    },
    OIL: {
        name: 'oil',
        grip: 0.3,
        color: '#1a1a1a',
        particles: null
    },
    CURB: {
        name: 'curb',
        grip: 0.8,
        color: '#cc0000',
        particles: null
    }
};

// Export classes for use in other modules
if (typeof window !== 'undefined') {
    window.Vector2 = Vector2;
    window.TirePhysics = TirePhysics;
    window.Wheel = Wheel;
    window.CollisionSystem = CollisionSystem;
    window.PhysicsEngine = PhysicsEngine;
    window.SurfaceType = SurfaceType;
}
