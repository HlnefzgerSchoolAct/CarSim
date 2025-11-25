/**
 * GlassShatter.js - Glass Breaking and Particle System
 * 
 * Handles window/windshield cracking and shattering effects with
 * realistic glass fragment physics and visual effects.
 * 
 * @module damage/GlassShatter
 * @author CarSim Development Team
 * @version 2.0.0
 */

import { DAMAGE_CONSTANTS, PHYSICS_CONSTANTS } from '../core/Constants.js';
import { MathUtils } from '../utils/MathUtils.js';
import { ObjectPool } from '../utils/ObjectPool.js';

/**
 * @typedef {Object} GlassPanel
 * @property {string} id - Panel identifier
 * @property {string} type - Glass type (windshield, side, rear)
 * @property {THREE.Mesh} mesh - Glass mesh
 * @property {THREE.Vector3} position - Local position
 * @property {THREE.Vector2} size - Panel dimensions
 * @property {number} thickness - Glass thickness in mm
 * @property {number} strength - Breaking strength in N
 * @property {number} damage - Current damage 0-100
 * @property {boolean} isShattered - Fully shattered state
 * @property {Array} cracks - Array of crack patterns
 * @property {Array} fragments - Active fragments
 */

/**
 * @typedef {Object} GlassFragment
 * @property {THREE.Mesh} mesh - Fragment mesh
 * @property {THREE.Vector3} position - World position
 * @property {THREE.Vector3} velocity - Linear velocity
 * @property {THREE.Vector3} angularVelocity - Angular velocity
 * @property {number} mass - Fragment mass
 * @property {number} lifetime - Remaining lifetime
 * @property {number} size - Fragment size category
 */

/**
 * @typedef {Object} CrackLine
 * @property {THREE.Vector2} start - Start point in UV space
 * @property {THREE.Vector2} end - End point in UV space  
 * @property {number} width - Crack width
 * @property {Array} branches - Sub-cracks
 */

/**
 * GlassShatter System
 * Manages glass damage, cracking, and shattering effects
 */
export class GlassShatter {
    /**
     * Creates a new GlassShatter system
     * @param {THREE.Scene} scene - Three.js scene
     * @param {Object} options - Configuration options
     */
    constructor(scene, options = {}) {
        /** @type {THREE.Scene} */
        this.scene = scene;
        
        /** @type {Map<string, GlassPanel>} */
        this.glassPanels = new Map();
        
        /** @type {Array<GlassFragment>} */
        this.fragments = [];
        
        /** @type {ObjectPool} Fragment object pool */
        this.fragmentPool = new ObjectPool(() => this.createFragment(), 200);
        
        /** @type {number} Maximum fragments in scene */
        this.maxFragments = options.maxFragments || 500;
        
        /** @type {number} Fragment lifetime in seconds */
        this.fragmentLifetime = options.fragmentLifetime || 15;
        
        /** @type {number} Minimum fragment size */
        this.minFragmentSize = options.minFragmentSize || 0.02;
        
        /** @type {number} Maximum fragment size */
        this.maxFragmentSize = options.maxFragmentSize || 0.15;
        
        /** @type {boolean} Enable reflections on glass */
        this.enableReflections = options.enableReflections !== false;
        
        /** @type {boolean} Enable fragment shadows */
        this.enableShadows = options.enableShadows || false;
        
        /** @type {Function} Callback when glass cracks */
        this.onCrack = options.onCrack || null;
        
        /** @type {Function} Callback when glass shatters */
        this.onShatter = options.onShatter || null;
        
        /**
         * Glass type properties
         * @type {Object}
         */
        this.glassTypes = {
            WINDSHIELD: {
                thickness: 6.5,           // mm (laminated)
                strength: 15000,          // N
                crackResistance: 0.7,     // Tendency to crack vs shatter
                fragmentDensity: 40,      // Fragments per m²
                transparency: 0.85,
                tint: 0x88ccff,
                laminated: true           // Stays together when cracked
            },
            SIDE_TEMPERED: {
                thickness: 4.0,           // mm
                strength: 8000,           // N
                crackResistance: 0.1,     // Shatters easily
                fragmentDensity: 120,     // Many small pieces
                transparency: 0.9,
                tint: 0x99ddff,
                laminated: false
            },
            REAR: {
                thickness: 3.5,           // mm
                strength: 7000,           // N
                crackResistance: 0.2,
                fragmentDensity: 100,
                transparency: 0.9,
                tint: 0x88ccff,
                laminated: false
            },
            SUNROOF: {
                thickness: 5.0,           // mm
                strength: 10000,          // N
                crackResistance: 0.3,
                fragmentDensity: 80,
                transparency: 0.7,
                tint: 0x556677,
                laminated: true
            },
            HEADLIGHT: {
                thickness: 3.0,           // mm (polycarbonate)
                strength: 5000,           // N
                crackResistance: 0.5,
                fragmentDensity: 60,
                transparency: 0.95,
                tint: 0xffffff,
                laminated: false
            },
            TAILLIGHT: {
                thickness: 2.5,           // mm
                strength: 4000,           // N
                crackResistance: 0.4,
                fragmentDensity: 50,
                transparency: 0.8,
                tint: 0xff3333,
                laminated: false
            }
        };
        
        /**
         * Crack pattern generators
         * @type {Object}
         */
        this.crackPatterns = {
            RADIAL: this._generateRadialCracks.bind(this),
            LINEAR: this._generateLinearCracks.bind(this),
            SPIDER: this._generateSpiderCracks.bind(this),
            SHATTER: this._generateShatterCracks.bind(this)
        };
        
        /** @type {THREE.TextureLoader} */
        this.textureLoader = new THREE.TextureLoader();
        
        /** @type {THREE.Texture} Crack overlay texture */
        this.crackTexture = null;
        
        /** @type {THREE.ShaderMaterial} Cracked glass shader */
        this.crackedGlassShader = null;
        
        /** @type {Object} Statistics */
        this.stats = {
            totalCracks: 0,
            totalShatters: 0,
            activeFragments: 0,
            peakFragments: 0
        };
        
        this._initializeMaterials();
    }
    
    /**
     * Initialize glass materials and shaders
     * @private
     */
    _initializeMaterials() {
        // Create procedural crack texture
        this._createCrackTexture();
        
        // Create cracked glass shader material
        this.crackedGlassShader = new THREE.ShaderMaterial({
            uniforms: {
                tDiffuse: { value: null },
                tCrack: { value: this.crackTexture },
                crackIntensity: { value: 0.0 },
                time: { value: 0.0 },
                tint: { value: new THREE.Color(0x88ccff) }
            },
            vertexShader: `
                varying vec2 vUv;
                varying vec3 vNormal;
                varying vec3 vViewPosition;
                
                void main() {
                    vUv = uv;
                    vNormal = normalize(normalMatrix * normal);
                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    vViewPosition = -mvPosition.xyz;
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                uniform sampler2D tDiffuse;
                uniform sampler2D tCrack;
                uniform float crackIntensity;
                uniform float time;
                uniform vec3 tint;
                
                varying vec2 vUv;
                varying vec3 vNormal;
                varying vec3 vViewPosition;
                
                void main() {
                    vec4 crack = texture2D(tCrack, vUv);
                    
                    // Fresnel effect for glass
                    vec3 viewDir = normalize(vViewPosition);
                    float fresnel = pow(1.0 - abs(dot(viewDir, vNormal)), 3.0);
                    
                    // Base glass color with tint
                    vec3 glassColor = tint * (0.1 + fresnel * 0.3);
                    
                    // Add crack overlay
                    float crackAlpha = crack.r * crackIntensity;
                    vec3 crackColor = vec3(0.9, 0.95, 1.0);
                    
                    vec3 finalColor = mix(glassColor, crackColor, crackAlpha);
                    float finalAlpha = 0.4 + fresnel * 0.4 + crackAlpha * 0.3;
                    
                    gl_FragColor = vec4(finalColor, finalAlpha);
                }
            `,
            transparent: true,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        
        // Fragment material (simple for performance)
        this.fragmentMaterial = new THREE.MeshPhysicalMaterial({
            color: 0xaaddff,
            metalness: 0.0,
            roughness: 0.1,
            transmission: 0.8,
            thickness: 0.02,
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide
        });
    }
    
    /**
     * Creates a procedural crack texture
     * @private
     */
    _createCrackTexture() {
        const size = 512;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        
        // Fill with transparent
        ctx.fillStyle = 'rgba(0, 0, 0, 0)';
        ctx.fillRect(0, 0, size, size);
        
        // Draw procedural cracks
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = 1;
        
        // Generate radial crack pattern
        const centerX = size / 2;
        const centerY = size / 2;
        const numRays = 12 + Math.floor(Math.random() * 8);
        
        for (let i = 0; i < numRays; i++) {
            const angle = (i / numRays) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
            const length = size * 0.4 * (0.5 + Math.random() * 0.5);
            
            this._drawCrackLine(ctx, centerX, centerY, angle, length, 3);
        }
        
        // Add concentric rings
        ctx.lineWidth = 0.5;
        for (let r = 30; r < size / 2; r += 30 + Math.random() * 20) {
            ctx.beginPath();
            const segments = 8 + Math.floor(Math.random() * 8);
            for (let i = 0; i < segments; i++) {
                const startAngle = (i / segments) * Math.PI * 2;
                const endAngle = ((i + 0.7 + Math.random() * 0.2) / segments) * Math.PI * 2;
                ctx.arc(centerX, centerY, r, startAngle, endAngle);
                ctx.moveTo(centerX + r * Math.cos(endAngle), centerY + r * Math.sin(endAngle));
            }
            ctx.stroke();
        }
        
        this.crackTexture = new THREE.CanvasTexture(canvas);
        this.crackTexture.wrapS = THREE.ClampToEdgeWrapping;
        this.crackTexture.wrapT = THREE.ClampToEdgeWrapping;
    }
    
    /**
     * Draws a crack line with branches recursively
     * @private
     */
    _drawCrackLine(ctx, x, y, angle, length, depth) {
        if (depth <= 0 || length < 5) return;
        
        const endX = x + Math.cos(angle) * length;
        const endY = y + Math.sin(angle) * length;
        
        // Draw main line with slight waviness
        ctx.beginPath();
        ctx.moveTo(x, y);
        
        const steps = Math.ceil(length / 20);
        for (let i = 1; i <= steps; i++) {
            const t = i / steps;
            const px = x + (endX - x) * t + (Math.random() - 0.5) * 3;
            const py = y + (endY - y) * t + (Math.random() - 0.5) * 3;
            ctx.lineTo(px, py);
        }
        ctx.stroke();
        
        // Add branches
        if (depth > 1 && Math.random() < 0.6) {
            const branchPoint = 0.3 + Math.random() * 0.4;
            const branchX = x + (endX - x) * branchPoint;
            const branchY = y + (endY - y) * branchPoint;
            
            const branchAngle = angle + (Math.random() > 0.5 ? 1 : -1) * (0.3 + Math.random() * 0.5);
            const branchLength = length * (0.3 + Math.random() * 0.4);
            
            this._drawCrackLine(ctx, branchX, branchY, branchAngle, branchLength, depth - 1);
        }
        
        // Continue main crack
        if (depth > 1 && Math.random() < 0.8) {
            const newAngle = angle + (Math.random() - 0.5) * 0.4;
            const newLength = length * (0.5 + Math.random() * 0.3);
            this._drawCrackLine(ctx, endX, endY, newAngle, newLength, depth - 1);
        }
    }
    
    /**
     * Creates a fragment object for pooling
     * @private
     * @returns {GlassFragment}
     */
    createFragment() {
        return {
            mesh: null,
            position: new THREE.Vector3(),
            velocity: new THREE.Vector3(),
            angularVelocity: new THREE.Vector3(),
            rotation: new THREE.Euler(),
            mass: 0.01,
            lifetime: this.fragmentLifetime,
            size: 0.05,
            isOnGround: false,
            bounceCount: 0
        };
    }
    
    /**
     * Registers a glass panel
     * @param {string} id - Panel identifier
     * @param {Object} config - Panel configuration
     * @returns {GlassPanel}
     */
    registerPanel(id, config) {
        const typeProps = this.glassTypes[config.type] || this.glassTypes.WINDSHIELD;
        
        const panel = {
            id,
            type: config.type,
            mesh: config.mesh,
            position: config.position ? config.position.clone() : new THREE.Vector3(),
            size: config.size ? config.size.clone() : new THREE.Vector2(1, 1),
            thickness: typeProps.thickness,
            strength: config.strength || typeProps.strength,
            damage: 0,
            isShattered: false,
            isCracked: false,
            cracks: [],
            crackIntensity: 0,
            typeProps,
            originalMaterial: config.mesh ? config.mesh.material.clone() : null,
            fragments: []
        };
        
        this.glassPanels.set(id, panel);
        return panel;
    }
    
    /**
     * Applies impact to a glass panel
     * @param {string} panelId - Panel identifier
     * @param {number} force - Impact force in Newtons
     * @param {THREE.Vector3} impactPoint - Impact point in world space
     * @param {THREE.Vector3} impactDirection - Impact direction
     * @param {THREE.Vector3} impactorVelocity - Velocity of impactor
     * @returns {Object} Impact result
     */
    applyImpact(panelId, force, impactPoint, impactDirection, impactorVelocity = null) {
        const panel = this.glassPanels.get(panelId);
        if (!panel || panel.isShattered) {
            return { cracked: false, shattered: false };
        }
        
        // Calculate damage based on force
        const damageIncrement = (force / panel.strength) * 40;
        panel.damage = Math.min(100, panel.damage + damageIncrement);
        
        // Determine if cracking or shattering occurs
        const shatterThreshold = panel.strength * (1 - panel.typeProps.crackResistance);
        const crackThreshold = panel.strength * 0.3;
        
        let result = { cracked: false, shattered: false, fragments: [] };
        
        if (force >= shatterThreshold || (panel.damage >= 80 && !panel.typeProps.laminated)) {
            // Glass shatters
            result = this._shatterPanel(panel, impactPoint, impactDirection, impactorVelocity);
            result.shattered = true;
        } else if (force >= crackThreshold || panel.damage >= 30) {
            // Glass cracks
            result = this._crackPanel(panel, impactPoint, force);
            result.cracked = true;
        }
        
        return result;
    }
    
    /**
     * Creates crack pattern on glass
     * @private
     * @param {GlassPanel} panel - Panel to crack
     * @param {THREE.Vector3} impactPoint - Impact point
     * @param {number} force - Impact force
     * @returns {Object} Crack result
     */
    _crackPanel(panel, impactPoint, force) {
        if (!panel.mesh) return { cracked: false };
        
        panel.isCracked = true;
        
        // Calculate UV coordinates of impact point
        const localPoint = panel.mesh.worldToLocal(impactPoint.clone());
        const uv = new THREE.Vector2(
            (localPoint.x / panel.size.x) + 0.5,
            (localPoint.y / panel.size.y) + 0.5
        );
        
        // Generate crack pattern based on force
        const intensity = Math.min(1, force / panel.strength);
        const pattern = intensity > 0.6 ? 'SPIDER' : (intensity > 0.3 ? 'RADIAL' : 'LINEAR');
        
        const cracks = this.crackPatterns[pattern](uv, intensity);
        panel.cracks.push(...cracks);
        
        // Update crack intensity for shader
        panel.crackIntensity = Math.min(1, panel.crackIntensity + intensity * 0.5);
        
        // Apply cracked material
        this._applyCrackedMaterial(panel);
        
        // Update stats
        this.stats.totalCracks++;
        
        // Fire callback
        if (this.onCrack) {
            this.onCrack(panel, cracks);
        }
        
        return { cracked: true, cracks, intensity: panel.crackIntensity };
    }
    
    /**
     * Shatters a glass panel into fragments
     * @private
     * @param {GlassPanel} panel - Panel to shatter
     * @param {THREE.Vector3} impactPoint - Impact point
     * @param {THREE.Vector3} impactDirection - Impact direction
     * @param {THREE.Vector3} impactorVelocity - Impactor velocity
     * @returns {Object} Shatter result
     */
    _shatterPanel(panel, impactPoint, impactDirection, impactorVelocity) {
        if (!panel.mesh || panel.isShattered) {
            return { shattered: false };
        }
        
        panel.isShattered = true;
        
        // Get world transform of panel
        const worldPosition = new THREE.Vector3();
        const worldQuaternion = new THREE.Quaternion();
        panel.mesh.getWorldPosition(worldPosition);
        panel.mesh.getWorldQuaternion(worldQuaternion);
        
        // Calculate number of fragments based on panel size and density
        const area = panel.size.x * panel.size.y;
        const numFragments = Math.min(
            this.maxFragments - this.fragments.length,
            Math.floor(area * panel.typeProps.fragmentDensity)
        );
        
        const createdFragments = [];
        
        // Generate Voronoi-like fragment positions
        const fragmentPositions = this._generateFragmentPositions(numFragments, panel.size);
        
        for (const fragPos of fragmentPositions) {
            const fragment = this._createGlassFragment(
                panel,
                fragPos,
                worldPosition,
                worldQuaternion,
                impactPoint,
                impactDirection,
                impactorVelocity
            );
            
            if (fragment) {
                this.fragments.push(fragment);
                createdFragments.push(fragment);
            }
        }
        
        // Hide or remove original panel mesh
        if (panel.mesh.parent) {
            panel.mesh.visible = false;
            // Don't remove from parent - just hide for potential reset
        }
        
        // Update stats
        this.stats.totalShatters++;
        this.stats.activeFragments = this.fragments.length;
        this.stats.peakFragments = Math.max(this.stats.peakFragments, this.fragments.length);
        
        // Fire callback
        if (this.onShatter) {
            this.onShatter(panel, createdFragments);
        }
        
        return { shattered: true, fragments: createdFragments };
    }
    
    /**
     * Generates fragment positions using Voronoi-like distribution
     * @private
     * @param {number} count - Number of fragments
     * @param {THREE.Vector2} size - Panel size
     * @returns {Array} Fragment positions
     */
    _generateFragmentPositions(count, size) {
        const positions = [];
        const halfW = size.x / 2;
        const halfH = size.y / 2;
        
        // Use Poisson disk sampling for better distribution
        const minDist = Math.sqrt((size.x * size.y) / count) * 0.5;
        const attempts = 30;
        
        for (let i = 0; i < count; i++) {
            let bestCandidate = null;
            let bestDistance = 0;
            
            for (let a = 0; a < attempts; a++) {
                const candidate = new THREE.Vector2(
                    (Math.random() - 0.5) * size.x,
                    (Math.random() - 0.5) * size.y
                );
                
                // Find minimum distance to existing points
                let minDistToExisting = Infinity;
                for (const existing of positions) {
                    const dist = candidate.distanceTo(existing);
                    minDistToExisting = Math.min(minDistToExisting, dist);
                }
                
                // Keep candidate with maximum minimum distance
                if (minDistToExisting > bestDistance) {
                    bestDistance = minDistToExisting;
                    bestCandidate = candidate;
                }
            }
            
            if (bestCandidate) {
                positions.push(bestCandidate);
            }
        }
        
        return positions;
    }
    
    /**
     * Creates a single glass fragment
     * @private
     */
    _createGlassFragment(panel, localPos, worldPos, worldQuat, impactPoint, impactDir, impactorVel) {
        const fragment = this.fragmentPool.acquire();
        
        // Random fragment size
        const size = this.minFragmentSize + Math.random() * (this.maxFragmentSize - this.minFragmentSize);
        fragment.size = size;
        
        // Create fragment geometry (irregular triangle/quad)
        const geometry = this._createFragmentGeometry(size);
        
        // Clone material for independent fading
        const material = this.fragmentMaterial.clone();
        material.color.setHex(panel.typeProps.tint);
        
        fragment.mesh = new THREE.Mesh(geometry, material);
        fragment.mesh.castShadow = this.enableShadows;
        
        // Calculate world position
        const fragWorld = new THREE.Vector3(localPos.x, localPos.y, 0);
        fragWorld.applyQuaternion(worldQuat);
        fragWorld.add(worldPos);
        fragment.position.copy(fragWorld);
        fragment.mesh.position.copy(fragWorld);
        
        // Set rotation
        fragment.rotation.setFromQuaternion(worldQuat);
        fragment.mesh.rotation.copy(fragment.rotation);
        
        // Calculate initial velocity
        // Fragments fly outward from impact point
        const toFragment = fragWorld.clone().sub(impactPoint).normalize();
        const distance = fragWorld.distanceTo(impactPoint);
        const distanceFactor = Math.max(0.1, 1 - distance / 2);
        
        // Base outward velocity
        const outwardSpeed = 5 + Math.random() * 10;
        fragment.velocity.copy(toFragment).multiplyScalar(outwardSpeed * distanceFactor);
        
        // Add impactor momentum if available
        if (impactorVel) {
            fragment.velocity.addScaledVector(impactorVel, 0.3);
        }
        
        // Add impact direction influence
        fragment.velocity.addScaledVector(impactDir, 2 + Math.random() * 3);
        
        // Add some randomness
        fragment.velocity.x += (Math.random() - 0.5) * 4;
        fragment.velocity.y += Math.random() * 3;
        fragment.velocity.z += (Math.random() - 0.5) * 4;
        
        // Angular velocity
        fragment.angularVelocity.set(
            (Math.random() - 0.5) * 20,
            (Math.random() - 0.5) * 20,
            (Math.random() - 0.5) * 20
        );
        
        // Mass based on size
        fragment.mass = size * size * panel.typeProps.thickness * 2500 * 0.000001; // kg
        
        fragment.lifetime = this.fragmentLifetime;
        fragment.isOnGround = false;
        fragment.bounceCount = 0;
        
        this.scene.add(fragment.mesh);
        
        return fragment;
    }
    
    /**
     * Creates fragment geometry
     * @private
     * @param {number} size - Fragment size
     * @returns {THREE.BufferGeometry}
     */
    _createFragmentGeometry(size) {
        // Create irregular polygon fragment
        const vertices = [];
        const indices = [];
        
        const numVerts = 4 + Math.floor(Math.random() * 3); // 4-6 vertices
        const angles = [];
        
        // Generate random angles for vertices
        for (let i = 0; i < numVerts; i++) {
            angles.push((i / numVerts) * Math.PI * 2 + (Math.random() - 0.5) * 0.5);
        }
        angles.sort((a, b) => a - b);
        
        // Create vertices
        for (const angle of angles) {
            const r = size * (0.5 + Math.random() * 0.5);
            vertices.push(
                Math.cos(angle) * r,
                Math.sin(angle) * r,
                (Math.random() - 0.5) * 0.005 // Slight thickness variation
            );
        }
        
        // Create triangles (fan from center)
        for (let i = 1; i < numVerts - 1; i++) {
            indices.push(0, i, i + 1);
        }
        
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();
        
        return geometry;
    }
    
    /**
     * Applies cracked glass material to panel
     * @private
     * @param {GlassPanel} panel - Panel to update
     */
    _applyCrackedMaterial(panel) {
        if (!panel.mesh) return;
        
        // Clone shader material for this panel
        const crackedMat = this.crackedGlassShader.clone();
        crackedMat.uniforms.crackIntensity.value = panel.crackIntensity;
        crackedMat.uniforms.tint.value.setHex(panel.typeProps.tint);
        
        panel.mesh.material = crackedMat;
    }
    
    /**
     * Generates radial crack pattern
     * @private
     */
    _generateRadialCracks(center, intensity) {
        const cracks = [];
        const numRays = Math.floor(4 + intensity * 8);
        
        for (let i = 0; i < numRays; i++) {
            const angle = (i / numRays) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
            const length = 0.2 + intensity * 0.5 * (0.5 + Math.random() * 0.5);
            
            const crack = {
                start: center.clone(),
                end: new THREE.Vector2(
                    center.x + Math.cos(angle) * length,
                    center.y + Math.sin(angle) * length
                ),
                width: 1 + Math.random(),
                branches: []
            };
            
            // Add branches
            if (intensity > 0.4 && Math.random() < 0.5) {
                const branchPoint = 0.3 + Math.random() * 0.4;
                const branchStart = new THREE.Vector2().lerpVectors(crack.start, crack.end, branchPoint);
                const branchAngle = angle + (Math.random() > 0.5 ? 1 : -1) * (0.3 + Math.random() * 0.4);
                const branchLength = length * 0.4 * (0.5 + Math.random() * 0.5);
                
                crack.branches.push({
                    start: branchStart.clone(),
                    end: new THREE.Vector2(
                        branchStart.x + Math.cos(branchAngle) * branchLength,
                        branchStart.y + Math.sin(branchAngle) * branchLength
                    ),
                    width: 0.5 + Math.random() * 0.5
                });
            }
            
            cracks.push(crack);
        }
        
        return cracks;
    }
    
    /**
     * Generates linear crack pattern
     * @private
     */
    _generateLinearCracks(center, intensity) {
        const cracks = [];
        const numCracks = Math.floor(1 + intensity * 3);
        
        for (let i = 0; i < numCracks; i++) {
            const angle = Math.random() * Math.PI;
            const halfLength = (0.1 + intensity * 0.3) * (0.5 + Math.random() * 0.5);
            
            cracks.push({
                start: new THREE.Vector2(
                    center.x - Math.cos(angle) * halfLength,
                    center.y - Math.sin(angle) * halfLength
                ),
                end: new THREE.Vector2(
                    center.x + Math.cos(angle) * halfLength,
                    center.y + Math.sin(angle) * halfLength
                ),
                width: 0.5 + Math.random(),
                branches: []
            });
        }
        
        return cracks;
    }
    
    /**
     * Generates spider web crack pattern
     * @private
     */
    _generateSpiderCracks(center, intensity) {
        const cracks = this._generateRadialCracks(center, intensity);
        
        // Add concentric ring cracks
        const numRings = Math.floor(1 + intensity * 3);
        for (let ring = 1; ring <= numRings; ring++) {
            const radius = ring * 0.1 * (0.8 + Math.random() * 0.4);
            const segments = 6 + Math.floor(Math.random() * 6);
            
            for (let i = 0; i < segments; i++) {
                const startAngle = (i / segments) * Math.PI * 2;
                const arcLength = (0.5 + Math.random() * 0.3) / segments * Math.PI * 2;
                const endAngle = startAngle + arcLength;
                
                cracks.push({
                    start: new THREE.Vector2(
                        center.x + Math.cos(startAngle) * radius,
                        center.y + Math.sin(startAngle) * radius
                    ),
                    end: new THREE.Vector2(
                        center.x + Math.cos(endAngle) * radius,
                        center.y + Math.sin(endAngle) * radius
                    ),
                    width: 0.3 + Math.random() * 0.3,
                    isArc: true,
                    arcCenter: center.clone(),
                    arcRadius: radius,
                    branches: []
                });
            }
        }
        
        return cracks;
    }
    
    /**
     * Generates shatter pre-pattern
     * @private
     */
    _generateShatterCracks(center, intensity) {
        // Dense crack network that precedes shattering
        const cracks = this._generateSpiderCracks(center, 1.0);
        
        // Add additional random cracks
        const numExtra = Math.floor(5 + intensity * 10);
        for (let i = 0; i < numExtra; i++) {
            const start = new THREE.Vector2(
                Math.random(),
                Math.random()
            );
            const angle = Math.random() * Math.PI * 2;
            const length = 0.05 + Math.random() * 0.15;
            
            cracks.push({
                start: start.clone(),
                end: new THREE.Vector2(
                    start.x + Math.cos(angle) * length,
                    start.y + Math.sin(angle) * length
                ),
                width: 0.3 + Math.random() * 0.5,
                branches: []
            });
        }
        
        return cracks;
    }
    
    /**
     * Updates all fragments and cracked glass
     * @param {number} deltaTime - Time step in seconds
     */
    update(deltaTime) {
        const gravity = PHYSICS_CONSTANTS?.GRAVITY || 9.81;
        
        // Update fragments
        for (let i = this.fragments.length - 1; i >= 0; i--) {
            const fragment = this.fragments[i];
            
            // Update lifetime
            fragment.lifetime -= deltaTime;
            if (fragment.lifetime <= 0) {
                this._cleanupFragment(fragment);
                this.fragments.splice(i, 1);
                continue;
            }
            
            if (!fragment.isOnGround) {
                // Apply gravity
                fragment.velocity.y -= gravity * deltaTime;
                
                // Apply air resistance (glass fragments have high drag)
                const speed = fragment.velocity.length();
                if (speed > 0.1) {
                    const dragForce = 0.5 * 1.225 * 1.0 * fragment.size * speed * speed;
                    const dragAccel = dragForce / fragment.mass;
                    fragment.velocity.addScaledVector(
                        fragment.velocity.clone().normalize(),
                        -dragAccel * deltaTime
                    );
                }
                
                // Update position
                fragment.position.addScaledVector(fragment.velocity, deltaTime);
                
                // Update rotation
                fragment.rotation.x += fragment.angularVelocity.x * deltaTime;
                fragment.rotation.y += fragment.angularVelocity.y * deltaTime;
                fragment.rotation.z += fragment.angularVelocity.z * deltaTime;
                
                // Ground collision
                if (fragment.position.y <= 0.01) {
                    fragment.position.y = 0.01;
                    fragment.bounceCount++;
                    
                    if (fragment.bounceCount < 2 && Math.abs(fragment.velocity.y) > 0.5) {
                        // Bounce
                        fragment.velocity.y *= -0.2;
                        fragment.velocity.x *= 0.7;
                        fragment.velocity.z *= 0.7;
                        fragment.angularVelocity.multiplyScalar(0.5);
                    } else {
                        // Come to rest
                        fragment.isOnGround = true;
                        fragment.velocity.set(0, 0, 0);
                        fragment.angularVelocity.set(0, 0, 0);
                    }
                }
            }
            
            // Update mesh
            if (fragment.mesh) {
                fragment.mesh.position.copy(fragment.position);
                fragment.mesh.rotation.copy(fragment.rotation);
                
                // Fade out near end of lifetime
                if (fragment.lifetime < 3 && fragment.mesh.material.opacity !== undefined) {
                    fragment.mesh.material.opacity = (fragment.lifetime / 3) * 0.8;
                }
            }
        }
        
        // Update cracked glass shader uniforms
        for (const panel of this.glassPanels.values()) {
            if (panel.isCracked && panel.mesh && panel.mesh.material.uniforms) {
                panel.mesh.material.uniforms.time.value += deltaTime;
            }
        }
        
        // Update stats
        this.stats.activeFragments = this.fragments.length;
    }
    
    /**
     * Cleans up a fragment
     * @private
     * @param {GlassFragment} fragment - Fragment to cleanup
     */
    _cleanupFragment(fragment) {
        if (fragment.mesh) {
            this.scene.remove(fragment.mesh);
            fragment.mesh.geometry.dispose();
            fragment.mesh.material.dispose();
            fragment.mesh = null;
        }
        this.fragmentPool.release(fragment);
    }
    
    /**
     * Gets panel damage level
     * @param {string} panelId - Panel identifier
     * @returns {number} Damage 0-100
     */
    getPanelDamage(panelId) {
        const panel = this.glassPanels.get(panelId);
        return panel ? panel.damage : 0;
    }
    
    /**
     * Checks if panel is shattered
     * @param {string} panelId - Panel identifier
     * @returns {boolean}
     */
    isShattered(panelId) {
        const panel = this.glassPanels.get(panelId);
        return panel ? panel.isShattered : false;
    }
    
    /**
     * Gets total glass damage percentage
     * @returns {number} Average damage 0-100
     */
    getTotalDamage() {
        let total = 0;
        let count = 0;
        
        for (const panel of this.glassPanels.values()) {
            total += panel.isShattered ? 100 : panel.damage;
            count++;
        }
        
        return count > 0 ? total / count : 0;
    }
    
    /**
     * Resets all glass panels
     */
    reset() {
        // Cleanup fragments
        for (const fragment of this.fragments) {
            this._cleanupFragment(fragment);
        }
        this.fragments = [];
        
        // Reset panels
        for (const panel of this.glassPanels.values()) {
            panel.damage = 0;
            panel.isShattered = false;
            panel.isCracked = false;
            panel.cracks = [];
            panel.crackIntensity = 0;
            
            if (panel.mesh) {
                panel.mesh.visible = true;
                if (panel.originalMaterial) {
                    panel.mesh.material = panel.originalMaterial.clone();
                }
            }
        }
        
        // Reset stats
        this.stats.totalCracks = 0;
        this.stats.totalShatters = 0;
        this.stats.activeFragments = 0;
    }
    
    /**
     * Gets statistics
     * @returns {Object} Statistics
     */
    getStats() {
        return { ...this.stats };
    }
    
    /**
     * Disposes all resources
     */
    dispose() {
        this.reset();
        this.glassPanels.clear();
        this.fragmentPool.clear();
        
        if (this.crackTexture) {
            this.crackTexture.dispose();
        }
        if (this.fragmentMaterial) {
            this.fragmentMaterial.dispose();
        }
        if (this.crackedGlassShader) {
            this.crackedGlassShader.dispose();
        }
    }
}

export default GlassShatter;
