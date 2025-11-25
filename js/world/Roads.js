/**
 * Roads.js - Road Surface System
 * @module world/Roads
 */

export class Roads {
    constructor(scene, options = {}) {
        this.scene = scene;
        this.segments = [];
        this.intersections = [];
        
        this.surfaceTypes = {
            ASPHALT: { grip: 1.0, color: 0x333333, roughness: 0.8 },
            CONCRETE: { grip: 0.95, color: 0x888888, roughness: 0.7 },
            GRAVEL: { grip: 0.6, color: 0x9a8b7a, roughness: 0.95 },
            DIRT: { grip: 0.55, color: 0x6b5344, roughness: 0.9 },
            GRASS: { grip: 0.5, color: 0x3a5a3a, roughness: 0.95 },
            ICE: { grip: 0.15, color: 0xaaddff, roughness: 0.1 }
        };
        
        this.defaultWidth = options.defaultWidth || 10;
    }
    
    createStraightRoad(start, end, width = null, surfaceType = 'ASPHALT') {
        const w = width || this.defaultWidth;
        const surface = this.surfaceTypes[surfaceType] || this.surfaceTypes.ASPHALT;
        
        const direction = new THREE.Vector3().subVectors(end, start);
        const length = direction.length();
        const center = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
        const angle = Math.atan2(direction.x, direction.z);
        
        const geometry = new THREE.PlaneGeometry(w, length);
        const material = new THREE.MeshStandardMaterial({
            color: surface.color,
            roughness: surface.roughness,
            metalness: 0.1
        });
        
        const road = new THREE.Mesh(geometry, material);
        road.rotation.x = -Math.PI / 2;
        road.rotation.z = angle;
        road.position.copy(center);
        road.position.y = 0.01;
        road.receiveShadow = true;
        
        this.scene.add(road);
        
        const segment = {
            mesh: road, start: start.clone(), end: end.clone(),
            width: w, surfaceType, grip: surface.grip
        };
        this.segments.push(segment);
        
        this._addRoadMarkings(road, length, w);
        
        return segment;
    }
    
    _addRoadMarkings(road, length, width) {
        // Center line
        const lineGeometry = new THREE.PlaneGeometry(0.2, length * 0.9);
        const lineMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
        const centerLine = new THREE.Mesh(lineGeometry, lineMaterial);
        centerLine.position.y = 0.01;
        road.add(centerLine);
        
        // Edge lines
        [-1, 1].forEach(side => {
            const edgeGeometry = new THREE.PlaneGeometry(0.15, length * 0.95);
            const edgeMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
            const edgeLine = new THREE.Mesh(edgeGeometry, edgeMaterial);
            edgeLine.position.set(side * (width / 2 - 0.5), 0.01, 0);
            road.add(edgeLine);
        });
    }
    
    getSurfaceAtPosition(position) {
        for (const segment of this.segments) {
            const toPoint = new THREE.Vector3().subVectors(position, segment.start);
            const roadDir = new THREE.Vector3().subVectors(segment.end, segment.start).normalize();
            const projection = toPoint.dot(roadDir);
            const roadLength = segment.start.distanceTo(segment.end);
            
            if (projection >= 0 && projection <= roadLength) {
                const projectedPoint = segment.start.clone().addScaledVector(roadDir, projection);
                const distance = position.distanceTo(projectedPoint);
                
                if (distance <= segment.width / 2) {
                    return {
                        type: segment.surfaceType,
                        grip: segment.grip,
                        segment
                    };
                }
            }
        }
        
        return { type: 'GRASS', grip: this.surfaceTypes.GRASS.grip, segment: null };
    }
    
    reset() {
        this.segments.forEach(s => {
            this.scene.remove(s.mesh);
            s.mesh.geometry.dispose();
            s.mesh.material.dispose();
        });
        this.segments = [];
    }
}

export default Roads;
