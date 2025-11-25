/**
 * MathUtils.js
 * Advanced mathematical utilities for physics simulations
 * Provides vector, matrix, quaternion operations optimized for performance
 */

/**
 * Vector3 operations with Float32Array backing for performance
 */
class Vector3Utils {
    /**
     * Create a new vector
     * @param {number} x 
     * @param {number} y 
     * @param {number} z 
     * @returns {Float32Array}
     */
    static create(x = 0, y = 0, z = 0) {
        return new Float32Array([x, y, z]);
    }

    /**
     * Copy vector values
     * @param {Float32Array} out 
     * @param {Float32Array} a 
     * @returns {Float32Array}
     */
    static copy(out, a) {
        out[0] = a[0];
        out[1] = a[1];
        out[2] = a[2];
        return out;
    }

    /**
     * Set vector values
     * @param {Float32Array} out 
     * @param {number} x 
     * @param {number} y 
     * @param {number} z 
     * @returns {Float32Array}
     */
    static set(out, x, y, z) {
        out[0] = x;
        out[1] = y;
        out[2] = z;
        return out;
    }

    /**
     * Add two vectors
     * @param {Float32Array} out 
     * @param {Float32Array} a 
     * @param {Float32Array} b 
     * @returns {Float32Array}
     */
    static add(out, a, b) {
        out[0] = a[0] + b[0];
        out[1] = a[1] + b[1];
        out[2] = a[2] + b[2];
        return out;
    }

    /**
     * Subtract vectors (a - b)
     * @param {Float32Array} out 
     * @param {Float32Array} a 
     * @param {Float32Array} b 
     * @returns {Float32Array}
     */
    static subtract(out, a, b) {
        out[0] = a[0] - b[0];
        out[1] = a[1] - b[1];
        out[2] = a[2] - b[2];
        return out;
    }

    /**
     * Multiply vector by scalar
     * @param {Float32Array} out 
     * @param {Float32Array} a 
     * @param {number} scalar 
     * @returns {Float32Array}
     */
    static scale(out, a, scalar) {
        out[0] = a[0] * scalar;
        out[1] = a[1] * scalar;
        out[2] = a[2] * scalar;
        return out;
    }

    /**
     * Multiply and add (out = a + b * scale)
     * @param {Float32Array} out 
     * @param {Float32Array} a 
     * @param {Float32Array} b 
     * @param {number} scale 
     * @returns {Float32Array}
     */
    static scaleAndAdd(out, a, b, scale) {
        out[0] = a[0] + b[0] * scale;
        out[1] = a[1] + b[1] * scale;
        out[2] = a[2] + b[2] * scale;
        return out;
    }

    /**
     * Calculate dot product
     * @param {Float32Array} a 
     * @param {Float32Array} b 
     * @returns {number}
     */
    static dot(a, b) {
        return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    }

    /**
     * Calculate cross product
     * @param {Float32Array} out 
     * @param {Float32Array} a 
     * @param {Float32Array} b 
     * @returns {Float32Array}
     */
    static cross(out, a, b) {
        const ax = a[0], ay = a[1], az = a[2];
        const bx = b[0], by = b[1], bz = b[2];
        out[0] = ay * bz - az * by;
        out[1] = az * bx - ax * bz;
        out[2] = ax * by - ay * bx;
        return out;
    }

    /**
     * Calculate vector length
     * @param {Float32Array} a 
     * @returns {number}
     */
    static length(a) {
        return Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]);
    }

    /**
     * Calculate squared length (faster, no sqrt)
     * @param {Float32Array} a 
     * @returns {number}
     */
    static lengthSquared(a) {
        return a[0] * a[0] + a[1] * a[1] + a[2] * a[2];
    }

    /**
     * Normalize vector to unit length
     * @param {Float32Array} out 
     * @param {Float32Array} a 
     * @returns {Float32Array}
     */
    static normalize(out, a) {
        const len = this.length(a);
        if (len > 0) {
            const invLen = 1.0 / len;
            out[0] = a[0] * invLen;
            out[1] = a[1] * invLen;
            out[2] = a[2] * invLen;
        } else {
            out[0] = 0;
            out[1] = 0;
            out[2] = 0;
        }
        return out;
    }

    /**
     * Calculate distance between two points
     * @param {Float32Array} a 
     * @param {Float32Array} b 
     * @returns {number}
     */
    static distance(a, b) {
        const dx = b[0] - a[0];
        const dy = b[1] - a[1];
        const dz = b[2] - a[2];
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    /**
     * Calculate squared distance (faster, no sqrt)
     * @param {Float32Array} a 
     * @param {Float32Array} b 
     * @returns {number}
     */
    static distanceSquared(a, b) {
        const dx = b[0] - a[0];
        const dy = b[1] - a[1];
        const dz = b[2] - a[2];
        return dx * dx + dy * dy + dz * dz;
    }

    /**
     * Linear interpolation between two vectors
     * @param {Float32Array} out 
     * @param {Float32Array} a 
     * @param {Float32Array} b 
     * @param {number} t - Interpolation factor [0, 1]
     * @returns {Float32Array}
     */
    static lerp(out, a, b, t) {
        out[0] = a[0] + (b[0] - a[0]) * t;
        out[1] = a[1] + (b[1] - a[1]) * t;
        out[2] = a[2] + (b[2] - a[2]) * t;
        return out;
    }

    /**
     * Negate vector
     * @param {Float32Array} out 
     * @param {Float32Array} a 
     * @returns {Float32Array}
     */
    static negate(out, a) {
        out[0] = -a[0];
        out[1] = -a[1];
        out[2] = -a[2];
        return out;
    }

    /**
     * Reflect vector across a normal
     * @param {Float32Array} out 
     * @param {Float32Array} v - Incident vector
     * @param {Float32Array} n - Normal vector (should be normalized)
     * @returns {Float32Array}
     */
    static reflect(out, v, n) {
        const dot = this.dot(v, n);
        out[0] = v[0] - 2 * dot * n[0];
        out[1] = v[1] - 2 * dot * n[1];
        out[2] = v[2] - 2 * dot * n[2];
        return out;
    }

    /**
     * Project vector a onto vector b
     * @param {Float32Array} out 
     * @param {Float32Array} a 
     * @param {Float32Array} b 
     * @returns {Float32Array}
     */
    static project(out, a, b) {
        const dotProduct = this.dot(a, b);
        const bLengthSq = this.lengthSquared(b);
        if (bLengthSq === 0) {
            out[0] = 0;
            out[1] = 0;
            out[2] = 0;
            return out;
        }
        const scalar = dotProduct / bLengthSq;
        return this.scale(out, b, scalar);
    }

    /**
     * Clamp vector length to maximum
     * @param {Float32Array} out 
     * @param {Float32Array} a 
     * @param {number} max 
     * @returns {Float32Array}
     */
    static clampLength(out, a, max) {
        const len = this.length(a);
        if (len > max && len > 0) {
            const scale = max / len;
            out[0] = a[0] * scale;
            out[1] = a[1] * scale;
            out[2] = a[2] * scale;
        } else {
            this.copy(out, a);
        }
        return out;
    }

    /**
     * Transform vector by 3x3 matrix
     * @param {Float32Array} out 
     * @param {Float32Array} v 
     * @param {Float32Array} m - 3x3 matrix in column-major order
     * @returns {Float32Array}
     */
    static transformMat3(out, v, m) {
        const x = v[0], y = v[1], z = v[2];
        out[0] = m[0] * x + m[3] * y + m[6] * z;
        out[1] = m[1] * x + m[4] * y + m[7] * z;
        out[2] = m[2] * x + m[5] * y + m[8] * z;
        return out;
    }

    /**
     * Rotate vector around arbitrary axis
     * @param {Float32Array} out 
     * @param {Float32Array} v 
     * @param {Float32Array} axis - Rotation axis (should be normalized)
     * @param {number} angle - Rotation angle in radians
     * @returns {Float32Array}
     */
    static rotateAroundAxis(out, v, axis, angle) {
        // Using Rodrigues' rotation formula
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const oneMinusCos = 1 - cos;

        const dot = this.dot(v, axis);
        const temp = Vector3Utils.create();
        this.cross(temp, axis, v);

        out[0] = v[0] * cos + temp[0] * sin + axis[0] * dot * oneMinusCos;
        out[1] = v[1] * cos + temp[1] * sin + axis[1] * dot * oneMinusCos;
        out[2] = v[2] * cos + temp[2] * sin + axis[2] * dot * oneMinusCos;
        return out;
    }
}

/**
 * Matrix3 operations (3x3 matrices)
 * Stored in column-major order
 */
class Matrix3Utils {
    /**
     * Create identity matrix
     * @returns {Float32Array}
     */
    static identity() {
        return new Float32Array([
            1, 0, 0,
            0, 1, 0,
            0, 0, 1
        ]);
    }

    /**
     * Create matrix from values
     * @param {number[]} values - 9 values in column-major order
     * @returns {Float32Array}
     */
    static fromValues(...values) {
        return new Float32Array(values);
    }

    /**
     * Copy matrix
     * @param {Float32Array} out 
     * @param {Float32Array} m 
     * @returns {Float32Array}
     */
    static copy(out, m) {
        for (let i = 0; i < 9; i++) {
            out[i] = m[i];
        }
        return out;
    }

    /**
     * Multiply two 3x3 matrices
     * @param {Float32Array} out 
     * @param {Float32Array} a 
     * @param {Float32Array} b 
     * @returns {Float32Array}
     */
    static multiply(out, a, b) {
        const a00 = a[0], a01 = a[1], a02 = a[2];
        const a10 = a[3], a11 = a[4], a12 = a[5];
        const a20 = a[6], a21 = a[7], a22 = a[8];

        const b00 = b[0], b01 = b[1], b02 = b[2];
        const b10 = b[3], b11 = b[4], b12 = b[5];
        const b20 = b[6], b21 = b[7], b22 = b[8];

        out[0] = b00 * a00 + b01 * a10 + b02 * a20;
        out[1] = b00 * a01 + b01 * a11 + b02 * a21;
        out[2] = b00 * a02 + b01 * a12 + b02 * a22;

        out[3] = b10 * a00 + b11 * a10 + b12 * a20;
        out[4] = b10 * a01 + b11 * a11 + b12 * a21;
        out[5] = b10 * a02 + b11 * a12 + b12 * a22;

        out[6] = b20 * a00 + b21 * a10 + b22 * a20;
        out[7] = b20 * a01 + b21 * a11 + b22 * a21;
        out[8] = b20 * a02 + b21 * a12 + b22 * a22;

        return out;
    }

    /**
     * Transpose matrix
     * @param {Float32Array} out 
     * @param {Float32Array} m 
     * @returns {Float32Array}
     */
    static transpose(out, m) {
        // If out and m are the same, use temporary storage
        if (out === m) {
            const temp = new Float32Array(9);
            this.copy(temp, m);
            m = temp;
        }

        out[0] = m[0];
        out[1] = m[3];
        out[2] = m[6];
        out[3] = m[1];
        out[4] = m[4];
        out[5] = m[7];
        out[6] = m[2];
        out[7] = m[5];
        out[8] = m[8];

        return out;
    }

    /**
     * Calculate determinant
     * @param {Float32Array} m 
     * @returns {number}
     */
    static determinant(m) {
        const a00 = m[0], a01 = m[1], a02 = m[2];
        const a10 = m[3], a11 = m[4], a12 = m[5];
        const a20 = m[6], a21 = m[7], a22 = m[8];

        return a00 * (a22 * a11 - a12 * a21) +
               a01 * (-a22 * a10 + a12 * a20) +
               a02 * (a21 * a10 - a11 * a20);
    }

    /**
     * Invert matrix
     * @param {Float32Array} out 
     * @param {Float32Array} m 
     * @returns {Float32Array|null}
     */
    static invert(out, m) {
        const a00 = m[0], a01 = m[1], a02 = m[2];
        const a10 = m[3], a11 = m[4], a12 = m[5];
        const a20 = m[6], a21 = m[7], a22 = m[8];

        const b01 = a22 * a11 - a12 * a21;
        const b11 = -a22 * a10 + a12 * a20;
        const b21 = a21 * a10 - a11 * a20;

        const det = a00 * b01 + a01 * b11 + a02 * b21;

        if (Math.abs(det) < 1e-10) {
            return null; // Matrix is singular
        }

        const invDet = 1.0 / det;

        out[0] = b01 * invDet;
        out[1] = (-a22 * a01 + a02 * a21) * invDet;
        out[2] = (a12 * a01 - a02 * a11) * invDet;
        out[3] = b11 * invDet;
        out[4] = (a22 * a00 - a02 * a20) * invDet;
        out[5] = (-a12 * a00 + a02 * a10) * invDet;
        out[6] = b21 * invDet;
        out[7] = (-a21 * a00 + a01 * a20) * invDet;
        out[8] = (a11 * a00 - a01 * a10) * invDet;

        return out;
    }

    /**
     * Create rotation matrix from angle around axis
     * @param {Float32Array} out 
     * @param {Float32Array} axis - Rotation axis (should be normalized)
     * @param {number} angle - Rotation angle in radians
     * @returns {Float32Array}
     */
    static fromRotation(out, axis, angle) {
        const x = axis[0], y = axis[1], z = axis[2];
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const t = 1 - cos;

        out[0] = x * x * t + cos;
        out[1] = y * x * t + z * sin;
        out[2] = z * x * t - y * sin;

        out[3] = x * y * t - z * sin;
        out[4] = y * y * t + cos;
        out[5] = z * y * t + x * sin;

        out[6] = x * z * t + y * sin;
        out[7] = y * z * t - x * sin;
        out[8] = z * z * t + cos;

        return out;
    }

    /**
     * Create rotation matrix from Euler angles (ZYX order)
     * @param {Float32Array} out 
     * @param {number} x - Pitch in radians
     * @param {number} y - Yaw in radians
     * @param {number} z - Roll in radians
     * @returns {Float32Array}
     */
    static fromEuler(out, x, y, z) {
        const cx = Math.cos(x), sx = Math.sin(x);
        const cy = Math.cos(y), sy = Math.sin(y);
        const cz = Math.cos(z), sz = Math.sin(z);

        out[0] = cy * cz;
        out[1] = cy * sz;
        out[2] = -sy;

        out[3] = sx * sy * cz - cx * sz;
        out[4] = sx * sy * sz + cx * cz;
        out[5] = sx * cy;

        out[6] = cx * sy * cz + sx * sz;
        out[7] = cx * sy * sz - sx * cz;
        out[8] = cx * cy;

        return out;
    }

    /**
     * Scale matrix by vector
     * @param {Float32Array} out 
     * @param {Float32Array} m 
     * @param {Float32Array} v 
     * @returns {Float32Array}
     */
    static scale(out, m, v) {
        out[0] = m[0] * v[0];
        out[1] = m[1] * v[0];
        out[2] = m[2] * v[0];

        out[3] = m[3] * v[1];
        out[4] = m[4] * v[1];
        out[5] = m[5] * v[1];

        out[6] = m[6] * v[2];
        out[7] = m[7] * v[2];
        out[8] = m[8] * v[2];

        return out;
    }
}

/**
 * Quaternion operations for rotations
 * Stored as [x, y, z, w]
 */
class QuaternionUtils {
    /**
     * Create identity quaternion
     * @returns {Float32Array}
     */
    static identity() {
        return new Float32Array([0, 0, 0, 1]);
    }

    /**
     * Create quaternion from values
     * @param {number} x 
     * @param {number} y 
     * @param {number} z 
     * @param {number} w 
     * @returns {Float32Array}
     */
    static create(x = 0, y = 0, z = 0, w = 1) {
        return new Float32Array([x, y, z, w]);
    }

    /**
     * Copy quaternion
     * @param {Float32Array} out 
     * @param {Float32Array} q 
     * @returns {Float32Array}
     */
    static copy(out, q) {
        out[0] = q[0];
        out[1] = q[1];
        out[2] = q[2];
        out[3] = q[3];
        return out;
    }

    /**
     * Set quaternion values
     * @param {Float32Array} out 
     * @param {number} x 
     * @param {number} y 
     * @param {number} z 
     * @param {number} w 
     * @returns {Float32Array}
     */
    static set(out, x, y, z, w) {
        out[0] = x;
        out[1] = y;
        out[2] = z;
        out[3] = w;
        return out;
    }

    /**
     * Multiply two quaternions
     * @param {Float32Array} out 
     * @param {Float32Array} a 
     * @param {Float32Array} b 
     * @returns {Float32Array}
     */
    static multiply(out, a, b) {
        const ax = a[0], ay = a[1], az = a[2], aw = a[3];
        const bx = b[0], by = b[1], bz = b[2], bw = b[3];

        out[0] = ax * bw + aw * bx + ay * bz - az * by;
        out[1] = ay * bw + aw * by + az * bx - ax * bz;
        out[2] = az * bw + aw * bz + ax * by - ay * bx;
        out[3] = aw * bw - ax * bx - ay * by - az * bz;

        return out;
    }

    /**
     * Rotate vector by quaternion
     * @param {Float32Array} out 
     * @param {Float32Array} v 
     * @param {Float32Array} q 
     * @returns {Float32Array}
     */
    static rotateVector(out, v, q) {
        const qx = q[0], qy = q[1], qz = q[2], qw = q[3];
        const vx = v[0], vy = v[1], vz = v[2];

        // Calculate quat * vector
        const ix = qw * vx + qy * vz - qz * vy;
        const iy = qw * vy + qz * vx - qx * vz;
        const iz = qw * vz + qx * vy - qy * vx;
        const iw = -qx * vx - qy * vy - qz * vz;

        // Calculate result * inverse quat
        out[0] = ix * qw + iw * -qx + iy * -qz - iz * -qy;
        out[1] = iy * qw + iw * -qy + iz * -qx - ix * -qz;
        out[2] = iz * qw + iw * -qz + ix * -qy - iy * -qx;

        return out;
    }

    /**
     * Create quaternion from axis angle
     * @param {Float32Array} out 
     * @param {Float32Array} axis - Rotation axis (should be normalized)
     * @param {number} angle - Rotation angle in radians
     * @returns {Float32Array}
     */
    static fromAxisAngle(out, axis, angle) {
        const halfAngle = angle * 0.5;
        const s = Math.sin(halfAngle);

        out[0] = axis[0] * s;
        out[1] = axis[1] * s;
        out[2] = axis[2] * s;
        out[3] = Math.cos(halfAngle);

        return out;
    }

    /**
     * Create quaternion from Euler angles (ZYX order)
     * @param {Float32Array} out 
     * @param {number} x - Pitch in radians
     * @param {number} y - Yaw in radians
     * @param {number} z - Roll in radians
     * @returns {Float32Array}
     */
    static fromEuler(out, x, y, z) {
        const halfX = x * 0.5;
        const halfY = y * 0.5;
        const halfZ = z * 0.5;

        const cx = Math.cos(halfX), sx = Math.sin(halfX);
        const cy = Math.cos(halfY), sy = Math.sin(halfY);
        const cz = Math.cos(halfZ), sz = Math.sin(halfZ);

        out[0] = sx * cy * cz - cx * sy * sz;
        out[1] = cx * sy * cz + sx * cy * sz;
        out[2] = cx * cy * sz - sx * sy * cz;
        out[3] = cx * cy * cz + sx * sy * sz;

        return out;
    }

    /**
     * Normalize quaternion
     * @param {Float32Array} out 
     * @param {Float32Array} q 
     * @returns {Float32Array}
     */
    static normalize(out, q) {
        const len = Math.sqrt(q[0] * q[0] + q[1] * q[1] + q[2] * q[2] + q[3] * q[3]);
        if (len > 0) {
            const invLen = 1.0 / len;
            out[0] = q[0] * invLen;
            out[1] = q[1] * invLen;
            out[2] = q[2] * invLen;
            out[3] = q[3] * invLen;
        } else {
            out[0] = 0;
            out[1] = 0;
            out[2] = 0;
            out[3] = 1;
        }
        return out;
    }

    /**
     * Calculate conjugate (inverse for unit quaternions)
     * @param {Float32Array} out 
     * @param {Float32Array} q 
     * @returns {Float32Array}
     */
    static conjugate(out, q) {
        out[0] = -q[0];
        out[1] = -q[1];
        out[2] = -q[2];
        out[3] = q[3];
        return out;
    }

    /**
     * Spherical linear interpolation
     * @param {Float32Array} out 
     * @param {Float32Array} a 
     * @param {Float32Array} b 
     * @param {number} t - Interpolation factor [0, 1]
     * @returns {Float32Array}
     */
    static slerp(out, a, b, t) {
        const ax = a[0], ay = a[1], az = a[2], aw = a[3];
        let bx = b[0], by = b[1], bz = b[2], bw = b[3];

        let dot = ax * bx + ay * by + az * bz + aw * bw;

        // If dot is negative, negate one quaternion to take shorter path
        if (dot < 0) {
            dot = -dot;
            bx = -bx;
            by = -by;
            bz = -bz;
            bw = -bw;
        }

        // If quaternions are very close, use linear interpolation
        if (dot > 0.9995) {
            out[0] = ax + (bx - ax) * t;
            out[1] = ay + (by - ay) * t;
            out[2] = az + (bz - az) * t;
            out[3] = aw + (bw - aw) * t;
            return this.normalize(out, out);
        }

        const theta = Math.acos(dot);
        const sinTheta = Math.sin(theta);
        const ratioA = Math.sin((1 - t) * theta) / sinTheta;
        const ratioB = Math.sin(t * theta) / sinTheta;

        out[0] = ax * ratioA + bx * ratioB;
        out[1] = ay * ratioA + by * ratioB;
        out[2] = az * ratioA + bz * ratioB;
        out[3] = aw * ratioA + bw * ratioB;

        return out;
    }

    /**
     * Convert quaternion to rotation matrix (3x3)
     * @param {Float32Array} out - 3x3 matrix
     * @param {Float32Array} q - Quaternion
     * @returns {Float32Array}
     */
    static toMat3(out, q) {
        const x = q[0], y = q[1], z = q[2], w = q[3];
        const x2 = x + x, y2 = y + y, z2 = z + z;
        const xx = x * x2, xy = x * y2, xz = x * z2;
        const yy = y * y2, yz = y * z2, zz = z * z2;
        const wx = w * x2, wy = w * y2, wz = w * z2;

        out[0] = 1 - (yy + zz);
        out[1] = xy + wz;
        out[2] = xz - wy;

        out[3] = xy - wz;
        out[4] = 1 - (xx + zz);
        out[5] = yz + wx;

        out[6] = xz + wy;
        out[7] = yz - wx;
        out[8] = 1 - (xx + yy);

        return out;
    }
}

/**
 * General mathematical utilities
 */
class MathUtils {
    /**
     * Clamp value between min and max
     * @param {number} value 
     * @param {number} min 
     * @param {number} max 
     * @returns {number}
     */
    static clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    /**
     * Linear interpolation
     * @param {number} a 
     * @param {number} b 
     * @param {number} t 
     * @returns {number}
     */
    static lerp(a, b, t) {
        return a + (b - a) * t;
    }

    /**
     * Smooth step interpolation
     * @param {number} edge0 
     * @param {number} edge1 
     * @param {number} x 
     * @returns {number}
     */
    static smoothstep(edge0, edge1, x) {
        const t = this.clamp((x - edge0) / (edge1 - edge0), 0, 1);
        return t * t * (3 - 2 * t);
    }

    /**
     * Convert degrees to radians
     * @param {number} degrees 
     * @returns {number}
     */
    static toRadians(degrees) {
        return degrees * (Math.PI / 180);
    }

    /**
     * Convert radians to degrees
     * @param {number} radians 
     * @returns {number}
     */
    static toDegrees(radians) {
        return radians * (180 / Math.PI);
    }

    /**
     * Wrap angle to [-PI, PI]
     * @param {number} angle 
     * @returns {number}
     */
    static wrapAngle(angle) {
        angle = angle % (2 * Math.PI);
        if (angle > Math.PI) {
            angle -= 2 * Math.PI;
        } else if (angle < -Math.PI) {
            angle += 2 * Math.PI;
        }
        return angle;
    }

    /**
     * Calculate shortest angular difference
     * @param {number} from 
     * @param {number} to 
     * @returns {number}
     */
    static angleDiff(from, to) {
        let diff = to - from;
        diff = this.wrapAngle(diff);
        return diff;
    }

    /**
     * Map value from one range to another
     * @param {number} value 
     * @param {number} inMin 
     * @param {number} inMax 
     * @param {number} outMin 
     * @param {number} outMax 
     * @returns {number}
     */
    static map(value, inMin, inMax, outMin, outMax) {
        return outMin + (value - inMin) * (outMax - outMin) / (inMax - inMin);
    }

    /**
     * Sign function that returns -1, 0, or 1
     * @param {number} x 
     * @returns {number}
     */
    static sign(x) {
        return x > 0 ? 1 : x < 0 ? -1 : 0;
    }

    /**
     * Check if value is approximately zero
     * @param {number} value 
     * @param {number} epsilon 
     * @returns {boolean}
     */
    static isZero(value, epsilon = 1e-6) {
        return Math.abs(value) < epsilon;
    }

    /**
     * Check if two values are approximately equal
     * @param {number} a 
     * @param {number} b 
     * @param {number} epsilon 
     * @returns {boolean}
     */
    static isEqual(a, b, epsilon = 1e-6) {
        return Math.abs(a - b) < epsilon;
    }

    /**
     * Calculate spring force (Hooke's law)
     * F = -k * x - c * v
     * @param {number} displacement - Current displacement from rest
     * @param {number} velocity - Current velocity
     * @param {number} springConstant - Spring stiffness (k)
     * @param {number} damping - Damping coefficient (c)
     * @returns {number}
     */
    static springForce(displacement, velocity, springConstant, damping) {
        return -springConstant * displacement - damping * velocity;
    }

    /**
     * Calculate damped harmonic oscillation
     * @param {number} amplitude 
     * @param {number} frequency 
     * @param {number} damping 
     * @param {number} time 
     * @returns {number}
     */
    static dampedOscillation(amplitude, frequency, damping, time) {
        return amplitude * Math.exp(-damping * time) * Math.cos(2 * Math.PI * frequency * time);
    }
}

// Export all utilities
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        Vector3Utils,
        Matrix3Utils,
        QuaternionUtils,
        MathUtils
    };
}
