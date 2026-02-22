import { getContext, setContext } from 'svelte';

const GRID_SIZE = 32;
const GRID_RULES_SYMBOL = Symbol('GRID_RULES_SYMBOL');

export class Grid {
	// Svelte 5 Reactive State
	step = $state(0);
	isPlaying = $state(false);

	// Zoom & View State
	targetScale = $state(1);
	currentScale = 1; // Used for smooth interpolation
	offsetX = 0;
	offsetY = 0;
	lerpFactor = 0.1; // Adjust (0.01 to 0.1) for smoothness

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
	updateInterval = 100;
	animationId: number = 0;

	constructor() {
		this.grid = this.createEmptyGrid();
	}

	private steps: Record<number, () => void> = {
		0: () => {
			this.loadRLE('bo5b$3bo3b$2o2b3o!');
		},
		1: () => {
			this.zoom(2);
			// Add any logic specific to step 1
		},
		2: () => {
			this.zoom(1);
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

	// --- Zoom Logic ---

	/**
	 * Set an absolute zoom level (e.g., 0.5, 2, 4)
	 * Automatically centers the zoom on the canvas middle.
	 */
	zoom(newScale: number) {
		const oldScale = this.targetScale;
		this.targetScale = Math.max(0.1, newScale);

		// Focal point: Center of the canvas
		const cx = this.canvas.width / 2;
		const cy = this.canvas.height / 2;

		// Calculate new offsets to keep the center stable during zoom
		const ratio = this.targetScale / oldScale;
		this.offsetX = cx - (cx - this.offsetX) * ratio;
		this.offsetY = cy - (cy - this.offsetY) * ratio;

		// If game is paused, trigger a transition loop to animate the zoom
		if (!this.isPlaying) {
			this.requestTransition();
		}
	}

	private requestTransition = () => {
		this.draw();
		// Continue loop until currentScale is visually identical to targetScale
		if (Math.abs(this.targetScale - this.currentScale) > 0.001) {
			requestAnimationFrame(this.requestTransition);
		}
	};

	// --- Core Methods ---

	mount(canvas: HTMLCanvasElement) {
		if (this.initialized) return;

		this.canvas = canvas;
		this.ctx = canvas.getContext('2d', { alpha: true }) as CanvasRenderingContext2D;

		const minDim = Math.min(canvas.clientWidth, canvas.clientHeight);
		this.cellSize = minDim / GRID_SIZE;

		this.canvas.width = minDim;
		this.canvas.height = minDim;

		this.cacheGridLines();
		this.initialized = true;
		this.draw();
	}

	private cacheGridLines() {
		this.offscreenCanvas = document.createElement('canvas');
		this.offscreenCanvas.width = this.canvas.width;
		this.offscreenCanvas.height = this.canvas.height;
		const oCtx = this.offscreenCanvas.getContext('2d')!;

		oCtx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
		oCtx.lineWidth = 0.5;

		oCtx.beginPath();
		for (let i = 0; i <= GRID_SIZE; i++) {
			const pos = i * this.cellSize;
			oCtx.moveTo(pos, 0);
			oCtx.lineTo(pos, this.canvas.height);
			oCtx.moveTo(0, pos);
			oCtx.lineTo(this.canvas.width, pos);
		}
		oCtx.stroke();
	}

	draw() {
		if (!this.initialized) return;

		// Interpolate scale for smooth "gliding" effect
		this.currentScale += (this.targetScale - this.currentScale) * this.lerpFactor;

		this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

		this.ctx.save();

		// Apply view transformations
		this.ctx.translate(this.offsetX, this.offsetY);
		this.ctx.scale(this.currentScale, this.currentScale);

		// Draw background grid
		this.ctx.drawImage(this.offscreenCanvas, 0, 0);

		// Draw active cells
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

	animate = (time: number) => {
		if (!this.isPlaying) return;
		this.animationId = requestAnimationFrame(this.animate);

		if (time - this.lastFrameTime >= this.updateInterval) {
			this.update();
			this.draw();
			this.lastFrameTime = time;
		} else {
			// Even if we don't update logic, we redraw to keep zoom smooth
			this.draw();
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
