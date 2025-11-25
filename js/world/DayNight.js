/**
 * DayNight.js - Day/Night Cycle System
 * @module world/DayNight
 */

export class DayNight {
    constructor(scene, options = {}) {
        this.scene = scene;
        this.timeOfDay = options.startTime || 12;
        this.cycleDuration = options.cycleDuration || 600;
        this.sunLight = options.sunLight || null;
        this.ambientLight = options.ambientLight || null;
        this.skyDome = options.skyDome || null;
        
        this.sunColors = {
            dawn: new THREE.Color(0xff7700),
            day: new THREE.Color(0xffffee),
            dusk: new THREE.Color(0xff5500),
            night: new THREE.Color(0x111133)
        };
        
        this.skyColors = {
            dawn: new THREE.Color(0xff9966),
            day: new THREE.Color(0x87ceeb),
            dusk: new THREE.Color(0xff6633),
            night: new THREE.Color(0x0a0a1a)
        };
        
        this.ambientIntensities = { dawn: 0.3, day: 0.6, dusk: 0.25, night: 0.1 };
        this.sunIntensities = { dawn: 0.5, day: 1.0, dusk: 0.4, night: 0.0 };
    }
    
    update(deltaTime) {
        this.timeOfDay += (deltaTime / this.cycleDuration) * 24;
        if (this.timeOfDay >= 24) this.timeOfDay -= 24;
        
        const hour = this.timeOfDay;
        let phase, t;
        
        if (hour >= 5 && hour < 7) { phase = 'dawn'; t = (hour - 5) / 2; }
        else if (hour >= 7 && hour < 17) { phase = 'day'; t = 1; }
        else if (hour >= 17 && hour < 19) { phase = 'dusk'; t = (hour - 17) / 2; }
        else { phase = 'night'; t = 1; }
        
        this._updateLighting(phase, t);
        this._updateSunPosition();
    }
    
    _updateLighting(phase, t) {
        if (this.sunLight) {
            const color = this.sunColors[phase] || this.sunColors.day;
            this.sunLight.color.copy(color);
            this.sunLight.intensity = this.sunIntensities[phase] || 1.0;
        }
        
        if (this.ambientLight) {
            this.ambientLight.intensity = this.ambientIntensities[phase] || 0.5;
        }
        
        if (this.skyDome && this.skyDome.material) {
            const color = this.skyColors[phase] || this.skyColors.day;
            this.skyDome.material.color.copy(color);
        }
        
        if (this.scene.fog) {
            const color = this.skyColors[phase] || this.skyColors.day;
            this.scene.fog.color.copy(color);
        }
    }
    
    _updateSunPosition() {
        if (!this.sunLight) return;
        const angle = ((this.timeOfDay - 6) / 24) * Math.PI * 2;
        const height = Math.sin(angle) * 100;
        const distance = Math.cos(angle) * 100;
        this.sunLight.position.set(distance, Math.max(height, -20), 50);
    }
    
    setTime(hour) { this.timeOfDay = hour % 24; }
    getTime() { return this.timeOfDay; }
    getPhase() {
        const h = this.timeOfDay;
        if (h >= 5 && h < 7) return 'dawn';
        if (h >= 7 && h < 17) return 'day';
        if (h >= 17 && h < 19) return 'dusk';
        return 'night';
    }
}

export default DayNight;
