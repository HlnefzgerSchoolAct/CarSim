/**
 * MathUtils.js - Mathematical Utility Functions
 * 
 * Provides common mathematical functions used throughout the physics simulation.
 * Includes vector operations, interpolation, clamping, and specialized physics math.
 * 
 * @module utils/MathUtils
 * @author CarSim Development Team
 * @version 2.0.0
 */

/**
 * @class MathUtils
 * @description Static class containing mathematical utility functions
 */
export class MathUtils {
    /**
     * Clamps a value between a minimum and maximum
     * @param {number} value - Value to clamp
     * @param {number} min - Minimum value
     * @param {number} max - Maximum value
     * @returns {number} Clamped value
     */
    static clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    /**
     * Linear interpolation between two values
     * @param {number} a - Start value
     * @param {number} b - End value
     * @param {number} t - Interpolation factor (0-1)
     * @returns {number} Interpolated value
     */
    static lerp(a, b, t) {
        return a + (b - a) * MathUtils.clamp(t, 0, 1);
    }

    /**
     * Inverse linear interpolation
     * @param {number} a - Start value
     * @param {number} b - End value
     * @param {number} value - Value to find t for
     * @returns {number} t value (0-1)
     */
    static inverseLerp(a, b, value) {
        if (Math.abs(b - a) < 1e-10) return 0;
        return MathUtils.clamp((value - a) / (b - a), 0, 1);
    }

    /**
     * Remap a value from one range to another
     * @param {number} value - Value to remap
     * @param {number} inMin - Input range minimum
     * @param {number} inMax - Input range maximum
     * @param {number} outMin - Output range minimum
     * @param {number} outMax - Output range maximum
     * @returns {number} Remapped value
     */
    static remap(value, inMin, inMax, outMin, outMax) {
        const t = MathUtils.inverseLerp(inMin, inMax, value);
        return MathUtils.lerp(outMin, outMax, t);
    }

    /**
     * Smooth interpolation using smoothstep
     * @param {number} a - Start value
     * @param {number} b - End value
     * @param {number} t - Interpolation factor (0-1)
     * @returns {number} Smoothly interpolated value
     */
    static smoothstep(a, b, t) {
        t = MathUtils.clamp(t, 0, 1);
        t = t * t * (3 - 2 * t);
        return a + (b - a) * t;
    }

    /**
     * Even smoother interpolation using smootherstep
     * @param {number} a - Start value
     * @param {number} b - End value
     * @param {number} t - Interpolation factor (0-1)
     * @returns {number} Smoothly interpolated value
     */
    static smootherstep(a, b, t) {
        t = MathUtils.clamp(t, 0, 1);
        t = t * t * t * (t * (t * 6 - 15) + 10);
        return a + (b - a) * t;
    }

    /**
     * Exponential decay interpolation
     * @param {number} current - Current value
     * @param {number} target - Target value
     * @param {number} decay - Decay rate
     * @param {number} deltaTime - Time step
     * @returns {number} New value
     */
    static damp(current, target, decay, deltaTime) {
        return MathUtils.lerp(current, target, 1 - Math.exp(-decay * deltaTime));
    }

    /**
     * Spring damper simulation
     * @param {number} current - Current value
     * @param {number} velocity - Current velocity
     * @param {number} target - Target value
     * @param {number} springConstant - Spring stiffness
     * @param {number} dampingConstant - Damping coefficient
     * @param {number} deltaTime - Time step
     * @returns {{value: number, velocity: number}} New value and velocity
     */
    static springDamper(current, velocity, target, springConstant, dampingConstant, deltaTime) {
        const displacement = current - target;
        const springForce = -springConstant * displacement;
        const dampingForce = -dampingConstant * velocity;
        const acceleration = springForce + dampingForce;
        
        const newVelocity = velocity + acceleration * deltaTime;
        const newValue = current + newVelocity * deltaTime;
        
        return { value: newValue, velocity: newVelocity };
    }

    /**
     * Convert degrees to radians
     * @param {number} degrees - Angle in degrees
     * @returns {number} Angle in radians
     */
    static degToRad(degrees) {
        return degrees * (Math.PI / 180);
    }

    /**
     * Convert radians to degrees
     * @param {number} radians - Angle in radians
     * @returns {number} Angle in degrees
     */
    static radToDeg(radians) {
        return radians * (180 / Math.PI);
    }

    /**
     * Normalize an angle to the range [-PI, PI]
     * @param {number} angle - Angle in radians
     * @returns {number} Normalized angle
     */
    static normalizeAngle(angle) {
        while (angle > Math.PI) angle -= Math.PI * 2;
        while (angle < -Math.PI) angle += Math.PI * 2;
        return angle;
    }

    /**
     * Calculate the shortest angular difference between two angles
     * @param {number} from - Start angle in radians
     * @param {number} to - End angle in radians
     * @returns {number} Shortest angular difference
     */
    static angleDifference(from, to) {
        let diff = MathUtils.normalizeAngle(to - from);
        return diff;
    }

    /**
     * Linearly interpolate angles taking the shortest path
     * @param {number} from - Start angle in radians
     * @param {number} to - End angle in radians
     * @param {number} t - Interpolation factor (0-1)
     * @returns {number} Interpolated angle
     */
    static lerpAngle(from, to, t) {
        const diff = MathUtils.angleDifference(from, to);
        return from + diff * MathUtils.clamp(t, 0, 1);
    }

    /**
     * Get sign of a number (-1, 0, or 1)
     * @param {number} value - Input value
     * @returns {number} Sign of the value
     */
    static sign(value) {
        if (value > 0) return 1;
        if (value < 0) return -1;
        return 0;
    }

    /**
     * Move towards a target value at a maximum rate
     * @param {number} current - Current value
     * @param {number} target - Target value
     * @param {number} maxDelta - Maximum change per step
     * @returns {number} New value
     */
    static moveTowards(current, target, maxDelta) {
        if (Math.abs(target - current) <= maxDelta) {
            return target;
        }
        return current + MathUtils.sign(target - current) * maxDelta;
    }

    /**
     * Check if a value is approximately equal to another
     * @param {number} a - First value
     * @param {number} b - Second value
     * @param {number} [epsilon=1e-6] - Tolerance
     * @returns {boolean} True if approximately equal
     */
    static approximately(a, b, epsilon = 1e-6) {
        return Math.abs(a - b) < epsilon;
    }

    /**
     * Random float in range
     * @param {number} min - Minimum value
     * @param {number} max - Maximum value
     * @returns {number} Random float
     */
    static randomRange(min, max) {
        return min + Math.random() * (max - min);
    }

    /**
     * Random integer in range (inclusive)
     * @param {number} min - Minimum value
     * @param {number} max - Maximum value
     * @returns {number} Random integer
     */
    static randomInt(min, max) {
        return Math.floor(min + Math.random() * (max - min + 1));
    }

    /**
     * Random value from Gaussian distribution
     * @param {number} [mean=0] - Mean of distribution
     * @param {number} [stdDev=1] - Standard deviation
     * @returns {number} Random value from Gaussian distribution
     */
    static randomGaussian(mean = 0, stdDev = 1) {
        let u = 0, v = 0;
        while (u === 0) u = Math.random();
        while (v === 0) v = Math.random();
        const value = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
        return mean + value * stdDev;
    }

    /**
     * Calculate distance between two 2D points
     * @param {number} x1 - First point X
     * @param {number} y1 - First point Y
     * @param {number} x2 - Second point X
     * @param {number} y2 - Second point Y
     * @returns {number} Distance
     */
    static distance2D(x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * Calculate squared distance between two 2D points
     * @param {number} x1 - First point X
     * @param {number} y1 - First point Y
     * @param {number} x2 - Second point X
     * @param {number} y2 - Second point Y
     * @returns {number} Squared distance
     */
    static distanceSquared2D(x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        return dx * dx + dy * dy;
    }

    /**
     * Calculate distance between two 3D points
     * @param {number} x1 - First point X
     * @param {number} y1 - First point Y
     * @param {number} z1 - First point Z
     * @param {number} x2 - Second point X
     * @param {number} y2 - Second point Y
     * @param {number} z2 - Second point Z
     * @returns {number} Distance
     */
    static distance3D(x1, y1, z1, x2, y2, z2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const dz = z2 - z1;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    /**
     * Normalize a 2D vector
     * @param {number} x - X component
     * @param {number} y - Y component
     * @returns {{x: number, y: number}} Normalized vector
     */
    static normalize2D(x, y) {
        const length = Math.sqrt(x * x + y * y);
        if (length < 1e-10) return { x: 0, y: 0 };
        return { x: x / length, y: y / length };
    }

    /**
     * Normalize a 3D vector
     * @param {number} x - X component
     * @param {number} y - Y component
     * @param {number} z - Z component
     * @returns {{x: number, y: number, z: number}} Normalized vector
     */
    static normalize3D(x, y, z) {
        const length = Math.sqrt(x * x + y * y + z * z);
        if (length < 1e-10) return { x: 0, y: 0, z: 0 };
        return { x: x / length, y: y / length, z: z / length };
    }

    /**
     * Dot product of two 2D vectors
     * @param {number} x1 - First vector X
     * @param {number} y1 - First vector Y
     * @param {number} x2 - Second vector X
     * @param {number} y2 - Second vector Y
     * @returns {number} Dot product
     */
    static dot2D(x1, y1, x2, y2) {
        return x1 * x2 + y1 * y2;
    }

    /**
     * Dot product of two 3D vectors
     * @param {number} x1 - First vector X
     * @param {number} y1 - First vector Y
     * @param {number} z1 - First vector Z
     * @param {number} x2 - Second vector X
     * @param {number} y2 - Second vector Y
     * @param {number} z2 - Second vector Z
     * @returns {number} Dot product
     */
    static dot3D(x1, y1, z1, x2, y2, z2) {
        return x1 * x2 + y1 * y2 + z1 * z2;
    }

    /**
     * Cross product of two 3D vectors
     * @param {number} x1 - First vector X
     * @param {number} y1 - First vector Y
     * @param {number} z1 - First vector Z
     * @param {number} x2 - Second vector X
     * @param {number} y2 - Second vector Y
     * @param {number} z2 - Second vector Z
     * @returns {{x: number, y: number, z: number}} Cross product vector
     */
    static cross3D(x1, y1, z1, x2, y2, z2) {
        return {
            x: y1 * z2 - z1 * y2,
            y: z1 * x2 - x1 * z2,
            z: x1 * y2 - y1 * x2
        };
    }

    /**
     * Project a point onto a line segment
     * @param {number} px - Point X
     * @param {number} py - Point Y
     * @param {number} ax - Line start X
     * @param {number} ay - Line start Y
     * @param {number} bx - Line end X
     * @param {number} by - Line end Y
     * @returns {{x: number, y: number, t: number}} Projected point and parameter
     */
    static projectPointOnLine(px, py, ax, ay, bx, by) {
        const abx = bx - ax;
        const aby = by - ay;
        const apx = px - ax;
        const apy = py - ay;
        
        const abLengthSq = abx * abx + aby * aby;
        if (abLengthSq < 1e-10) {
            return { x: ax, y: ay, t: 0 };
        }
        
        let t = (apx * abx + apy * aby) / abLengthSq;
        t = MathUtils.clamp(t, 0, 1);
        
        return {
            x: ax + t * abx,
            y: ay + t * aby,
            t: t
        };
    }

    /**
     * Rotate a 2D point around origin
     * @param {number} x - Point X
     * @param {number} y - Point Y
     * @param {number} angle - Rotation angle in radians
     * @returns {{x: number, y: number}} Rotated point
     */
    static rotate2D(x, y, angle) {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        return {
            x: x * cos - y * sin,
            y: x * sin + y * cos
        };
    }

    /**
     * Rotate a 2D point around a center point
     * @param {number} x - Point X
     * @param {number} y - Point Y
     * @param {number} cx - Center X
     * @param {number} cy - Center Y
     * @param {number} angle - Rotation angle in radians
     * @returns {{x: number, y: number}} Rotated point
     */
    static rotateAround(x, y, cx, cy, angle) {
        const translated = MathUtils.rotate2D(x - cx, y - cy, angle);
        return {
            x: translated.x + cx,
            y: translated.y + cy
        };
    }

    /**
     * Cubic bezier interpolation
     * @param {number} p0 - Start point
     * @param {number} p1 - First control point
     * @param {number} p2 - Second control point
     * @param {number} p3 - End point
     * @param {number} t - Parameter (0-1)
     * @returns {number} Interpolated value
     */
    static cubicBezier(p0, p1, p2, p3, t) {
        const t2 = t * t;
        const t3 = t2 * t;
        const mt = 1 - t;
        const mt2 = mt * mt;
        const mt3 = mt2 * mt;
        return mt3 * p0 + 3 * mt2 * t * p1 + 3 * mt * t2 * p2 + t3 * p3;
    }

    /**
     * Catmull-Rom spline interpolation
     * @param {number} p0 - Point before start
     * @param {number} p1 - Start point
     * @param {number} p2 - End point
     * @param {number} p3 - Point after end
     * @param {number} t - Parameter (0-1)
     * @returns {number} Interpolated value
     */
    static catmullRom(p0, p1, p2, p3, t) {
        const t2 = t * t;
        const t3 = t2 * t;
        return 0.5 * (
            (2 * p1) +
            (-p0 + p2) * t +
            (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
            (-p0 + 3 * p1 - 3 * p2 + p3) * t3
        );
    }

    /**
     * Sample a lookup table with linear interpolation
     * @param {Array<Array<number>>} table - Lookup table [[x, y], ...]
     * @param {number} x - Input value
     * @returns {number} Interpolated output value
     */
    static sampleLookupTable(table, x) {
        if (table.length === 0) return 0;
        if (table.length === 1) return table[0][1];
        
        // Find surrounding points
        if (x <= table[0][0]) return table[0][1];
        if (x >= table[table.length - 1][0]) return table[table.length - 1][1];
        
        for (let i = 0; i < table.length - 1; i++) {
            if (x >= table[i][0] && x <= table[i + 1][0]) {
                const t = (x - table[i][0]) / (table[i + 1][0] - table[i][0]);
                return MathUtils.lerp(table[i][1], table[i + 1][1], t);
            }
        }
        
        return table[table.length - 1][1];
    }

    /**
     * Calculate quadratic roots
     * @param {number} a - Coefficient a
     * @param {number} b - Coefficient b
     * @param {number} c - Coefficient c
     * @returns {Array<number>} Array of real roots
     */
    static quadraticRoots(a, b, c) {
        const discriminant = b * b - 4 * a * c;
        
        if (discriminant < 0) return [];
        if (Math.abs(discriminant) < 1e-10) {
            return [-b / (2 * a)];
        }
        
        const sqrtD = Math.sqrt(discriminant);
        return [
            (-b + sqrtD) / (2 * a),
            (-b - sqrtD) / (2 * a)
        ];
    }

    /**
     * Check if two circles intersect
     * @param {number} x1 - First circle center X
     * @param {number} y1 - First circle center Y
     * @param {number} r1 - First circle radius
     * @param {number} x2 - Second circle center X
     * @param {number} y2 - Second circle center Y
     * @param {number} r2 - Second circle radius
     * @returns {boolean} True if circles intersect
     */
    static circlesIntersect(x1, y1, r1, x2, y2, r2) {
        const distSq = MathUtils.distanceSquared2D(x1, y1, x2, y2);
        const radiusSum = r1 + r2;
        return distSq <= radiusSum * radiusSum;
    }

    /**
     * Check if a point is inside a circle
     * @param {number} px - Point X
     * @param {number} py - Point Y
     * @param {number} cx - Circle center X
     * @param {number} cy - Circle center Y
     * @param {number} r - Circle radius
     * @returns {boolean} True if point is inside circle
     */
    static pointInCircle(px, py, cx, cy, r) {
        return MathUtils.distanceSquared2D(px, py, cx, cy) <= r * r;
    }

    /**
     * Check if a point is inside a rectangle
     * @param {number} px - Point X
     * @param {number} py - Point Y
     * @param {number} rx - Rectangle left
     * @param {number} ry - Rectangle top
     * @param {number} rw - Rectangle width
     * @param {number} rh - Rectangle height
     * @returns {boolean} True if point is inside rectangle
     */
    static pointInRect(px, py, rx, ry, rw, rh) {
        return px >= rx && px <= rx + rw && py >= ry && py <= ry + rh;
    }

    /**
     * Check if a point is inside an oriented bounding box
     * @param {number} px - Point X
     * @param {number} py - Point Y
     * @param {number} cx - Box center X
     * @param {number} cy - Box center Y
     * @param {number} hw - Box half width
     * @param {number} hh - Box half height
     * @param {number} angle - Box rotation angle
     * @returns {boolean} True if point is inside OBB
     */
    static pointInOBB(px, py, cx, cy, hw, hh, angle) {
        // Transform point to box local space
        const rotated = MathUtils.rotate2D(px - cx, py - cy, -angle);
        return Math.abs(rotated.x) <= hw && Math.abs(rotated.y) <= hh;
    }

    /**
     * Calculate line-line intersection
     * @param {number} x1 - Line 1 start X
     * @param {number} y1 - Line 1 start Y
     * @param {number} x2 - Line 1 end X
     * @param {number} y2 - Line 1 end Y
     * @param {number} x3 - Line 2 start X
     * @param {number} y3 - Line 2 start Y
     * @param {number} x4 - Line 2 end X
     * @param {number} y4 - Line 2 end Y
     * @returns {{x: number, y: number, t1: number, t2: number}|null} Intersection point or null
     */
    static lineLineIntersection(x1, y1, x2, y2, x3, y3, x4, y4) {
        const denominator = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
        
        if (Math.abs(denominator) < 1e-10) return null;
        
        const t1 = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denominator;
        const t2 = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denominator;
        
        if (t1 >= 0 && t1 <= 1 && t2 >= 0 && t2 <= 1) {
            return {
                x: x1 + t1 * (x2 - x1),
                y: y1 + t1 * (y2 - y1),
                t1: t1,
                t2: t2
            };
        }
        
        return null;
    }

    /**
     * Calculate ray-circle intersection
     * @param {number} ox - Ray origin X
     * @param {number} oy - Ray origin Y
     * @param {number} dx - Ray direction X (normalized)
     * @param {number} dy - Ray direction Y (normalized)
     * @param {number} cx - Circle center X
     * @param {number} cy - Circle center Y
     * @param {number} r - Circle radius
     * @returns {{t: number, x: number, y: number}|null} Closest intersection or null
     */
    static rayCircleIntersection(ox, oy, dx, dy, cx, cy, r) {
        const fx = ox - cx;
        const fy = oy - cy;
        
        const a = dx * dx + dy * dy;
        const b = 2 * (fx * dx + fy * dy);
        const c = fx * fx + fy * fy - r * r;
        
        const discriminant = b * b - 4 * a * c;
        
        if (discriminant < 0) return null;
        
        const sqrtD = Math.sqrt(discriminant);
        const t1 = (-b - sqrtD) / (2 * a);
        const t2 = (-b + sqrtD) / (2 * a);
        
        let t = t1;
        if (t < 0) t = t2;
        if (t < 0) return null;
        
        return {
            t: t,
            x: ox + t * dx,
            y: oy + t * dy
        };
    }

    /**
     * Calculate OBB to OBB collision
     * @param {Object} a - First OBB {cx, cy, hw, hh, angle}
     * @param {Object} b - Second OBB {cx, cy, hw, hh, angle}
     * @returns {boolean} True if OBBs collide
     */
    static obbObbCollision(a, b) {
        // Get axes to test
        const axes = [
            MathUtils.rotate2D(1, 0, a.angle),
            MathUtils.rotate2D(0, 1, a.angle),
            MathUtils.rotate2D(1, 0, b.angle),
            MathUtils.rotate2D(0, 1, b.angle)
        ];

        // Get vertices
        const vertsA = MathUtils.getOBBVertices(a);
        const vertsB = MathUtils.getOBBVertices(b);

        // SAT test
        for (const axis of axes) {
            const projA = MathUtils.projectVertices(vertsA, axis);
            const projB = MathUtils.projectVertices(vertsB, axis);
            
            if (projA.max < projB.min || projB.max < projA.min) {
                return false;
            }
        }

        return true;
    }

    /**
     * Get OBB vertices
     * @param {Object} obb - OBB {cx, cy, hw, hh, angle}
     * @returns {Array<{x: number, y: number}>} Array of 4 vertices
     */
    static getOBBVertices(obb) {
        const cos = Math.cos(obb.angle);
        const sin = Math.sin(obb.angle);
        const corners = [
            { x: -obb.hw, y: -obb.hh },
            { x: obb.hw, y: -obb.hh },
            { x: obb.hw, y: obb.hh },
            { x: -obb.hw, y: obb.hh }
        ];
        
        return corners.map(c => ({
            x: obb.cx + c.x * cos - c.y * sin,
            y: obb.cy + c.x * sin + c.y * cos
        }));
    }

    /**
     * Project vertices onto an axis
     * @param {Array<{x: number, y: number}>} vertices - Vertices to project
     * @param {{x: number, y: number}} axis - Axis to project onto
     * @returns {{min: number, max: number}} Projection range
     */
    static projectVertices(vertices, axis) {
        let min = Infinity;
        let max = -Infinity;
        
        for (const v of vertices) {
            const proj = v.x * axis.x + v.y * axis.y;
            min = Math.min(min, proj);
            max = Math.max(max, proj);
        }
        
        return { min, max };
    }

    /**
     * Calculate bounce velocity vector
     * @param {number} vx - Velocity X
     * @param {number} vy - Velocity Y
     * @param {number} nx - Normal X
     * @param {number} ny - Normal Y
     * @param {number} restitution - Coefficient of restitution
     * @returns {{x: number, y: number}} Bounced velocity
     */
    static bounce(vx, vy, nx, ny, restitution) {
        const dot = vx * nx + vy * ny;
        return {
            x: vx - (1 + restitution) * dot * nx,
            y: vy - (1 + restitution) * dot * ny
        };
    }

    /**
     * Apply friction to velocity
     * @param {number} vx - Velocity X
     * @param {number} vy - Velocity Y
     * @param {number} friction - Friction coefficient
     * @param {number} deltaTime - Time step
     * @returns {{x: number, y: number}} Velocity after friction
     */
    static applyFriction(vx, vy, friction, deltaTime) {
        const speed = Math.sqrt(vx * vx + vy * vy);
        if (speed < 1e-10) return { x: 0, y: 0 };
        
        const newSpeed = Math.max(0, speed - friction * deltaTime);
        const factor = newSpeed / speed;
        
        return { x: vx * factor, y: vy * factor };
    }

    /**
     * Calculate centripetal acceleration
     * @param {number} speed - Linear speed
     * @param {number} radius - Turn radius
     * @returns {number} Centripetal acceleration
     */
    static centripetalAcceleration(speed, radius) {
        if (Math.abs(radius) < 1e-10) return 0;
        return (speed * speed) / radius;
    }

    /**
     * Convert km/h to m/s
     * @param {number} kmh - Speed in km/h
     * @returns {number} Speed in m/s
     */
    static kmhToMs(kmh) {
        return kmh / 3.6;
    }

    /**
     * Convert m/s to km/h
     * @param {number} ms - Speed in m/s
     * @returns {number} Speed in km/h
     */
    static msToKmh(ms) {
        return ms * 3.6;
    }

    /**
     * Convert mph to m/s
     * @param {number} mph - Speed in mph
     * @returns {number} Speed in m/s
     */
    static mphToMs(mph) {
        return mph * 0.44704;
    }

    /**
     * Convert m/s to mph
     * @param {number} ms - Speed in m/s
     * @returns {number} Speed in mph
     */
    static msToMph(ms) {
        return ms / 0.44704;
    }

    /**
     * Calculate kinetic energy
     * @param {number} mass - Mass in kg
     * @param {number} velocity - Velocity in m/s
     * @returns {number} Kinetic energy in Joules
     */
    static kineticEnergy(mass, velocity) {
        return 0.5 * mass * velocity * velocity;
    }

    /**
     * Calculate momentum
     * @param {number} mass - Mass in kg
     * @param {number} velocity - Velocity in m/s
     * @returns {number} Momentum in kg·m/s
     */
    static momentum(mass, velocity) {
        return mass * velocity;
    }

    /**
     * Calculate impact force from deceleration
     * @param {number} mass - Mass in kg
     * @param {number} velocityChange - Change in velocity in m/s
     * @param {number} time - Time duration in seconds
     * @returns {number} Force in Newtons
     */
    static impactForce(mass, velocityChange, time) {
        if (Math.abs(time) < 1e-10) return Infinity;
        return mass * velocityChange / time;
    }

    /**
     * Ease in quadratic
     * @param {number} t - Time (0-1)
     * @returns {number} Eased value
     */
    static easeInQuad(t) {
        return t * t;
    }

    /**
     * Ease out quadratic
     * @param {number} t - Time (0-1)
     * @returns {number} Eased value
     */
    static easeOutQuad(t) {
        return t * (2 - t);
    }

    /**
     * Ease in-out quadratic
     * @param {number} t - Time (0-1)
     * @returns {number} Eased value
     */
    static easeInOutQuad(t) {
        return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    }

    /**
     * Ease in cubic
     * @param {number} t - Time (0-1)
     * @returns {number} Eased value
     */
    static easeInCubic(t) {
        return t * t * t;
    }

    /**
     * Ease out cubic
     * @param {number} t - Time (0-1)
     * @returns {number} Eased value
     */
    static easeOutCubic(t) {
        const t1 = t - 1;
        return t1 * t1 * t1 + 1;
    }

    /**
     * Ease in-out cubic
     * @param {number} t - Time (0-1)
     * @returns {number} Eased value
     */
    static easeInOutCubic(t) {
        return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
    }

    /**
     * Ease in elastic
     * @param {number} t - Time (0-1)
     * @returns {number} Eased value
     */
    static easeInElastic(t) {
        if (t === 0 || t === 1) return t;
        return -Math.pow(2, 10 * (t - 1)) * Math.sin((t - 1.1) * 5 * Math.PI);
    }

    /**
     * Ease out elastic
     * @param {number} t - Time (0-1)
     * @returns {number} Eased value
     */
    static easeOutElastic(t) {
        if (t === 0 || t === 1) return t;
        return Math.pow(2, -10 * t) * Math.sin((t - 0.1) * 5 * Math.PI) + 1;
    }

    /**
     * Ease out bounce
     * @param {number} t - Time (0-1)
     * @returns {number} Eased value
     */
    static easeOutBounce(t) {
        const n1 = 7.5625;
        const d1 = 2.75;

        if (t < 1 / d1) {
            return n1 * t * t;
        } else if (t < 2 / d1) {
            return n1 * (t -= 1.5 / d1) * t + 0.75;
        } else if (t < 2.5 / d1) {
            return n1 * (t -= 2.25 / d1) * t + 0.9375;
        } else {
            return n1 * (t -= 2.625 / d1) * t + 0.984375;
        }
    }

    /**
     * Perlin-like noise (simple implementation)
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @returns {number} Noise value (-1 to 1)
     */
    static noise2D(x, y) {
        // Simple implementation using sine functions
        const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
        return (n - Math.floor(n)) * 2 - 1;
    }

    /**
     * Fractal Brownian Motion noise
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {number} octaves - Number of octaves
     * @param {number} persistence - Amplitude decrease per octave
     * @returns {number} FBM noise value
     */
    static fbm(x, y, octaves = 4, persistence = 0.5) {
        let value = 0;
        let amplitude = 1;
        let frequency = 1;
        let maxValue = 0;

        for (let i = 0; i < octaves; i++) {
            value += amplitude * MathUtils.noise2D(x * frequency, y * frequency);
            maxValue += amplitude;
            amplitude *= persistence;
            frequency *= 2;
        }

        return value / maxValue;
    }
}

export default MathUtils;
