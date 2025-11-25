/**
 * InterpolationUtils.js
 * Interpolation, curve, and spline utilities for smooth animations and physics
 */

/**
 * Bezier curve utilities
 */
class BezierUtils {
    /**
     * Evaluate cubic Bezier curve at parameter t
     * @param {number} t - Parameter [0, 1]
     * @param {number} p0 - Start point
     * @param {number} p1 - First control point
     * @param {number} p2 - Second control point
     * @param {number} p3 - End point
     * @returns {number}
     */
    static cubicBezier(t, p0, p1, p2, p3) {
        const t2 = t * t;
        const t3 = t2 * t;
        const mt = 1 - t;
        const mt2 = mt * mt;
        const mt3 = mt2 * mt;

        return mt3 * p0 + 3 * mt2 * t * p1 + 3 * mt * t2 * p2 + t3 * p3;
    }

    /**
     * Evaluate quadratic Bezier curve at parameter t
     * @param {number} t - Parameter [0, 1]
     * @param {number} p0 - Start point
     * @param {number} p1 - Control point
     * @param {number} p2 - End point
     * @returns {number}
     */
    static quadraticBezier(t, p0, p1, p2) {
        const mt = 1 - t;
        const mt2 = mt * mt;
        const t2 = t * t;

        return mt2 * p0 + 2 * mt * t * p1 + t2 * p2;
    }

    /**
     * Get derivative of cubic Bezier at parameter t
     * @param {number} t - Parameter [0, 1]
     * @param {number} p0 - Start point
     * @param {number} p1 - First control point
     * @param {number} p2 - Second control point
     * @param {number} p3 - End point
     * @returns {number}
     */
    static cubicBezierDerivative(t, p0, p1, p2, p3) {
        const mt = 1 - t;
        const mt2 = mt * mt;
        const t2 = t * t;

        return 3 * mt2 * (p1 - p0) + 6 * mt * t * (p2 - p1) + 3 * t2 * (p3 - p2);
    }

    /**
     * Find t parameter for a given x value in a cubic Bezier curve
     * Uses Newton-Raphson iteration for efficiency
     * @param {number} x - Target x value
     * @param {number} x0 - Start x
     * @param {number} x1 - First control x
     * @param {number} x2 - Second control x
     * @param {number} x3 - End x
     * @returns {number} - Parameter t
     */
    static cubicBezierSolveX(x, x0, x1, x2, x3) {
        // Initial guess
        let t = x;
        
        // Newton-Raphson iterations
        for (let i = 0; i < 8; i++) {
            const currentX = this.cubicBezier(t, x0, x1, x2, x3);
            const derivative = this.cubicBezierDerivative(t, x0, x1, x2, x3);
            
            if (Math.abs(derivative) < 1e-6) break;
            
            const diff = currentX - x;
            t -= diff / derivative;
            
            // Clamp to valid range
            t = Math.max(0, Math.min(1, t));
            
            if (Math.abs(diff) < 1e-6) break;
        }
        
        return t;
    }

    /**
     * Cubic Bezier easing function (like CSS cubic-bezier)
     * @param {number} t - Parameter [0, 1]
     * @param {number} x1 - First control point x
     * @param {number} y1 - First control point y
     * @param {number} x2 - Second control point x
     * @param {number} y2 - Second control point y
     * @returns {number}
     */
    static easing(t, x1, y1, x2, y2) {
        const tX = this.cubicBezierSolveX(t, 0, x1, x2, 1);
        return this.cubicBezier(tX, 0, y1, y2, 1);
    }
}

/**
 * Catmull-Rom spline utilities for smooth curves through points
 */
class CatmullRomSpline {
    /**
     * Evaluate Catmull-Rom spline at parameter t
     * @param {number} t - Parameter [0, 1]
     * @param {number} p0 - Point before start
     * @param {number} p1 - Start point
     * @param {number} p2 - End point
     * @param {number} p3 - Point after end
     * @param {number} tension - Tension parameter (default 0.5)
     * @returns {number}
     */
    static evaluate(t, p0, p1, p2, p3, tension = 0.5) {
        const t2 = t * t;
        const t3 = t2 * t;
        
        const v0 = (p2 - p0) * tension;
        const v1 = (p3 - p1) * tension;
        
        return (2 * p1 - 2 * p2 + v0 + v1) * t3 +
               (-3 * p1 + 3 * p2 - 2 * v0 - v1) * t2 +
               v0 * t +
               p1;
    }

    /**
     * Get derivative of Catmull-Rom spline at parameter t
     * @param {number} t - Parameter [0, 1]
     * @param {number} p0 - Point before start
     * @param {number} p1 - Start point
     * @param {number} p2 - End point
     * @param {number} p3 - Point after end
     * @param {number} tension - Tension parameter (default 0.5)
     * @returns {number}
     */
    static derivative(t, p0, p1, p2, p3, tension = 0.5) {
        const t2 = t * t;
        
        const v0 = (p2 - p0) * tension;
        const v1 = (p3 - p1) * tension;
        
        return 3 * (2 * p1 - 2 * p2 + v0 + v1) * t2 +
               2 * (-3 * p1 + 3 * p2 - 2 * v0 - v1) * t +
               v0;
    }

    /**
     * Evaluate spline through multiple points
     * @param {number[]} points - Array of control points
     * @param {number} t - Global parameter [0, 1]
     * @param {boolean} loop - Whether spline loops
     * @param {number} tension - Tension parameter
     * @returns {number}
     */
    static evaluateChain(points, t, loop = false, tension = 0.5) {
        const n = points.length;
        if (n < 2) return points[0] || 0;
        if (n === 2) return points[0] + (points[1] - points[0]) * t;
        
        // Find which segment we're on
        const segments = loop ? n : n - 1;
        const scaledT = t * segments;
        const segment = Math.floor(scaledT);
        const localT = scaledT - segment;
        
        // Get the four points for this segment
        const i1 = segment % n;
        const i2 = (segment + 1) % n;
        const i0 = (segment - 1 + n) % n;
        const i3 = (segment + 2) % n;
        
        // Handle non-looping case
        if (!loop) {
            if (segment >= segments) {
                return points[n - 1];
            }
            if (segment < 0) {
                return points[0];
            }
        }
        
        const p0 = points[i0];
        const p1 = points[i1];
        const p2 = points[i2];
        const p3 = points[i3];
        
        return this.evaluate(localT, p0, p1, p2, p3, tension);
    }
}

/**
 * Hermite spline utilities
 */
class HermiteSpline {
    /**
     * Evaluate cubic Hermite spline
     * @param {number} t - Parameter [0, 1]
     * @param {number} p0 - Start point
     * @param {number} m0 - Start tangent
     * @param {number} p1 - End point
     * @param {number} m1 - End tangent
     * @returns {number}
     */
    static evaluate(t, p0, m0, p1, m1) {
        const t2 = t * t;
        const t3 = t2 * t;
        
        const h00 = 2 * t3 - 3 * t2 + 1;
        const h10 = t3 - 2 * t2 + t;
        const h01 = -2 * t3 + 3 * t2;
        const h11 = t3 - t2;
        
        return h00 * p0 + h10 * m0 + h01 * p1 + h11 * m1;
    }

    /**
     * Get derivative of cubic Hermite spline
     * @param {number} t - Parameter [0, 1]
     * @param {number} p0 - Start point
     * @param {number} m0 - Start tangent
     * @param {number} p1 - End point
     * @param {number} m1 - End tangent
     * @returns {number}
     */
    static derivative(t, p0, m0, p1, m1) {
        const t2 = t * t;
        
        const h00 = 6 * t2 - 6 * t;
        const h10 = 3 * t2 - 4 * t + 1;
        const h01 = -6 * t2 + 6 * t;
        const h11 = 3 * t2 - 2 * t;
        
        return h00 * p0 + h10 * m0 + h01 * p1 + h11 * m1;
    }
}

/**
 * Easing functions for smooth animations
 */
class EasingFunctions {
    // Linear
    static linear(t) {
        return t;
    }

    // Quadratic
    static easeInQuad(t) {
        return t * t;
    }

    static easeOutQuad(t) {
        return t * (2 - t);
    }

    static easeInOutQuad(t) {
        return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    }

    // Cubic
    static easeInCubic(t) {
        return t * t * t;
    }

    static easeOutCubic(t) {
        const t1 = t - 1;
        return t1 * t1 * t1 + 1;
    }

    static easeInOutCubic(t) {
        return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
    }

    // Quartic
    static easeInQuart(t) {
        return t * t * t * t;
    }

    static easeOutQuart(t) {
        const t1 = t - 1;
        return 1 - t1 * t1 * t1 * t1;
    }

    static easeInOutQuart(t) {
        const t1 = t - 1;
        return t < 0.5 ? 8 * t * t * t * t : 1 - 8 * t1 * t1 * t1 * t1;
    }

    // Quintic
    static easeInQuint(t) {
        return t * t * t * t * t;
    }

    static easeOutQuint(t) {
        const t1 = t - 1;
        return 1 + t1 * t1 * t1 * t1 * t1;
    }

    static easeInOutQuint(t) {
        const t1 = t - 1;
        return t < 0.5 ? 16 * t * t * t * t * t : 1 + 16 * t1 * t1 * t1 * t1 * t1;
    }

    // Sinusoidal
    static easeInSine(t) {
        return 1 - Math.cos(t * Math.PI / 2);
    }

    static easeOutSine(t) {
        return Math.sin(t * Math.PI / 2);
    }

    static easeInOutSine(t) {
        return -(Math.cos(Math.PI * t) - 1) / 2;
    }

    // Exponential
    static easeInExpo(t) {
        return t === 0 ? 0 : Math.pow(2, 10 * (t - 1));
    }

    static easeOutExpo(t) {
        return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
    }

    static easeInOutExpo(t) {
        if (t === 0 || t === 1) return t;
        return t < 0.5
            ? Math.pow(2, 20 * t - 10) / 2
            : (2 - Math.pow(2, -20 * t + 10)) / 2;
    }

    // Circular
    static easeInCirc(t) {
        return 1 - Math.sqrt(1 - t * t);
    }

    static easeOutCirc(t) {
        const t1 = t - 1;
        return Math.sqrt(1 - t1 * t1);
    }

    static easeInOutCirc(t) {
        return t < 0.5
            ? (1 - Math.sqrt(1 - 4 * t * t)) / 2
            : (Math.sqrt(1 - (-2 * t + 2) * (-2 * t + 2)) + 1) / 2;
    }

    // Elastic
    static easeInElastic(t) {
        if (t === 0 || t === 1) return t;
        const c4 = (2 * Math.PI) / 3;
        return -Math.pow(2, 10 * t - 10) * Math.sin((t * 10 - 10.75) * c4);
    }

    static easeOutElastic(t) {
        if (t === 0 || t === 1) return t;
        const c4 = (2 * Math.PI) / 3;
        return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
    }

    static easeInOutElastic(t) {
        if (t === 0 || t === 1) return t;
        const c5 = (2 * Math.PI) / 4.5;
        return t < 0.5
            ? -(Math.pow(2, 20 * t - 10) * Math.sin((20 * t - 11.125) * c5)) / 2
            : (Math.pow(2, -20 * t + 10) * Math.sin((20 * t - 11.125) * c5)) / 2 + 1;
    }

    // Back
    static easeInBack(t) {
        const c1 = 1.70158;
        const c3 = c1 + 1;
        return c3 * t * t * t - c1 * t * t;
    }

    static easeOutBack(t) {
        const c1 = 1.70158;
        const c3 = c1 + 1;
        const t1 = t - 1;
        return 1 + c3 * t1 * t1 * t1 + c1 * t1 * t1;
    }

    static easeInOutBack(t) {
        const c1 = 1.70158;
        const c2 = c1 * 1.525;
        return t < 0.5
            ? (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2
            : (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2;
    }

    // Bounce
    static easeOutBounce(t) {
        const n1 = 7.5625;
        const d1 = 2.75;
        if (t < 1 / d1) {
            return n1 * t * t;
        } else if (t < 2 / d1) {
            const t1 = t - 1.5 / d1;
            return n1 * t1 * t1 + 0.75;
        } else if (t < 2.5 / d1) {
            const t1 = t - 2.25 / d1;
            return n1 * t1 * t1 + 0.9375;
        } else {
            const t1 = t - 2.625 / d1;
            return n1 * t1 * t1 + 0.984375;
        }
    }

    static easeInBounce(t) {
        return 1 - this.easeOutBounce(1 - t);
    }

    static easeInOutBounce(t) {
        return t < 0.5
            ? (1 - this.easeOutBounce(1 - 2 * t)) / 2
            : (1 + this.easeOutBounce(2 * t - 1)) / 2;
    }
}

/**
 * Smooth damping for spring-like motion
 */
class SmoothDamping {
    /**
     * Smooth damp towards target
     * @param {number} current - Current value
     * @param {number} target - Target value
     * @param {number} currentVelocity - Current velocity (will be modified)
     * @param {number} smoothTime - Approximate time to reach target
     * @param {number} deltaTime - Time since last update
     * @param {number} maxSpeed - Maximum speed (optional)
     * @returns {Object} {value, velocity}
     */
    static smoothDamp(current, target, currentVelocity, smoothTime, deltaTime, maxSpeed = Infinity) {
        // Based on Game Programming Gems 4 Chapter 1.10
        smoothTime = Math.max(0.0001, smoothTime);
        const omega = 2 / smoothTime;
        const x = omega * deltaTime;
        const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
        
        let change = current - target;
        const originalTo = target;

        // Clamp maximum speed
        const maxChange = maxSpeed * smoothTime;
        change = Math.max(-maxChange, Math.min(change, maxChange));
        const temp = (currentVelocity + omega * change) * deltaTime;
        
        const newValue = current - change + (change + temp) * exp;
        const newVelocity = (currentVelocity - omega * temp) * exp;

        // Prevent overshooting
        if ((originalTo - current > 0) === (newValue > originalTo)) {
            return { value: originalTo, velocity: (originalTo - newValue) / deltaTime };
        }

        return { value: newValue, velocity: newVelocity };
    }

    /**
     * Smooth damp angle (handles wrapping)
     * @param {number} current - Current angle in radians
     * @param {number} target - Target angle in radians
     * @param {number} currentVelocity - Current angular velocity
     * @param {number} smoothTime - Approximate time to reach target
     * @param {number} deltaTime - Time since last update
     * @param {number} maxSpeed - Maximum angular speed (optional)
     * @returns {Object} {value, velocity}
     */
    static smoothDampAngle(current, target, currentVelocity, smoothTime, deltaTime, maxSpeed = Infinity) {
        // Calculate shortest angle difference
        let diff = target - current;
        while (diff > Math.PI) diff -= 2 * Math.PI;
        while (diff < -Math.PI) diff += 2 * Math.PI;
        
        const wrappedTarget = current + diff;
        const result = this.smoothDamp(current, wrappedTarget, currentVelocity, smoothTime, deltaTime, maxSpeed);
        
        // Wrap result angle
        let angle = result.value;
        while (angle > Math.PI) angle -= 2 * Math.PI;
        while (angle < -Math.PI) angle += 2 * Math.PI;
        
        return { value: angle, velocity: result.velocity };
    }
}

/**
 * Lookup table for fast interpolation
 */
class LookupTable {
    /**
     * Create lookup table from function
     * @param {Function} fn - Function to sample
     * @param {number} minX - Minimum x value
     * @param {number} maxX - Maximum x value
     * @param {number} samples - Number of samples
     */
    constructor(fn, minX, maxX, samples = 100) {
        this.minX = minX;
        this.maxX = maxX;
        this.samples = samples;
        this.table = new Float32Array(samples);
        this.step = (maxX - minX) / (samples - 1);
        
        // Populate table
        for (let i = 0; i < samples; i++) {
            const x = minX + i * this.step;
            this.table[i] = fn(x);
        }
    }

    /**
     * Lookup value with linear interpolation
     * @param {number} x 
     * @returns {number}
     */
    lookup(x) {
        // Clamp to valid range
        if (x <= this.minX) return this.table[0];
        if (x >= this.maxX) return this.table[this.samples - 1];
        
        // Find position in table
        const pos = (x - this.minX) / this.step;
        const index = Math.floor(pos);
        const frac = pos - index;
        
        // Linear interpolation
        const y0 = this.table[index];
        const y1 = this.table[index + 1];
        return y0 + (y1 - y0) * frac;
    }
}

// Export utilities
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        BezierUtils,
        CatmullRomSpline,
        HermiteSpline,
        EasingFunctions,
        SmoothDamping,
        LookupTable
    };
}
