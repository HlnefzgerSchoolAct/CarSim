/**
 * AudioManager.js - Audio System Manager
 * @module audio/AudioManager
 */

export class AudioManager {
    constructor(options = {}) {
        this.context = null;
        this.masterGain = null;
        this.sounds = new Map();
        this.music = null;
        this.enabled = true;
        this.masterVolume = options.masterVolume || 0.8;
        this.sfxVolume = options.sfxVolume || 1.0;
        this.musicVolume = options.musicVolume || 0.5;
        
        this._initialized = false;
    }
    
    async init() {
        if (this._initialized) return;
        
        try {
            this.context = new (window.AudioContext || window.webkitAudioContext)();
            this.masterGain = this.context.createGain();
            this.masterGain.gain.value = this.masterVolume;
            this.masterGain.connect(this.context.destination);
            this._initialized = true;
        } catch (e) {
            console.warn('Audio not supported:', e);
        }
    }
    
    async loadSound(name, url) {
        if (!this._initialized) await this.init();
        if (!this.context) return;
        
        try {
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.context.decodeAudioData(arrayBuffer);
            this.sounds.set(name, audioBuffer);
        } catch (e) {
            console.warn(`Failed to load sound ${name}:`, e);
        }
    }
    
    play(name, options = {}) {
        if (!this.enabled || !this._initialized || !this.context) return null;
        
        const buffer = this.sounds.get(name);
        if (!buffer) return null;
        
        const source = this.context.createBufferSource();
        source.buffer = buffer;
        
        const gainNode = this.context.createGain();
        gainNode.gain.value = (options.volume || 1.0) * this.sfxVolume;
        
        source.connect(gainNode);
        gainNode.connect(this.masterGain);
        
        source.loop = options.loop || false;
        source.playbackRate.value = options.pitch || 1.0;
        
        source.start(0);
        
        return { source, gainNode };
    }
    
    setMasterVolume(volume) {
        this.masterVolume = Math.max(0, Math.min(1, volume));
        if (this.masterGain) this.masterGain.gain.value = this.masterVolume;
    }
    
    setEnabled(enabled) { this.enabled = enabled; }
    
    resume() {
        if (this.context && this.context.state === 'suspended') {
            this.context.resume();
        }
    }
    
    dispose() {
        if (this.context) {
            this.context.close();
        }
        this.sounds.clear();
    }
}

export default AudioManager;
