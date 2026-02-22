import { getContext, setContext } from 'svelte';

const GRID_SIZE = 32;
const GRID_RULES_SYMBOL = Symbol('GRID_RULES_SYMBOL');

type Easing = [number, number, number, number];

export class Grid {
	// Svelte 5 Reactive State
	step = $state(0);
	isPlaying = $state(false);

	// Zoom & View State
	targetScale = 1;
	targetOffsetX = 0;
	targetOffsetY = 0;
	currentScale = 1;
	currentOffsetX = 0;
	currentOffsetY = 0;
	gridOriginX = 0;
	gridOriginY = 0;

	// Animation state
	private anim = {
		startScale: 1,
		endScale: 1,
		startX: 0,
		endX: 0,
		startY: 0,
		endY: 0,
		startTime: 0,
		duration: 0,
		easing: [0.25, 0.1, 0.25, 1.0] as Easing
	};

	// Canvas Properties
	canvas!: HTMLCanvasElement;
	ctx!: CanvasRenderingContext2D;
	offscreenCanvas!: HTMLCanvasElement;
	initialized = false;

	// Grid State
	cellSize = 0;
	grid: number[][];

	// Animation & Timing
	lastFrameTime = 0;
	updateInterval = 100;
	animationId = 0;
	transitionId = 0;

	constructor() {
		this.grid = this.createEmptyGrid();
	}

	// --- Steps ---

	private steps: Record<number, () => void> = {
		0: () => {
			this.zoom(0.5);
			this.loadRLE('bo5b$3bo3b$2o2b3o!');
			this.play();
		},
		1: () => {
			this.stop(); // cancel the loop first
			this.clear_grid(); // then clear, nothing can overwrite it
			this.zoom(2);
		},
		2: () => {
			this.loadRLE('bo5b$3bo3b$2o2b3o!');
			this.zoom(2);
		},
		3: () => {
			this.clear_grid();
			this.grid[GRID_SIZE / 2][GRID_SIZE / 2] = 1;
			this.draw();
			this.zoom(4);
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

		// Always re-center the grid on the canvas at the new scale,
		// so it fills the viewport regardless of zoom level.
		const gridPx = this.cellSize * GRID_SIZE;
		this.targetOffsetX = (this.canvas.width - gridPx * this.targetScale) / 2 - this.gridOriginX;
		this.targetOffsetY = (this.canvas.height - gridPx * this.targetScale) / 2 - this.gridOriginY;

		this.anim = {
			startScale: this.currentScale,
			endScale: this.targetScale,
			startX: this.currentOffsetX,
			endX: this.targetOffsetX,
			startY: this.currentOffsetY,
			endY: this.targetOffsetY,
			startTime: performance.now(),
			duration,
			easing
		};

		if (!this.isPlaying) this.startTransitionLoop();
	}

	// --- Animation Tick ---

	private tickAnim(now: number) {
		const { startScale, endScale, startX, endX, startY, endY, startTime, duration, easing } =
			this.anim;

		const raw = duration > 0 ? Math.min((now - startTime) / duration, 1) : 1;
		const t = raw < 1 ? this.cubicBezier(...easing, raw) : 1;

		this.currentScale = startScale + (endScale - startScale) * t;
		this.currentOffsetX = startX + (endX - startX) * t;
		this.currentOffsetY = startY + (endY - startY) * t;
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

		const maxDim = Math.max(canvas.clientWidth, canvas.clientHeight);
		this.cellSize = maxDim / GRID_SIZE;
		this.gridOriginX = (canvas.clientWidth - maxDim) / 2;
		this.gridOriginY = (canvas.clientHeight - maxDim) / 2;

		this.cacheGridLines();
		this.initialized = true;
		this.draw();
	}

	private cacheGridLines() {
		const gridPx = this.cellSize * GRID_SIZE;
		this.offscreenCanvas = document.createElement('canvas');
		this.offscreenCanvas.width = gridPx;
		this.offscreenCanvas.height = gridPx;
		const oCtx = this.offscreenCanvas.getContext('2d')!;

		oCtx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
		oCtx.lineWidth = 0.5;
		oCtx.beginPath();
		for (let i = 0; i <= GRID_SIZE; i++) {
			const pos = i * this.cellSize;
			oCtx.moveTo(pos, 0);
			oCtx.lineTo(pos, gridPx);
			oCtx.moveTo(0, pos);
			oCtx.lineTo(gridPx, pos);
		}
		oCtx.stroke();
	}

	// --- Draw ---

	draw() {
		if (!this.initialized) return;

		this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
		this.ctx.save();

		this.ctx.translate(this.gridOriginX, this.gridOriginY);
		this.ctx.translate(this.currentOffsetX, this.currentOffsetY);
		this.ctx.scale(this.currentScale, this.currentScale);

		this.ctx.drawImage(this.offscreenCanvas, 0, 0);

		this.ctx.fillStyle = 'white';
		for (let y = 0; y < GRID_SIZE; y++) {
			for (let x = 0; x < GRID_SIZE; x++) {
				if (this.grid[y][x] === 1) {
					this.ctx.fillRect(x * this.cellSize, y * this.cellSize, this.cellSize, this.cellSize);
				}
			}
		}

		this.ctx.restore();
	}

	// --- Game Logic ---

	update() {
		const nextGrid = this.createEmptyGrid();
		for (let y = 0; y < GRID_SIZE; y++) {
			for (let x = 0; x < GRID_SIZE; x++) {
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
				sum += this.grid[(y + j + GRID_SIZE) % GRID_SIZE][(x + i + GRID_SIZE) % GRID_SIZE];
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
		this.offscreenCanvas = null!;
		this.initialized = false;
	}
	// --- Utilities ---

	createEmptyGrid(): number[][] {
		return Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(0));
	}

	loadRLE(rle: string, startX = Math.floor(GRID_SIZE / 3), startY = Math.floor(GRID_SIZE / 3)) {
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
					if (x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE) this.grid[y][x] = state;
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
