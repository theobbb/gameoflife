const BASE_CELL_SIZE = 20;
const STIFFNESS = 2;
const DAMPING = 0.2;

// Metaball parameters
const METABALL_RADIUS = BASE_CELL_SIZE * 0.4;
const METABALL_THRESHOLD = 1.0; // Threshold for blob edge
const RENDER_RESOLUTION = 4; // Lower = more detailed but slower (1 = full res, 2 = half res)

const ANIMATION_DURATION = 500;

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 10;
const ZOOM_SENSITIVITY = 0.1;

export function create_canvas(ref: HTMLCanvasElement) {
	const canvas: HTMLCanvasElement = ref;
	const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
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
		x: number; // actual render position
		y: number;
		vx: number; // velocity
		vy: number;
		targetX: number;
		targetY: number;
		phase: number; // for organic wobble
		phaseSpeed: number;
		alpha: number; // for fade in/out during transitions
		scale: number; // for shrink/grow during transitions
		dying: boolean; // is this cell dying?
	};

	let visualCells: Map<string, Cell> = new Map();
	let dyingCells: Map<string, Cell> = new Map(); // Cells being removed

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
	const UPDATE_INTERVAL = 100; // ms between updates

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

	function cellKey(row: number, col: number): string {
		return `${row},${col}`;
	}

	// Calculate direction vector away from neighbors for animation
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

	// Sync visual cells with grid
	function syncVisualCells() {
		const currentKeys = new Set<string>();

		// Clear dying cells from previous generation
		dyingCells.clear();

		for (let row = 0; row < ROWS; row++) {
			for (let col = 0; col < COLS; col++) {
				const key = cellKey(row, col);
				const isAlive = grid[row][col];
				const willBeAlive = nextGrid[row][col];

				if (isAlive) {
					currentKeys.add(key);

					if (!visualCells.has(key)) {
						// Create new visual cell (already alive, just syncing)
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

				// Handle spawning cells (not alive now, but will be)
				if (!isAlive && willBeAlive && isAnimating) {
					const key = cellKey(row, col);
					if (!visualCells.has(key)) {
						const targetX = col * BASE_CELL_SIZE + BASE_CELL_SIZE / 2;
						const targetY = row * BASE_CELL_SIZE + BASE_CELL_SIZE / 2;

						// Start from center of neighbors
						const vector = calculateNeighborVector(row, col, nextGrid);
						const startX = targetX - vector.x * (BASE_CELL_SIZE / 2);
						const startY = targetY - vector.y * (BASE_CELL_SIZE / 2);

						visualCells.set(key, {
							gridX: col,
							gridY: row,
							x: startX,
							y: startY,
							vx: 0,
							vy: 0,
							targetX,
							targetY,
							phase: Math.random() * Math.PI * 2,
							phaseSpeed: 0.5 + Math.random() * 0.5,
							alpha: 0,
							scale: 0,
							dying: false
						});
						currentKeys.add(key);
					}
				}

				// Handle dying cells (alive now, but won't be)
				if (isAlive && !willBeAlive && isAnimating) {
					const key = cellKey(row, col);
					const cell = visualCells.get(key);
					if (cell) {
						cell.dying = true;
						// Move to dying cells map
						dyingCells.set(key, cell);
					}
				}
			}
		}

		// Remove cells that finished dying
		if (!isAnimating) {
			for (const [key, cell] of visualCells) {
				if (!currentKeys.has(key)) {
					visualCells.delete(key);
				}
			}
		}
	}

	// Count alive neighbors
	function countNeighbors(row: number, col: number): number {
		let count = 0;
		for (let i = -1; i <= 1; i++) {
			for (let j = -1; j <= 1; j++) {
				if (i === 0 && j === 0) continue;

				const newRow = row + i;
				const newCol = col + j;

				const wrappedRow = (newRow + ROWS) % ROWS;
				const wrappedCol = (newCol + COLS) % COLS;

				if (grid[wrappedRow][wrappedCol]) {
					count++;
				}
			}
		}
		return count;
	}

	// Update grid according to Conway's rules
	function updateGrid() {
		for (let row = 0; row < ROWS; row++) {
			for (let col = 0; col < COLS; col++) {
				const neighbors = countNeighbors(row, col);
				const isAlive = grid[row][col];

				if (isAlive) {
					nextGrid[row][col] = neighbors === 2 || neighbors === 3;
				} else {
					nextGrid[row][col] = neighbors === 3;
				}
			}
		}

		isAnimating = true;
		animationStartTime = performance.now();
		animationProgress = 0;

		// Sync visual cells to prepare for animation
		syncVisualCells();
	}

	function completeTransition() {
		[grid, nextGrid] = [nextGrid, grid];
		isAnimating = false;
		animationProgress = 0;

		// Remove all dying cells
		for (const key of dyingCells.keys()) {
			visualCells.delete(key);
		}
		dyingCells.clear();

		// Reset alpha and scale for all remaining cells
		for (const cell of visualCells.values()) {
			cell.alpha = 1;
			cell.scale = 1;
			cell.dying = false;
		}
	}

	// Convert screen coordinates to grid coordinates
	function screenToGrid(screenX: number, screenY: number): { col: number; row: number } {
		const worldX = (screenX - pan_offset.x) / zoom_level;
		const worldY = (screenY - pan_offset.y) / zoom_level;
		const col = Math.floor(worldX / BASE_CELL_SIZE);
		const row = Math.floor(worldY / BASE_CELL_SIZE);
		return { col, row };
	}

	// Update physics for organic movement
	function updatePhysics(deltaTime: number) {
		const dt = deltaTime / 1000; // convert to seconds

		// Easing function for smooth animation
		const easeInOutCubic = (t: number): number => {
			return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
		};

		const progress = isAnimating ? easeInOutCubic(animationProgress) : 0;

		// Update all living and spawning cells
		for (const cell of visualCells.values()) {
			// Update phase for wobble
			cell.phase += cell.phaseSpeed * dt;

			// Calculate target position with slight offset based on neighbors
			const baseX = cell.gridX * BASE_CELL_SIZE + BASE_CELL_SIZE / 2;
			const baseY = cell.gridY * BASE_CELL_SIZE + BASE_CELL_SIZE / 2;

			// Add organic wobble (less during animation)
			const wobbleAmount = isAnimating ? 1 : 2;
			const wobbleX = Math.sin(cell.phase) * wobbleAmount;
			const wobbleY = Math.cos(cell.phase * 1.3) * wobbleAmount;

			cell.targetX = baseX + wobbleX;
			cell.targetY = baseY + wobbleY;

			// Handle spawning animation
			if (isAnimating && cell.scale < 1 && !cell.dying) {
				cell.alpha = progress;
				cell.scale = progress;
			} else if (!isAnimating && !cell.dying) {
				cell.alpha = 1;
				cell.scale = 1;
			}

			// Spring physics towards target

			const dx = cell.targetX - cell.x;
			const dy = cell.targetY - cell.y;

			cell.vx += dx * STIFFNESS * dt;
			cell.vy += dy * STIFFNESS * dt;

			cell.vx *= Math.pow(DAMPING, dt);
			cell.vy *= Math.pow(DAMPING, dt);

			cell.x += cell.vx * dt * 60;
			cell.y += cell.vy * dt * 60;
		}

		// Update dying cells
		for (const cell of dyingCells.values()) {
			// Update phase for wobble
			cell.phase += cell.phaseSpeed * dt;

			// Fade out and shrink
			cell.alpha = 1 - progress;
			cell.scale = 1 - progress;

			// Move away from neighbors
			const vector = calculateNeighborVector(cell.gridY, cell.gridX, grid);
			const pushDistance = progress * (BASE_CELL_SIZE / 2);

			cell.targetX = cell.gridX * BASE_CELL_SIZE + BASE_CELL_SIZE / 2 + vector.x * pushDistance;
			cell.targetY = cell.gridY * BASE_CELL_SIZE + BASE_CELL_SIZE / 2 + vector.y * pushDistance;

			const dx = cell.targetX - cell.x;
			const dy = cell.targetY - cell.y;

			cell.vx += dx * STIFFNESS * dt;
			cell.vy += dy * STIFFNESS * dt;

			cell.vx *= Math.pow(DAMPING, dt);
			cell.vy *= Math.pow(DAMPING, dt);

			cell.x += cell.vx * dt * 60;
			cell.y += cell.vy * dt * 60;
		}
	}

	// Metaball field calculation with alpha and scale support
	function calculateMetaballField(x: number, y: number, cells: Map<string, Cell>): number {
		let sum = 0;

		for (const cell of cells.values()) {
			const dx = x - cell.x;
			const dy = y - cell.y;
			const distSq = dx * dx + dy * dy;

			// Metaball formula: r²/d² with alpha and scale modulation
			if (distSq > 0) {
				const effectiveRadius = METABALL_RADIUS * cell.scale;
				sum += ((effectiveRadius * effectiveRadius) / distSq) * cell.alpha;
			}
		}

		return sum;
	}

	// Linear interpolation for marching squares
	function lerp(a: number, b: number, t: number): number {
		return a + (b - a) * t;
	}

	// Calculate interpolated point on edge where field crosses threshold
	function getEdgePoint(
		x1: number,
		y1: number,
		val1: number,
		x2: number,
		y2: number,
		val2: number
	): { x: number; y: number } {
		if (Math.abs(val1 - val2) < 0.001) {
			return { x: (x1 + x2) / 2, y: (y1 + y2) / 2 };
		}
		const t = (METABALL_THRESHOLD - val1) / (val2 - val1);
		return {
			x: lerp(x1, x2, t),
			y: lerp(y1, y2, t)
		};
	}

	// Marching squares implementation for smooth contours
	function drawMetaballs(startRow: number, endRow: number, startCol: number, endCol: number) {
		const startX = startCol * BASE_CELL_SIZE;
		const startY = startRow * BASE_CELL_SIZE;
		const endX = endCol * BASE_CELL_SIZE;
		const endY = endRow * BASE_CELL_SIZE;

		const bufferWidth = Math.ceil((endX - startX) / RENDER_RESOLUTION) + 1;
		const bufferHeight = Math.ceil((endY - startY) / RENDER_RESOLUTION) + 1;

		const field: number[][] = [];

		// Combine living and dying cells for rendering
		const allCells = new Map([...visualCells, ...dyingCells]);

		// Calculate field values
		for (let by = 0; by < bufferHeight; by++) {
			field[by] = [];
			for (let bx = 0; bx < bufferWidth; bx++) {
				const worldX = startX + bx * RENDER_RESOLUTION;
				const worldY = startY + by * RENDER_RESOLUTION;
				field[by][bx] = calculateMetaballField(worldX, worldY, allCells);
			}
		}

		// First pass: fill the interior
		//ctx.fillStyle = 'rgba(80, 220, 140, 0.7)';
		ctx.beginPath();

		for (let by = 0; by < bufferHeight - 1; by++) {
			for (let bx = 0; bx < bufferWidth - 1; bx++) {
				const tl = field[by][bx];
				const tr = field[by][bx + 1];
				const bl = field[by + 1][bx];
				const br = field[by + 1][bx + 1];

				// Simple fill: if center is above threshold, fill this square
				const center = (tl + tr + bl + br) / 4;
				if (center >= METABALL_THRESHOLD) {
					const x = startX + bx * RENDER_RESOLUTION;
					const y = startY + by * RENDER_RESOLUTION;
					ctx.fillRect(x, y, RENDER_RESOLUTION, RENDER_RESOLUTION);
				}
			}
		}

		ctx.fill();

		// Second pass: draw smooth contours using marching squares
		ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
		ctx.lineWidth = 2.5 / zoom_level;
		ctx.lineCap = 'round';
		ctx.lineJoin = 'round';

		for (let by = 0; by < bufferHeight - 1; by++) {
			for (let bx = 0; bx < bufferWidth - 1; bx++) {
				const x = startX + bx * RENDER_RESOLUTION;
				const y = startY + by * RENDER_RESOLUTION;

				const tl = field[by][bx];
				const tr = field[by][bx + 1];
				const bl = field[by + 1][bx];
				const br = field[by + 1][bx + 1];

				// Create marching squares case (4-bit number)
				let caseId = 0;
				if (tl >= METABALL_THRESHOLD) caseId |= 1;
				if (tr >= METABALL_THRESHOLD) caseId |= 2;
				if (br >= METABALL_THRESHOLD) caseId |= 4;
				if (bl >= METABALL_THRESHOLD) caseId |= 8;

				// Skip if all in or all out
				if (caseId === 0 || caseId === 15) continue;

				// Calculate edge points with linear interpolation
				const topPoint = getEdgePoint(x, y, tl, x + RENDER_RESOLUTION, y, tr);
				const rightPoint = getEdgePoint(
					x + RENDER_RESOLUTION,
					y,
					tr,
					x + RENDER_RESOLUTION,
					y + RENDER_RESOLUTION,
					br
				);
				const bottomPoint = getEdgePoint(
					x + RENDER_RESOLUTION,
					y + RENDER_RESOLUTION,
					br,
					x,
					y + RENDER_RESOLUTION,
					bl
				);
				const leftPoint = getEdgePoint(x, y + RENDER_RESOLUTION, bl, x, y, tl);

				// Draw line segments based on case
				ctx.beginPath();

				switch (caseId) {
					case 1:
					case 14:
						ctx.moveTo(topPoint.x, topPoint.y);
						ctx.lineTo(leftPoint.x, leftPoint.y);
						break;
					case 2:
					case 13:
						ctx.moveTo(topPoint.x, topPoint.y);
						ctx.lineTo(rightPoint.x, rightPoint.y);
						break;
					case 3:
					case 12:
						ctx.moveTo(leftPoint.x, leftPoint.y);
						ctx.lineTo(rightPoint.x, rightPoint.y);
						break;
					case 4:
					case 11:
						ctx.moveTo(rightPoint.x, rightPoint.y);
						ctx.lineTo(bottomPoint.x, bottomPoint.y);
						break;
					case 5:
						ctx.moveTo(topPoint.x, topPoint.y);
						ctx.lineTo(rightPoint.x, rightPoint.y);
						ctx.moveTo(leftPoint.x, leftPoint.y);
						ctx.lineTo(bottomPoint.x, bottomPoint.y);
						break;
					case 6:
					case 9:
						ctx.moveTo(topPoint.x, topPoint.y);
						ctx.lineTo(bottomPoint.x, bottomPoint.y);
						break;
					case 7:
					case 8:
						ctx.moveTo(leftPoint.x, leftPoint.y);
						ctx.lineTo(bottomPoint.x, bottomPoint.y);
						break;
					case 10:
						ctx.moveTo(topPoint.x, topPoint.y);
						ctx.lineTo(leftPoint.x, leftPoint.y);
						ctx.moveTo(rightPoint.x, rightPoint.y);
						ctx.lineTo(bottomPoint.x, bottomPoint.y);
						break;
				}

				ctx.stroke();
			}
		}
	}

	// Draw the grid
	function draw() {
		ctx.fillStyle = '#1a1a1a';
		ctx.fillRect(0, 0, width, height);

		ctx.save();
		ctx.translate(pan_offset.x, pan_offset.y);
		ctx.scale(zoom_level, zoom_level);

		const startCol = Math.max(0, Math.floor(-pan_offset.x / zoom_level / BASE_CELL_SIZE) - 2);
		const endCol = Math.min(
			COLS,
			Math.ceil((width - pan_offset.x) / zoom_level / BASE_CELL_SIZE) + 2
		);
		const startRow = Math.max(0, Math.floor(-pan_offset.y / zoom_level / BASE_CELL_SIZE) - 2);
		const endRow = Math.min(
			ROWS,
			Math.ceil((height - pan_offset.y) / zoom_level / BASE_CELL_SIZE) + 2
		);

		// Draw grid lines (optional, subtle)
		if (zoom_level > 0.5) {
			ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
			ctx.lineWidth = 0.5 / zoom_level;
			for (let i = startRow; i <= endRow; i++) {
				ctx.beginPath();
				ctx.moveTo(startCol * BASE_CELL_SIZE, i * BASE_CELL_SIZE);
				ctx.lineTo(endCol * BASE_CELL_SIZE, i * BASE_CELL_SIZE);
				ctx.stroke();
			}
			for (let i = startCol; i <= endCol; i++) {
				ctx.beginPath();
				ctx.moveTo(i * BASE_CELL_SIZE, startRow * BASE_CELL_SIZE);
				ctx.lineTo(i * BASE_CELL_SIZE, endRow * BASE_CELL_SIZE);
				ctx.stroke();
			}
		}

		// Draw organic blobs
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

	// Animation loop
	function animate(currentTime: number) {
		const deltaTime = currentTime - lastFrameTime;
		lastFrameTime = currentTime;

		// Update animation progress
		if (isAnimating) {
			const elapsed = currentTime - animationStartTime;
			animationProgress = Math.min(elapsed / ANIMATION_DURATION, 1);

			if (animationProgress >= 1) {
				completeTransition();
			}
		}

		// Update physics
		updatePhysics(deltaTime);

		draw();

		// Only update grid if playing and not currently animating
		if (isPlaying && !isAnimating && currentTime - lastUpdateTime > UPDATE_INTERVAL) {
			updateGrid();
			lastUpdateTime = currentTime;
		}

		requestAnimationFrame(animate);
	}

	// Handle mouse clicks to toggle cells
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

	function onKeyDown(event: KeyboardEvent) {
		if (event.code === 'Space') {
			event.preventDefault();
			isPlaying = !isPlaying;
			if (isPlaying) {
				lastUpdateTime = performance.now();
			}
			draw();
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
		initGrid();

		const centerRow = Math.floor(ROWS / 2);
		const centerCol = Math.floor(COLS / 2);

		// Glider pattern
		grid[centerRow][centerCol + 1] = true;
		grid[centerRow + 1][centerCol + 2] = true;
		grid[centerRow + 2][centerCol] = true;
		grid[centerRow + 2][centerCol + 1] = true;
		grid[centerRow + 2][centerCol + 2] = true;

		syncVisualCells();
		draw();
	}

	function zoom(direction: 1 | -1, origin: Vector2) {
		const old_zoom = zoom_level;

		if (direction > 0) {
			zoom_level = Math.min(MAX_ZOOM, zoom_level * (1 + ZOOM_SENSITIVITY));
		} else {
			zoom_level = Math.max(MIN_ZOOM, zoom_level * (1 - ZOOM_SENSITIVITY));
		}

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

	// Initialize with glider pattern
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
}
