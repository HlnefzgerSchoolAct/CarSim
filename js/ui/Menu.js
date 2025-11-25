/**
 * Menu.js - Game Menu System
 * @module ui/Menu
 */

export class Menu {
    constructor(options = {}) {
        this.container = null;
        this.isVisible = false;
        this.currentMenu = 'main';
        this.onResume = options.onResume || null;
        this.onRestart = options.onRestart || null;
        this.settings = {
            graphics: 'high',
            audio: 0.8,
            assists: { abs: true, tc: false, stability: true }
        };
        
        this._createMenus();
        this._setupKeyListener();
    }
    
    _createMenus() {
        this.container = document.createElement('div');
        this.container.id = 'game-menu';
        this.container.className = 'game-menu hidden';
        this.container.innerHTML = `
            <div class="menu-overlay"></div>
            <div class="menu-panel">
                <div class="menu-main">
                    <h1>CAR SIMULATOR</h1>
                    <button data-action="resume">Resume</button>
                    <button data-action="restart">Restart</button>
                    <button data-action="settings">Settings</button>
                    <button data-action="controls">Controls</button>
                </div>
                <div class="menu-settings hidden">
                    <h2>Settings</h2>
                    <div class="setting">
                        <label>Graphics Quality</label>
                        <select id="graphics-quality">
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high" selected>High</option>
                            <option value="ultra">Ultra</option>
                        </select>
                    </div>
                    <div class="setting">
                        <label>Master Volume</label>
                        <input type="range" id="master-volume" min="0" max="100" value="80">
                    </div>
                    <div class="setting">
                        <label>ABS</label>
                        <input type="checkbox" id="abs-toggle" checked>
                    </div>
                    <div class="setting">
                        <label>Traction Control</label>
                        <input type="checkbox" id="tc-toggle">
                    </div>
                    <div class="setting">
                        <label>Stability Control</label>
                        <input type="checkbox" id="stability-toggle" checked>
                    </div>
                    <button data-action="back">Back</button>
                </div>
                <div class="menu-controls hidden">
                    <h2>Controls</h2>
                    <div class="control-list">
                        <div class="control"><span>W / ↑</span><span>Accelerate</span></div>
                        <div class="control"><span>S / ↓</span><span>Brake / Reverse</span></div>
                        <div class="control"><span>A / ←</span><span>Steer Left</span></div>
                        <div class="control"><span>D / →</span><span>Steer Right</span></div>
                        <div class="control"><span>SPACE</span><span>Handbrake</span></div>
                        <div class="control"><span>SHIFT</span><span>Gear Up</span></div>
                        <div class="control"><span>CTRL</span><span>Gear Down</span></div>
                        <div class="control"><span>C</span><span>Change Camera</span></div>
                        <div class="control"><span>R</span><span>Reset Car</span></div>
                        <div class="control"><span>ESC</span><span>Pause Menu</span></div>
                    </div>
                    <button data-action="back">Back</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(this.container);
        this._setupEvents();
    }
    
    _setupEvents() {
        this.container.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = e.target.dataset.action;
                this._handleAction(action);
            });
        });
        
        this.container.querySelector('#graphics-quality')?.addEventListener('change', (e) => {
            this.settings.graphics = e.target.value;
        });
        
        this.container.querySelector('#master-volume')?.addEventListener('input', (e) => {
            this.settings.audio = e.target.value / 100;
        });
    }
    
    _setupKeyListener() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.toggle();
            }
        });
    }
    
    _handleAction(action) {
        switch (action) {
            case 'resume':
                this.hide();
                if (this.onResume) this.onResume();
                break;
            case 'restart':
                this.hide();
                if (this.onRestart) this.onRestart();
                break;
            case 'settings':
                this._showPanel('settings');
                break;
            case 'controls':
                this._showPanel('controls');
                break;
            case 'back':
                this._showPanel('main');
                break;
        }
    }
    
    _showPanel(panel) {
        this.container.querySelectorAll('.menu-main, .menu-settings, .menu-controls').forEach(p => {
            p.classList.add('hidden');
        });
        this.container.querySelector(`.menu-${panel}`)?.classList.remove('hidden');
        this.currentMenu = panel;
    }
    
    show() {
        this.container.classList.remove('hidden');
        this.isVisible = true;
        this._showPanel('main');
    }
    
    hide() {
        this.container.classList.add('hidden');
        this.isVisible = false;
    }
    
    toggle() {
        if (this.isVisible) this.hide();
        else this.show();
    }
    
    getSettings() { return { ...this.settings }; }
    
    dispose() {
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
    }
}

export default Menu;
