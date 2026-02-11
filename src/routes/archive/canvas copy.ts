export function create_canvas(ref: HTMLCanvasElement) {
	const canvas: HTMLCanvasElement = ref;
	const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
	const canvas_rect = canvas.getBoundingClientRect();
	const { width, height } = canvas_rect;
	canvas.width = width;
	canvas.height = height;

	type Vector2 = { x: number; y: number };

	const BASE_CELL_SIZE = 10;
	let CELL_SIZE = BASE_CELL_SIZE;
	let COLS = Math.floor(width / CELL_SIZE);
	let ROWS = Math.floor(height / CELL_SIZE);

	// Create grid
	let grid: boolean[][] = [];
	let nextGrid: boolean[][] = [];

	function initGrid() {
		grid = Array(ROWS)
			.fill(null)
			.map(() => Array(COLS).fill(false));
		nextGrid = Array(ROWS)
			.fill(null)
			.map(() => Array(COLS).fill(false));
	}

	initGrid();

	// Game state
	let isPlaying = false;
	let lastUpdateTime = 0;
	const UPDATE_INTERVAL = 100; // ms between updates

	// Zoom and pan state
	let zoom_level = 4;
	let pan_offset: Vector2 = {
		x: width / 2 - (width * zoom_level) / 2,
		y: height / 2 - (height * zoom_level) / 2
	};
	const MIN_ZOOM = 0.1;
	const MAX_ZOOM = 10;
	const ZOOM_SENSITIVITY = 0.1;

	// Count alive neighbors
	function countNeighbors(row: number, col: number): number {
		let count = 0;
		for (let i = -1; i <= 1; i++) {
			for (let j = -1; j <= 1; j++) {
				if (i === 0 && j === 0) continue;

				const newRow = row + i;
				const newCol = col + j;

				// Wrap around edges (toroidal topology)
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

				// Conway's rules:
				// 1. Any live cell with 2-3 neighbors survives
				// 2. Any dead cell with exactly 3 neighbors becomes alive
				// 3. All other cells die or stay dead
				if (isAlive) {
					nextGrid[row][col] = neighbors === 2 || neighbors === 3;
				} else {
					nextGrid[row][col] = neighbors === 3;
				}
			}
		}

		// Swap grids
		[grid, nextGrid] = [nextGrid, grid];
	}

	// Convert screen coordinates to grid coordinates
	function screenToGrid(screenX: number, screenY: number): { col: number; row: number } {
		const worldX = (screenX - pan_offset.x) / zoom_level;
		const worldY = (screenY - pan_offset.y) / zoom_level;
		const col = Math.floor(worldX / BASE_CELL_SIZE);
		const row = Math.floor(worldY / BASE_CELL_SIZE);
		return { col, row };
	}

	// Draw the grid
	function draw() {
		// Clear canvas
		ctx.fillStyle = '#1a1a1a';
		ctx.fillRect(0, 0, width, height);

		// Save context and apply transformations
		ctx.save();
		ctx.translate(pan_offset.x, pan_offset.y);
		ctx.scale(zoom_level, zoom_level);

		// Calculate visible range
		const startCol = Math.max(0, Math.floor(-pan_offset.x / zoom_level / BASE_CELL_SIZE) - 1);
		const endCol = Math.min(
			COLS,
			Math.ceil((width - pan_offset.x) / zoom_level / BASE_CELL_SIZE) + 1
		);
		const startRow = Math.max(0, Math.floor(-pan_offset.y / zoom_level / BASE_CELL_SIZE) - 1);
		const endRow = Math.min(
			ROWS,
			Math.ceil((height - pan_offset.y) / zoom_level / BASE_CELL_SIZE) + 1
		);

		// Draw cells
		ctx.fillStyle = '#00ff00';
		for (let row = startRow; row < endRow; row++) {
			for (let col = startCol; col < endCol; col++) {
				if (grid[row][col]) {
					ctx.fillRect(
						col * BASE_CELL_SIZE,
						row * BASE_CELL_SIZE,
						BASE_CELL_SIZE - 1,
						BASE_CELL_SIZE - 1
					);
				}
			}
		}

		// Draw grid lines (only if zoomed in enough)
		if (zoom_level > 0.5) {
			ctx.strokeStyle = '#2a2a2a';
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

		ctx.restore();

		// Draw status (not affected by zoom)
		ctx.fillStyle = 'white';
		ctx.font = '14px monospace';
		ctx.fillText(isPlaying ? 'Playing (Space to pause)' : 'Paused (Space to play)', 10, 20);
		ctx.fillText('Click to toggle cells | Scroll to zoom', 10, 40);
		ctx.fillText(`Zoom: ${(zoom_level * 100).toFixed(0)}%`, 10, 60);
	}

	// Animation loop
	function animate(currentTime: number) {
		if (isPlaying && currentTime - lastUpdateTime > UPDATE_INTERVAL) {
			updateGrid();
			lastUpdateTime = currentTime;
		}
		draw();
		requestAnimationFrame(animate);
	}

	// Handle mouse clicks to toggle cells
	function onClick(event: MouseEvent) {
		const x = event.clientX - canvas_rect.left;
		const y = event.clientY - canvas_rect.top;

		const { col, row } = screenToGrid(x, y);

		if (row >= 0 && row < ROWS && col >= 0 && col < COLS) {
			grid[row][col] = !grid[row][col];
			draw();
		}
	}

	// Handle mouse drag to add cells
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
				draw();
			}
		}
	}

	// Handle spacebar to toggle play/pause
	function onKeyDown(event: KeyboardEvent) {
		if (event.code === 'Space') {
			event.preventDefault();
			isPlaying = !isPlaying;
			if (isPlaying) {
				lastUpdateTime = performance.now();
			}
			draw();
		}
	}

	function zoom(direction: 1 | -1, origin: Vector2) {
		const old_zoom = zoom_level;

		// Calculate new zoom level
		if (direction > 0) {
			zoom_level = Math.min(MAX_ZOOM, zoom_level * (1 + ZOOM_SENSITIVITY));
		} else {
			zoom_level = Math.max(MIN_ZOOM, zoom_level * (1 - ZOOM_SENSITIVITY));
		}

		// Adjust pan offset to keep the mouse position fixed
		// Formula: new_offset = mouse_pos - (mouse_pos - old_offset) * (new_zoom / old_zoom)
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

	// Add event listeners
	canvas.addEventListener('mousedown', onMouseDown);
	canvas.addEventListener('mouseup', onMouseUp);
	canvas.addEventListener('mousemove', onMouseMove);
	canvas.addEventListener('wheel', on_mouse_wheel);
	window.addEventListener('keydown', onKeyDown);

	// Start animation loop
	draw();
	requestAnimationFrame(animate);

	// Add some initial patterns (optional - glider)
	const centerRow = Math.floor(ROWS / 2);
	const centerCol = Math.floor(COLS / 2);

	// Glider pattern
	grid[centerRow][centerCol + 1] = true;
	grid[centerRow + 1][centerCol + 2] = true;
	grid[centerRow + 2][centerCol] = true;
	grid[centerRow + 2][centerCol + 1] = true;
	grid[centerRow + 2][centerCol + 2] = true;

	draw();
}
