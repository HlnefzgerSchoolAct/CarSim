/**
 * SpatialHash.js
 * Spatial hash grid for efficient broad-phase collision detection
 * 
 * Divides space into a grid and assigns objects to cells based on their position.
 * Only objects in the same or adjacent cells need narrow-phase collision checking.
 * 
 * References:
 * - "Real-Time Collision Detection" by Christer Ericson
 * - "Game Physics Engine Development" by Ian Millington
 */

/**
 * Spatial hash grid for fast spatial queries
 */
class SpatialHash {
    /**
     * Create a spatial hash
     * @param {number} cellSize - Size of each grid cell
     * @param {number} maxObjects - Expected maximum number of objects (for optimization)
     */
    constructor(cellSize = 10, maxObjects = 1000) {
        this.cellSize = cellSize;
        this.invCellSize = 1.0 / cellSize;
        
        // Hash table mapping cell coordinates to arrays of objects
        this.cells = new Map();
        
        // Track which cells each object occupies
        this.objectCells = new Map();
        
        // Statistics
        this.stats = {
            totalObjects: 0,
            totalCells: 0,
            maxObjectsPerCell: 0,
            avgObjectsPerCell: 0,
            queriesThisFrame: 0,
            pairsChecked: 0
        };
        
        // Configuration
        this.maxObjects = maxObjects;
        this.enableDebug = false;
    }

    /**
     * Hash function to convert cell coordinates to a single key
     * Uses spatial hashing technique for better distribution
     * @param {number} x - Cell x coordinate
     * @param {number} y - Cell y coordinate
     * @param {number} z - Cell z coordinate
     * @returns {number}
     */
    hashCell(x, y, z) {
        // Use prime numbers for better distribution
        // Cantor pairing function adapted for 3D
        const h1 = x * 73856093;
        const h2 = y * 19349663;
        const h3 = z * 83492791;
        return (h1 ^ h2 ^ h3);
    }

    /**
     * Get cell coordinates for a world position
     * @param {number} x - World x coordinate
     * @param {number} y - World y coordinate
     * @param {number} z - World z coordinate
     * @returns {Object} {x, y, z}
     */
    getCellCoords(x, y, z) {
        return {
            x: Math.floor(x * this.invCellSize),
            y: Math.floor(y * this.invCellSize),
            z: Math.floor(z * this.invCellSize)
        };
    }

    /**
     * Get cell key for a position
     * @param {number} x 
     * @param {number} y 
     * @param {number} z 
     * @returns {number}
     */
    getCellKey(x, y, z) {
        const coords = this.getCellCoords(x, y, z);
        return this.hashCell(coords.x, coords.y, coords.z);
    }

    /**
     * Get all cells that an object with AABB overlaps
     * @param {Object} bounds - {min: [x,y,z], max: [x,y,z]}
     * @returns {Array} Array of cell keys
     */
    getCellsForBounds(bounds) {
        const minCell = this.getCellCoords(bounds.min[0], bounds.min[1], bounds.min[2]);
        const maxCell = this.getCellCoords(bounds.max[0], bounds.max[1], bounds.max[2]);
        
        const cells = [];
        
        // Iterate through all cells that the bounds overlap
        for (let x = minCell.x; x <= maxCell.x; x++) {
            for (let y = minCell.y; y <= maxCell.y; y++) {
                for (let z = minCell.z; z <= maxCell.z; z++) {
                    cells.push(this.hashCell(x, y, z));
                }
            }
        }
        
        return cells;
    }

    /**
     * Insert an object into the spatial hash
     * @param {*} object - Object to insert (must have boundingBox property)
     * @param {*} id - Unique identifier for the object
     */
    insert(object, id) {
        if (!object.boundingBox) {
            console.warn('Object must have boundingBox property');
            return;
        }
        
        // Get all cells this object occupies
        const cellKeys = this.getCellsForBounds(object.boundingBox);
        
        // Add object to each cell
        for (const key of cellKeys) {
            if (!this.cells.has(key)) {
                this.cells.set(key, []);
            }
            this.cells.get(key).push({ object, id });
        }
        
        // Track which cells this object is in
        this.objectCells.set(id, cellKeys);
        
        this.stats.totalObjects++;
        this.stats.totalCells = this.cells.size;
    }

    /**
     * Remove an object from the spatial hash
     * @param {*} id - Unique identifier of the object to remove
     */
    remove(id) {
        const cellKeys = this.objectCells.get(id);
        if (!cellKeys) return;
        
        // Remove object from all cells it was in
        for (const key of cellKeys) {
            const cell = this.cells.get(key);
            if (cell) {
                const index = cell.findIndex(item => item.id === id);
                if (index !== -1) {
                    cell.splice(index, 1);
                }
                
                // Remove empty cells
                if (cell.length === 0) {
                    this.cells.delete(key);
                }
            }
        }
        
        this.objectCells.delete(id);
        this.stats.totalObjects--;
        this.stats.totalCells = this.cells.size;
    }

    /**
     * Update an object's position in the spatial hash
     * More efficient than remove + insert
     * @param {*} object - Updated object
     * @param {*} id - Object identifier
     */
    update(object, id) {
        if (!object.boundingBox) {
            console.warn('Object must have boundingBox property');
            return;
        }
        
        const oldCellKeys = this.objectCells.get(id);
        const newCellKeys = this.getCellsForBounds(object.boundingBox);
        
        if (!oldCellKeys) {
            // Object wasn't in hash, just insert it
            this.insert(object, id);
            return;
        }
        
        // Find cells to add and remove
        const cellsToAdd = newCellKeys.filter(key => !oldCellKeys.includes(key));
        const cellsToRemove = oldCellKeys.filter(key => !newCellKeys.includes(key));
        
        // Remove from old cells
        for (const key of cellsToRemove) {
            const cell = this.cells.get(key);
            if (cell) {
                const index = cell.findIndex(item => item.id === id);
                if (index !== -1) {
                    cell.splice(index, 1);
                }
                if (cell.length === 0) {
                    this.cells.delete(key);
                }
            }
        }
        
        // Add to new cells
        for (const key of cellsToAdd) {
            if (!this.cells.has(key)) {
                this.cells.set(key, []);
            }
            this.cells.get(key).push({ object, id });
        }
        
        // Update cells that haven't changed (update object reference)
        const unchangedCells = newCellKeys.filter(key => oldCellKeys.includes(key));
        for (const key of unchangedCells) {
            const cell = this.cells.get(key);
            if (cell) {
                const item = cell.find(item => item.id === id);
                if (item) {
                    item.object = object;
                }
            }
        }
        
        // Update tracking
        this.objectCells.set(id, newCellKeys);
        this.stats.totalCells = this.cells.size;
    }

    /**
     * Query for objects near a point
     * @param {Float32Array|Array} point - [x, y, z]
     * @param {number} radius - Search radius
     * @returns {Array} Array of objects within radius
     */
    queryPoint(point, radius) {
        this.stats.queriesThisFrame++;
        
        // Create bounding box for the query
        const bounds = {
            min: [point[0] - radius, point[1] - radius, point[2] - radius],
            max: [point[0] - radius, point[1] + radius, point[2] + radius]
        };
        
        return this.queryBounds(bounds);
    }

    /**
     * Query for objects within a bounding box
     * @param {Object} bounds - {min: [x,y,z], max: [x,y,z]}
     * @returns {Array} Array of objects
     */
    queryBounds(bounds) {
        this.stats.queriesThisFrame++;
        
        const cellKeys = this.getCellsForBounds(bounds);
        const results = new Set();
        
        // Collect all objects from relevant cells
        for (const key of cellKeys) {
            const cell = this.cells.get(key);
            if (cell) {
                for (const item of cell) {
                    results.add(item);
                }
            }
        }
        
        return Array.from(results);
    }

    /**
     * Query for objects near another object
     * @param {*} object - Query object (must have boundingBox)
     * @param {*} id - Object's ID (to exclude from results)
     * @returns {Array} Array of nearby objects
     */
    queryObject(object, id) {
        if (!object.boundingBox) {
            console.warn('Object must have boundingBox property');
            return [];
        }
        
        const results = this.queryBounds(object.boundingBox);
        
        // Filter out the query object itself
        return results.filter(item => item.id !== id);
    }

    /**
     * Get all potential collision pairs
     * Returns pairs of objects that might be colliding (broad phase)
     * @returns {Array} Array of [object1, object2] pairs
     */
    getAllPotentialPairs() {
        const pairs = [];
        const checked = new Set();
        
        // Iterate through all cells
        for (const [key, cell] of this.cells) {
            // Check all pairs within this cell
            for (let i = 0; i < cell.length; i++) {
                for (let j = i + 1; j < cell.length; j++) {
                    const id1 = cell[i].id;
                    const id2 = cell[j].id;
                    
                    // Create unique pair identifier
                    const pairId = id1 < id2 ? `${id1}-${id2}` : `${id2}-${id1}`;
                    
                    // Only add each pair once
                    if (!checked.has(pairId)) {
                        pairs.push([cell[i], cell[j]]);
                        checked.add(pairId);
                    }
                }
            }
        }
        
        this.stats.pairsChecked = pairs.length;
        return pairs;
    }

    /**
     * Get all potential collision pairs with collision filtering
     * @param {Function} filterFn - Optional filter function (obj1, obj2) => boolean
     * @returns {Array} Array of [object1, object2] pairs
     */
    getAllPotentialPairsFiltered(filterFn = null) {
        const pairs = [];
        const checked = new Set();
        
        for (const [key, cell] of this.cells) {
            for (let i = 0; i < cell.length; i++) {
                for (let j = i + 1; j < cell.length; j++) {
                    const item1 = cell[i];
                    const item2 = cell[j];
                    const id1 = item1.id;
                    const id2 = item2.id;
                    
                    const pairId = id1 < id2 ? `${id1}-${id2}` : `${id2}-${id1}`;
                    
                    if (!checked.has(pairId)) {
                        // Apply filter if provided
                        if (!filterFn || filterFn(item1.object, item2.object)) {
                            pairs.push([item1, item2]);
                        }
                        checked.add(pairId);
                    }
                }
            }
        }
        
        this.stats.pairsChecked = pairs.length;
        return pairs;
    }

    /**
     * Raycast through the spatial hash
     * @param {Float32Array|Array} origin - Ray origin
     * @param {Float32Array|Array} direction - Ray direction (should be normalized)
     * @param {number} maxDistance - Maximum ray distance
     * @returns {Array} Array of objects the ray passes through
     */
    raycast(origin, direction, maxDistance) {
        this.stats.queriesThisFrame++;
        
        const results = new Set();
        
        // Use DDA (Digital Differential Analyzer) algorithm to traverse grid
        let t = 0;
        const step = this.cellSize * 0.5; // Step size for traversal
        
        while (t < maxDistance) {
            // Current position along ray
            const x = origin[0] + direction[0] * t;
            const y = origin[1] + direction[1] * t;
            const z = origin[2] + direction[2] * t;
            
            // Get cell at this position
            const key = this.getCellKey(x, y, z);
            const cell = this.cells.get(key);
            
            if (cell) {
                for (const item of cell) {
                    results.add(item);
                }
            }
            
            t += step;
        }
        
        return Array.from(results);
    }

    /**
     * Get k-nearest neighbors to a point
     * @param {Float32Array|Array} point 
     * @param {number} k - Number of neighbors to find
     * @param {number} maxRadius - Maximum search radius
     * @returns {Array} Array of {object, distance} sorted by distance
     */
    kNearestNeighbors(point, k, maxRadius = Infinity) {
        // Start with a small radius and expand if needed
        let radius = this.cellSize;
        let results = [];
        
        while (results.length < k && radius < maxRadius) {
            const candidates = this.queryPoint(point, radius);
            
            // Calculate distances
            results = candidates.map(item => {
                const obj = item.object;
                const pos = obj.position;
                const dx = pos[0] - point[0];
                const dy = pos[1] - point[1];
                const dz = pos[2] - point[2];
                const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
                
                return { item, distance };
            });
            
            // Sort by distance
            results.sort((a, b) => a.distance - b.distance);
            
            // Take top k
            results = results.slice(0, k);
            
            // Expand search radius
            radius *= 2;
        }
        
        return results;
    }

    /**
     * Clear the entire spatial hash
     */
    clear() {
        this.cells.clear();
        this.objectCells.clear();
        this.stats.totalObjects = 0;
        this.stats.totalCells = 0;
    }

    /**
     * Rebuild the spatial hash (useful after changing cell size)
     */
    rebuild() {
        const objects = [];
        
        // Collect all objects
        for (const [id, cellKeys] of this.objectCells) {
            // Get object from first cell
            const firstCellKey = cellKeys[0];
            const cell = this.cells.get(firstCellKey);
            if (cell) {
                const item = cell.find(item => item.id === id);
                if (item) {
                    objects.push({ object: item.object, id });
                }
            }
        }
        
        // Clear and re-insert
        this.clear();
        for (const { object, id } of objects) {
            this.insert(object, id);
        }
    }

    /**
     * Update statistics
     */
    updateStats() {
        let maxObjects = 0;
        let totalObjects = 0;
        
        for (const cell of this.cells.values()) {
            const count = cell.length;
            maxObjects = Math.max(maxObjects, count);
            totalObjects += count;
        }
        
        this.stats.maxObjectsPerCell = maxObjects;
        this.stats.avgObjectsPerCell = this.cells.size > 0 ? totalObjects / this.cells.size : 0;
    }

    /**
     * Get statistics about the spatial hash
     * @returns {Object}
     */
    getStats() {
        this.updateStats();
        return { ...this.stats };
    }

    /**
     * Reset per-frame statistics
     */
    resetFrameStats() {
        this.stats.queriesThisFrame = 0;
        this.stats.pairsChecked = 0;
    }

    /**
     * Visualize the spatial hash (for debugging)
     * @param {Function} drawCellFn - Function to draw a cell: (minX, minY, minZ, maxX, maxY, maxZ, objectCount)
     */
    visualize(drawCellFn) {
        if (!this.enableDebug) return;
        
        for (const [key, cell] of this.cells) {
            // We need to reverse the hash to get cell coordinates
            // This is expensive, so only use for debugging
            // For now, we'll iterate through occupied cells differently
            
            if (cell.length > 0) {
                // Get bounds from first object in cell
                const firstObj = cell[0].object;
                if (firstObj.boundingBox) {
                    const min = firstObj.boundingBox.min;
                    const cellCoords = this.getCellCoords(min[0], min[1], min[2]);
                    
                    const minX = cellCoords.x * this.cellSize;
                    const minY = cellCoords.y * this.cellSize;
                    const minZ = cellCoords.z * this.cellSize;
                    const maxX = minX + this.cellSize;
                    const maxY = minY + this.cellSize;
                    const maxZ = minZ + this.cellSize;
                    
                    drawCellFn(minX, minY, minZ, maxX, maxY, maxZ, cell.length);
                }
            }
        }
    }

    /**
     * Set cell size (requires rebuild)
     * @param {number} newCellSize 
     */
    setCellSize(newCellSize) {
        this.cellSize = newCellSize;
        this.invCellSize = 1.0 / newCellSize;
        this.rebuild();
    }

    /**
     * Get memory usage estimate
     * @returns {number} Approximate memory usage in bytes
     */
    getMemoryUsage() {
        let bytes = 0;
        
        // Cell map overhead
        bytes += this.cells.size * 50; // Approximate map entry overhead
        
        // Object references in cells
        for (const cell of this.cells.values()) {
            bytes += cell.length * 8; // Pointer size
        }
        
        // Object cells tracking
        bytes += this.objectCells.size * 50;
        
        return bytes;
    }
}

/**
 * Hierarchical spatial hash for multi-scale queries
 * Uses multiple spatial hashes with different cell sizes
 */
class HierarchicalSpatialHash {
    constructor(levels = 3, baseCellSize = 5) {
        this.levels = [];
        
        // Create multiple levels with increasing cell sizes
        for (let i = 0; i < levels; i++) {
            const cellSize = baseCellSize * Math.pow(2, i);
            this.levels.push({
                hash: new SpatialHash(cellSize),
                cellSize: cellSize
            });
        }
    }

    /**
     * Insert object into all levels
     * @param {*} object 
     * @param {*} id 
     */
    insert(object, id) {
        for (const level of this.levels) {
            level.hash.insert(object, id);
        }
    }

    /**
     * Remove object from all levels
     * @param {*} id 
     */
    remove(id) {
        for (const level of this.levels) {
            level.hash.remove(id);
        }
    }

    /**
     * Update object in all levels
     * @param {*} object 
     * @param {*} id 
     */
    update(object, id) {
        for (const level of this.levels) {
            level.hash.update(object, id);
        }
    }

    /**
     * Query using the most appropriate level for the query size
     * @param {Float32Array|Array} point 
     * @param {number} radius 
     * @returns {Array}
     */
    queryPoint(point, radius) {
        // Choose level based on query radius
        let bestLevel = this.levels[0];
        for (const level of this.levels) {
            if (radius >= level.cellSize * 0.5) {
                bestLevel = level;
            }
        }
        
        return bestLevel.hash.queryPoint(point, radius);
    }

    /**
     * Clear all levels
     */
    clear() {
        for (const level of this.levels) {
            level.hash.clear();
        }
    }

    /**
     * Get combined statistics from all levels
     * @returns {Object}
     */
    getStats() {
        return this.levels.map((level, i) => ({
            level: i,
            cellSize: level.cellSize,
            stats: level.hash.getStats()
        }));
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SpatialHash, HierarchicalSpatialHash };
}
