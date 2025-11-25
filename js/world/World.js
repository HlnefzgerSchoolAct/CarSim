/**
 * World.js - Game World Environment
 * @module world/World
 */

export class World {
    constructor(scene, options = {}) {
        this.scene = scene;
        this.ground = null;
        this.obstacles = [];
        this.roads = [];
        this.tireMarks = [];
        this.maxTireMarks = options.maxTireMarks || 500;
        
        this._createGround();
        this._createLighting();
        this._createEnvironment();
    }
    
    _createGround() {
        const groundGeometry = new THREE.PlaneGeometry(500, 500, 50, 50);
        const groundMaterial = new THREE.MeshStandardMaterial({
            color: 0x3a5a3a,
            roughness: 0.9,
            metalness: 0.1
        });
        this.ground = new THREE.Mesh(groundGeometry, groundMaterial);
        this.ground.rotation.x = -Math.PI / 2;
        this.ground.receiveShadow = true;
        this.scene.add(this.ground);
        
        // Road
        const roadGeometry = new THREE.PlaneGeometry(20, 500);
        const roadMaterial = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.8 });
        const road = new THREE.Mesh(roadGeometry, roadMaterial);
        road.rotation.x = -Math.PI / 2;
        road.position.y = 0.01;
        road.receiveShadow = true;
        this.scene.add(road);
        this.roads.push(road);
    }
    
    _createLighting() {
        const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
        this.scene.add(ambientLight);
        
        const sunLight = new THREE.DirectionalLight(0xffffff, 1);
        sunLight.position.set(50, 100, 50);
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.width = 2048;
        sunLight.shadow.mapSize.height = 2048;
        sunLight.shadow.camera.near = 0.5;
        sunLight.shadow.camera.far = 500;
        sunLight.shadow.camera.left = -100;
        sunLight.shadow.camera.right = 100;
        sunLight.shadow.camera.top = 100;
        sunLight.shadow.camera.bottom = -100;
        this.scene.add(sunLight);
        this.sunLight = sunLight;
    }
    
    _createEnvironment() {
        // Create obstacles
        const obstaclePositions = [
            { x: 15, z: 30 }, { x: -15, z: 50 }, { x: 20, z: -40 },
            { x: -20, z: -60 }, { x: 25, z: 80 }, { x: -25, z: 100 }
        ];
        
        obstaclePositions.forEach(pos => {
            const geometry = new THREE.BoxGeometry(3, 2, 3);
            const material = new THREE.MeshStandardMaterial({ color: 0x888888 });
            const obstacle = new THREE.Mesh(geometry, material);
            obstacle.position.set(pos.x, 1, pos.z);
            obstacle.castShadow = true;
            obstacle.receiveShadow = true;
            this.scene.add(obstacle);
            this.obstacles.push({ position: obstacle.position, radius: 2.5, mesh: obstacle });
        });
        
        // Trees
        for (let i = 0; i < 30; i++) {
            const x = (Math.random() - 0.5) * 200;
            const z = (Math.random() - 0.5) * 200;
            if (Math.abs(x) < 15) continue;
            
            const trunkGeometry = new THREE.CylinderGeometry(0.3, 0.4, 3, 8);
            const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x4a3520 });
            const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
            trunk.position.set(x, 1.5, z);
            trunk.castShadow = true;
            this.scene.add(trunk);
            
            const foliageGeometry = new THREE.ConeGeometry(2, 4, 8);
            const foliageMaterial = new THREE.MeshStandardMaterial({ color: 0x2d5a27 });
            const foliage = new THREE.Mesh(foliageGeometry, foliageMaterial);
            foliage.position.set(x, 5, z);
            foliage.castShadow = true;
            this.scene.add(foliage);
            
            this.obstacles.push({ position: trunk.position, radius: 0.5, mesh: trunk });
        }
    }
    
    getObstacles() { return this.obstacles; }
    
    addTireMarks(wheelPositions, intensity) {
        if (intensity < 0.1) return;
        
        wheelPositions.forEach(pos => {
            const markGeometry = new THREE.PlaneGeometry(0.3, 0.5);
            const markMaterial = new THREE.MeshBasicMaterial({
                color: 0x111111,
                transparent: true,
                opacity: Math.min(intensity * 0.5, 0.4)
            });
            const mark = new THREE.Mesh(markGeometry, markMaterial);
            mark.rotation.x = -Math.PI / 2;
            mark.position.copy(pos);
            mark.position.y = 0.02;
            this.scene.add(mark);
            this.tireMarks.push({ mesh: mark, age: 0, maxAge: 30 });
            
            if (this.tireMarks.length > this.maxTireMarks) {
                const oldest = this.tireMarks.shift();
                this.scene.remove(oldest.mesh);
                oldest.mesh.geometry.dispose();
                oldest.mesh.material.dispose();
            }
        });
    }
    
    updateTireMarks(deltaTime) {
        for (let i = this.tireMarks.length - 1; i >= 0; i--) {
            const mark = this.tireMarks[i];
            mark.age += deltaTime;
            mark.mesh.material.opacity *= 0.999;
            
            if (mark.age > mark.maxAge) {
                this.scene.remove(mark.mesh);
                mark.mesh.geometry.dispose();
                mark.mesh.material.dispose();
                this.tireMarks.splice(i, 1);
            }
        }
    }
    
    reset() {
        this.tireMarks.forEach(mark => {
            this.scene.remove(mark.mesh);
            mark.mesh.geometry.dispose();
            mark.mesh.material.dispose();
        });
        this.tireMarks = [];
    }
}

export default World;
