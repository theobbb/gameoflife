const MAX_ALPHA = 0.5;
const BASE_CELL_SIZE = 20;

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

	// Metaball parameters
	const METABALL_RADIUS = BASE_CELL_SIZE * 0.4;
	const METABALL_THRESHOLD = 1.0; // Threshold for blob edge
	const RENDER_RESOLUTION = 3; // Lower = more detailed but slower (1 = full res, 2 = half res)

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
	};

	let visualCells: Map<string, Cell> = new Map();

	function initGrid() {
		grid = Array(ROWS)
			.fill(null)
			.map(() => Array(COLS).fill(false));
		nextGrid = Array(ROWS)
			.fill(null)
			.map(() => Array(COLS).fill(false));
		visualCells.clear();
	}

	initGrid();

	// Game state
	let isPlaying = false;
	let lastUpdateTime = 0;
	const UPDATE_INTERVAL = 100; // ms between updates

	// Animation state
	let isAnimating = false;
	let animationProgress = 0;
	const ANIMATION_DURATION = 1000;
	let animationStartTime = 0;

	// Zoom and pan state
	let zoom_level = 4;
	let pan_offset: Vector2 = {
		x: width / 2 - (width * zoom_level) / 2,
		y: height / 2 - (height * zoom_level) / 2
	};
	const MIN_ZOOM = 0.1;
	const MAX_ZOOM = 10;
	const ZOOM_SENSITIVITY = 0.1;

	function cellKey(row: number, col: number): string {
		return `${row},${col}`;
	}

	// Sync visual cells with grid
	function syncVisualCells() {
		const currentKeys = new Set<string>();

		for (let row = 0; row < ROWS; row++) {
			for (let col = 0; col < COLS; col++) {
				if (grid[row][col]) {
					const key = cellKey(row, col);
					currentKeys.add(key);

					if (!visualCells.has(key)) {
						// Create new visual cell
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
							phaseSpeed: 0.5 + Math.random() * 0.5
						});
					}
				}
			}
		}

		// Remove cells that are no longer alive
		for (const [key, cell] of visualCells) {
			if (!currentKeys.has(key)) {
				visualCells.delete(key);
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
	}

	function completeTransition() {
		[grid, nextGrid] = [nextGrid, grid];
		isAnimating = false;
		animationProgress = 0;
		syncVisualCells();
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

		for (const cell of visualCells.values()) {
			// Update phase for wobble
			cell.phase += cell.phaseSpeed * dt;

			// Calculate target position with slight offset based on neighbors
			const baseX = cell.gridX * BASE_CELL_SIZE + BASE_CELL_SIZE / 2;
			const baseY = cell.gridY * BASE_CELL_SIZE + BASE_CELL_SIZE / 2;

			// Add organic wobble
			const wobbleAmount = 2;
			const wobbleX = Math.sin(cell.phase) * wobbleAmount;
			const wobbleY = Math.cos(cell.phase * 1.3) * wobbleAmount;

			cell.targetX = baseX + wobbleX;
			cell.targetY = baseY + wobbleY;

			// Spring physics towards target
			const stiffness = 5;
			const damping = 0.7;

			const dx = cell.targetX - cell.x;
			const dy = cell.targetY - cell.y;

			cell.vx += dx * stiffness * dt;
			cell.vy += dy * stiffness * dt;

			cell.vx *= Math.pow(damping, dt);
			cell.vy *= Math.pow(damping, dt);

			cell.x += cell.vx * dt * 60;
			cell.y += cell.vy * dt * 60;
		}
	}

	// Metaball field calculation
	function calculateMetaballField(x: number, y: number): number {
		let sum = 0;

		for (const cell of visualCells.values()) {
			const dx = x - cell.x;
			const dy = y - cell.y;
			const distSq = dx * dx + dy * dy;

			// Metaball formula: r²/d²
			if (distSq > 0) {
				sum += (METABALL_RADIUS * METABALL_RADIUS) / distSq;
			}
		}

		return sum;
	}

	// Draw using marching squares for smooth outline
	function drawMetaballs(startRow: number, endRow: number, startCol: number, endCol: number) {
		// Create field buffer
		const bufferWidth = Math.ceil(((endCol - startCol) * BASE_CELL_SIZE) / RENDER_RESOLUTION);
		const bufferHeight = Math.ceil(((endRow - startRow) * BASE_CELL_SIZE) / RENDER_RESOLUTION);

		const field: number[][] = [];

		// Calculate field values
		for (let by = 0; by < bufferHeight; by++) {
			field[by] = [];
			for (let bx = 0; bx < bufferWidth; bx++) {
				const worldX = startCol * BASE_CELL_SIZE + bx * RENDER_RESOLUTION;
				const worldY = startRow * BASE_CELL_SIZE + by * RENDER_RESOLUTION;
				field[by][bx] = calculateMetaballField(worldX, worldY);
			}
		}

		// Draw filled blob
		ctx.fillStyle = 'rgba(100, 255, 150, 0.8)';
		ctx.beginPath();

		let pathStarted = false;

		// Simple contour following
		for (let by = 0; by < bufferHeight - 1; by++) {
			for (let bx = 0; bx < bufferWidth - 1; bx++) {
				const tl = field[by][bx] >= METABALL_THRESHOLD;
				const tr = field[by][bx + 1] >= METABALL_THRESHOLD;
				const bl = field[by + 1][bx] >= METABALL_THRESHOLD;
				const br = field[by + 1][bx + 1] >= METABALL_THRESHOLD;

				// If any corner is inside, draw this cell as part of blob
				if (tl || tr || bl || br) {
					const x = startCol * BASE_CELL_SIZE + bx * RENDER_RESOLUTION;
					const y = startRow * BASE_CELL_SIZE + by * RENDER_RESOLUTION;
					ctx.fillRect(x, y, RENDER_RESOLUTION, RENDER_RESOLUTION);
				}
			}
		}

		ctx.fill();

		// Draw outline
		ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
		ctx.lineWidth = 2 / zoom_level;
		ctx.beginPath();

		// Trace contour
		for (let by = 0; by < bufferHeight - 1; by++) {
			for (let bx = 0; bx < bufferWidth - 1; bx++) {
				const tl = field[by][bx] >= METABALL_THRESHOLD;
				const tr = field[by][bx + 1] >= METABALL_THRESHOLD;
				const bl = field[by + 1][bx] >= METABALL_THRESHOLD;
				const br = field[by + 1][bx + 1] >= METABALL_THRESHOLD;

				const x = startCol * BASE_CELL_SIZE + bx * RENDER_RESOLUTION;
				const y = startRow * BASE_CELL_SIZE + by * RENDER_RESOLUTION;

				// Draw edges where threshold crosses
				if (tl !== tr) {
					ctx.moveTo(x + RENDER_RESOLUTION / 2, y);
					ctx.lineTo(x + RENDER_RESOLUTION / 2, y + RENDER_RESOLUTION);
				}
				if (tl !== bl) {
					ctx.moveTo(x, y + RENDER_RESOLUTION / 2);
					ctx.lineTo(x + RENDER_RESOLUTION, y + RENDER_RESOLUTION / 2);
				}
			}
		}

		ctx.stroke();
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
		ctx.fillText(`Cells: ${visualCells.size}`, 10, 80);
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
