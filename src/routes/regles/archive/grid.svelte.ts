import { getContext, setContext } from 'svelte';

const GRID_SIZE = 32;
const GRID_RULES_SYMBOL = Symbol('GRID_RULES_SYMBOL');

export class Grid {
	step = $state(0);
	// Canvas Properties
	canvas!: HTMLCanvasElement;
	ctx!: CanvasRenderingContext2D;
	offscreenCanvas!: HTMLCanvasElement;
	initialized = false;

	// Grid State
	cellSize: number = 0;
	grid: number[][];

	// Animation & Controls
	isPlaying = $state(false);
	lastFrameTime = 0;
	updateInterval = 100;
	animationId: number = 0;

	scale = $state(1);
	offsetX = $state(0);
	offsetY = $state(0);

	// For smooth interpolation
	targetScale = 2;
	zoomSpeed = 0.1;

	constructor() {
		this.grid = this.createEmptyGrid();
	}

	private steps: Record<number, () => void> = {
		0: () => {
			this.loadRLE('bo5b$3bo3b$2o2b3o!');
		},
		1: () => {
			// Add any logic specific to step 1
		},
		2: () => {
			this.zoom(2);
			// Logic for step 2
		},
		3: () => {
			// Logic for step 3
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

	createEmptyGrid(): number[][] {
		return Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(0));
	}

	mount(canvas: HTMLCanvasElement) {
		if (this.initialized) return;

		this.canvas = canvas;
		this.ctx = canvas.getContext('2d', { alpha: true }) as CanvasRenderingContext2D;

		// 1. Calculate cellSize based on the min dimension of the actual canvas
		const minDim = Math.min(canvas.clientWidth, canvas.clientHeight);
		this.cellSize = minDim / GRID_SIZE;

		// Ensure internal resolution matches CSS size
		this.canvas.width = minDim;
		this.canvas.height = minDim;

		// 2. Pre-render the grid lines to an offscreen canvas for performance
		this.cacheGridLines();

		this.draw();
		this.initialized = true;
	}

	private cacheGridLines() {
		this.offscreenCanvas = document.createElement('canvas');
		this.offscreenCanvas.width = this.canvas.width;
		this.offscreenCanvas.height = this.canvas.height;
		const oCtx = this.offscreenCanvas.getContext('2d')!;

		oCtx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
		oCtx.lineWidth = 0.5;

		oCtx.beginPath();
		for (let i = 0; i <= GRID_SIZE; i++) {
			const pos = i * this.cellSize;
			// Vertical lines
			oCtx.moveTo(pos, 0);
			oCtx.lineTo(pos, this.canvas.height);
			// Horizontal lines
			oCtx.moveTo(0, pos);
			oCtx.lineTo(this.canvas.width, pos);
		}
		oCtx.stroke();
	}
	zoom(delta: number, centerX?: number, centerY?: number) {
		const zoomFactor = 1.1;
		const oldScale = this.targetScale;

		// Determine new scale
		if (delta > 0) {
			this.targetScale *= zoomFactor;
		} else {
			this.targetScale /= zoomFactor;
		}

		// Constrain zoom
		this.targetScale = Math.max(0.5, Math.min(this.targetScale, 10));

		// Calculate focal point (default to canvas center)
		const focusX = centerX ?? this.canvas.width / 2;
		const focusY = centerY ?? this.canvas.height / 2;

		// Adjust offsets so the zoom "points" at the focusX/Y
		// formula: newOffset = focus - (focus - oldOffset) * (newScale / oldScale)
		const ratio = this.targetScale / oldScale;
		this.offsetX = focusX - (focusX - this.offsetX) * ratio;
		this.offsetY = focusY - (focusY - this.offsetY) * ratio;
	}
	draw() {
		if (!this.initialized) return;

		// Smoothly interpolate current scale towards targetScale
		// This creates the "smooth" gliding effect
		this.scale += (this.targetScale - this.scale) * 0.1;

		this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

		this.ctx.save();
		// Apply Transform: Translate to offset, then scale
		this.ctx.translate(this.offsetX, this.offsetY);
		this.ctx.scale(this.scale, this.scale);

		// 3. Draw the cached grid lines
		this.ctx.drawImage(this.offscreenCanvas, 0, 0);

		// 4. Draw Cells
		this.ctx.fillStyle = 'white';
		for (let y = 0; y < GRID_SIZE; y++) {
			for (let x = 0; x < GRID_SIZE; x++) {
				if (this.grid[y][x] === 1) {
					this.ctx.fillRect(x * this.cellSize, y * this.cellSize, this.cellSize, this.cellSize);
				}
			}
		}
		this.ctx.restore();

		// If we are animating the zoom but the game is paused,
		// we need to keep requesting frames until targetScale is reached
		if (!this.isPlaying && Math.abs(this.targetScale - this.scale) > 0.001) {
			requestAnimationFrame(() => this.draw());
		}
	}

	// --- Core Game Logic ---

	update() {
		const nextGrid = this.createEmptyGrid();
		for (let y = 0; y < GRID_SIZE; y++) {
			for (let x = 0; x < GRID_SIZE; x++) {
				const neighbors = this.countNeighbors(x, y);
				const isAlive = this.grid[y][x] === 1;

				if (isAlive && (neighbors < 2 || neighbors > 3)) {
					nextGrid[y][x] = 0;
				} else if (!isAlive && neighbors === 3) {
					nextGrid[y][x] = 1;
				} else {
					nextGrid[y][x] = this.grid[y][x];
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

	animate = (time: number) => {
		if (!this.isPlaying) return;
		this.animationId = requestAnimationFrame(this.animate);

		if (time - this.lastFrameTime >= this.updateInterval) {
			this.update();
			this.draw();
			this.lastFrameTime = time;
		}
	};

	play() {
		if (this.isPlaying) return;
		this.isPlaying = true;
		this.lastFrameTime = performance.now();
		this.animate(this.lastFrameTime);
	}

	stop() {
		this.isPlaying = false;
		cancelAnimationFrame(this.animationId);
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
