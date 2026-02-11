import { page } from '$app/state';
import type { Pattern } from '$lib/types';

const BASE_CELL_SIZE = 20;
const STIFFNESS = 2;
const DAMPING = 0.2;

// Metaball parameters
const METABALL_RADIUS = BASE_CELL_SIZE * 0.4;
const METABALL_RADIUS_SQ = METABALL_RADIUS * METABALL_RADIUS;
const METABALL_THRESHOLD = 1.0;
const RENDER_RESOLUTION = 4;
const INFLUENCE_RADIUS = METABALL_RADIUS * 6.0;

const ANIMATION_DURATION = 500;

// Camera Settings
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 10;
const ZOOM_SENSITIVITY = 0.1;
const CAMERA_SMOOTHING = 0.15; // Higher = Snappier, Lower = Smoother

export function create_canvas(ref: HTMLCanvasElement) {
	const canvas: HTMLCanvasElement = ref;
	const ctx = canvas.getContext('2d', { alpha: false }) as CanvasRenderingContext2D;
	const canvas_rect = canvas.getBoundingClientRect();
	const { width, height } = canvas_rect;
	canvas.width = width;
	canvas.height = height;

	// const pattern: Pattern | null = $derived(page.data.pattern);

	// $inspect(pattern);
	// $effect(() => {
	// 	if (pattern) drawPattern(pattern);
	// });

	type Vector2 = { x: number; y: number };

	let CELL_SIZE = BASE_CELL_SIZE;
	let COLS = Math.floor(width / CELL_SIZE);
	let ROWS = Math.floor(height / CELL_SIZE);

	let grid: boolean[][] = [];
	let nextGrid: boolean[][] = [];

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

	const visualCells: Map<number, Cell> = new Map();
	const dyingCells: Map<number, Cell> = new Map();
	let fieldBuffer = new Float32Array(0);
	let fieldWidth = 0;
	let fieldHeight = 0;

	const encodeKey = (row: number, col: number) => (row << 16) | col;

	// --- CAMERA STATE ---
	// Actual values used for rendering
	let zoom_level = 4;
	let pan_offset: Vector2 = {
		x: width / 2 - (width * zoom_level) / 2,
		y: height / 2 - (height * zoom_level) / 2
	};

	// Target values for smooth animation
	let target_zoom = zoom_level;
	let target_pan: Vector2 = { ...pan_offset };

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

	let isPlaying = false;
	let lastUpdateTime = 0;
	const UPDATE_INTERVAL = 100;

	let isAnimating = false;
	let animationProgress = 0;
	let animationStartTime = 0;

	// --- HELPER FUNCTIONS ---

	function calculateNeighborVector(row: number, col: number, useGrid: boolean[][]): Vector2 {
		let x = 0,
			y = 0;
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
		const mag = Math.sqrt(x * x + y * y);
		return mag > 0 ? { x: x / mag, y: y / mag } : { x, y };
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

				if (isAlive) {
					currentKeys.add(key);
					if (!visualCells.has(key)) {
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

				if (!isAlive && willBeAlive && isAnimating) {
					if (!visualCells.has(key)) {
						const targetX = col * BASE_CELL_SIZE + BASE_CELL_SIZE / 2;
						const targetY = row * BASE_CELL_SIZE + BASE_CELL_SIZE / 2;
						const vector = calculateNeighborVector(row, col, grid);

						visualCells.set(key, {
							gridX: col,
							gridY: row,
							x: targetX - vector.x * BASE_CELL_SIZE,
							y: targetY - vector.y * BASE_CELL_SIZE,
							vx: 0,
							vy: 0,
							targetX,
							targetY,
							phase: Math.random() * Math.PI * 2,
							phaseSpeed: 0.5 + Math.random() * 0.5,
							alpha: 1,
							scale: 0.5,
							dying: false
						});
						currentKeys.add(key);
					}
				}

				if (isAlive && !willBeAlive && isAnimating) {
					const cell = visualCells.get(key);
					if (cell) {
						cell.dying = true;
						const vector = calculateNeighborVector(row, col, nextGrid);
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
		for (const key of dyingCells.keys()) visualCells.delete(key);
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
			const wobbleAmount = isAnimating ? 0.5 : 2;
			const wobbleX = Math.sin(cell.phase) * wobbleAmount;
			const wobbleY = Math.cos(cell.phase * 1.3) * wobbleAmount;

			if (!cell.dying) {
				cell.targetX = cell.gridX * BASE_CELL_SIZE + BASE_CELL_SIZE / 2 + wobbleX;
				cell.targetY = cell.gridY * BASE_CELL_SIZE + BASE_CELL_SIZE / 2 + wobbleY;
				if (isAnimating && cell.scale < 1) cell.scale = lerp(0.5, 1, progress);
				else if (!isAnimating) cell.scale = 1;
			} else {
				cell.targetX += wobbleX * 0.1;
				cell.targetY += wobbleY * 0.1;
				cell.scale = 1 - progress;
				cell.alpha = 1 - progress;
			}

			const dx = cell.targetX - cell.x;
			const dy = cell.targetY - cell.y;
			cell.vx += ((dx * STIFFNESS) / 4) * tSec;
			cell.vy += ((dy * STIFFNESS) / 4) * tSec;

			const d = Math.pow(DAMPING, tSec);
			cell.vx *= d;
			cell.vy *= d;
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

	function drawMetaballs(startRow: number, endRow: number, startCol: number, endCol: number) {
		const startX = startCol * BASE_CELL_SIZE;
		const startY = startRow * BASE_CELL_SIZE;
		const endX = endCol * BASE_CELL_SIZE;
		const endY = endRow * BASE_CELL_SIZE;

		const bufW = Math.ceil((endX - startX) / RENDER_RESOLUTION) + 1;
		const bufH = Math.ceil((endY - startY) / RENDER_RESOLUTION) + 1;
		const reqSize = bufW * bufH;

		if (fieldBuffer.length < reqSize) fieldBuffer = new Float32Array(reqSize);
		else fieldBuffer.fill(0, 0, reqSize);

		fieldWidth = bufW;
		fieldHeight = bufH;

		const iter = visualCells.values();
		let cellResult = iter.next();

		while (!cellResult.done) {
			const cell = cellResult.value;
			cellResult = iter.next();

			if (
				cell.x < startX - INFLUENCE_RADIUS ||
				cell.x > endX + INFLUENCE_RADIUS ||
				cell.y < startY - INFLUENCE_RADIUS ||
				cell.y > endY + INFLUENCE_RADIUS
			)
				continue;

			const r2 = METABALL_RADIUS_SQ * (cell.scale * cell.scale);
			const strength = r2 * cell.alpha;
			if (strength < 0.01) continue;

			const fx = (cell.x - startX) / RENDER_RESOLUTION;
			const fy = (cell.y - startY) / RENDER_RESOLUTION;
			const radiusInUnits = INFLUENCE_RADIUS / RENDER_RESOLUTION;
			const minX = Math.max(0, Math.floor(fx - radiusInUnits));
			const maxX = Math.min(bufW - 1, Math.ceil(fx + radiusInUnits));
			const minY = Math.max(0, Math.floor(fy - radiusInUnits));
			const maxY = Math.min(bufH - 1, Math.ceil(fy + radiusInUnits));

			for (let by = minY; by <= maxY; by++) {
				const rowOffset = by * bufW;
				const worldYPos = startY + by * RENDER_RESOLUTION;
				const dy = worldYPos - cell.y;
				const dy2 = dy * dy;
				for (let bx = minX; bx <= maxX; bx++) {
					const worldXPos = startX + bx * RENDER_RESOLUTION;
					const dx = worldXPos - cell.x;
					const distSq = dx * dx + dy2;
					if (distSq > 0.1) fieldBuffer[rowOffset + bx] += strength / distSq;
					else fieldBuffer[rowOffset + bx] += 100;
				}
			}
		}

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

	// --- NEW: Camera Update Logic (Feature #2) ---
	function updateCamera() {
		// Smoothly interpolate current values towards targets
		// Easing: Exponential decay (fast start, slow end)
		zoom_level += (target_zoom - zoom_level) * CAMERA_SMOOTHING;
		pan_offset.x += (target_pan.x - pan_offset.x) * CAMERA_SMOOTHING;
		pan_offset.y += (target_pan.y - pan_offset.y) * CAMERA_SMOOTHING;

		// Snap if close enough to stop micro-calculations
		if (Math.abs(target_zoom - zoom_level) < 0.001) zoom_level = target_zoom;
		if (Math.abs(target_pan.x - pan_offset.x) < 0.1) pan_offset.x = target_pan.x;
		if (Math.abs(target_pan.y - pan_offset.y) < 0.1) pan_offset.y = target_pan.y;
	}

	function draw() {
		ctx.fillStyle = '#1a1a1a';
		ctx.fillRect(0, 0, width, height);

		ctx.save();
		ctx.translate(pan_offset.x, pan_offset.y);
		ctx.scale(zoom_level, zoom_level);

		const margin = 2;
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
		// ctx.fillStyle = 'white';
		// ctx.font = '14px monospace';
		// ctx.fillText(isPlaying ? 'Playing (Space to pause)' : 'Paused (Space to play)', 10, 20);
		// ctx.fillText('Click to toggle cells | Scroll to zoom', 10, 40);
		// ctx.fillText(`Zoom: ${(zoom_level * 100).toFixed(0)}%`, 10, 60);
	}

	let lastFrameTime = performance.now();

	function animate(currentTime: number) {
		requestAnimationFrame(animate);

		// --- NEW: Feature #1 (Tab visibility fix) ---
		// If the delta time is insanely high (e.g. user came back from another tab),
		// we clamp it. This prevents the physics from exploding.
		let deltaTime = currentTime - lastFrameTime;
		lastFrameTime = currentTime;

		// If hidden, don't update physics or draw (save battery),
		// but keep the loop alive so it resumes instantly.
		if (document.hidden) return;

		// Cap deltaTime to 50ms (20fps equivalent)
		// This ensures that even if there's a lag spike, the physics only
		// steps forward by a small safe amount.
		if (deltaTime > 50) deltaTime = 50;

		if (isAnimating) {
			const elapsed = currentTime - animationStartTime;
			animationProgress = Math.min(elapsed / ANIMATION_DURATION, 1);
			if (animationProgress >= 1) completeTransition();
		}

		updateCamera(); // Apply smooth zoom/pan
		updatePhysics(deltaTime);
		draw();

		if (isPlaying && !isAnimating && currentTime - lastUpdateTime > UPDATE_INTERVAL) {
			updateGrid();
			lastUpdateTime = currentTime;
		}
	}

	// --- NEW: Center View Logic (Feature #3) ---
	function centerView(padding = 50) {
		if (visualCells.size === 0) {
			// Default reset if empty
			target_zoom = 1;
			target_pan = {
				x: width / 2 - (width * 1) / 2,
				y: height / 2 - (height * 1) / 2
			};
			return;
		}

		// 1. Calculate Bounding Box of living cells
		let minX = Infinity,
			minY = Infinity;
		let maxX = -Infinity,
			maxY = -Infinity;

		// Use grid coordinates for stability (x/y positions wobble)
		for (const cell of visualCells.values()) {
			if (cell.dying) continue;
			// Convert grid index to world px
			const cx = cell.gridX * BASE_CELL_SIZE;
			const cy = cell.gridY * BASE_CELL_SIZE;
			if (cx < minX) minX = cx;
			if (cy < minY) minY = cy;
			if (cx > maxX) maxX = cx;
			if (cy > maxY) maxY = cy;
		}

		// Add cell size to max to encompass the full cell
		maxX += BASE_CELL_SIZE;
		maxY += BASE_CELL_SIZE;

		// 2. Determine necessary zoom to fit
		const patternWidth = maxX - minX;
		const patternHeight = maxY - minY;
		const patternCenterX = minX + patternWidth / 2;
		const patternCenterY = minY + patternHeight / 2;

		const availableWidth = width - padding * 2;
		const availableHeight = height - padding * 2;

		const scaleX = availableWidth / patternWidth;
		const scaleY = availableHeight / patternHeight;

		// Pick the stricter scale, clamped to limits
		let newZoom = Math.min(scaleX, scaleY);
		newZoom = Math.max(MIN_ZOOM, Math.min(newZoom, 2.0)); // Don't zoom in TOO much automatically

		// 3. Calculate Pan to center the pattern
		// Formula: Pan = ScreenCenter - (WorldCenter * Zoom)
		const newPanX = width / 2 - patternCenterX * newZoom;
		const newPanY = height / 2 - patternCenterY * newZoom;

		// 4. Set Targets
		target_zoom = newZoom;
		target_pan = { x: newPanX, y: newPanY };
	}

	// Event handlers
	function onVisibilityChange() {
		// Reset the clock when tab becomes visible to prevent huge jumps
		if (!document.hidden) {
			lastFrameTime = performance.now();
		}
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

	function drawPattern(rle_pattern: Pattern) {
		//console.log('drawing...', rle_pattern);
		initGrid();
		const { pattern, width, height } = rle_pattern;
		const startCol = Math.floor((COLS - width) / 2);
		const startRow = Math.floor((ROWS - height) / 2);

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

		// --- NEW: Auto-center the new pattern ---
		centerView(50);
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

		if (event.code === 'KeyC') {
			centerView();
		} // Manual center hotkey
	}

	// --- NEW: Smooth Zoom Logic ---
	function zoom(direction: 1 | -1, origin: Vector2) {
		// We modify the TARGETS, not the current values
		const oldZoom = target_zoom;

		if (direction > 0) {
			target_zoom = Math.min(MAX_ZOOM, target_zoom * (1 + ZOOM_SENSITIVITY));
		} else {
			target_zoom = Math.max(MIN_ZOOM, target_zoom * (1 - ZOOM_SENSITIVITY));
		}

		// Adjust target pan so we zoom towards the mouse cursor
		// Math: NewPan = Mouse - (Mouse - OldPan) * (NewZoom / OldZoom)
		const zoomRatio = target_zoom / oldZoom;
		target_pan.x = origin.x - (origin.x - target_pan.x) * zoomRatio;
		target_pan.y = origin.y - (origin.y - target_pan.y) * zoomRatio;
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

	// Listen for tab visibility changes
	document.addEventListener('visibilitychange', onVisibilityChange);

	const centerRow = Math.floor(ROWS / 2);
	const centerCol = Math.floor(COLS / 2);
	grid[centerRow][centerCol + 1] = true;
	grid[centerRow + 1][centerCol + 2] = true;
	grid[centerRow + 2][centerCol] = true;
	grid[centerRow + 2][centerCol + 1] = true;
	grid[centerRow + 2][centerCol + 2] = true;

	syncVisualCells();
	requestAnimationFrame(animate);

	// Initial centering
	centerView(100);

	return { drawPattern, pause, toggle_play };
}
