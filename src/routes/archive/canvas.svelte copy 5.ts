const BASE_CELL_SIZE = 20;
const STIFFNESS = 2;
const DAMPING = 0.2;

// Metaball parameters
const METABALL_RADIUS = BASE_CELL_SIZE * 0.4;
const METABALL_RADIUS_SQ = METABALL_RADIUS * METABALL_RADIUS;
const METABALL_THRESHOLD = 1.0;
const RENDER_RESOLUTION = 4;

// Optimization: Cells only influence pixels within this visual radius
// 6.0 * Radius covers values down to ~0.03, below which visual impact is negligible
const INFLUENCE_RADIUS = METABALL_RADIUS * 6.0;

const ANIMATION_DURATION = 500;

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 10;
const ZOOM_SENSITIVITY = 0.1;

export function create_canvas(ref: HTMLCanvasElement) {
	const canvas: HTMLCanvasElement = ref;
	const ctx = canvas.getContext('2d', { alpha: false }) as CanvasRenderingContext2D; // Optimization: alpha false
	const canvas_rect = canvas.getBoundingClientRect();
	const { width, height } = canvas_rect;
	canvas.width = width;
	canvas.height = height;

	type Vector2 = { x: number; y: number };

	let CELL_SIZE = BASE_CELL_SIZE;
	let COLS = Math.floor(width / CELL_SIZE);
	let ROWS = Math.floor(height / CELL_SIZE);

	// Create grid (logical source of truth)
	let grid: boolean[][] = [];
	let nextGrid: boolean[][] = [];

	// Visual representation with physics
	type Cell = {
		gridX: number;
		gridY: number;
		x: number;
		y: number;
		vx: number;
		vy: number;
		targetX: number;
		targetY: number;
		phase: number;
		phaseSpeed: number;
		alpha: number;
		scale: number;
		dying: boolean;
	};

	// Optimization: Use integer keys (row << 16 | col) instead of strings
	const visualCells: Map<number, Cell> = new Map();
	const dyingCells: Map<number, Cell> = new Map();

	// Reusable rendering buffer
	let fieldBuffer = new Float32Array(0);
	let fieldWidth = 0;
	let fieldHeight = 0;

	// Optimization: Bitwise key encoding/decoding
	// Supports grids up to 65535 x 65535
	const encodeKey = (row: number, col: number) => (row << 16) | col;
	// const decodeKey = (key: number) => ({ row: key >>> 16, col: key & 0xFFFF });

	function initGrid() {
		grid = Array(ROWS)
			.fill(null)
			.map(() => Array(COLS).fill(false));
		nextGrid = Array(ROWS)
			.fill(null)
			.map(() => Array(COLS).fill(false));
		visualCells.clear();
		dyingCells.clear();
	}

	initGrid();

	// Game state
	let isPlaying = false;
	let lastUpdateTime = 0;
	const UPDATE_INTERVAL = 100;

	// Animation state
	let isAnimating = false;
	let animationProgress = 0;
	let animationStartTime = 0;

	// Zoom and pan state
	let zoom_level = 4;
	let pan_offset: Vector2 = {
		x: width / 2 - (width * zoom_level) / 2,
		y: height / 2 - (height * zoom_level) / 2
	};

	function calculateNeighborVector(row: number, col: number, useGrid: boolean[][]): Vector2 {
		let x = 0;
		let y = 0;

		for (let i = -1; i <= 1; i++) {
			for (let j = -1; j <= 1; j++) {
				if (i === 0 && j === 0) continue;

				const wrappedRow = (row + i + ROWS) % ROWS;
				const wrappedCol = (col + j + COLS) % COLS;

				if (useGrid[wrappedRow][wrappedCol]) {
					x -= j;
					y -= i;
				}
			}
		}

		const magnitude = Math.sqrt(x * x + y * y);
		if (magnitude > 0) {
			x /= magnitude;
			y /= magnitude;
		}

		return { x, y };
	}

	function syncVisualCells() {
		const currentKeys = new Set<number>();
		dyingCells.clear();

		for (let row = 0; row < ROWS; row++) {
			for (let col = 0; col < COLS; col++) {
				const isAlive = grid[row][col];
				const willBeAlive = nextGrid[row][col];

				if (!isAlive && !willBeAlive) continue;

				const key = encodeKey(row, col);

				// HANDLE SURVIVORS (Standard update)
				if (isAlive) {
					currentKeys.add(key);
					if (!visualCells.has(key)) {
						// Logic for manually clicked cells (appear instantly)
						const targetX = col * BASE_CELL_SIZE + BASE_CELL_SIZE / 2;
						const targetY = row * BASE_CELL_SIZE + BASE_CELL_SIZE / 2;
						visualCells.set(key, {
							gridX: col,
							gridY: row,
							x: targetX,
							y: targetY,
							vx: 0,
							vy: 0,
							targetX,
							targetY,
							phase: Math.random() * Math.PI * 2,
							phaseSpeed: 0.5 + Math.random() * 0.5,
							alpha: 1,
							scale: 1,
							dying: false
						});
					}
				}

				// HANDLE SPAWNING (The "Squeeze Out" Effect)
				if (!isAlive && willBeAlive && isAnimating) {
					if (!visualCells.has(key)) {
						const targetX = col * BASE_CELL_SIZE + BASE_CELL_SIZE / 2;
						const targetY = row * BASE_CELL_SIZE + BASE_CELL_SIZE / 2;

						// CRITICAL CHANGE: Use 'grid' (OLD state) to find where to spawn FROM.
						// We want to spawn from the existing neighbors.
						const vector = calculateNeighborVector(row, col, grid);

						// Start completely overlapping the neighbor (1.0 * SIZE instead of 0.5)
						// This allows the spring physics to "pop" it out into the empty space.
						const startX = targetX - vector.x * (BASE_CELL_SIZE * 1.0);
						const startY = targetY - vector.y * (BASE_CELL_SIZE * 1.0);

						visualCells.set(key, {
							gridX: col,
							gridY: row,
							x: startX,
							y: startY,
							vx: 0,
							vy: 0,
							targetX,
							targetY, // Target is the empty slot
							phase: Math.random() * Math.PI * 2,
							phaseSpeed: 0.5 + Math.random() * 0.5,
							alpha: 1, // Start fully opaque (it's "inside" the other cell)
							scale: 0.5, // Start smaller
							dying: false
						});
						currentKeys.add(key);
					}
				}

				// HANDLE DYING (The "Ejection" Effect)
				if (isAlive && !willBeAlive && isAnimating) {
					const cell = visualCells.get(key);
					if (cell) {
						cell.dying = true;

						// CRITICAL CHANGE: Use 'nextGrid' (NEW state) to find who to run away FROM.
						// We ignore other dying cells and only push away from survivors.
						const vector = calculateNeighborVector(row, col, nextGrid);

						// Set the target FAR away (2.5x size).
						// The physics system will try to pull the cell there rapidly.
						const pushDistance = BASE_CELL_SIZE * 2.5;
						cell.targetX = cell.x + vector.x * pushDistance;
						cell.targetY = cell.y + vector.y * pushDistance;

						dyingCells.set(key, cell);
					}
				}
			}
		}

		if (!isAnimating) {
			for (const key of visualCells.keys()) {
				if (!currentKeys.has(key)) visualCells.delete(key);
			}
		}
	}

	function countNeighbors(row: number, col: number): number {
		let count = 0;
		for (let i = -1; i <= 1; i++) {
			for (let j = -1; j <= 1; j++) {
				if (i === 0 && j === 0) continue;
				// Optimization: Inline modulo arithmetic
				let r = row + i;
				let c = col + j;
				if (r < 0) r = ROWS - 1;
				else if (r >= ROWS) r = 0;
				if (c < 0) c = COLS - 1;
				else if (c >= COLS) c = 0;

				if (grid[r][c]) count++;
			}
		}
		return count;
	}

	function updateGrid() {
		for (let row = 0; row < ROWS; row++) {
			for (let col = 0; col < COLS; col++) {
				const neighbors = countNeighbors(row, col);
				const isAlive = grid[row][col];
				nextGrid[row][col] = isAlive ? neighbors === 2 || neighbors === 3 : neighbors === 3;
			}
		}

		isAnimating = true;
		animationStartTime = performance.now();
		animationProgress = 0;
		syncVisualCells();
	}

	function completeTransition() {
		[grid, nextGrid] = [nextGrid, grid];
		isAnimating = false;
		animationProgress = 0;

		for (const key of dyingCells.keys()) {
			visualCells.delete(key);
		}
		dyingCells.clear();

		for (const cell of visualCells.values()) {
			cell.alpha = 1;
			cell.scale = 1;
			cell.dying = false;
		}
	}

	function screenToGrid(screenX: number, screenY: number): { col: number; row: number } {
		const worldX = (screenX - pan_offset.x) / zoom_level;
		const worldY = (screenY - pan_offset.y) / zoom_level;
		return {
			col: Math.floor(worldX / BASE_CELL_SIZE),
			row: Math.floor(worldY / BASE_CELL_SIZE)
		};
	}

	function updatePhysics(dt: number) {
		const tSec = dt / 1000;
		const progress = isAnimating
			? animationProgress < 0.5
				? 4 * animationProgress ** 3
				: 1 - Math.pow(-2 * animationProgress + 2, 3) / 2
			: 0;

		for (const cell of visualCells.values()) {
			cell.phase += cell.phaseSpeed * tSec;

			// Wobble logic
			const wobbleAmount = isAnimating ? 0.5 : 2; // Reduce wobble during fast movement
			const wobbleX = Math.sin(cell.phase) * wobbleAmount;
			const wobbleY = Math.cos(cell.phase * 1.3) * wobbleAmount;

			if (!cell.dying) {
				// Living cells: Target is their grid position + wobble
				cell.targetX = cell.gridX * BASE_CELL_SIZE + BASE_CELL_SIZE / 2 + wobbleX;
				cell.targetY = cell.gridY * BASE_CELL_SIZE + BASE_CELL_SIZE / 2 + wobbleY;

				// Growth animation
				if (isAnimating && cell.scale < 1) {
					// Quick elastic growth
					cell.scale = lerp(0.5, 1, progress);
				} else if (!isAnimating) {
					cell.scale = 1;
				}
			} else {
				// Dying cells: Target was already set to "Ejection Point" in syncVisualCells.
				// We just add wobble to the trajectory.
				cell.targetX += wobbleX * 0.1;
				cell.targetY += wobbleY * 0.1;

				// Shrink and Fade
				cell.scale = 1 - progress;
				cell.alpha = 1 - progress;
			}

			// Spring Physics Integration
			const dx = cell.targetX - cell.x;
			const dy = cell.targetY - cell.y;

			// Apply forces
			cell.vx += ((dx * STIFFNESS) / 4) * tSec;
			cell.vy += ((dy * STIFFNESS) / 4) * tSec;

			// Apply damping
			const d = Math.pow(DAMPING, tSec);
			cell.vx *= d;
			cell.vy *= d;

			// Update position
			cell.x += cell.vx * tSec * 60;
			cell.y += cell.vy * tSec * 60;
		}
	}

	function lerp(a: number, b: number, t: number): number {
		return a + (b - a) * t;
	}

	function getEdgePoint(
		x1: number,
		y1: number,
		val1: number,
		x2: number,
		y2: number,
		val2: number
	) {
		if (Math.abs(val1 - val2) < 0.001) return { x: (x1 + x2) / 2, y: (y1 + y2) / 2 };
		const t = (METABALL_THRESHOLD - val1) / (val2 - val1);
		return { x: lerp(x1, x2, t), y: lerp(y1, y2, t) };
	}

	// Optimization: Additive Splatting Approach
	// Instead of iterating pixels and checking all cells (slow),
	// we iterate cells and add to nearby pixels (fast).
	function drawMetaballs(startRow: number, endRow: number, startCol: number, endCol: number) {
		const startX = startCol * BASE_CELL_SIZE;
		const startY = startRow * BASE_CELL_SIZE;
		const endX = endCol * BASE_CELL_SIZE;
		const endY = endRow * BASE_CELL_SIZE;

		// Calculate required buffer size
		const bufW = Math.ceil((endX - startX) / RENDER_RESOLUTION) + 1;
		const bufH = Math.ceil((endY - startY) / RENDER_RESOLUTION) + 1;
		const reqSize = bufW * bufH;

		// Resize buffer if needed (amortized allocation)
		if (fieldBuffer.length < reqSize) {
			fieldBuffer = new Float32Array(reqSize);
		} else {
			// Efficient clear
			fieldBuffer.fill(0, 0, reqSize);
		}

		fieldWidth = bufW;
		fieldHeight = bufH;

		// 1. Splatting Pass: Add cell influence to the scalar field
		const iter = visualCells.values(); // Iterating values of a Map is fast
		let cellResult = iter.next();

		while (!cellResult.done) {
			const cell = cellResult.value;
			cellResult = iter.next();

			// Optimization: Skip cells that are too far off-screen
			// We include the INFLUENCE_RADIUS in the check
			if (
				cell.x < startX - INFLUENCE_RADIUS ||
				cell.x > endX + INFLUENCE_RADIUS ||
				cell.y < startY - INFLUENCE_RADIUS ||
				cell.y > endY + INFLUENCE_RADIUS
			) {
				continue;
			}

			// Pre-calculate influence factors
			const r2 = METABALL_RADIUS_SQ * (cell.scale * cell.scale);
			const strength = r2 * cell.alpha;
			if (strength < 0.01) continue; // Skip invisible cells

			// Convert cell position to field space
			const fx = (cell.x - startX) / RENDER_RESOLUTION;
			const fy = (cell.y - startY) / RENDER_RESOLUTION;

			// Determine bounds of influence in field coordinates
			const radiusInUnits = INFLUENCE_RADIUS / RENDER_RESOLUTION;
			const minX = Math.max(0, Math.floor(fx - radiusInUnits));
			const maxX = Math.min(bufW - 1, Math.ceil(fx + radiusInUnits));
			const minY = Math.max(0, Math.floor(fy - radiusInUnits));
			const maxY = Math.min(bufH - 1, Math.ceil(fy + radiusInUnits));

			// Inner loop: Only update local neighborhood
			for (let by = minY; by <= maxY; by++) {
				const rowOffset = by * bufW;
				const worldYPos = startY + by * RENDER_RESOLUTION;
				const dy = worldYPos - cell.y;
				const dy2 = dy * dy;

				for (let bx = minX; bx <= maxX; bx++) {
					const worldXPos = startX + bx * RENDER_RESOLUTION;
					const dx = worldXPos - cell.x;
					const distSq = dx * dx + dy2;

					if (distSq > 0.1) {
						fieldBuffer[rowOffset + bx] += strength / distSq;
					} else {
						fieldBuffer[rowOffset + bx] += 100; // Cap center to avoid infinity
					}
				}
			}
		}

		// 2. Rendering Pass: Marching Squares
		// Note: Logic logic mostly unchanged, just reading from 1D float buffer

		// Fill pass
		// ctx.fillStyle = 'rgba(80, 220, 140, 0.7)'; // Uncomment to enable fill
		// ctx.beginPath();
		// ... fill logic (omitted for brevity as it was commented out in source) ...
		// ctx.fill();

		// Stroke pass
		ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
		ctx.lineWidth = 2.5 / zoom_level;
		ctx.lineCap = 'round';
		ctx.lineJoin = 'round';
		ctx.beginPath();

		for (let by = 0; by < bufH - 1; by++) {
			const rowOffset = by * bufW;
			const nextRowOffset = (by + 1) * bufW;
			const y = startY + by * RENDER_RESOLUTION;

			for (let bx = 0; bx < bufW - 1; bx++) {
				const tl = fieldBuffer[rowOffset + bx];
				const tr = fieldBuffer[rowOffset + bx + 1];
				const bl = fieldBuffer[nextRowOffset + bx];
				const br = fieldBuffer[nextRowOffset + bx + 1];

				let caseId = 0;
				if (tl >= METABALL_THRESHOLD) caseId |= 1;
				if (tr >= METABALL_THRESHOLD) caseId |= 2;
				if (br >= METABALL_THRESHOLD) caseId |= 4;
				if (bl >= METABALL_THRESHOLD) caseId |= 8;

				if (caseId === 0 || caseId === 15) continue;

				const x = startX + bx * RENDER_RESOLUTION;

				const top = getEdgePoint(x, y, tl, x + RENDER_RESOLUTION, y, tr);
				const right = getEdgePoint(
					x + RENDER_RESOLUTION,
					y,
					tr,
					x + RENDER_RESOLUTION,
					y + RENDER_RESOLUTION,
					br
				);
				const bottom = getEdgePoint(
					x + RENDER_RESOLUTION,
					y + RENDER_RESOLUTION,
					br,
					x,
					y + RENDER_RESOLUTION,
					bl
				);
				const left = getEdgePoint(x, y + RENDER_RESOLUTION, bl, x, y, tl);

				switch (caseId) {
					case 1:
					case 14:
						ctx.moveTo(top.x, top.y);
						ctx.lineTo(left.x, left.y);
						break;
					case 2:
					case 13:
						ctx.moveTo(top.x, top.y);
						ctx.lineTo(right.x, right.y);
						break;
					case 3:
					case 12:
						ctx.moveTo(left.x, left.y);
						ctx.lineTo(right.x, right.y);
						break;
					case 4:
					case 11:
						ctx.moveTo(right.x, right.y);
						ctx.lineTo(bottom.x, bottom.y);
						break;
					case 5:
						ctx.moveTo(top.x, top.y);
						ctx.lineTo(right.x, right.y);
						ctx.moveTo(left.x, left.y);
						ctx.lineTo(bottom.x, bottom.y);
						break;
					case 6:
					case 9:
						ctx.moveTo(top.x, top.y);
						ctx.lineTo(bottom.x, bottom.y);
						break;
					case 7:
					case 8:
						ctx.moveTo(left.x, left.y);
						ctx.lineTo(bottom.x, bottom.y);
						break;
					case 10:
						ctx.moveTo(top.x, top.y);
						ctx.lineTo(left.x, left.y);
						ctx.moveTo(right.x, right.y);
						ctx.lineTo(bottom.x, bottom.y);
						break;
				}
			}
		}
		ctx.stroke();
	}

	function draw() {
		ctx.fillStyle = '#1a1a1a';
		ctx.fillRect(0, 0, width, height);

		ctx.save();
		ctx.translate(pan_offset.x, pan_offset.y);
		ctx.scale(zoom_level, zoom_level);

		const margin = 2; // Extra cells buffer
		const startCol = Math.max(0, Math.floor(-pan_offset.x / zoom_level / BASE_CELL_SIZE) - margin);
		const endCol = Math.min(
			COLS,
			Math.ceil((width - pan_offset.x) / zoom_level / BASE_CELL_SIZE) + margin
		);
		const startRow = Math.max(0, Math.floor(-pan_offset.y / zoom_level / BASE_CELL_SIZE) - margin);
		const endRow = Math.min(
			ROWS,
			Math.ceil((height - pan_offset.y) / zoom_level / BASE_CELL_SIZE) + margin
		);

		if (zoom_level > 0.5) {
			ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
			ctx.lineWidth = 0.5 / zoom_level;

			ctx.beginPath();
			for (let i = startRow; i <= endRow; i++) {
				const y = i * BASE_CELL_SIZE;
				ctx.moveTo(startCol * BASE_CELL_SIZE, y);
				ctx.lineTo(endCol * BASE_CELL_SIZE, y);
			}
			for (let i = startCol; i <= endCol; i++) {
				const x = i * BASE_CELL_SIZE;
				ctx.moveTo(x, startRow * BASE_CELL_SIZE);
				ctx.lineTo(x, endRow * BASE_CELL_SIZE);
			}
			ctx.stroke();
		}

		if (visualCells.size > 0) {
			drawMetaballs(startRow, endRow, startCol, endCol);
		}

		ctx.restore();

		// Draw status
		ctx.fillStyle = 'white';
		ctx.font = '14px monospace';
		ctx.fillText(isPlaying ? 'Playing (Space to pause)' : 'Paused (Space to play)', 10, 20);
		ctx.fillText('Click to toggle cells | Scroll to zoom', 10, 40);
		ctx.fillText(`Zoom: ${(zoom_level * 100).toFixed(0)}%`, 10, 60);
		ctx.fillText(`Cells: ${visualCells.size} | Dying: ${dyingCells.size}`, 10, 80);
	}

	let lastFrameTime = performance.now();

	function animate(currentTime: number) {
		const deltaTime = currentTime - lastFrameTime;
		lastFrameTime = currentTime;

		if (isAnimating) {
			const elapsed = currentTime - animationStartTime;
			animationProgress = Math.min(elapsed / ANIMATION_DURATION, 1);
			if (animationProgress >= 1) completeTransition();
		}

		updatePhysics(deltaTime);
		draw();

		if (isPlaying && !isAnimating && currentTime - lastUpdateTime > UPDATE_INTERVAL) {
			updateGrid();
			lastUpdateTime = currentTime;
		}

		requestAnimationFrame(animate);
	}

	function onClick(event: MouseEvent) {
		const x = event.clientX - canvas_rect.left;
		const y = event.clientY - canvas_rect.top;
		const { col, row } = screenToGrid(x, y);

		if (row >= 0 && row < ROWS && col >= 0 && col < COLS) {
			grid[row][col] = !grid[row][col];
			syncVisualCells();
			draw();
		}
	}

	let isMouseDown = false;
	function onMouseDown(event: MouseEvent) {
		onClick(event);
		isMouseDown = true;
	}
	function onMouseUp() {
		isMouseDown = false;
	}
	function onMouseMove(event: MouseEvent) {
		if (isMouseDown) {
			const x = event.clientX - canvas_rect.left;
			const y = event.clientY - canvas_rect.top;
			const { col, row } = screenToGrid(x, y);
			if (row >= 0 && row < ROWS && col >= 0 && col < COLS) {
				grid[row][col] = true;
				syncVisualCells();
				draw();
			}
		}
	}

	function parseRLE(rleString: string): { pattern: boolean[][]; width: number; height: number } {
		const lines = rleString.trim().split('\n');
		let patternData = '';
		let width = 0,
			height = 0;

		for (const line of lines) {
			if (line.startsWith('x')) {
				const xMatch = line.match(/x\s*=\s*(\d+)/);
				const yMatch = line.match(/y\s*=\s*(\d+)/);
				if (xMatch) width = parseInt(xMatch[1]);
				if (yMatch) height = parseInt(yMatch[1]);
			} else if (!line.startsWith('#')) {
				patternData += line;
			}
		}

		patternData = patternData.replace(/!/g, '').trim();
		const pattern = Array(height)
			.fill(null)
			.map(() => Array(width).fill(false));

		let row = 0,
			col = 0,
			runCount = '';
		for (let i = 0; i < patternData.length; i++) {
			const char = patternData[i];
			if (char >= '0' && char <= '9') {
				runCount += char;
			} else if (char === 'b') {
				col += runCount === '' ? 1 : parseInt(runCount);
				runCount = '';
			} else if (char === 'o') {
				const count = runCount === '' ? 1 : parseInt(runCount);
				for (let j = 0; j < count; j++) {
					if (row < height && col < width) pattern[row][col] = true;
					col++;
				}
				runCount = '';
			} else if (char === '$') {
				row += runCount === '' ? 1 : parseInt(runCount);
				col = 0;
				runCount = '';
			}
		}
		return { pattern, width, height };
	}

	function drawPattern(rleString: string, centerX?: number, centerY?: number) {
		initGrid();
		const { pattern, width, height } = parseRLE(rleString);
		const startCol = centerX !== undefined ? centerX : Math.floor((COLS - width) / 2);
		const startRow = centerY !== undefined ? centerY : Math.floor((ROWS - height) / 2);

		for (let row = 0; row < height; row++) {
			for (let col = 0; col < width; col++) {
				const gridRow = startRow + row;
				const gridCol = startCol + col;
				if (gridRow >= 0 && gridRow < ROWS && gridCol >= 0 && gridCol < COLS) {
					grid[gridRow][gridCol] = pattern[row][col];
				}
			}
		}
		syncVisualCells();
		draw();
	}

	function toggle_play() {
		isPlaying = !isPlaying;
		if (isPlaying) lastUpdateTime = performance.now();
		draw();
	}

	function pause() {
		if (isPlaying) toggle_play();
	}

	function onKeyDown(event: KeyboardEvent) {
		if (event.code === 'Space') {
			event.preventDefault();
			toggle_play();
		}
		if (event.code === 'ArrowRight') {
			event.preventDefault();
			updateGrid();
			lastUpdateTime = performance.now();
		}
		if (event.code === 'ArrowUp') {
			event.preventDefault();
			test();
		}
	}

	function test() {
		const gosperGliderGun = `x = 36, y = 9, rule = B3/S23
24bo$22bobo$12b2o6b2o12b2o$11bo3bo4b2o12b2o$2o8bo5bo3b2o$2o8bo3bob2o4b
obo$10bo5bo7bo$11bo3bo$12b2o!`;
		drawPattern(gosperGliderGun);
	}

	function zoom(direction: 1 | -1, origin: Vector2) {
		const old_zoom = zoom_level;
		zoom_level =
			direction > 0
				? Math.min(MAX_ZOOM, zoom_level * (1 + ZOOM_SENSITIVITY))
				: Math.max(MIN_ZOOM, zoom_level * (1 - ZOOM_SENSITIVITY));

		const zoom_ratio = zoom_level / old_zoom;
		pan_offset.x = origin.x - (origin.x - pan_offset.x) * zoom_ratio;
		pan_offset.y = origin.y - (origin.y - pan_offset.y) * zoom_ratio;
		draw();
	}

	function on_mouse_wheel(event: WheelEvent) {
		event.preventDefault();
		const x = event.clientX - canvas_rect.left;
		const y = event.clientY - canvas_rect.top;
		zoom(event.deltaY < 0 ? 1 : -1, { x, y });
	}

	canvas.addEventListener('mousedown', onMouseDown);
	canvas.addEventListener('mouseup', onMouseUp);
	canvas.addEventListener('mousemove', onMouseMove);
	canvas.addEventListener('wheel', on_mouse_wheel);
	window.addEventListener('keydown', onKeyDown);
	window.addEventListener('beforeunload', pause);

	const centerRow = Math.floor(ROWS / 2);
	const centerCol = Math.floor(COLS / 2);
	grid[centerRow][centerCol + 1] = true;
	grid[centerRow + 1][centerCol + 2] = true;
	grid[centerRow + 2][centerCol] = true;
	grid[centerRow + 2][centerCol + 1] = true;
	grid[centerRow + 2][centerCol + 2] = true;

	syncVisualCells();
	draw();
	requestAnimationFrame(animate);

	return { drawPattern };
}
