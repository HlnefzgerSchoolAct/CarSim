/**
 * HUD.js - Heads-Up Display Manager
 * @module ui/HUD
 */

export class HUD {
    constructor(options = {}) {
        this.container = options.container || document.getElementById('hud');
        this.elements = {};
        this.visible = true;
        
        this._createElements();
    }
    
    _createElements() {
        // Speedometer
        this.elements.speedometer = this._createElement('speedometer', `
            <div class="speed-value">0</div>
            <div class="speed-unit">km/h</div>
        `);
        
        // Tachometer
        this.elements.tachometer = this._createElement('tachometer', `
            <div class="rpm-bar"><div class="rpm-fill"></div></div>
            <div class="rpm-value">0</div>
            <div class="gear-indicator">N</div>
        `);
        
        // Damage display
        this.elements.damage = this._createElement('damage-display', `
            <div class="damage-label">DAMAGE</div>
            <div class="damage-bar"><div class="damage-fill"></div></div>
            <div class="damage-zones">
                <div class="zone front"></div>
                <div class="zone rear"></div>
                <div class="zone left"></div>
                <div class="zone right"></div>
            </div>
        `);
        
        // Drift score
        this.elements.drift = this._createElement('drift-display', `
            <div class="drift-label">DRIFT</div>
            <div class="drift-total">0</div>
            <div class="drift-current"></div>
            <div class="drift-combo"></div>
        `);
        
        // G-Force meter
        this.elements.gforce = this._createElement('gforce-meter', `
            <div class="gforce-dot"></div>
            <div class="gforce-grid"></div>
        `);
        
        // Minimap
        this.elements.minimap = this._createElement('minimap', `
            <canvas class="minimap-canvas" width="150" height="150"></canvas>
            <div class="player-marker"></div>
        `);
    }
    
    _createElement(id, html) {
        const el = document.createElement('div');
        el.id = id;
        el.className = `hud-element ${id}`;
        el.innerHTML = html;
        if (this.container) this.container.appendChild(el);
        return el;
    }
    
    updateSpeed(speedKmh) {
        const el = this.elements.speedometer?.querySelector('.speed-value');
        if (el) el.textContent = Math.round(speedKmh);
    }
    
    updateRPM(rpm, maxRpm, gear) {
        const fill = this.elements.tachometer?.querySelector('.rpm-fill');
        const value = this.elements.tachometer?.querySelector('.rpm-value');
        const gearEl = this.elements.tachometer?.querySelector('.gear-indicator');
        
        if (fill) {
            const percent = (rpm / maxRpm) * 100;
            fill.style.width = `${percent}%`;
            fill.style.backgroundColor = rpm > maxRpm * 0.85 ? '#ff3333' : '#33ff33';
        }
        if (value) value.textContent = Math.round(rpm);
        if (gearEl) gearEl.textContent = gear === 0 ? 'N' : (gear === -1 ? 'R' : gear);
    }
    
    updateDamage(total, zones = {}) {
        const fill = this.elements.damage?.querySelector('.damage-fill');
        if (fill) {
            fill.style.width = `${total}%`;
            fill.style.backgroundColor = total > 70 ? '#ff0000' : (total > 40 ? '#ff6600' : '#ffcc00');
        }
        
        ['front', 'rear', 'left', 'right'].forEach(zone => {
            const el = this.elements.damage?.querySelector(`.zone.${zone}`);
            if (el && zones[zone] !== undefined) {
                const dmg = zones[zone];
                el.style.backgroundColor = `rgba(255, ${Math.round(255 - dmg * 2.55)}, 0, ${0.3 + dmg / 200})`;
            }
        });
    }
    
    updateDriftScore(total, current, combo) {
        const totalEl = this.elements.drift?.querySelector('.drift-total');
        const currentEl = this.elements.drift?.querySelector('.drift-current');
        const comboEl = this.elements.drift?.querySelector('.drift-combo');
        
        if (totalEl) totalEl.textContent = Math.round(total);
        if (currentEl) {
            currentEl.textContent = current > 0 ? `+${Math.round(current)}` : '';
            currentEl.style.display = current > 0 ? 'block' : 'none';
        }
        if (comboEl) {
            comboEl.textContent = combo > 1 ? `x${combo.toFixed(1)}` : '';
            comboEl.style.display = combo > 1 ? 'block' : 'none';
        }
    }
    
    updateGForce(gX, gY) {
        const dot = this.elements.gforce?.querySelector('.gforce-dot');
        if (dot) {
            const maxG = 2;
            const x = Math.max(-1, Math.min(1, gX / maxG)) * 40;
            const y = Math.max(-1, Math.min(1, -gY / maxG)) * 40;
            dot.style.transform = `translate(${x}px, ${y}px)`;
        }
    }
    
    setVisible(visible) {
        this.visible = visible;
        if (this.container) {
            this.container.style.display = visible ? 'block' : 'none';
        }
    }
    
    dispose() {
        Object.values(this.elements).forEach(el => {
            if (el && el.parentNode) el.parentNode.removeChild(el);
        });
        this.elements = {};
    }
}

export default HUD;
