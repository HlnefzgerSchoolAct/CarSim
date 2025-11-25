/**
 * EffectsAudio.js - Sound Effects System
 * @module audio/EffectsAudio
 */

export class EffectsAudio {
    constructor(audioManager) {
        this.audioManager = audioManager;
        this.activeSounds = new Map();
        
        this.soundConfigs = {
            collision: { volume: 0.8, variations: 3 },
            scrape: { volume: 0.5, loop: true },
            tireSqueal: { volume: 0.6, loop: true },
            skid: { volume: 0.4, loop: true },
            crash: { volume: 1.0 },
            glass: { volume: 0.7 },
            metal: { volume: 0.8 },
            horn: { volume: 0.6 },
            wind: { volume: 0.3, loop: true }
        };
    }
    
    playCollision(intensity) {
        const volume = Math.min(1, intensity * 0.3) * this.soundConfigs.collision.volume;
        return this.audioManager.play('collision', { volume });
    }
    
    playTireSqueal(intensity) {
        const soundId = 'tireSqueal';
        let sound = this.activeSounds.get(soundId);
        
        if (intensity > 0.1) {
            if (!sound) {
                sound = this.audioManager.play('tireSqueal', {
                    volume: 0,
                    loop: true
                });
                if (sound) this.activeSounds.set(soundId, sound);
            }
            
            if (sound && sound.gainNode) {
                const targetVolume = Math.min(1, intensity) * this.soundConfigs.tireSqueal.volume;
                sound.gainNode.gain.setTargetAtTime(targetVolume, this.audioManager.context.currentTime, 0.1);
            }
        } else {
            this.stopSound(soundId);
        }
    }
    
    playSkid(active) {
        const soundId = 'skid';
        if (active && !this.activeSounds.has(soundId)) {
            const sound = this.audioManager.play('skid', {
                volume: this.soundConfigs.skid.volume,
                loop: true
            });
            if (sound) this.activeSounds.set(soundId, sound);
        } else if (!active) {
            this.stopSound(soundId);
        }
    }
    
    playWind(speed) {
        const soundId = 'wind';
        let sound = this.activeSounds.get(soundId);
        
        if (speed > 10) {
            if (!sound) {
                sound = this.audioManager.play('wind', { volume: 0, loop: true });
                if (sound) this.activeSounds.set(soundId, sound);
            }
            
            if (sound && sound.gainNode) {
                const volume = Math.min(1, (speed - 10) / 50) * this.soundConfigs.wind.volume;
                sound.gainNode.gain.setTargetAtTime(volume, this.audioManager.context.currentTime, 0.3);
            }
        } else {
            this.stopSound(soundId);
        }
    }
    
    stopSound(soundId) {
        const sound = this.activeSounds.get(soundId);
        if (sound) {
            try {
                if (sound.gainNode) {
                    sound.gainNode.gain.setTargetAtTime(0, this.audioManager.context.currentTime, 0.1);
                }
                setTimeout(() => {
                    try { sound.source.stop(); } catch (e) {}
                }, 200);
            } catch (e) {}
            this.activeSounds.delete(soundId);
        }
    }
    
    stopAll() {
        for (const soundId of this.activeSounds.keys()) {
            this.stopSound(soundId);
        }
    }
    
    dispose() {
        this.stopAll();
    }
}

export default EffectsAudio;
