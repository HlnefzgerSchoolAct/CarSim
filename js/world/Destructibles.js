/**
 * Destructibles.js - Destructible Objects System
 * @module world/Destructibles
 */

export class Destructibles {
    constructor(scene, options = {}) {
        this.scene = scene;
        this.objects = new Map();
        this.debris = [];
        this.maxDebris = options.maxDebris || 100;
        
        this.objectTypes = {
            CONE: { health: 50, mass: 5, fragments: 3, color: 0xff6600 },
            BARRIER: { health: 200, mass: 50, fragments: 8, color: 0xcccccc },
            SIGN: { health: 100, mass: 20, fragments: 5, color: 0xffff00 },
            FENCE: { health: 150, mass: 30, fragments: 6, color: 0x8b4513 },
            TRASH_CAN: { health: 80, mass: 15, fragments: 4, color: 0x666666 }
        };
    }
    
    createObject(type, position, rotation = 0) {
        const config = this.objectTypes[type] || this.objectTypes.CONE;
        let geometry, mesh;
        
        switch(type) {
            case 'CONE':
                geometry = new THREE.ConeGeometry(0.3, 0.8, 8);
                break;
            case 'BARRIER':
                geometry = new THREE.BoxGeometry(2, 0.8, 0.3);
                break;
            case 'SIGN':
                geometry = new THREE.BoxGeometry(0.1, 1.5, 1);
                break;
            default:
                geometry = new THREE.BoxGeometry(0.5, 1, 0.5);
        }
        
        const material = new THREE.MeshStandardMaterial({ color: config.color });
        mesh = new THREE.Mesh(geometry, material);
        mesh.position.copy(position);
        mesh.rotation.y = rotation;
        mesh.castShadow = true;
        this.scene.add(mesh);
        
        const obj = {
            id: `destructible_${this.objects.size}`,
            type, mesh, health: config.health, maxHealth: config.health,
            mass: config.mass, fragmentCount: config.fragments,
            position: position.clone(), isDestroyed: false
        };
        
        this.objects.set(obj.id, obj);
        return obj;
    }
    
    applyDamage(objectId, damage, impactPoint, impactDirection) {
        const obj = this.objects.get(objectId);
        if (!obj || obj.isDestroyed) return null;
        
        obj.health -= damage;
        
        if (obj.health <= 0) {
            return this._destroyObject(obj, impactPoint, impactDirection);
        }
        
        // Visual damage
        const ratio = obj.health / obj.maxHealth;
        obj.mesh.material.color.multiplyScalar(0.9 + ratio * 0.1);
        
        return { destroyed: false, health: obj.health };
    }
    
    _destroyObject(obj, impactPoint, impactDirection) {
        obj.isDestroyed = true;
        this.scene.remove(obj.mesh);
        
        // Create debris
        for (let i = 0; i < obj.fragmentCount; i++) {
            const size = 0.1 + Math.random() * 0.3;
            const geometry = new THREE.BoxGeometry(size, size, size);
            const material = new THREE.MeshStandardMaterial({
                color: this.objectTypes[obj.type]?.color || 0x888888
            });
            const fragment = new THREE.Mesh(geometry, material);
            
            fragment.position.copy(obj.position);
            fragment.position.x += (Math.random() - 0.5) * 0.5;
            fragment.position.y += Math.random() * 0.5 + 0.2;
            fragment.position.z += (Math.random() - 0.5) * 0.5;
            
            this.scene.add(fragment);
            
            const debris = {
                mesh: fragment,
                velocity: new THREE.Vector3(
                    impactDirection.x * 5 + (Math.random() - 0.5) * 3,
                    Math.random() * 5 + 2,
                    impactDirection.z * 5 + (Math.random() - 0.5) * 3
                ),
                angularVelocity: new THREE.Vector3(
                    (Math.random() - 0.5) * 10,
                    (Math.random() - 0.5) * 10,
                    (Math.random() - 0.5) * 10
                ),
                lifetime: 5 + Math.random() * 5,
                onGround: false
            };
            
            this.debris.push(debris);
            
            if (this.debris.length > this.maxDebris) {
                const old = this.debris.shift();
                this.scene.remove(old.mesh);
                old.mesh.geometry.dispose();
                old.mesh.material.dispose();
            }
        }
        
        obj.mesh.geometry.dispose();
        obj.mesh.material.dispose();
        
        return { destroyed: true, fragments: obj.fragmentCount };
    }
    
    update(deltaTime) {
        const gravity = 9.81;
        
        for (let i = this.debris.length - 1; i >= 0; i--) {
            const d = this.debris[i];
            d.lifetime -= deltaTime;
            
            if (d.lifetime <= 0) {
                this.scene.remove(d.mesh);
                d.mesh.geometry.dispose();
                d.mesh.material.dispose();
                this.debris.splice(i, 1);
                continue;
            }
            
            if (!d.onGround) {
                d.velocity.y -= gravity * deltaTime;
                d.mesh.position.addScaledVector(d.velocity, deltaTime);
                d.mesh.rotation.x += d.angularVelocity.x * deltaTime;
                d.mesh.rotation.y += d.angularVelocity.y * deltaTime;
                d.mesh.rotation.z += d.angularVelocity.z * deltaTime;
                
                if (d.mesh.position.y <= 0.1) {
                    d.mesh.position.y = 0.1;
                    d.velocity.y *= -0.3;
                    d.velocity.x *= 0.8;
                    d.velocity.z *= 0.8;
                    d.angularVelocity.multiplyScalar(0.5);
                    if (Math.abs(d.velocity.y) < 0.5) d.onGround = true;
                }
            }
            
            if (d.lifetime < 2) {
                d.mesh.material.opacity = d.lifetime / 2;
                d.mesh.material.transparent = true;
            }
        }
    }
    
    getObjectAtPosition(position, radius = 1) {
        for (const [id, obj] of this.objects) {
            if (!obj.isDestroyed && obj.position.distanceTo(position) < radius) {
                return obj;
            }
        }
        return null;
    }
    
    reset() {
        this.debris.forEach(d => {
            this.scene.remove(d.mesh);
            d.mesh.geometry.dispose();
            d.mesh.material.dispose();
        });
        this.debris = [];
        
        this.objects.forEach(obj => {
            if (obj.mesh && obj.mesh.parent) {
                this.scene.remove(obj.mesh);
                obj.mesh.geometry.dispose();
                obj.mesh.material.dispose();
            }
        });
        this.objects.clear();
    }
}

export default Destructibles;
