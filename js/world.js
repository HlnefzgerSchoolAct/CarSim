/**
 * World Class
 * Creates the game environment including ground, lighting, and obstacles
 */
class World {
    constructor(scene) {
        this.scene = scene;
        this.obstacles = [];
        
        // Tire marks system
        this.tireMarks = [];
        this.maxTireMarks = 500;
        this.tireMarkMaterial = new THREE.MeshBasicMaterial({
            color: 0x222222,
            transparent: true,
            opacity: 0.6,
            side: THREE.DoubleSide
        });
        
        this.createGround();
        this.createLighting();
        this.createSkybox();
        this.createObstacles();
        this.createRoadMarkings();
    }
    
    addTireMarks(wheelPositions, slipAngle) {
        // Create tire marks based on slip intensity
        const intensity = Math.min(slipAngle / 0.5, 1); // 0-1 based on slip angle
        
        wheelPositions.forEach(pos => {
            if (this.tireMarks.length >= this.maxTireMarks) {
                // Remove oldest tire mark
                const oldMark = this.tireMarks.shift();
                this.scene.remove(oldMark);
                oldMark.geometry.dispose();
            }
            
            // Create small tire mark segment
            const markGeometry = new THREE.PlaneGeometry(0.15, 0.3);
            const markMaterial = this.tireMarkMaterial.clone();
            markMaterial.opacity = 0.3 + intensity * 0.4;
            
            const mark = new THREE.Mesh(markGeometry, markMaterial);
            mark.position.copy(pos);
            mark.rotation.x = -Math.PI / 2;
            mark.rotation.z = Math.random() * 0.2 - 0.1; // Slight random rotation
            
            this.scene.add(mark);
            this.tireMarks.push(mark);
        });
    }
    
    // Fade tire marks over time (optional performance optimization)
    updateTireMarks(deltaTime) {
        // Gradually fade old tire marks
        for (let i = 0; i < Math.min(10, this.tireMarks.length); i++) {
            const mark = this.tireMarks[i];
            if (mark.material.opacity > 0.1) {
                mark.material.opacity -= deltaTime * 0.05;
            }
        }
    }

    createGround() {
        // Large ground plane
        const groundGeometry = new THREE.PlaneGeometry(500, 500, 50, 50);
        const groundMaterial = new THREE.MeshStandardMaterial({
            color: 0x3a7d3a,
            roughness: 0.9,
            metalness: 0.1
        });
        
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);

        // Road surface
        const roadGeometry = new THREE.PlaneGeometry(15, 500);
        const roadMaterial = new THREE.MeshStandardMaterial({
            color: 0x333333,
            roughness: 0.8,
            metalness: 0.1
        });
        
        const road = new THREE.Mesh(roadGeometry, roadMaterial);
        road.rotation.x = -Math.PI / 2;
        road.position.y = 0.01;
        road.receiveShadow = true;
        this.scene.add(road);

        // Cross road
        const crossRoad = new THREE.Mesh(roadGeometry, roadMaterial);
        crossRoad.rotation.x = -Math.PI / 2;
        crossRoad.rotation.z = Math.PI / 2;
        crossRoad.position.y = 0.01;
        crossRoad.receiveShadow = true;
        this.scene.add(crossRoad);
    }

    createRoadMarkings() {
        const markingMaterial = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.5
        });

        // Center line dashes along main road
        for (let i = -240; i < 240; i += 10) {
            const marking = new THREE.Mesh(
                new THREE.PlaneGeometry(0.3, 4),
                markingMaterial
            );
            marking.rotation.x = -Math.PI / 2;
            marking.position.set(0, 0.02, i);
            this.scene.add(marking);
        }

        // Center line dashes along cross road
        for (let i = -240; i < 240; i += 10) {
            const marking = new THREE.Mesh(
                new THREE.PlaneGeometry(0.3, 4),
                markingMaterial
            );
            marking.rotation.x = -Math.PI / 2;
            marking.rotation.z = Math.PI / 2;
            marking.position.set(i, 0.02, 0);
            this.scene.add(marking);
        }

        // Edge lines
        const edgeGeometry = new THREE.PlaneGeometry(0.2, 500);
        
        [-7, 7].forEach(x => {
            const edge = new THREE.Mesh(edgeGeometry, markingMaterial);
            edge.rotation.x = -Math.PI / 2;
            edge.position.set(x, 0.02, 0);
            this.scene.add(edge);
        });
    }

    createLighting() {
        // Ambient light for overall illumination
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);

        // Directional light (sun)
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(50, 100, 50);
        directionalLight.castShadow = true;
        
        // Shadow settings
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 500;
        directionalLight.shadow.camera.left = -100;
        directionalLight.shadow.camera.right = 100;
        directionalLight.shadow.camera.top = 100;
        directionalLight.shadow.camera.bottom = -100;
        
        this.scene.add(directionalLight);

        // Hemisphere light for natural sky/ground color
        const hemisphereLight = new THREE.HemisphereLight(0x87ceeb, 0x3a7d3a, 0.3);
        this.scene.add(hemisphereLight);
    }

    createSkybox() {
        // Simple sky color background
        this.scene.background = new THREE.Color(0x87ceeb);

        // Add fog for depth
        this.scene.fog = new THREE.Fog(0x87ceeb, 100, 400);
    }

    createObstacles() {
        // Create trees
        this.createTrees();
        
        // Create buildings
        this.createBuildings();
        
        // Create traffic cones
        this.createCones();
    }

    createTrees() {
        const trunkGeometry = new THREE.CylinderGeometry(0.3, 0.4, 2, 8);
        const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x8b4513 });
        
        const foliageGeometry = new THREE.ConeGeometry(2, 4, 8);
        const foliageMaterial = new THREE.MeshStandardMaterial({ color: 0x228b22 });

        const treePositions = [
            { x: 20, z: 20 }, { x: -25, z: 30 }, { x: 30, z: -20 },
            { x: -20, z: -35 }, { x: 40, z: 50 }, { x: -45, z: -50 },
            { x: 50, z: -40 }, { x: -35, z: 60 }, { x: 25, z: -60 },
            { x: -60, z: 25 }, { x: 60, z: 35 }, { x: -50, z: -30 }
        ];

        treePositions.forEach(pos => {
            const treeGroup = new THREE.Group();
            
            const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
            trunk.position.y = 1;
            trunk.castShadow = true;
            treeGroup.add(trunk);

            const foliage = new THREE.Mesh(foliageGeometry, foliageMaterial);
            foliage.position.y = 4;
            foliage.castShadow = true;
            treeGroup.add(foliage);

            treeGroup.position.set(pos.x, 0, pos.z);
            this.scene.add(treeGroup);
            
            this.obstacles.push({
                position: new THREE.Vector3(pos.x, 0, pos.z),
                radius: 1
            });
        });
    }

    createBuildings() {
        const buildingMaterial = new THREE.MeshStandardMaterial({
            color: 0x888888,
            roughness: 0.7
        });

        const buildings = [
            { x: 50, z: 50, w: 15, h: 20, d: 15 },
            { x: -50, z: 50, w: 12, h: 15, d: 12 },
            { x: 50, z: -50, w: 10, h: 25, d: 10 },
            { x: -50, z: -50, w: 18, h: 12, d: 18 }
        ];

        buildings.forEach(b => {
            const geometry = new THREE.BoxGeometry(b.w, b.h, b.d);
            const building = new THREE.Mesh(geometry, buildingMaterial);
            building.position.set(b.x, b.h / 2, b.z);
            building.castShadow = true;
            building.receiveShadow = true;
            this.scene.add(building);

            // Add windows
            this.addWindowsToBuilding(building, b);
            
            this.obstacles.push({
                position: new THREE.Vector3(b.x, 0, b.z),
                radius: Math.max(b.w, b.d) / 2
            });
        });
    }

    addWindowsToBuilding(building, dimensions) {
        const windowMaterial = new THREE.MeshStandardMaterial({
            color: 0xffffcc,
            emissive: 0xffffcc,
            emissiveIntensity: 0.2
        });

        const windowGeom = new THREE.PlaneGeometry(1.5, 2);
        
        // Add windows on each floor
        for (let floor = 3; floor < dimensions.h - 2; floor += 4) {
            for (let side = 0; side < 4; side++) {
                const windowMesh = new THREE.Mesh(windowGeom, windowMaterial);
                
                switch (side) {
                    case 0: // Front
                        windowMesh.position.set(dimensions.x, floor, dimensions.z + dimensions.d / 2 + 0.01);
                        break;
                    case 1: // Back
                        windowMesh.position.set(dimensions.x, floor, dimensions.z - dimensions.d / 2 - 0.01);
                        windowMesh.rotation.y = Math.PI;
                        break;
                    case 2: // Left
                        windowMesh.position.set(dimensions.x - dimensions.w / 2 - 0.01, floor, dimensions.z);
                        windowMesh.rotation.y = -Math.PI / 2;
                        break;
                    case 3: // Right
                        windowMesh.position.set(dimensions.x + dimensions.w / 2 + 0.01, floor, dimensions.z);
                        windowMesh.rotation.y = Math.PI / 2;
                        break;
                }
                
                this.scene.add(windowMesh);
            }
        }
    }

    createCones() {
        const coneGeometry = new THREE.ConeGeometry(0.3, 0.8, 8);
        const coneMaterial = new THREE.MeshStandardMaterial({ color: 0xff6600 });

        // Place cones along the road edge at intersection
        const conePositions = [
            { x: -8, z: -8 }, { x: -8, z: 8 },
            { x: 8, z: -8 }, { x: 8, z: 8 }
        ];

        conePositions.forEach(pos => {
            const cone = new THREE.Mesh(coneGeometry, coneMaterial);
            cone.position.set(pos.x, 0.4, pos.z);
            cone.castShadow = true;
            this.scene.add(cone);
        });
    }

    getObstacles() {
        return this.obstacles;
    }
}