/**
 * DriftScoring.js - Drift Scoring System
 * 
 * Manages drift score calculation, combos, multipliers, and bonuses
 * for a rewarding drift experience.
 * 
 * @module drift/DriftScoring
 * @author CarSim Development Team
 * @version 2.0.0
 */

import { DRIFT_CONSTANTS } from '../core/Constants.js';
import { MathUtils } from '../utils/MathUtils.js';

/**
 * @class DriftScoring
 * @description Manages drift scoring mechanics
 */
export class DriftScoring {
    /**
     * Creates a new DriftScoring instance
     * @param {Object} [config] - Configuration options
     */
    constructor(config = {}) {
        // Score multipliers
        /** @type {number} Score per degree of drift angle */
        this.angleMultiplier = config.angleMultiplier ?? DRIFT_CONSTANTS.SCORE_ANGLE_MULTIPLIER;
        
        /** @type {number} Score per m/s of speed */
        this.speedMultiplier = config.speedMultiplier ?? DRIFT_CONSTANTS.SCORE_SPEED_MULTIPLIER;
        
        /** @type {number} Duration bonus multiplier */
        this.durationMultiplier = config.durationMultiplier ?? DRIFT_CONSTANTS.SCORE_DURATION_MULTIPLIER;
        
        /** @type {number} Maximum duration bonus */
        this.maxDurationBonus = config.maxDurationBonus ?? DRIFT_CONSTANTS.MAX_DURATION_BONUS;
        
        // Combo settings
        /** @type {number} Combo increment per 2 seconds */
        this.comboIncrement = config.comboIncrement ?? DRIFT_CONSTANTS.COMBO_INCREMENT;
        
        /** @type {number} Maximum combo multiplier */
        this.maxCombo = config.maxCombo ?? DRIFT_CONSTANTS.MAX_COMBO;
        
        /** @type {number} Time to bank score after drift ends */
        this.scoreBankDelay = config.scoreBankDelay ?? DRIFT_CONSTANTS.SCORE_BANK_DELAY;
        
        // Bonus settings
        /** @type {number} Wall proximity bonus distance */
        this.wallProximityDistance = config.wallProximityDistance ?? DRIFT_CONSTANTS.WALL_PROXIMITY_DISTANCE;
        
        /** @type {number} Wall proximity bonus multiplier */
        this.wallProximityBonus = config.wallProximityBonus ?? DRIFT_CONSTANTS.WALL_PROXIMITY_BONUS;
        
        /** @type {number} Score loss on collision */
        this.collisionScoreLoss = config.collisionScoreLoss ?? DRIFT_CONSTANTS.COLLISION_SCORE_LOSS;
        
        // Current state
        /** @type {number} Total banked score */
        this.totalScore = 0;
        
        /** @type {number} Current drift score (not yet banked) */
        this.currentScore = 0;
        
        /** @type {number} Current combo multiplier */
        this.combo = 1;
        
        /** @type {number} Time in current drift */
        this.driftTime = 0;
        
        /** @type {number} Time since drift ended */
        this.bankTimer = 0;
        
        /** @type {boolean} Score is pending banking */
        this.scorePending = false;
        
        // Session statistics
        /** @type {number} Best single drift score */
        this.bestDriftScore = 0;
        
        /** @type {number} Longest drift duration */
        this.longestDrift = 0;
        
        /** @type {number} Highest combo achieved */
        this.highestCombo = 1;
        
        /** @type {number} Total drifts completed */
        this.totalDrifts = 0;
        
        /** @type {number} Total drift distance */
        this.totalDriftDistance = 0;
        
        // Bonus tracking
        /** @type {Array} Active bonuses */
        this.activeBonuses = [];
        
        /** @type {boolean} Near wall bonus active */
        this.nearWallBonus = false;
        
        // Score history for display
        /** @type {Array} Recent score popups */
        this.scorePopups = [];
        
        // Callbacks
        this.onScoreBanked = config.onScoreBanked ?? null;
        this.onComboChange = config.onComboChange ?? null;
        this.onBonusActivated = config.onBonusActivated ?? null;
    }

    /**
     * Update scoring system
     * @param {number} deltaTime - Time step in seconds
     * @param {Object} driftState - Current drift state from DriftController
     * @param {number} vehicleSpeed - Current vehicle speed
     * @param {Object} [environment] - Environment info for bonuses
     */
    update(deltaTime, driftState, vehicleSpeed, environment = {}) {
        if (driftState.isDrifting) {
            this.updateDriftScore(deltaTime, driftState, vehicleSpeed, environment);
        } else if (this.scorePending) {
            this.updateScoreBanking(deltaTime);
        }
        
        // Update score popups
        this.updatePopups(deltaTime);
    }

    /**
     * Update score during active drift
     * @param {number} deltaTime - Time step
     * @param {Object} driftState - Drift state
     * @param {number} vehicleSpeed - Vehicle speed
     * @param {Object} environment - Environment info
     */
    updateDriftScore(deltaTime, driftState, vehicleSpeed, environment) {
        this.driftTime += deltaTime;
        
        // Calculate base score for this frame
        const angleScore = Math.abs(driftState.slipAngle) * this.angleMultiplier;
        const speedScore = Math.abs(vehicleSpeed) * this.speedMultiplier;
        
        // Calculate duration bonus
        const durationBonus = Math.min(
            this.driftTime * this.durationMultiplier,
            this.maxDurationBonus
        );
        
        // Calculate frame score
        let frameScore = (angleScore + speedScore) * (1 + durationBonus) * deltaTime;
        
        // Apply bonuses
        const bonusMultiplier = this.calculateBonuses(environment, driftState);
        frameScore *= bonusMultiplier;
        
        // Add to current score
        this.currentScore += frameScore;
        
        // Update combo
        this.updateCombo(deltaTime);
        
        // Track distance
        this.totalDriftDistance += vehicleSpeed * deltaTime;
    }

    /**
     * Update combo multiplier
     * @param {number} deltaTime - Time step
     */
    updateCombo(deltaTime) {
        // Combo increases every 2 seconds
        const comboThreshold = 2;
        const newCombo = 1 + Math.floor(this.driftTime / comboThreshold) * this.comboIncrement;
        
        const clampedCombo = Math.min(newCombo, this.maxCombo);
        
        if (clampedCombo > this.combo) {
            this.combo = clampedCombo;
            
            if (this.onComboChange) {
                this.onComboChange(this.combo);
            }
            
            // Track highest combo
            if (this.combo > this.highestCombo) {
                this.highestCombo = this.combo;
            }
        }
    }

    /**
     * Calculate active bonuses
     * @param {Object} environment - Environment info
     * @param {Object} driftState - Drift state
     * @returns {number} Total bonus multiplier
     */
    calculateBonuses(environment, driftState) {
        let multiplier = 1.0;
        this.activeBonuses = [];
        
        // Wall proximity bonus
        const wallDistance = environment.nearestWallDistance ?? Infinity;
        if (wallDistance < this.wallProximityDistance) {
            this.nearWallBonus = true;
            const proximityFactor = 1 - (wallDistance / this.wallProximityDistance);
            const bonus = 1 + proximityFactor * (this.wallProximityBonus - 1);
            multiplier *= bonus;
            this.activeBonuses.push({
                type: 'WALL_PROXIMITY',
                value: bonus
            });
        } else {
            this.nearWallBonus = false;
        }
        
        // Counter-steer bonus
        if (driftState.isCounterSteering) {
            multiplier *= 1.2;
            this.activeBonuses.push({
                type: 'COUNTER_STEER',
                value: 1.2
            });
        }
        
        // Perfect angle bonus (around optimal drift angle)
        const optimalAngle = 0.5; // ~30 degrees
        const angleDiff = Math.abs(Math.abs(driftState.slipAngle) - optimalAngle);
        if (angleDiff < 0.1) {
            multiplier *= 1.3;
            this.activeBonuses.push({
                type: 'PERFECT_ANGLE',
                value: 1.3
            });
        }
        
        // High speed bonus (over 60 km/h / 16.67 m/s)
        if (Math.abs(environment.vehicleSpeed ?? 0) > 16.67) {
            multiplier *= 1.15;
            this.activeBonuses.push({
                type: 'HIGH_SPEED',
                value: 1.15
            });
        }
        
        // Trigger callback for new bonuses
        if (this.activeBonuses.length > 0 && this.onBonusActivated) {
            this.onBonusActivated(this.activeBonuses);
        }
        
        return multiplier;
    }

    /**
     * Update score banking after drift ends
     * @param {number} deltaTime - Time step
     */
    updateScoreBanking(deltaTime) {
        this.bankTimer += deltaTime;
        
        if (this.bankTimer >= this.scoreBankDelay) {
            this.bankScore();
        }
    }

    /**
     * Bank the current drift score
     */
    bankScore() {
        if (this.currentScore <= 0) {
            this.resetCurrentDrift();
            return;
        }
        
        // Apply combo multiplier
        const finalScore = Math.round(this.currentScore * this.combo);
        
        // Add to total
        this.totalScore += finalScore;
        this.totalDrifts++;
        
        // Track best drift
        if (finalScore > this.bestDriftScore) {
            this.bestDriftScore = finalScore;
        }
        
        // Track longest drift
        if (this.driftTime > this.longestDrift) {
            this.longestDrift = this.driftTime;
        }
        
        // Create popup
        this.addScorePopup(finalScore, this.combo);
        
        // Callback
        if (this.onScoreBanked) {
            this.onScoreBanked({
                score: finalScore,
                combo: this.combo,
                duration: this.driftTime,
                totalScore: this.totalScore
            });
        }
        
        // Reset for next drift
        this.resetCurrentDrift();
    }

    /**
     * Handle drift ending
     */
    onDriftEnd() {
        if (this.currentScore > 0) {
            this.scorePending = true;
            this.bankTimer = 0;
        } else {
            this.resetCurrentDrift();
        }
    }

    /**
     * Handle collision during drift
     * @param {number} impactForce - Force of collision
     */
    onCollision(impactForce) {
        if (this.currentScore > 0) {
            // Lose portion of current score
            const scoreLoss = this.currentScore * this.collisionScoreLoss;
            this.currentScore -= scoreLoss;
            
            // Reset combo
            this.combo = 1;
            
            // Create negative popup
            this.addScorePopup(-Math.round(scoreLoss), 0, 'COLLISION');
        }
    }

    /**
     * Reset current drift state
     */
    resetCurrentDrift() {
        this.currentScore = 0;
        this.combo = 1;
        this.driftTime = 0;
        this.scorePending = false;
        this.bankTimer = 0;
        this.activeBonuses = [];
        this.nearWallBonus = false;
    }

    /**
     * Add a score popup
     * @param {number} score - Score value
     * @param {number} combo - Combo at time of score
     * @param {string} [type='DRIFT'] - Popup type
     */
    addScorePopup(score, combo, type = 'DRIFT') {
        this.scorePopups.push({
            score,
            combo,
            type,
            time: 0,
            maxTime: 2.0 // Display for 2 seconds
        });
        
        // Limit popup history
        while (this.scorePopups.length > 5) {
            this.scorePopups.shift();
        }
    }

    /**
     * Update score popups
     * @param {number} deltaTime - Time step
     */
    updatePopups(deltaTime) {
        for (let i = this.scorePopups.length - 1; i >= 0; i--) {
            this.scorePopups[i].time += deltaTime;
            
            if (this.scorePopups[i].time >= this.scorePopups[i].maxTime) {
                this.scorePopups.splice(i, 1);
            }
        }
    }

    /**
     * Get current scoring state
     * @returns {Object} Scoring state
     */
    getState() {
        return {
            totalScore: this.totalScore,
            currentScore: Math.round(this.currentScore),
            displayScore: Math.round(this.currentScore * this.combo),
            combo: this.combo,
            driftTime: this.driftTime,
            scorePending: this.scorePending,
            activeBonuses: this.activeBonuses,
            nearWallBonus: this.nearWallBonus,
            scorePopups: this.scorePopups
        };
    }

    /**
     * Get session statistics
     * @returns {Object} Session stats
     */
    getStatistics() {
        return {
            totalScore: this.totalScore,
            bestDriftScore: this.bestDriftScore,
            longestDrift: this.longestDrift,
            highestCombo: this.highestCombo,
            totalDrifts: this.totalDrifts,
            totalDriftDistance: this.totalDriftDistance,
            averageScore: this.totalDrifts > 0 ? 
                Math.round(this.totalScore / this.totalDrifts) : 0
        };
    }

    /**
     * Reset all scores and statistics
     */
    reset() {
        this.totalScore = 0;
        this.bestDriftScore = 0;
        this.longestDrift = 0;
        this.highestCombo = 1;
        this.totalDrifts = 0;
        this.totalDriftDistance = 0;
        this.resetCurrentDrift();
        this.scorePopups = [];
    }

    /**
     * Reset only current session (keep lifetime stats)
     */
    resetSession() {
        this.totalScore = 0;
        this.resetCurrentDrift();
        this.scorePopups = [];
    }

    /**
     * Serialize to JSON
     * @returns {Object} JSON representation
     */
    toJSON() {
        return {
            totalScore: this.totalScore,
            bestDriftScore: this.bestDriftScore,
            longestDrift: this.longestDrift,
            highestCombo: this.highestCombo,
            totalDrifts: this.totalDrifts,
            totalDriftDistance: this.totalDriftDistance
        };
    }

    /**
     * Load from JSON
     * @param {Object} json - JSON object
     */
    loadFromJSON(json) {
        if (json.totalScore !== undefined) this.totalScore = json.totalScore;
        if (json.bestDriftScore !== undefined) this.bestDriftScore = json.bestDriftScore;
        if (json.longestDrift !== undefined) this.longestDrift = json.longestDrift;
        if (json.highestCombo !== undefined) this.highestCombo = json.highestCombo;
        if (json.totalDrifts !== undefined) this.totalDrifts = json.totalDrifts;
        if (json.totalDriftDistance !== undefined) this.totalDriftDistance = json.totalDriftDistance;
    }
}

export default DriftScoring;
