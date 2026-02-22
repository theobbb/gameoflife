import { getContext, setContext } from 'svelte';

const GRID_SIZE = 32;
const GRID_RULES_SYMBOL = Symbol('GRID_RULES_SYMBOL');

export class Grid {
	// Svelte 5 Reactive State
	step = $state(0);
	isPlaying = $state(false);

	// Zoom & View State — targets are set instantly, "current" values lerp toward them
	targetScale = 1;
	currentScale = 1;
	targetOffsetX = 0;
	targetOffsetY = 0;
	currentOffsetX = 0;
	currentOffsetY = 0;
	gridOriginX = 0;
	gridOriginY = 0;

	// How fast the lerp moves: higher = snappier, lower = floatier
	readonly LERP_SPEED = 8; // units: per second

	// Canvas Properties
	canvas!: HTMLCanvasElement;
	ctx!: CanvasRenderingContext2D;
	offscreenCanvas!: HTMLCanvasElement;
	initialized = false;

	// Grid State
	cellSize: number = 0;
	grid: number[][];

	// Animation & Timing
	lastFrameTime = 0;
	lastRenderTime = 0;
	updateInterval = 100;
	animationId: number = 0;
	transitionId: number = 0;

	constructor() {
		this.grid = this.createEmptyGrid();
	}

	private steps: Record<number, () => void> = {
		0: () => {
			this.loadRLE('bo5b$3bo3b$2o2b3o!');
		},
		1: () => {
			this.zoom(2);
		},
		2: () => {
			this.zoom(1);
		},
		3: () => {}
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

	// --- Zoom Logic ---

	zoom(newScale: number) {
		const oldTarget = this.targetScale;
		this.targetScale = Math.max(0.1, newScale);

		// Focal point: center of canvas
		const cx = this.canvas.width / 2;
		const cy = this.canvas.height / 2;

		// Adjust target offsets so zoom feels anchored to center
		const ratio = this.targetScale / oldTarget;
		this.targetOffsetX = cx - (cx - this.targetOffsetX) * ratio;
		this.targetOffsetY = cy - (cy - this.targetOffsetY) * ratio;

		if (!this.isPlaying) {
			this.startTransitionLoop();
		}
	}

	private isSettled(): boolean {
		return (
			Math.abs(this.targetScale - this.currentScale) < 0.0005 &&
			Math.abs(this.targetOffsetX - this.currentOffsetX) < 0.05 &&
			Math.abs(this.targetOffsetY - this.currentOffsetY) < 0.05
		);
	}

	private startTransitionLoop() {
		cancelAnimationFrame(this.transitionId);
		this.lastRenderTime = performance.now();
		const loop = (now: number) => {
			const dt = Math.min((now - this.lastRenderTime) / 1000, 0.1); // seconds, clamped
			this.lastRenderTime = now;
			this.lerpView(dt);
			this.draw();
			if (!this.isSettled()) {
				this.transitionId = requestAnimationFrame(loop);
			}
		};
		this.transitionId = requestAnimationFrame(loop);
	}

	/**
	 * Exponential lerp that is frame-rate independent.
	 * Formula: current += (target - current) * (1 - e^(-speed * dt))
	 */
	private lerpView(dt: number) {
		const t = 1 - Math.exp(-this.LERP_SPEED * dt);
		this.currentScale += (this.targetScale - this.currentScale) * t;
		this.currentOffsetX += (this.targetOffsetX - this.currentOffsetX) * t;
		this.currentOffsetY += (this.targetOffsetY - this.currentOffsetY) * t;

		// Snap to target when close enough to avoid infinite creep
		if (Math.abs(this.targetScale - this.currentScale) < 0.0005)
			this.currentScale = this.targetScale;
		if (Math.abs(this.targetOffsetX - this.currentOffsetX) < 0.05)
			this.currentOffsetX = this.targetOffsetX;
		if (Math.abs(this.targetOffsetY - this.currentOffsetY) < 0.05)
			this.currentOffsetY = this.targetOffsetY;
	}

	// --- Core Methods ---

	mount(canvas: HTMLCanvasElement) {
		if (this.initialized) return;

		this.canvas = canvas;
		this.ctx = canvas.getContext('2d', { alpha: true }) as CanvasRenderingContext2D;

		this.canvas.width = canvas.clientWidth;
		this.canvas.height = canvas.clientHeight;

		const maxDim = Math.max(canvas.clientWidth, canvas.clientHeight);
		this.cellSize = maxDim / GRID_SIZE;

		// No gridOriginX/Y needed — grid is larger than canvas and clips naturally
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

	draw() {
		if (!this.initialized) return;

		this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
		this.ctx.save();

		// First, shift to center the square grid in the canvas
		this.ctx.translate(this.gridOriginX, this.gridOriginY);

		// Then apply user pan/zoom on top
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
				const col = (x + i + GRID_SIZE) % GRID_SIZE;
				const row = (y + j + GRID_SIZE) % GRID_SIZE;
				sum += this.grid[row][col];
			}
		}
		return sum;
	}

	animate = (now: number) => {
		if (!this.isPlaying) return;
		this.animationId = requestAnimationFrame(this.animate);

		const dt = Math.min((now - this.lastRenderTime) / 1000, 0.1);
		this.lastRenderTime = now;
		this.lerpView(dt);

		if (now - this.lastFrameTime >= this.updateInterval) {
			this.update();
			this.lastFrameTime = now;
		}

		this.draw();
	};

	play() {
		if (this.isPlaying) return;
		cancelAnimationFrame(this.transitionId); // hand off rendering to animate loop
		this.isPlaying = true;
		this.lastFrameTime = performance.now();
		this.lastRenderTime = performance.now();
		this.animate(this.lastFrameTime);
	}

	stop() {
		this.isPlaying = false;
		cancelAnimationFrame(this.animationId);
	}

	// --- Utilities ---

	createEmptyGrid(): number[][] {
		return Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(0));
	}

	loadRLE(rle: string, startX = Math.floor(GRID_SIZE / 3), startY = Math.floor(GRID_SIZE / 3)) {
		const cleanRLE = rle.replace(/\s+/g, '');
		let currentX = startX;
		let currentY = startY;
		let countStr = '';

		for (let i = 0; i < cleanRLE.length; i++) {
			const char = cleanRLE[i];
			if (char >= '0' && char <= '9') {
				countStr += char;
			} else if (char === 'b' || char === 'o') {
				const count = countStr === '' ? 1 : parseInt(countStr, 10);
				const state = char === 'o' ? 1 : 0;
				for (let c = 0; c < count; c++) {
					if (currentX >= 0 && currentX < GRID_SIZE && currentY >= 0 && currentY < GRID_SIZE) {
						this.grid[currentY][currentX] = state;
					}
					currentX++;
				}
				countStr = '';
			} else if (char === '$') {
				currentY += countStr === '' ? 1 : parseInt(countStr, 10);
				currentX = startX;
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
