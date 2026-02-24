import { getContext, setContext } from 'svelte';

const GRID_RULES_SYMBOL = Symbol('GRID_RULES_SYMBOL');
const BASE_GRID_SIZE = 33;

export const CELL_COLOR = 'rgba(255, 255, 255, 0.9)';
export const GRID_COLOR = 'rgba(150, 150, 150, 1)';

const HOVER_SCALE = 0.8;
const HOVER_ACTIVE_COLOR = 'rgba(0, 0, 0, 0.3)';
const HOVER_INACTIVE_COLOR = 'rgba(255, 255, 255, 0.1)';

// steps
const MAIN_RLE = 'bo5b$3bo3b$2o2b3o!';
export const GENS_DURATION = 1000;

type Easing = [number, number, number, number];

export class Grid {
	// Svelte 5 Reactive State
	step = $state(0);
	isPlaying = $state(false);
	generationCount = $state(0);
	maxGenerations = $state(0); // 0 = unlimited

	// Zoom state — driven by visibleTiles
	currentScale = 1;
	private anim = {
		startScale: 1,
		endScale: 1,
		startTime: 0,
		duration: 0,
		easing: [0.25, 0.1, 0.25, 1.0] as Easing
	};

	// Pan state — offsets in cell units, centered on grid by default (0, 0)
	private pan = { x: 0, y: 0 };
	private panAnim = {
		startX: 0,
		startY: 0,
		endX: 0,
		endY: 0,
		startTime: 0,
		duration: 0,
		easing: [0.25, 0.1, 0.25, 1.0] as Easing
	};

	// Canvas
	canvas!: HTMLCanvasElement;
	ctx!: CanvasRenderingContext2D;
	initialized = false;

	// Grid
	grid: number[][];

	// Timing
	lastFrameTime = 0;
	updateInterval = 100;
	animationId = 0;
	transitionId = 0;

	// --- Steps ---

	private steps: Record<number, () => (() => void) | void> = {
		0: () => {
			this.clear_grid();
			this.updateInterval = 100;
			this.maxGenerations = 0;
			this.loadRLE(MAIN_RLE);
			this.setVisibleTiles(42);
			this.play();
			return () => {
				this.stop();
			};
		},
		// grid
		1: () => {
			this.clear_grid();
			this.setVisibleTiles(16);
		},
		// cells
		2: () => {
			this.loadRLE(MAIN_RLE);
			this.setVisibleTiles(16);
		},
		// neighbours
		3: () => {
			this.loadRLE(MAIN_RLE);
			const mid = Math.floor(BASE_GRID_SIZE / 2);
			// this.grid[mid][mid] = 1;

			this.setVisibleTiles(3);
		},
		// gens
		4: () => {
			this.loadRLE(MAIN_RLE);
			const mid = Math.floor(BASE_GRID_SIZE / 2);

			this.updateInterval = GENS_DURATION; // slow motion
			this.maxGenerations = 5; // stop after 5 generations
			this.generationCount = 0;
			this.setVisibleTiles(16);
			this.play();
			this.clearAllHovers();
			return () => {
				this.stop();
				this.generationCount = 0;
			};
		},
		// title 2
		5: () => {
			this.loadRLE(MAIN_RLE);
			this.setVisibleTiles(42);

			this.stop();

			//this.play();
		},
		// count neighbours
		6: () => {
			this.loadRLE('3b$bob$3b');
			this.hover_neighbours();
			return () => {
				this.cancelHoverSequence();
				this.clearAllHovers();
			};
		},
		// 2-3
		7: () => {
			this.loadRLE('bbo$bob$bob');
			this.hover_neighbours();
			return () => {
				this.cancelHoverSequence();
				this.clearAllHovers();
			};
		},
		// 0-1
		8: () => {
			this.loadRLE('3b$bob$bbo');
			this.hover_neighbours();
			return () => {
				this.cancelHoverSequence();
				this.clearAllHovers();
			};
		},
		// 4+
		9: () => {
			this.loadRLE('bob$ooo$oob');
			this.hover_neighbours();
			return () => {
				this.cancelHoverSequence();
				this.clearAllHovers();
			};
		},
		// finally
		10: () => {
			this.resetFocus(500);
			this.loadRLE('bob$ooo$oob');
			this.setVisibleTiles(8);

			// Collect all dead cells in the visible 16x16 region centered on the grid
			const half = 4;
			const mid = Math.floor(BASE_GRID_SIZE / 2);
			const startX = mid - half;
			const startY = mid - half;

			const dead_cells: Array<[number, number]> = [];
			for (let y = startY; y < startY + 9; y++) {
				for (let x = startX; x < startX + 9; x++) {
					if (this.grid[y][x] === 0) {
						dead_cells.push([x, y]);
					}
				}
			}

			this.hoverCellSequence(dead_cells, 300, [0.25, 0.1, 0.25, 1.0], 20);

			return () => {
				this.cancelHoverSequence();
				this.clearAllHovers();
			};
		},
		// focus a dead cell
		11: () => {
			// Keep the same RLE as step 10
			this.loadRLE('bob$ooo$oob');

			const mid = Math.floor(BASE_GRID_SIZE / 2);
			const targetX = mid + 1;
			const targetY = mid + 1;

			// Zoom in tight and pan so the dead cell is centered
			this.setVisibleTiles(3, 700, [0.4, 0, 0.2, 1.0]);
			this.focusCell(targetX, targetY, 700, [0.4, 0, 0.2, 1.0]);

			// Hover the dead cell after the pan settles
			const id = setTimeout(() => {
				this.hoverCell(targetX, targetY, 400);
			}, 400);

			return () => {
				clearTimeout(id);
				this.clearAllHovers();
			};
		},
		12: () => {
			this.setVisibleTiles(42);
			this.clear_grid();
		}
	};

	private cleanup: (() => void) | null = null;

	set_step(num: number) {
		const action = this.steps[num];
		if (!action) {
			console.warn(`Step ${num} is not defined.`);
			return;
		}

		// Run previous step's cleanup if it returned one
		this.cleanup?.();
		this.cleanup = null;

		this.step = num;
		const result = action();

		// If the step returned a function, store it as the cleanup
		if (typeof result === 'function') {
			this.cleanup = result;
		}
	}

	// --- Hover state ---
	private hovers = new Map<
		string,
		{
			x: number;
			y: number;
			progress: number;
			direction: 1 | -1;
			duration: number;
			easing: Easing;
			animId: number;
			startTime: number;
			startProgress: number;
		}
	>();

	constructor() {
		this.grid = this.createEmptyGrid();
	}

	// --- Derived geometry ---

	private get cellSize() {
		const maxDim = Math.max(this.canvas.width, this.canvas.height);
		return (maxDim / BASE_GRID_SIZE) * this.currentScale;
	}

	private get offsetX() {
		return (this.canvas.width - this.cellSize * BASE_GRID_SIZE) / 2 + this.pan.x * this.cellSize;
	}

	private get offsetY() {
		return (this.canvas.height - this.cellSize * BASE_GRID_SIZE) / 2 + this.pan.y * this.cellSize;
	}

	// --- Progress (0–1) for use in CSS progress bars ---

	get progress(): number {
		if (this.maxGenerations === 0) return 0;
		return Math.min(this.generationCount / this.maxGenerations, 1);
	}

	// --- Visible tiles API ---

	setVisibleTiles(tiles: number, duration = 600, easing: Easing = [0.25, 0.1, 0.25, 1.0]) {
		const targetScale = BASE_GRID_SIZE / tiles;

		this.anim = {
			startScale: this.currentScale,
			endScale: targetScale,
			startTime: performance.now(),
			duration,
			easing
		};

		if (!this.isPlaying) this.startTransitionLoop();
	}

	/**
	 * Smoothly pan so that cell (cellX, cellY) is centered in the canvas.
	 * Pan is expressed as a grid-unit offset applied to the default centered offsetX/Y.
	 */
	focusCell(cellX: number, cellY: number, duration = 600, easing: Easing = [0.25, 0.1, 0.25, 1.0]) {
		// The default center of the grid (in cell units) is BASE_GRID_SIZE / 2 - 0.5
		const gridCenter = (BASE_GRID_SIZE - 1) / 2;
		const targetPanX = gridCenter - cellX;
		const targetPanY = gridCenter - cellY;

		this.panAnim = {
			startX: this.pan.x,
			startY: this.pan.y,
			endX: targetPanX,
			endY: targetPanY,
			startTime: performance.now(),
			duration,
			easing
		};

		if (!this.isPlaying) this.startTransitionLoop();
	}

	/** Reset pan back to centered (0, 0) */
	resetFocus(duration = 600, easing: Easing = [0.25, 0.1, 0.25, 1.0]) {
		this.focusCell((BASE_GRID_SIZE - 1) / 2, (BASE_GRID_SIZE - 1) / 2, duration, easing);
	}

	// --- Easing ---

	private cubicBezier(p1x: number, p1y: number, p2x: number, p2y: number, x: number): number {
		const cx = 3 * p1x,
			bx = 3 * (p2x - p1x) - cx,
			ax = 1 - cx - bx;
		const cy = 3 * p1y,
			by = 3 * (p2y - p1y) - cy,
			ay = 1 - cy - by;

		const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
		const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
		const derivX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;

		let t = x;
		for (let i = 0; i < 8; i++) {
			const err = sampleX(t) - x;
			if (Math.abs(err) < 1e-6) break;
			t -= err / derivX(t);
		}
		return sampleY(t);
	}

	hover_neighbours() {
		this.setVisibleTiles(3);
		const mid = Math.floor(BASE_GRID_SIZE / 2);
		this.hoverCellSequence(
			[
				[mid - 1, mid - 1],
				[mid, mid - 1],
				[mid + 1, mid - 1],
				[mid - 1, mid],
				[mid + 1, mid],
				[mid - 1, mid + 1],
				[mid, mid + 1],
				[mid + 1, mid + 1]
			],
			300,
			[0.25, 0.1, 0.25, 1.0],
			300
		);
	}

	private hoverKey(x: number, y: number) {
		return `${x},${y}`;
	}

	hoverCell(x: number, y: number, duration = 300, easing: Easing = [0.25, 0.1, 0.25, 1.0]) {
		const key = this.hoverKey(x, y);
		const existing = this.hovers.get(key);

		if (existing) cancelAnimationFrame(existing.animId);

		const entry = {
			x,
			y,
			progress: existing ? existing.progress : 0,
			startProgress: existing ? existing.progress : 0,
			direction: 1 as const,
			duration,
			easing,
			animId: 0,
			startTime: performance.now()
		};

		this.hovers.set(key, entry);
		this.runHoverAnim(key);
	}
	private hoverSequenceTimeouts: ReturnType<typeof setTimeout>[] = [];

	hoverCellSequence(
		cells: Array<[number, number]>,
		duration = 300,
		easing: Easing = [0.25, 0.1, 0.25, 1.0],
		staggerDelay = 100
	) {
		this.cancelHoverSequence();
		cells.forEach(([x, y], i) => {
			const id = setTimeout(() => {
				this.hoverCell(x, y, duration, easing);
			}, i * staggerDelay);
			this.hoverSequenceTimeouts.push(id);
		});
	}
	cancelHoverSequence() {
		this.hoverSequenceTimeouts.forEach(clearTimeout);
		this.hoverSequenceTimeouts = [];
	}

	clearHover(x: number, y: number, duration?: number, easing?: Easing) {
		const key = this.hoverKey(x, y);
		const existing = this.hovers.get(key);
		if (!existing) return;

		cancelAnimationFrame(existing.animId);

		this.hovers.set(key, {
			...existing,
			direction: -1,
			startTime: performance.now(),
			startProgress: existing.progress,
			duration: duration ?? existing.duration,
			easing: easing ?? existing.easing
		});

		this.runHoverAnim(key);
	}

	clearAllHovers(duration?: number, easing?: Easing) {
		for (const { x, y } of this.hovers.values()) {
			this.clearHover(x, y, duration, easing);
		}
	}

	private runHoverAnim(key: string) {
		const tick = (now: number) => {
			const entry = this.hovers.get(key);
			if (!entry) return;

			const elapsed = now - entry.startTime;
			const raw = Math.min(elapsed / entry.duration, 1);
			const t = raw < 1 ? this.cubicBezier(...entry.easing, raw) : 1;

			if (entry.direction === 1) {
				entry.progress = entry.startProgress + (1 - entry.startProgress) * t;
			} else {
				entry.progress = entry.startProgress * (1 - t);
			}

			if (!this.isPlaying) this.draw();

			if (raw < 1) {
				entry.animId = requestAnimationFrame(tick);
			} else if (entry.direction === -1) {
				this.hovers.delete(key);
			}
		};

		const entry = this.hovers.get(key);
		if (entry) entry.animId = requestAnimationFrame(tick);
	}

	// --- Animation ---

	private tickAnim(now: number) {
		// Scale
		{
			const { startScale, endScale, startTime, duration, easing } = this.anim;
			const raw = duration > 0 ? Math.min((now - startTime) / duration, 1) : 1;
			const t = raw < 1 ? this.cubicBezier(...easing, raw) : 1;
			this.currentScale = startScale + (endScale - startScale) * t;
		}
		// Pan
		{
			const { startX, startY, endX, endY, startTime, duration, easing } = this.panAnim;
			const raw = duration > 0 ? Math.min((now - startTime) / duration, 1) : 1;
			const t = raw < 1 ? this.cubicBezier(...easing, raw) : 1;
			this.pan.x = startX + (endX - startX) * t;
			this.pan.y = startY + (endY - startY) * t;
		}
	}

	private isSettled(): boolean {
		const now = performance.now();
		return (
			now >= this.anim.startTime + this.anim.duration &&
			now >= this.panAnim.startTime + this.panAnim.duration
		);
	}

	private startTransitionLoop() {
		cancelAnimationFrame(this.transitionId);
		const loop = (now: number) => {
			this.tickAnim(now);
			this.draw();
			if (!this.isSettled()) this.transitionId = requestAnimationFrame(loop);
		};
		this.transitionId = requestAnimationFrame(loop);
	}

	// --- Mount ---

	mount(canvas: HTMLCanvasElement) {
		if (this.initialized) return;
		this.canvas = canvas;
		this.ctx = canvas.getContext('2d', { alpha: true }) as CanvasRenderingContext2D;
		this.canvas.width = canvas.clientWidth;
		this.canvas.height = canvas.clientHeight;
		this.initialized = true;
		this.draw();
	}

	// --- Draw ---

	draw() {
		if (!this.initialized) return;

		const { ctx, canvas, cellSize, offsetX, offsetY } = this;
		const gridPx = cellSize * BASE_GRID_SIZE;

		ctx.clearRect(0, 0, canvas.width, canvas.height);
		ctx.save();
		ctx.translate(offsetX, offsetY);

		// Grid lines
		ctx.strokeStyle = GRID_COLOR;
		ctx.lineWidth = 0.5;
		ctx.beginPath();
		for (let i = 0; i <= BASE_GRID_SIZE; i++) {
			const pos = i * cellSize;
			ctx.moveTo(pos, 0);
			ctx.lineTo(pos, gridPx);
			ctx.moveTo(0, pos);
			ctx.lineTo(gridPx, pos);
		}
		ctx.stroke();

		// Cells
		ctx.fillStyle = CELL_COLOR;
		for (let y = 0; y < BASE_GRID_SIZE; y++) {
			for (let x = 0; x < BASE_GRID_SIZE; x++) {
				if (this.grid[y][x] === 1) {
					ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
				}
			}
		}
		const hover_size = cellSize * HOVER_SCALE;
		const hover_offset = (cellSize - hover_size) / 2;

		// Hover highlights
		for (const { x, y, progress } of this.hovers.values()) {
			if (progress <= 0) continue;
			const isAlive = this.grid[y][x] === 1;
			ctx.save();
			ctx.globalAlpha = progress;
			ctx.fillStyle = isAlive ? HOVER_ACTIVE_COLOR : HOVER_INACTIVE_COLOR;
			ctx.fillRect(
				x * cellSize + hover_offset,
				y * cellSize + hover_offset,
				hover_size,
				hover_size
			);
			ctx.restore();
		}
		ctx.restore();
	}

	// --- Game Logic ---

	update() {
		// Stop if generation limit reached
		if (this.maxGenerations > 0 && this.generationCount >= this.maxGenerations) {
			this.stop();
			return;
		}

		const nextGrid = this.createEmptyGrid();
		for (let y = 0; y < BASE_GRID_SIZE; y++) {
			for (let x = 0; x < BASE_GRID_SIZE; x++) {
				const neighbors = this.countNeighbors(x, y);
				const isAlive = this.grid[y][x] === 1;
				if (isAlive && (neighbors === 2 || neighbors === 3)) {
					nextGrid[y][x] = 1;
				} else if (!isAlive && neighbors === 3) {
					nextGrid[y][x] = 1;
				}
			}
		}
		this.grid = nextGrid;
		this.generationCount++;
	}

	countNeighbors(x: number, y: number): number {
		let sum = 0;
		for (let i = -1; i < 2; i++) {
			for (let j = -1; j < 2; j++) {
				if (i === 0 && j === 0) continue;
				sum +=
					this.grid[(y + j + BASE_GRID_SIZE) % BASE_GRID_SIZE][
						(x + i + BASE_GRID_SIZE) % BASE_GRID_SIZE
					];
			}
		}
		return sum;
	}

	// --- Playback ---

	animate = (now: number) => {
		if (!this.isPlaying) return;
		this.animationId = requestAnimationFrame(this.animate);
		this.tickAnim(now);
		if (now - this.lastFrameTime >= this.updateInterval) {
			this.update();
			this.lastFrameTime = now;
		}
		this.draw();
	};

	play() {
		if (this.isPlaying) return;
		cancelAnimationFrame(this.transitionId);
		this.isPlaying = true;
		this.lastFrameTime = performance.now();
		this.animate(this.lastFrameTime);
	}

	stop() {
		this.isPlaying = false;
		cancelAnimationFrame(this.animationId);
	}

	clear_grid() {
		this.grid = this.createEmptyGrid();
		if (!this.isPlaying && this.initialized) this.draw();
	}

	destroy() {
		this.stop();
		cancelAnimationFrame(this.animationId);
		cancelAnimationFrame(this.transitionId);
		this.ctx = null!;
		this.canvas = null!;
		this.initialized = false;
	}

	// --- Utilities ---

	createEmptyGrid(): number[][] {
		return Array.from({ length: BASE_GRID_SIZE }, () => Array(BASE_GRID_SIZE).fill(0));
	}

	loadRLE(rle: string) {
		this.clear_grid();
		const cleanRLE = rle.replace(/\s+/g, '');

		// First pass: measure pattern dimensions
		let maxX = 0,
			curX = 0,
			curY = 0,
			countStr = '';
		for (const char of cleanRLE) {
			if (char >= '0' && char <= '9') {
				countStr += char;
			} else if (char === 'b' || char === 'o') {
				curX += countStr === '' ? 1 : parseInt(countStr, 10);
				if (curX > maxX) maxX = curX;
				countStr = '';
			} else if (char === '$') {
				curY += countStr === '' ? 1 : parseInt(countStr, 10);
				curX = 0;
				countStr = '';
			} else if (char === '!') break;
		}
		const patternWidth = maxX;
		const patternHeight = curY + 1;

		// Center the pattern
		const startX = Math.floor((BASE_GRID_SIZE - patternWidth) / 2);
		const startY = Math.floor((BASE_GRID_SIZE - patternHeight) / 2);

		// Second pass: render (same as before, but using computed start)
		let x = startX,
			y = startY;
		countStr = '';
		for (const char of cleanRLE) {
			if (char >= '0' && char <= '9') {
				countStr += char;
			} else if (char === 'b' || char === 'o') {
				const count = countStr === '' ? 1 : parseInt(countStr, 10);
				const state = char === 'o' ? 1 : 0;
				for (let c = 0; c < count; c++) {
					if (x >= 0 && x < BASE_GRID_SIZE && y >= 0 && y < BASE_GRID_SIZE) this.grid[y][x] = state;
					x++;
				}
				countStr = '';
			} else if (char === '$') {
				y += countStr === '' ? 1 : parseInt(countStr, 10);
				x = startX;
				countStr = '';
			} else if (char === '!') break;
		}

		if (!this.isPlaying && this.initialized) this.draw();
	}
}

export function init_grid() {
	return setContext(GRID_RULES_SYMBOL, new Grid());
}

export function get_grid() {
	const store = getContext<Grid>(GRID_RULES_SYMBOL);
	if (!store) throw new Error('GRID_RULES_SYMBOL not initialized');
	return store;
}
