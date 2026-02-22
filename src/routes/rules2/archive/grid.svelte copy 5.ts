import { getContext, setContext } from 'svelte';

const GRID_RULES_SYMBOL = Symbol('GRID_RULES_SYMBOL');
const BASE_GRID_SIZE = 33;

type Easing = [number, number, number, number];

export class Grid {
	// Svelte 5 Reactive State
	step = $state(0);
	isPlaying = $state(false);

	// Zoom & View State
	targetScale = 1;
	currentScale = 1;

	// Animation state
	private anim = {
		startScale: 1,
		endScale: 1,
		startTime: 0,
		duration: 0,
		easing: [0.25, 0.1, 0.25, 1.0] as Easing
	};

	// Canvas Properties
	canvas!: HTMLCanvasElement;
	ctx!: CanvasRenderingContext2D;
	initialized = false;

	// Grid State — always BASE_GRID_SIZE, never changes
	grid: number[][];

	// Animation & Timing
	lastFrameTime = 0;
	updateInterval = 100;
	animationId = 0;
	transitionId = 0;

	constructor() {
		this.grid = this.createEmptyGrid();
	}

	// --- Derived geometry (recomputed every draw) ---

	private get baseCellSize() {
		// At scale=1, how big is one cell in px so the grid fills the canvas
		const maxDim = Math.max(this.canvas.width, this.canvas.height);
		return maxDim / BASE_GRID_SIZE;
	}

	private get cellSize() {
		return this.baseCellSize * this.currentScale;
	}

	private get visibleCells() {
		// How many cells fit across the canvas at current zoom
		return Math.ceil(BASE_GRID_SIZE / this.currentScale) + 1;
	}

	private get offsetX() {
		// Center the grid on the canvas
		return (this.canvas.width - this.cellSize * BASE_GRID_SIZE) / 2;
	}

	private get offsetY() {
		return (this.canvas.height - this.cellSize * BASE_GRID_SIZE) / 2;
	}

	// --- Steps ---

	private steps: Record<number, () => void> = {
		0: () => {
			this.zoom(0.5);
			this.loadRLE('bo5b$3bo3b$2o2b3o!');
			this.play();
		},
		1: () => {
			this.stop();
			this.clear_grid();
			this.zoom(1);
		},
		2: () => {
			this.loadRLE('bo5b$3bo3b$2o2b3o!');
			this.zoom(2);
		},
		3: () => {
			//this.clear_grid();
			const mid = Math.floor(BASE_GRID_SIZE / 2);
			this.grid[mid][mid] = 1;
			// Zoom so only 3×3 cells are visible
			this.zoom(BASE_GRID_SIZE / 3);
		}
	};

	set_step(num: number) {
		const action = this.steps[num];
		if (action) {
			this.step = num;
			action();
		} else {
			console.warn(`Step ${num} is not defined.`);
		}
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

	// --- Zoom ---

	zoom(newScale: number, duration = 600, easing: Easing = [0.25, 0.1, 0.25, 1.0]) {
		this.targetScale = Math.max(0.1, newScale);

		this.anim = {
			startScale: this.currentScale,
			endScale: this.targetScale,
			startTime: performance.now(),
			duration,
			easing
		};

		if (!this.isPlaying) this.startTransitionLoop();
	}

	// --- Animation Tick ---

	private tickAnim(now: number) {
		const { startScale, endScale, startTime, duration, easing } = this.anim;

		const raw = duration > 0 ? Math.min((now - startTime) / duration, 1) : 1;
		const t = raw < 1 ? this.cubicBezier(...easing, raw) : 1;

		this.currentScale = startScale + (endScale - startScale) * t;
	}

	private isSettled(): boolean {
		return performance.now() >= this.anim.startTime + this.anim.duration;
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

		ctx.clearRect(0, 0, canvas.width, canvas.height);
		ctx.save();
		ctx.translate(offsetX, offsetY);

		// Grid lines — drawn fresh each frame based on current cellSize
		ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
		ctx.lineWidth = 0.5;
		ctx.beginPath();
		for (let i = 0; i <= BASE_GRID_SIZE; i++) {
			const pos = i * cellSize;
			ctx.moveTo(pos, 0);
			ctx.lineTo(pos, cellSize * BASE_GRID_SIZE);
			ctx.moveTo(0, pos);
			ctx.lineTo(cellSize * BASE_GRID_SIZE, pos);
		}
		ctx.stroke();

		// Cells
		ctx.fillStyle = 'white';
		for (let y = 0; y < BASE_GRID_SIZE; y++) {
			for (let x = 0; x < BASE_GRID_SIZE; x++) {
				if (this.grid[y][x] === 1) {
					ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
				}
			}
		}

		ctx.restore();
	}

	// --- Game Logic ---

	update() {
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

	loadRLE(
		rle: string,
		startX = Math.floor(BASE_GRID_SIZE / 3),
		startY = Math.floor(BASE_GRID_SIZE / 3)
	) {
		const cleanRLE = rle.replace(/\s+/g, '');
		let x = startX,
			y = startY,
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
