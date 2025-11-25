/**
 * Weather.js - Dynamic Weather System
 * 
 * Implements comprehensive weather simulation including rain, snow, fog,
 * and their effects on driving conditions, visibility, and vehicle physics.
 * 
 * @module effects/Weather
 * @author CarSim Development Team
 * @version 2.0.0
 */

import { WEATHER_CONSTANTS, PHYSICS_CONSTANTS } from '../core/Constants.js';
import { MathUtils } from '../utils/MathUtils.js';
import { ObjectPool } from '../utils/ObjectPool.js';

/**
 * @typedef {Object} WeatherState
 * @property {string} type - Current weather type
 * @property {number} intensity - Weather intensity 0-1
 * @property {number} wetness - Surface wetness 0-1
 * @property {number} visibility - Visibility distance in meters
 * @property {number} windSpeed - Wind speed in m/s
 * @property {THREE.Vector3} windDirection - Wind direction vector
 * @property {number} temperature - Temperature in Celsius
 * @property {number} humidity - Humidity 0-1
 */

/**
 * Weather System - Full weather simulation
 */
export class Weather {
    /**
     * Creates a new Weather system
     * @param {THREE.Scene} scene - Three.js scene
     * @param {Object} options - Configuration options
     */
    constructor(scene, options = {}) {
        /** @type {THREE.Scene} */
        this.scene = scene;
        
        /**
         * Weather types and their properties
         * @type {Object}
         */
        this.weatherTypes = {
            CLEAR: {
                gripModifier: 1.0,
                visibilityRange: 10000,
                fogDensity: 0,
                particleCount: 0,
                skyColor: 0x87ceeb,
                ambientIntensity: 1.0
            },
            CLOUDY: {
                gripModifier: 1.0,
                visibilityRange: 8000,
                fogDensity: 0.0001,
                particleCount: 0,
                skyColor: 0xa0a0a0,
                ambientIntensity: 0.7
            },
            OVERCAST: {
                gripModifier: 0.95,
                visibilityRange: 5000,
                fogDensity: 0.0003,
                particleCount: 0,
                skyColor: 0x808080,
                ambientIntensity: 0.5
            },
            LIGHT_RAIN: {
                gripModifier: 0.8,
                visibilityRange: 3000,
                fogDensity: 0.0005,
                particleCount: 1000,
                skyColor: 0x606060,
                ambientIntensity: 0.4,
                particleType: 'rain'
            },
            HEAVY_RAIN: {
                gripModifier: 0.6,
                visibilityRange: 500,
                fogDensity: 0.002,
                particleCount: 5000,
                skyColor: 0x404040,
                ambientIntensity: 0.25,
                particleType: 'rain'
            },
            THUNDERSTORM: {
                gripModifier: 0.5,
                visibilityRange: 300,
                fogDensity: 0.003,
                particleCount: 8000,
                skyColor: 0x303030,
                ambientIntensity: 0.2,
                particleType: 'rain',
                hasLightning: true
            },
            LIGHT_SNOW: {
                gripModifier: 0.5,
                visibilityRange: 2000,
                fogDensity: 0.001,
                particleCount: 2000,
                skyColor: 0xc0c0c0,
                ambientIntensity: 0.6,
                particleType: 'snow'
            },
            HEAVY_SNOW: {
                gripModifier: 0.3,
                visibilityRange: 100,
                fogDensity: 0.005,
                particleCount: 8000,
                skyColor: 0xe0e0e0,
                ambientIntensity: 0.5,
                particleType: 'snow'
            },
            BLIZZARD: {
                gripModifier: 0.15,
                visibilityRange: 50,
                fogDensity: 0.01,
                particleCount: 15000,
                skyColor: 0xffffff,
                ambientIntensity: 0.4,
                particleType: 'snow'
            },
            FOG: {
                gripModifier: 0.9,
                visibilityRange: 100,
                fogDensity: 0.02,
                particleCount: 0,
                skyColor: 0xc0c0c0,
                ambientIntensity: 0.5
            },
            DENSE_FOG: {
                gripModifier: 0.85,
                visibilityRange: 30,
                fogDensity: 0.05,
                particleCount: 0,
                skyColor: 0xd0d0d0,
                ambientIntensity: 0.4
            }
        };
        
        /**
         * Current weather state
         * @type {WeatherState}
         */
        this.state = {
            type: 'CLEAR',
            intensity: 0,
            wetness: 0,
            snowAccumulation: 0,
            visibility: 10000,
            windSpeed: 0,
            windDirection: new THREE.Vector3(1, 0, 0),
            windGust: 0,
            temperature: 20,
            humidity: 0.5,
            transitionProgress: 1
        };
        
        /**
         * Target weather for transitions
         * @type {Object}
         */
        this.targetWeather = {
            type: 'CLEAR',
            intensity: 0
        };
        
        /**
         * Transition duration in seconds
         * @type {number}
         */
        this.transitionDuration = options.transitionDuration || 30;
        
        /**
         * Current transition time
         * @type {number}
         */
        this.transitionTime = 0;
        
        /**
         * Maximum particles
         * @type {number}
         */
        this.maxParticles = options.maxParticles || 20000;
        
        /**
         * Particle spread area
         * @type {THREE.Vector3}
         */
        this.particleArea = new THREE.Vector3(
            options.areaWidth || 100,
            options.areaHeight || 50,
            options.areaDepth || 100
        );
        
        /**
         * Rain particle system
         * @type {Object}
         */
        this.rainSystem = null;
        
        /**
         * Snow particle system
         * @type {Object}
         */
        this.snowSystem = null;
        
        /**
         * Scene fog
         * @type {THREE.Fog}
         */
        this.fog = null;
        
        /**
         * Ambient light reference
         * @type {THREE.AmbientLight}
         */
        this.ambientLight = options.ambientLight || null;
        
        /**
         * Directional light reference (sun)
         * @type {THREE.DirectionalLight}
         */
        this.sunLight = options.sunLight || null;
        
        /**
         * Sky dome/box reference
         * @type {THREE.Mesh}
         */
        this.skyDome = options.skyDome || null;
        
        /**
         * Lightning system
         * @type {Object}
         */
        this.lightning = {
            active: false,
            nextStrike: 0,
            intensity: 0,
            position: new THREE.Vector3()
        };
        
        /**
         * Puddle system for wet surfaces
         * @type {Array}
         */
        this.puddles = [];
        
        /**
         * Weather change callbacks
         * @type {Array<Function>}
         */
        this.onWeatherChange = [];
        
        /**
         * Audio system reference
         * @type {Object}
         */
        this.audioSystem = options.audioSystem || null;
        
        // Initialize systems
        this._initializeParticleSystems();
        this._initializeFog();
    }
    
    /**
     * Initializes particle systems for rain and snow
     * @private
     */
    _initializeParticleSystems() {
        // Rain particle system
        this._createRainSystem();
        
        // Snow particle system
        this._createSnowSystem();
    }
    
    /**
     * Creates rain particle system
     * @private
     */
    _createRainSystem() {
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(this.maxParticles * 3);
        const velocities = new Float32Array(this.maxParticles * 3);
        const sizes = new Float32Array(this.maxParticles);
        const alphas = new Float32Array(this.maxParticles);
        
        // Initialize particles
        for (let i = 0; i < this.maxParticles; i++) {
            positions[i * 3] = (Math.random() - 0.5) * this.particleArea.x;
            positions[i * 3 + 1] = Math.random() * this.particleArea.y;
            positions[i * 3 + 2] = (Math.random() - 0.5) * this.particleArea.z;
            
            velocities[i * 3] = 0;
            velocities[i * 3 + 1] = -20 - Math.random() * 10; // Fall speed
            velocities[i * 3 + 2] = 0;
            
            sizes[i] = 0.05 + Math.random() * 0.05;
            alphas[i] = 0.3 + Math.random() * 0.3;
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
        geometry.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1));
        
        const material = new THREE.ShaderMaterial({
            uniforms: {
                color: { value: new THREE.Color(0xaaccff) },
                opacity: { value: 1.0 },
                pointTexture: { value: this._createRainDropTexture() }
            },
            vertexShader: `
                attribute float size;
                attribute float alpha;
                varying float vAlpha;
                
                void main() {
                    vAlpha = alpha;
                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    gl_PointSize = size * (300.0 / -mvPosition.z);
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                uniform vec3 color;
                uniform float opacity;
                uniform sampler2D pointTexture;
                varying float vAlpha;
                
                void main() {
                    vec4 texColor = texture2D(pointTexture, gl_PointCoord);
                    gl_FragColor = vec4(color, opacity * vAlpha * texColor.a);
                }
            `,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            transparent: true
        });
        
        this.rainSystem = new THREE.Points(geometry, material);
        this.rainSystem.visible = false;
        this.scene.add(this.rainSystem);
    }
    
    /**
     * Creates snow particle system
     * @private
     */
    _createSnowSystem() {
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(this.maxParticles * 3);
        const velocities = new Float32Array(this.maxParticles * 3);
        const sizes = new Float32Array(this.maxParticles);
        const rotations = new Float32Array(this.maxParticles);
        
        for (let i = 0; i < this.maxParticles; i++) {
            positions[i * 3] = (Math.random() - 0.5) * this.particleArea.x;
            positions[i * 3 + 1] = Math.random() * this.particleArea.y;
            positions[i * 3 + 2] = (Math.random() - 0.5) * this.particleArea.z;
            
            velocities[i * 3] = (Math.random() - 0.5) * 0.5;
            velocities[i * 3 + 1] = -1 - Math.random() * 2;
            velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.5;
            
            sizes[i] = 0.1 + Math.random() * 0.2;
            rotations[i] = Math.random() * Math.PI * 2;
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
        geometry.setAttribute('rotation', new THREE.BufferAttribute(rotations, 1));
        
        const material = new THREE.ShaderMaterial({
            uniforms: {
                color: { value: new THREE.Color(0xffffff) },
                opacity: { value: 0.8 },
                pointTexture: { value: this._createSnowflakeTexture() }
            },
            vertexShader: `
                attribute float size;
                attribute float rotation;
                varying float vRotation;
                
                void main() {
                    vRotation = rotation;
                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    gl_PointSize = size * (200.0 / -mvPosition.z);
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                uniform vec3 color;
                uniform float opacity;
                uniform sampler2D pointTexture;
                varying float vRotation;
                
                void main() {
                    vec2 center = gl_PointCoord - 0.5;
                    float c = cos(vRotation);
                    float s = sin(vRotation);
                    vec2 rotated = vec2(
                        center.x * c - center.y * s,
                        center.x * s + center.y * c
                    ) + 0.5;
                    
                    vec4 texColor = texture2D(pointTexture, rotated);
                    gl_FragColor = vec4(color, opacity * texColor.a);
                }
            `,
            blending: THREE.NormalBlending,
            depthWrite: false,
            transparent: true
        });
        
        this.snowSystem = new THREE.Points(geometry, material);
        this.snowSystem.visible = false;
        this.scene.add(this.snowSystem);
    }
    
    /**
     * Creates rain drop texture
     * @private
     * @returns {THREE.Texture}
     */
    _createRainDropTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        
        // Elongated drop shape
        const gradient = ctx.createLinearGradient(16, 0, 16, 64);
        gradient.addColorStop(0, 'rgba(200, 220, 255, 0)');
        gradient.addColorStop(0.1, 'rgba(200, 220, 255, 0.8)');
        gradient.addColorStop(0.9, 'rgba(200, 220, 255, 0.8)');
        gradient.addColorStop(1, 'rgba(200, 220, 255, 0)');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(14, 0, 4, 64);
        
        const texture = new THREE.CanvasTexture(canvas);
        return texture;
    }
    
    /**
     * Creates snowflake texture
     * @private
     * @returns {THREE.Texture}
     */
    _createSnowflakeTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        
        // Simple circular snowflake
        const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.8)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(32, 32, 30, 0, Math.PI * 2);
        ctx.fill();
        
        // Add some crystalline structure
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 2;
        for (let i = 0; i < 6; i++) {
            const angle = i * Math.PI / 3;
            ctx.beginPath();
            ctx.moveTo(32, 32);
            ctx.lineTo(32 + Math.cos(angle) * 28, 32 + Math.sin(angle) * 28);
            ctx.stroke();
        }
        
        const texture = new THREE.CanvasTexture(canvas);
        return texture;
    }
    
    /**
     * Initializes scene fog
     * @private
     */
    _initializeFog() {
        this.fog = new THREE.FogExp2(0x87ceeb, 0);
        this.scene.fog = this.fog;
    }
    
    /**
     * Sets weather type
     * @param {string} weatherType - Weather type name
     * @param {number} intensity - Intensity 0-1
     * @param {boolean} instant - Skip transition
     */
    setWeather(weatherType, intensity = 1, instant = false) {
        if (!this.weatherTypes[weatherType]) {
            console.warn(`Unknown weather type: ${weatherType}`);
            return;
        }
        
        this.targetWeather.type = weatherType;
        this.targetWeather.intensity = MathUtils.clamp(intensity, 0, 1);
        
        if (instant) {
            this.state.type = weatherType;
            this.state.intensity = intensity;
            this.state.transitionProgress = 1;
            this._applyWeatherEffects();
        } else {
            this.transitionTime = 0;
            this.state.transitionProgress = 0;
        }
        
        // Fire callbacks
        for (const callback of this.onWeatherChange) {
            callback(this.state, this.targetWeather);
        }
    }
    
    /**
     * Sets wind parameters
     * @param {number} speed - Wind speed in m/s
     * @param {THREE.Vector3} direction - Wind direction
     */
    setWind(speed, direction) {
        this.state.windSpeed = speed;
        if (direction) {
            this.state.windDirection.copy(direction).normalize();
        }
    }
    
    /**
     * Sets temperature
     * @param {number} celsius - Temperature in Celsius
     */
    setTemperature(celsius) {
        this.state.temperature = celsius;
    }
    
    /**
     * Updates weather system
     * @param {number} deltaTime - Time step in seconds
     * @param {THREE.Vector3} cameraPosition - Camera position for particle centering
     */
    update(deltaTime, cameraPosition) {
        // Update transition
        if (this.state.transitionProgress < 1) {
            this.transitionTime += deltaTime;
            this.state.transitionProgress = Math.min(1, this.transitionTime / this.transitionDuration);
            
            if (this.state.transitionProgress >= 1) {
                this.state.type = this.targetWeather.type;
                this.state.intensity = this.targetWeather.intensity;
            }
        }
        
        // Apply current weather effects
        this._applyWeatherEffects();
        
        // Update particles
        this._updateParticles(deltaTime, cameraPosition);
        
        // Update wetness/snow accumulation
        this._updateSurfaceConditions(deltaTime);
        
        // Update wind gusts
        this._updateWind(deltaTime);
        
        // Update lightning
        if (this.weatherTypes[this.state.type]?.hasLightning) {
            this._updateLightning(deltaTime);
        }
    }
    
    /**
     * Applies weather visual effects
     * @private
     */
    _applyWeatherEffects() {
        const weatherProps = this.weatherTypes[this.state.type];
        const targetProps = this.weatherTypes[this.targetWeather.type];
        const t = this.state.transitionProgress;
        
        // Interpolate values
        const intensity = this.state.intensity;
        
        // Update fog
        const fogDensity = MathUtils.lerp(
            weatherProps.fogDensity,
            targetProps.fogDensity,
            t
        ) * intensity;
        this.fog.density = fogDensity;
        
        const fogColor = new THREE.Color(weatherProps.skyColor).lerp(
            new THREE.Color(targetProps.skyColor),
            t
        );
        this.fog.color.copy(fogColor);
        
        // Update sky color if sky dome exists
        if (this.skyDome && this.skyDome.material) {
            this.skyDome.material.color.copy(fogColor);
        }
        
        // Update ambient light
        if (this.ambientLight) {
            const ambientIntensity = MathUtils.lerp(
                weatherProps.ambientIntensity,
                targetProps.ambientIntensity,
                t
            );
            this.ambientLight.intensity = ambientIntensity * intensity;
        }
        
        // Update sun light
        if (this.sunLight) {
            const sunIntensity = MathUtils.lerp(
                weatherProps.ambientIntensity,
                targetProps.ambientIntensity,
                t
            );
            this.sunLight.intensity = sunIntensity * 0.8;
        }
        
        // Update visibility
        this.state.visibility = MathUtils.lerp(
            weatherProps.visibilityRange,
            targetProps.visibilityRange,
            t
        );
        
        // Update particle visibility
        const particleType = targetProps.particleType;
        const particleCount = Math.floor(targetProps.particleCount * intensity);
        
        if (particleType === 'rain' && this.rainSystem) {
            this.rainSystem.visible = particleCount > 0;
            this.rainSystem.userData.activeCount = particleCount;
        } else if (this.rainSystem) {
            this.rainSystem.visible = false;
        }
        
        if (particleType === 'snow' && this.snowSystem) {
            this.snowSystem.visible = particleCount > 0;
            this.snowSystem.userData.activeCount = particleCount;
        } else if (this.snowSystem) {
            this.snowSystem.visible = false;
        }
    }
    
    /**
     * Updates particle systems
     * @private
     */
    _updateParticles(deltaTime, cameraPosition) {
        // Update rain
        if (this.rainSystem && this.rainSystem.visible) {
            this._updateRainParticles(deltaTime, cameraPosition);
        }
        
        // Update snow
        if (this.snowSystem && this.snowSystem.visible) {
            this._updateSnowParticles(deltaTime, cameraPosition);
        }
    }
    
    /**
     * Updates rain particles
     * @private
     */
    _updateRainParticles(deltaTime, cameraPosition) {
        const positions = this.rainSystem.geometry.attributes.position.array;
        const velocities = this.rainSystem.geometry.attributes.velocity.array;
        const activeCount = this.rainSystem.userData.activeCount || 0;
        
        const halfX = this.particleArea.x / 2;
        const halfZ = this.particleArea.z / 2;
        const height = this.particleArea.y;
        
        const windX = this.state.windDirection.x * this.state.windSpeed * 0.5;
        const windZ = this.state.windDirection.z * this.state.windSpeed * 0.5;
        
        for (let i = 0; i < activeCount; i++) {
            const i3 = i * 3;
            
            // Update position
            positions[i3] += (velocities[i3] + windX) * deltaTime;
            positions[i3 + 1] += velocities[i3 + 1] * deltaTime;
            positions[i3 + 2] += (velocities[i3 + 2] + windZ) * deltaTime;
            
            // Reset if below ground or out of bounds
            if (positions[i3 + 1] < 0 || 
                Math.abs(positions[i3] - cameraPosition.x) > halfX ||
                Math.abs(positions[i3 + 2] - cameraPosition.z) > halfZ) {
                
                positions[i3] = cameraPosition.x + (Math.random() - 0.5) * this.particleArea.x;
                positions[i3 + 1] = cameraPosition.y + height;
                positions[i3 + 2] = cameraPosition.z + (Math.random() - 0.5) * this.particleArea.z;
            }
        }
        
        this.rainSystem.geometry.attributes.position.needsUpdate = true;
    }
    
    /**
     * Updates snow particles
     * @private
     */
    _updateSnowParticles(deltaTime, cameraPosition) {
        const positions = this.snowSystem.geometry.attributes.position.array;
        const velocities = this.snowSystem.geometry.attributes.velocity.array;
        const rotations = this.snowSystem.geometry.attributes.rotation.array;
        const activeCount = this.snowSystem.userData.activeCount || 0;
        
        const halfX = this.particleArea.x / 2;
        const halfZ = this.particleArea.z / 2;
        const height = this.particleArea.y;
        
        const windX = this.state.windDirection.x * this.state.windSpeed * 0.3;
        const windZ = this.state.windDirection.z * this.state.windSpeed * 0.3;
        
        for (let i = 0; i < activeCount; i++) {
            const i3 = i * 3;
            
            // Swaying motion
            const sway = Math.sin(positions[i3 + 1] * 0.1 + i * 0.1) * 0.5;
            
            // Update position
            positions[i3] += (velocities[i3] + windX + sway) * deltaTime;
            positions[i3 + 1] += velocities[i3 + 1] * deltaTime;
            positions[i3 + 2] += (velocities[i3 + 2] + windZ) * deltaTime;
            
            // Rotate snowflake
            rotations[i] += deltaTime * 2;
            
            // Reset if below ground or out of bounds
            if (positions[i3 + 1] < 0 || 
                Math.abs(positions[i3] - cameraPosition.x) > halfX ||
                Math.abs(positions[i3 + 2] - cameraPosition.z) > halfZ) {
                
                positions[i3] = cameraPosition.x + (Math.random() - 0.5) * this.particleArea.x;
                positions[i3 + 1] = cameraPosition.y + height;
                positions[i3 + 2] = cameraPosition.z + (Math.random() - 0.5) * this.particleArea.z;
            }
        }
        
        this.snowSystem.geometry.attributes.position.needsUpdate = true;
        this.snowSystem.geometry.attributes.rotation.needsUpdate = true;
    }
    
    /**
     * Updates surface conditions
     * @private
     */
    _updateSurfaceConditions(deltaTime) {
        const weatherProps = this.weatherTypes[this.state.type];
        const particleType = weatherProps.particleType;
        
        // Wetness from rain
        if (particleType === 'rain') {
            const wetnessRate = this.state.intensity * 0.1 * deltaTime;
            this.state.wetness = Math.min(1, this.state.wetness + wetnessRate);
        } else {
            // Drying
            const dryRate = 0.01 * deltaTime * (this.state.temperature > 10 ? 1 : 0.2);
            this.state.wetness = Math.max(0, this.state.wetness - dryRate);
        }
        
        // Snow accumulation
        if (particleType === 'snow' && this.state.temperature < 2) {
            const accumRate = this.state.intensity * 0.01 * deltaTime;
            this.state.snowAccumulation = Math.min(1, this.state.snowAccumulation + accumRate);
        } else if (this.state.temperature > 2) {
            // Melting
            const meltRate = (this.state.temperature - 2) * 0.005 * deltaTime;
            this.state.snowAccumulation = Math.max(0, this.state.snowAccumulation - meltRate);
            // Melting snow adds to wetness
            this.state.wetness = Math.min(1, this.state.wetness + meltRate * 0.5);
        }
    }
    
    /**
     * Updates wind gusts
     * @private
     */
    _updateWind(deltaTime) {
        // Random gust variation
        this.state.windGust += (Math.random() - 0.5) * 2 * deltaTime;
        this.state.windGust *= 0.95; // Decay
        this.state.windGust = MathUtils.clamp(this.state.windGust, -this.state.windSpeed * 0.5, this.state.windSpeed * 0.5);
    }
    
    /**
     * Updates lightning effects
     * @private
     */
    _updateLightning(deltaTime) {
        this.lightning.nextStrike -= deltaTime;
        
        if (this.lightning.intensity > 0) {
            // Fade out lightning
            this.lightning.intensity -= deltaTime * 5;
            
            if (this.sunLight) {
                this.sunLight.intensity = this.lightning.intensity * 5;
            }
        }
        
        if (this.lightning.nextStrike <= 0) {
            // Strike!
            this.lightning.active = true;
            this.lightning.intensity = 1;
            this.lightning.nextStrike = 5 + Math.random() * 20;
            
            // Random position
            this.lightning.position.set(
                (Math.random() - 0.5) * 500,
                100,
                (Math.random() - 0.5) * 500
            );
            
            // Flash effect
            if (this.sunLight) {
                this.sunLight.intensity = 5;
            }
            
            // Play thunder sound
            if (this.audioSystem) {
                // Thunder delay based on distance
                const distance = this.lightning.position.length();
                const delay = distance / 343; // Speed of sound
                setTimeout(() => {
                    if (this.audioSystem.playThunder) {
                        this.audioSystem.playThunder(distance);
                    }
                }, delay * 1000);
            }
        }
    }
    
    /**
     * Gets grip modifier for current conditions
     * @returns {number}
     */
    getGripModifier() {
        const weatherProps = this.weatherTypes[this.state.type];
        let grip = weatherProps.gripModifier;
        
        // Additional wetness effect
        grip *= (1 - this.state.wetness * 0.3);
        
        // Snow accumulation effect
        grip *= (1 - this.state.snowAccumulation * 0.5);
        
        return grip;
    }
    
    /**
     * Gets current weather state
     * @returns {WeatherState}
     */
    getState() {
        return { ...this.state };
    }
    
    /**
     * Gets effective wind vector (with gusts)
     * @returns {THREE.Vector3}
     */
    getWindVector() {
        return this.state.windDirection.clone().multiplyScalar(
            this.state.windSpeed + this.state.windGust
        );
    }
    
    /**
     * Registers weather change callback
     * @param {Function} callback
     */
    addWeatherChangeCallback(callback) {
        this.onWeatherChange.push(callback);
    }
    
    /**
     * Resets weather to clear
     */
    reset() {
        this.setWeather('CLEAR', 0, true);
        this.state.wetness = 0;
        this.state.snowAccumulation = 0;
        this.state.windSpeed = 0;
        this.state.windGust = 0;
    }
    
    /**
     * Disposes weather system resources
     */
    dispose() {
        if (this.rainSystem) {
            this.scene.remove(this.rainSystem);
            this.rainSystem.geometry.dispose();
            this.rainSystem.material.dispose();
        }
        
        if (this.snowSystem) {
            this.scene.remove(this.snowSystem);
            this.snowSystem.geometry.dispose();
            this.snowSystem.material.dispose();
        }
    }
}

export default Weather;
