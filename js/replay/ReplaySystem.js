/**
 * ReplaySystem.js - Gameplay Recording and Playback
 * @module replay/ReplaySystem
 */

export class ReplaySystem {
    constructor(options = {}) {
        this.isRecording = false;
        this.isPlaying = false;
        this.frames = [];
        this.currentFrame = 0;
        this.maxFrames = options.maxFrames || 18000; // 5 min at 60fps
        this.frameInterval = options.frameInterval || 1000 / 60;
        this.playbackSpeed = 1.0;
        this.lastRecordTime = 0;
        
        this.onPlaybackEnd = options.onPlaybackEnd || null;
    }
    
    startRecording() {
        this.frames = [];
        this.currentFrame = 0;
        this.isRecording = true;
        this.isPlaying = false;
        this.lastRecordTime = performance.now();
    }
    
    stopRecording() {
        this.isRecording = false;
        return this.frames.length;
    }
    
    recordFrame(state) {
        if (!this.isRecording) return;
        
        const now = performance.now();
        if (now - this.lastRecordTime < this.frameInterval) return;
        this.lastRecordTime = now;
        
        const frame = {
            timestamp: now,
            position: state.position ? { x: state.position.x, y: state.position.y, z: state.position.z } : null,
            rotation: state.rotation,
            velocity: state.velocity ? { x: state.velocity.x, y: state.velocity.y, z: state.velocity.z } : null,
            rpm: state.rpm,
            gear: state.gear,
            steering: state.steering,
            damage: state.damage,
            isDrifting: state.isDrifting
        };
        
        this.frames.push(frame);
        
        if (this.frames.length > this.maxFrames) {
            this.frames.shift();
        }
    }
    
    startPlayback() {
        if (this.frames.length === 0) return false;
        
        this.currentFrame = 0;
        this.isPlaying = true;
        this.isRecording = false;
        return true;
    }
    
    stopPlayback() {
        this.isPlaying = false;
        this.currentFrame = 0;
    }
    
    getPlaybackFrame() {
        if (!this.isPlaying || this.frames.length === 0) return null;
        
        const frame = this.frames[this.currentFrame];
        this.currentFrame += this.playbackSpeed;
        
        if (this.currentFrame >= this.frames.length) {
            if (this.onPlaybackEnd) this.onPlaybackEnd();
            this.stopPlayback();
            return null;
        }
        
        return frame;
    }
    
    setPlaybackSpeed(speed) {
        this.playbackSpeed = Math.max(0.1, Math.min(4, speed));
    }
    
    seekTo(frameIndex) {
        this.currentFrame = Math.max(0, Math.min(this.frames.length - 1, frameIndex));
    }
    
    seekToPercent(percent) {
        this.seekTo(Math.floor(this.frames.length * percent));
    }
    
    getProgress() {
        if (this.frames.length === 0) return 0;
        return this.currentFrame / this.frames.length;
    }
    
    getDuration() {
        if (this.frames.length < 2) return 0;
        return (this.frames[this.frames.length - 1].timestamp - this.frames[0].timestamp) / 1000;
    }
    
    getFrameCount() {
        return this.frames.length;
    }
    
    clear() {
        this.frames = [];
        this.currentFrame = 0;
        this.isRecording = false;
        this.isPlaying = false;
    }
    
    exportReplay() {
        return JSON.stringify({
            version: 1,
            frameCount: this.frames.length,
            duration: this.getDuration(),
            frames: this.frames
        });
    }
    
    importReplay(data) {
        try {
            const replay = JSON.parse(data);
            if (replay.frames && Array.isArray(replay.frames)) {
                this.frames = replay.frames;
                this.currentFrame = 0;
                return true;
            }
        } catch (e) {
            console.error('Failed to import replay:', e);
        }
        return false;
    }
}

export default ReplaySystem;
