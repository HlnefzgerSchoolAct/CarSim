/**
 * EngineAudio.js - RPM-based Engine Sound System
 * @module audio/EngineAudio
 */

export class EngineAudio {
    constructor(audioManager, options = {}) {
        this.audioManager = audioManager;
        this.context = null;
        this.oscillators = [];
        this.gainNodes = [];
        this.masterGain = null;
        this.isPlaying = false;
        this.currentRPM = 800;
        this.idleRPM = options.idleRPM || 800;
        this.maxRPM = options.maxRPM || 7500;
        this.throttle = 0;
        this.load = 0;
    }
    
    async init() {
        if (!this.audioManager.context) await this.audioManager.init();
        this.context = this.audioManager.context;
        if (!this.context) return;
        
        this.masterGain = this.context.createGain();
        this.masterGain.gain.value = 0.3;
        this.masterGain.connect(this.audioManager.masterGain);
        
        // Create harmonics for engine sound
        const harmonics = [1, 2, 3, 4, 6];
        harmonics.forEach((harmonic, i) => {
            const osc = this.context.createOscillator();
            const gain = this.context.createGain();
            
            osc.type = i === 0 ? 'sawtooth' : 'sine';
            gain.gain.value = 0.1 / (harmonic * 0.5);
            
            osc.connect(gain);
            gain.connect(this.masterGain);
            
            this.oscillators.push(osc);
            this.gainNodes.push(gain);
        });
    }
    
    start() {
        if (this.isPlaying || !this.context) return;
        
        this.oscillators.forEach(osc => {
            try { osc.start(); } catch (e) {}
        });
        this.isPlaying = true;
    }
    
    stop() {
        if (!this.isPlaying) return;
        
        this.oscillators.forEach(osc => {
            try { osc.stop(); } catch (e) {}
        });
        this.isPlaying = false;
    }
    
    update(rpm, throttle, load = 0) {
        if (!this.isPlaying || !this.context) return;
        
        this.currentRPM = Math.max(this.idleRPM, Math.min(this.maxRPM, rpm));
        this.throttle = Math.max(0, Math.min(1, throttle));
        this.load = Math.max(0, Math.min(1, load));
        
        const baseFreq = (this.currentRPM / 60) * 2; // Firing frequency for 4-cylinder
        
        const harmonics = [1, 2, 3, 4, 6];
        this.oscillators.forEach((osc, i) => {
            osc.frequency.setTargetAtTime(baseFreq * harmonics[i], this.context.currentTime, 0.01);
        });
        
        // Volume based on throttle and RPM
        const rpmRatio = (this.currentRPM - this.idleRPM) / (this.maxRPM - this.idleRPM);
        const volume = 0.15 + rpmRatio * 0.3 + this.throttle * 0.2;
        this.masterGain.gain.setTargetAtTime(volume, this.context.currentTime, 0.05);
    }
    
    setVolume(volume) {
        if (this.masterGain) {
            this.masterGain.gain.value = Math.max(0, Math.min(1, volume));
        }
    }
    
    dispose() {
        this.stop();
        this.oscillators = [];
        this.gainNodes = [];
    }
}

export default EngineAudio;
