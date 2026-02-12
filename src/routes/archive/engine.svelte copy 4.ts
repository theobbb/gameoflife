// src/lib/game.svelte.ts
import type { Pattern } from '$lib/types';
import { rgbaToString, type RGBA } from '$lib/utils/color';
import { getContext, setContext } from 'svelte';

// --- CONSTANTS ---
const BASE_CELL_SIZE = 20;
const STIFFNESS = [2, 1, 4];
const DAMPING = [0.2, 0.1, 0.5];

// Metaball parameters
const METABALL_RADIUS = [0.4, 0.2, 0.6];
const METABALL_THRESHOLD = [1.0, 0.5, 2.0];
const RENDER_RESOLUTION = [4, 2, 6];
const INFLUENCE_RADIUS = [6.0, 4.0, 8.0];

const ANIMATION_DURATION = 500; // ms to morph between states
const UPDATE_INTERVAL = 100; // ms between generations (at 1x speed)

// Camera Settings
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 8;
const ZOOM_SENSITIVITY = 0.1;
const CAMERA_SMOOTHING = 0.15;

const GAME_ENGINE_SYMBOL = Symbol('GAME_ENGINE_SYMBOL');

type Vector2 = { x: number; y: number };

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
	isManual?: boolean; // New flag for manual interaction
};

export class Engine {
	// --- STATE (Runes) ---
	isPlaying = $state(false);
	time_scale = $state(1.0); // 1.0 = Normal, 2.0 = Fast, 0.5 = Slow

	stats: { n_gens: number } = $state({ n_gens: 0 });
	current_pattern: Pattern | null = $state(null);
	theme = $state('default');

	controls = $state({
		playing: false,
		zoom_level: 4.0,
		time_scale: 1.0,
		stiffness: STIFFNESS[0],
		damping: DAMPING[0],
		metaball_radius: METABALL_RADIUS[0],
		metaball_threshold: METABALL_THRESHOLD[0],
		render_resolution: RENDER_RESOLUTION[0],
		influence_radius: INFLUENCE_RADIUS[0]
	});

	private METABALL_RADIUS = $derived(BASE_CELL_SIZE * this.controls.metaball_radius);
	private METABALL_RADIUS_SQ = $derived(this.METABALL_RADIUS * this.METABALL_RADIUS);
	private METABALL_THRESHOLD = $derived(this.controls.metaball_threshold);

	private RENDER_RESOLUTION = $derived(this.controls.render_resolution);
	private INFLUENCE_RADIUS = $derived(this.METABALL_RADIUS * this.controls.influence_radius);

	initialized = $state(false);

	// --- INTERNAL INFRASTRUCTURE ---
	private canvas: HTMLCanvasElement | null = null;
	private ctx: CanvasRenderingContext2D | null = null;
	private canvas_rect: DOMRect | null = null;
	private width = 0;
	private height = 0;
	private animationId: number = 0;

	// Grid Data
	private CELL_SIZE = BASE_CELL_SIZE;
	private COLS = 0;
	private ROWS = 0;
	private grid: boolean[][] = [];
	private nextGrid: boolean[][] = [];

	// Visuals & Physics
	private visualCells: Map<number, Cell> = new Map();
	private dyingCells: Map<number, Cell> = new Map();
	private fieldBuffer = new Float32Array(0);
	private fieldWidth = 0;
	private fieldHeight = 0;

	// Camera Physics
	private pan_offset: Vector2 = { x: 0, y: 0 };
	private target_zoom = 4;
	private target_pan: Vector2 = { x: 0, y: 0 };

	// Input State
	private hover_pos: { col: number; row: number } | null = null; // New Hover State

	// Loop & Time Logic
	private lastFrameTime = 0;
	private timeSinceLastUpdate = 0; // Accumulator for generation ticks

	private isAnimating = false;
	private animationProgress = 0; // 0.0 to 1.0

	private isMouseDown = false;

	private currentColors = {
		background: { r: 17, g: 17, b: 17, a: 1 }, // Default #111111
		grid: { r: 255, g: 255, b: 255, a: 0.2 },
		grid_hover: { r: 255, g: 255, b: 255, a: 0.2 },
		life_stroke: { r: 255, g: 255, b: 255, a: 0.85 },
		life_fill: { r: 255, g: 255, b: 255, a: 0.85 }
	};
	private transition = {
		active: false,
		startTime: 0,
		duration: 0,
		startColors: { ...this.currentColors }, // Snapshot of where we started
		targetColors: { ...this.currentColors } // Where we are going
	};

	constructor() {
		this.target_zoom = this.controls.zoom_level;
	}

	mount(canvas: HTMLCanvasElement) {
		if (this.initialized) return;
		//if (this.canvas === canvas) return;

		this.canvas = canvas;
		this.ctx = canvas.getContext('2d', { alpha: false }) as CanvasRenderingContext2D;

		// Setup Dimensions
		this.canvas_rect = canvas.getBoundingClientRect();
		this.width = this.canvas_rect.width;
		this.height = this.canvas_rect.height;
		this.canvas.width = this.width;
		this.canvas.height = this.height;

		// Calculate Grid Dimensions
		this.COLS = Math.floor(this.width / this.CELL_SIZE);
		this.ROWS = Math.floor(this.height / this.CELL_SIZE);

		// Init Camera Center
		this.pan_offset = {
			x: this.width / 2 - (this.width * this.controls.zoom_level) / 2,
			y: this.height / 2 - (this.height * this.controls.zoom_level) / 2
		};
		this.target_pan = { ...this.pan_offset };

		this.initGrid();
		this.setupListeners();

		this.get_theme();

		this.syncVisualCells();

		this.centerView(100);

		// Start Loop
		this.lastFrameTime = performance.now();
		this.animate(this.lastFrameTime);

		console.log('engine initialized');
		this.initialized = true;
	}

	private get_theme() {
		// --- SYNC INITIAL THEME FROM DOM ---
		// Grab whatever is currently set on HTML or fallback
		const styles = getComputedStyle(document.documentElement);
		const bg = styles.getPropertyValue('--color-bg').trim();
		const grid = styles.getPropertyValue('--color-grid').trim();
		const grid_hover = styles.getPropertyValue('--color-grid-hover').trim();
		const life_stroke = styles.getPropertyValue('--color-life-stroke').trim();
		const life_fill = styles.getPropertyValue('--color-life-fill').trim();

		if (bg) this.currentColors.background = this.parseCssColor(bg);
		// Note: We default grid alpha to 0.2 and blob to 0.85 if the CSS passes opaque RGB
		if (grid) this.currentColors.grid = this.parseCssColor(grid);
		if (grid_hover) this.currentColors.grid_hover = this.parseCssColor(grid_hover);
		if (life_stroke) this.currentColors.life_stroke = this.parseCssColor(life_stroke);
		if (life_fill) this.currentColors.life_fill = this.parseCssColor(life_fill);
	}
	private parseCssColor(cssString: string, defaultAlpha = 1): RGBA {
		if (!cssString) return { r: 0, g: 0, b: 0, a: 1 };

		// Matches rgb(r, g, b) or rgba(r, g, b, a)
		const match = cssString.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);

		if (match) {
			return {
				r: parseInt(match[1], 10),
				g: parseInt(match[2], 10),
				b: parseInt(match[3], 10),
				a: match[4] ? parseFloat(match[4]) : defaultAlpha
			};
		}
		return { r: 0, g: 0, b: 0, a: 1 }; // Fallback
	}

	destroy() {
		console.log('destroying engine...');
		if (this.animationId) cancelAnimationFrame(this.animationId);
		this.removeListeners();
		this.initialized = false;
		this.current_pattern = null;
		this.theme = 'default';
	}

	// --- GRID MANAGEMENT ---

	private initGrid() {
		this.grid = Array(this.ROWS)
			.fill(null)
			.map(() => Array(this.COLS).fill(false));
		this.nextGrid = Array(this.ROWS)
			.fill(null)
			.map(() => Array(this.COLS).fill(false));
		this.visualCells.clear();
		this.dyingCells.clear();
	}

	private encodeKey(row: number, col: number) {
		return (row << 16) | col;
	}

	private safeSet(row: number, col: number, val: boolean) {
		if (row >= 0 && row < this.ROWS && col >= 0 && col < this.COLS) {
			this.grid[row][col] = val;
		}
	}

	private calculateNeighborVector(row: number, col: number, useGrid: boolean[][]): Vector2 {
		let x = 0,
			y = 0;
		for (let i = -1; i <= 1; i++) {
			for (let j = -1; j <= 1; j++) {
				if (i === 0 && j === 0) continue;
				const wrappedRow = (row + i + this.ROWS) % this.ROWS;
				const wrappedCol = (col + j + this.COLS) % this.COLS;
				if (useGrid[wrappedRow][wrappedCol]) {
					x -= j;
					y -= i;
				}
			}
		}
		const mag = Math.sqrt(x * x + y * y);
		return mag > 0 ? { x: x / mag, y: y / mag } : { x, y };
	}

	private countNeighbors(row: number, col: number): number {
		let count = 0;
		for (let i = -1; i <= 1; i++) {
			for (let j = -1; j <= 1; j++) {
				if (i === 0 && j === 0) continue;
				let r = row + i;
				let c = col + j;
				if (r < 0) r = this.ROWS - 1;
				else if (r >= this.ROWS) r = 0;
				if (c < 0) c = this.COLS - 1;
				else if (c >= this.COLS) c = 0;
				if (this.grid[r][c]) count++;
			}
		}
		return count;
	}

	// --- GAME LOOP & PHYSICS ---

	private animate = (currentTime: number) => {
		this.animationId = requestAnimationFrame(this.animate);

		this.processColorTransition(currentTime);

		let deltaTime = currentTime - this.lastFrameTime;
		this.lastFrameTime = currentTime;

		if (document.hidden) return;
		// Cap physics step to avoid explosions if tab was backgrounded
		if (deltaTime > 50) deltaTime = 50;

		// 1. Calculate Simulation Delta (Time * Scale)
		const simDelta = deltaTime * this.time_scale;

		// 2. Advance Animation Progress
		if (this.isAnimating) {
			// Add percentage of completion based on simDelta
			this.animationProgress += simDelta / ANIMATION_DURATION;

			if (this.animationProgress >= 1) {
				this.animationProgress = 1;
				this.completeTransition();
			}
		}

		this.updateCamera();

		// 3. Update Physics (Wobble/Move) using scaled time
		this.updatePhysics(deltaTime, this.time_scale);

		this.draw();

		// 4. Trigger Next Generation
		if (this.isPlaying && !this.isAnimating) {
			this.timeSinceLastUpdate += simDelta;

			if (this.timeSinceLastUpdate > UPDATE_INTERVAL) {
				this.updateGrid();
				// Consume the interval, keep remainder
				this.timeSinceLastUpdate -= UPDATE_INTERVAL;
			}
		}
	};

	updateGrid = () => {
		for (let row = 0; row < this.ROWS; row++) {
			for (let col = 0; col < this.COLS; col++) {
				const neighbors = this.countNeighbors(row, col);
				const isAlive = this.grid[row][col];
				this.nextGrid[row][col] = isAlive ? neighbors === 2 || neighbors === 3 : neighbors === 3;
			}
		}
		this.stats.n_gens++;

		// Start Transition
		this.isAnimating = true;
		this.animationProgress = 0;
		this.syncVisualCells();
	};

	private syncVisualCells() {
		const currentKeys = new Set<number>();
		this.dyingCells.clear();

		for (let row = 0; row < this.ROWS; row++) {
			for (let col = 0; col < this.COLS; col++) {
				const isAlive = this.grid[row][col];
				const willBeAlive = this.nextGrid[row][col];
				if (!isAlive && !willBeAlive) continue;

				const key = this.encodeKey(row, col);

				// Existing or New Cells
				if (isAlive) {
					currentKeys.add(key);
					if (!this.visualCells.has(key)) {
						const targetX = col * this.CELL_SIZE + this.CELL_SIZE / 2;
						const targetY = row * this.CELL_SIZE + this.CELL_SIZE / 2;
						this.visualCells.set(key, {
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
							scale: 0.1, // Start small for pop-in effect
							dying: false,
							isManual: true // Mark as manual so it grows via physics, not animation loop
						});
					}
				}

				// Cells about to be born (Animation Pre-calculation for Next Gen)
				if (!isAlive && willBeAlive && this.isAnimating) {
					if (!this.visualCells.has(key)) {
						const targetX = col * this.CELL_SIZE + this.CELL_SIZE / 2;
						const targetY = row * this.CELL_SIZE + this.CELL_SIZE / 2;
						const vector = this.calculateNeighborVector(row, col, this.grid);
						this.visualCells.set(key, {
							gridX: col,
							gridY: row,
							x: targetX - vector.x * this.CELL_SIZE,
							y: targetY - vector.y * this.CELL_SIZE,
							vx: 0,
							vy: 0,
							targetX,
							targetY,
							phase: Math.random() * Math.PI * 2,
							phaseSpeed: 0.5 + Math.random() * 0.5,
							alpha: 1,
							scale: 0.5,
							dying: false,
							isManual: false // These are born naturally
						});
						currentKeys.add(key);
					}
				}

				// Cells about to die
				if (isAlive && !willBeAlive && this.isAnimating) {
					const cell = this.visualCells.get(key);
					if (cell) {
						cell.dying = true;
						const vector = this.calculateNeighborVector(row, col, this.nextGrid);
						const pushDistance = this.CELL_SIZE * 2.5;
						cell.targetX = cell.x + vector.x * pushDistance;
						cell.targetY = cell.y + vector.y * pushDistance;
						this.dyingCells.set(key, cell);
					}
				}
			}
		}

		// Cleanup dead visual cells if we aren't animating
		if (!this.isAnimating) {
			for (const key of this.visualCells.keys()) {
				if (!currentKeys.has(key)) this.visualCells.delete(key);
			}
		}
	}

	private completeTransition() {
		[this.grid, this.nextGrid] = [this.nextGrid, this.grid];
		this.isAnimating = false;
		this.animationProgress = 0;

		for (const key of this.dyingCells.keys()) this.visualCells.delete(key);
		this.dyingCells.clear();

		for (const cell of this.visualCells.values()) {
			cell.alpha = 1;
			cell.scale = 1;
			cell.dying = false;
		}
	}

	private lerp(a: number, b: number, t: number): number {
		return a + (b - a) * t;
	}

	private updatePhysics(dt: number, scale: number) {
		const tSec = (dt / 1000) * scale;

		// Cubic ease in/out for Game of Life steps
		const progress = this.isAnimating
			? this.animationProgress < 0.5
				? 4 * this.animationProgress ** 3
				: 1 - Math.pow(-2 * this.animationProgress + 2, 3) / 2
			: 0;

		for (const cell of this.visualCells.values()) {
			cell.phase += cell.phaseSpeed * tSec;
			const wobbleAmount = this.isAnimating ? 0.5 : 2;
			const wobbleX = Math.sin(cell.phase) * wobbleAmount;
			const wobbleY = Math.cos(cell.phase * 1.3) * wobbleAmount;

			if (!cell.dying) {
				cell.targetX = cell.gridX * this.CELL_SIZE + this.CELL_SIZE / 2 + wobbleX;
				cell.targetY = cell.gridY * this.CELL_SIZE + this.CELL_SIZE / 2 + wobbleY;

				// Scale Logic
				if (cell.isManual) {
					// Manual Spawn: Smooth spring-like growth regardless of game loop state
					cell.scale += (1 - cell.scale) * 15 * tSec;
					if (cell.scale > 0.99) {
						cell.scale = 1;
						cell.isManual = false;
					}
				} else if (this.isAnimating && cell.scale < 1) {
					// Natural Birth: Sync with game loop
					cell.scale = this.lerp(0.5, 1, progress);
				} else if (!this.isAnimating && !cell.isManual) {
					// Idle state
					cell.scale = 1;
				}
			} else {
				cell.targetX += wobbleX * 0.1;
				cell.targetY += wobbleY * 0.1;
				cell.scale = 1 - progress;
				cell.alpha = 1 - progress;
			}

			const dx = cell.targetX - cell.x;
			const dy = cell.targetY - cell.y;
			cell.vx += ((dx * this.controls.stiffness) / 4) * tSec;
			cell.vy += ((dy * this.controls.stiffness) / 4) * tSec;

			const d = Math.pow(this.controls.damping, tSec);
			cell.vx *= d;
			cell.vy *= d;
			cell.x += cell.vx * tSec * 60;
			cell.y += cell.vy * tSec * 60;
		}
	}

	private updateCamera() {
		this.controls.zoom_level += (this.target_zoom - this.controls.zoom_level) * CAMERA_SMOOTHING;
		this.pan_offset.x += (this.target_pan.x - this.pan_offset.x) * CAMERA_SMOOTHING;
		this.pan_offset.y += (this.target_pan.y - this.pan_offset.y) * CAMERA_SMOOTHING;

		if (Math.abs(this.target_zoom - this.controls.zoom_level) < 0.001)
			this.controls.zoom_level = this.target_zoom;
		if (Math.abs(this.target_pan.x - this.pan_offset.x) < 0.1)
			this.pan_offset.x = this.target_pan.x;
		if (Math.abs(this.target_pan.y - this.pan_offset.y) < 0.1)
			this.pan_offset.y = this.target_pan.y;
	}

	// --- DRAWING (Metaballs) ---

	private getEdgePoint(x1: number, y1: number, val1: number, x2: number, y2: number, val2: number) {
		if (Math.abs(val1 - val2) < 0.001) return { x: (x1 + x2) / 2, y: (y1 + y2) / 2 };
		const t = (this.METABALL_THRESHOLD - val1) / (val2 - val1);
		return { x: this.lerp(x1, x2, t), y: this.lerp(y1, y2, t) };
	}

	private drawMetaballs(startRow: number, endRow: number, startCol: number, endCol: number) {
		// ... [Keep the initial buffer calculation logic exactly the same] ...
		// (Copy the first half of the previous function up until "const ctx = this.ctx!;" )
		const startX = startCol * this.CELL_SIZE;
		const startY = startRow * this.CELL_SIZE;
		const endX = endCol * this.CELL_SIZE;
		const endY = endRow * this.CELL_SIZE;

		const bufW = Math.ceil((endX - startX) / this.RENDER_RESOLUTION) + 1;
		const bufH = Math.ceil((endY - startY) / this.RENDER_RESOLUTION) + 1;
		const reqSize = bufW * bufH;

		if (this.fieldBuffer.length < reqSize) this.fieldBuffer = new Float32Array(reqSize);
		else this.fieldBuffer.fill(0, 0, reqSize);

		this.fieldWidth = bufW;
		this.fieldHeight = bufH;

		// 1. Calculate Field Strengths (Heavy Math - Done Once)
		for (const cell of this.visualCells.values()) {
			if (
				cell.x < startX - this.INFLUENCE_RADIUS ||
				cell.x > endX + this.INFLUENCE_RADIUS ||
				cell.y < startY - this.INFLUENCE_RADIUS ||
				cell.y > endY + this.INFLUENCE_RADIUS
			)
				continue;

			const r2 = this.METABALL_RADIUS_SQ * (cell.scale * cell.scale);
			const strength = r2 * cell.alpha;
			if (strength < 0.01) continue;

			const fx = (cell.x - startX) / this.RENDER_RESOLUTION;
			const fy = (cell.y - startY) / this.RENDER_RESOLUTION;
			const radiusInUnits = this.INFLUENCE_RADIUS / this.RENDER_RESOLUTION;
			const minX = Math.max(0, Math.floor(fx - radiusInUnits));
			const maxX = Math.min(bufW - 1, Math.ceil(fx + radiusInUnits));
			const minY = Math.max(0, Math.floor(fy - radiusInUnits));
			const maxY = Math.min(bufH - 1, Math.ceil(fy + radiusInUnits));

			for (let by = minY; by <= maxY; by++) {
				const rowOffset = by * bufW;
				const worldYPos = startY + by * this.RENDER_RESOLUTION;
				const dy = worldYPos - cell.y;
				const dy2 = dy * dy;
				for (let bx = minX; bx <= maxX; bx++) {
					const worldXPos = startX + bx * this.RENDER_RESOLUTION;
					const dx = worldXPos - cell.x;
					const distSq = dx * dx + dy2;
					if (distSq > 0.1) this.fieldBuffer[rowOffset + bx] += strength / distSq;
					else this.fieldBuffer[rowOffset + bx] += 100;
				}
			}
		}

		const ctx = this.ctx!;

		// =========================================
		// PASS 1: FILL (Polygons + Solid Rects)
		// =========================================
		ctx.fillStyle = rgbaToString(this.currentColors.life_fill); // 🟢 INSIDE COLOR
		ctx.beginPath();

		for (let by = 0; by < bufH - 1; by++) {
			const rowOffset = by * bufW;
			const nextRowOffset = (by + 1) * bufW;
			const y = startY + by * this.RENDER_RESOLUTION;

			for (let bx = 0; bx < bufW - 1; bx++) {
				const tl = this.fieldBuffer[rowOffset + bx];
				const tr = this.fieldBuffer[rowOffset + bx + 1];
				const bl = this.fieldBuffer[nextRowOffset + bx];
				const br = this.fieldBuffer[nextRowOffset + bx + 1];

				let caseId = 0;
				if (tl >= this.METABALL_THRESHOLD) caseId |= 1;
				if (tr >= this.METABALL_THRESHOLD) caseId |= 2;
				if (br >= this.METABALL_THRESHOLD) caseId |= 4;
				if (bl >= this.METABALL_THRESHOLD) caseId |= 8;

				if (caseId === 0) continue;

				const x = startX + bx * this.RENDER_RESOLUTION;

				// Optimization: Solid block
				if (caseId === 15) {
					ctx.rect(x, y, this.RENDER_RESOLUTION, this.RENDER_RESOLUTION);
					continue;
				}

				// Interpolation
				const top = this.getEdgePoint(x, y, tl, x + this.RENDER_RESOLUTION, y, tr);
				const right = this.getEdgePoint(
					x + this.RENDER_RESOLUTION,
					y,
					tr,
					x + this.RENDER_RESOLUTION,
					y + this.RENDER_RESOLUTION,
					br
				);
				const bottom = this.getEdgePoint(
					x + this.RENDER_RESOLUTION,
					y + this.RENDER_RESOLUTION,
					br,
					x,
					y + this.RENDER_RESOLUTION,
					bl
				);
				const left = this.getEdgePoint(x, y + this.RENDER_RESOLUTION, bl, x, y, tl);

				// Closed loops for filling (Connect to corners)
				switch (caseId) {
					case 1:
						ctx.moveTo(top.x, top.y);
						ctx.lineTo(left.x, left.y);
						ctx.lineTo(x, y);
						break;
					case 2:
						ctx.moveTo(right.x, right.y);
						ctx.lineTo(top.x, top.y);
						ctx.lineTo(x + this.RENDER_RESOLUTION, y);
						break;
					case 3:
						ctx.moveTo(right.x, right.y);
						ctx.lineTo(left.x, left.y);
						ctx.lineTo(x, y);
						ctx.lineTo(x + this.RENDER_RESOLUTION, y);
						break;
					case 4:
						ctx.moveTo(bottom.x, bottom.y);
						ctx.lineTo(right.x, right.y);
						ctx.lineTo(x + this.RENDER_RESOLUTION, y + this.RENDER_RESOLUTION);
						break;
					case 5:
						ctx.moveTo(top.x, top.y);
						ctx.lineTo(left.x, left.y);
						ctx.lineTo(x, y);
						ctx.moveTo(bottom.x, bottom.y);
						ctx.lineTo(right.x, right.y);
						ctx.lineTo(x + this.RENDER_RESOLUTION, y + this.RENDER_RESOLUTION);
						break;
					case 6:
						ctx.moveTo(bottom.x, bottom.y);
						ctx.lineTo(top.x, top.y);
						ctx.lineTo(x + this.RENDER_RESOLUTION, y);
						ctx.lineTo(x + this.RENDER_RESOLUTION, y + this.RENDER_RESOLUTION);
						break;
					case 7:
						ctx.moveTo(bottom.x, bottom.y);
						ctx.lineTo(left.x, left.y);
						ctx.lineTo(x, y);
						ctx.lineTo(x + this.RENDER_RESOLUTION, y);
						ctx.lineTo(x + this.RENDER_RESOLUTION, y + this.RENDER_RESOLUTION);
						break;
					case 8:
						ctx.moveTo(left.x, left.y);
						ctx.lineTo(bottom.x, bottom.y);
						ctx.lineTo(x, y + this.RENDER_RESOLUTION);
						break;
					case 9:
						ctx.moveTo(top.x, top.y);
						ctx.lineTo(bottom.x, bottom.y);
						ctx.lineTo(x, y + this.RENDER_RESOLUTION);
						ctx.lineTo(x, y);
						break;
					case 10:
						ctx.moveTo(right.x, right.y);
						ctx.lineTo(top.x, top.y);
						ctx.lineTo(x + this.RENDER_RESOLUTION, y);
						ctx.moveTo(left.x, left.y);
						ctx.lineTo(bottom.x, bottom.y);
						ctx.lineTo(x, y + this.RENDER_RESOLUTION);
						break;
					case 11:
						ctx.moveTo(right.x, right.y);
						ctx.lineTo(bottom.x, bottom.y);
						ctx.lineTo(x, y + this.RENDER_RESOLUTION);
						ctx.lineTo(x, y);
						ctx.lineTo(x + this.RENDER_RESOLUTION, y);
						break;
					case 12:
						ctx.moveTo(left.x, left.y);
						ctx.lineTo(right.x, right.y);
						ctx.lineTo(x + this.RENDER_RESOLUTION, y + this.RENDER_RESOLUTION);
						ctx.lineTo(x, y + this.RENDER_RESOLUTION);
						break;
					case 13:
						ctx.moveTo(top.x, top.y);
						ctx.lineTo(right.x, right.y);
						ctx.lineTo(x + this.RENDER_RESOLUTION, y + this.RENDER_RESOLUTION);
						ctx.lineTo(x, y + this.RENDER_RESOLUTION);
						ctx.lineTo(x, y);
						break;
					case 14:
						ctx.moveTo(top.x, top.y);
						ctx.lineTo(left.x, left.y);
						ctx.lineTo(x, y + this.RENDER_RESOLUTION);
						ctx.lineTo(x + this.RENDER_RESOLUTION, y + this.RENDER_RESOLUTION);
						ctx.lineTo(x + this.RENDER_RESOLUTION, y);
						break;
				}
			}
		}
		ctx.fill();

		// =========================================
		// PASS 2: STROKE (Contours Only)
		// =========================================
		ctx.lineWidth = 3 / this.controls.zoom_level;
		ctx.lineCap = 'round';
		ctx.lineJoin = 'round';
		ctx.strokeStyle = rgbaToString(this.currentColors.life_stroke); // 🔴 OUTLINE COLOR

		ctx.beginPath();

		for (let by = 0; by < bufH - 1; by++) {
			const rowOffset = by * bufW;
			const nextRowOffset = (by + 1) * bufW;
			const y = startY + by * this.RENDER_RESOLUTION;

			for (let bx = 0; bx < bufW - 1; bx++) {
				const tl = this.fieldBuffer[rowOffset + bx];
				const tr = this.fieldBuffer[rowOffset + bx + 1];
				const bl = this.fieldBuffer[nextRowOffset + bx];
				const br = this.fieldBuffer[nextRowOffset + bx + 1];

				let caseId = 0;
				if (tl >= this.METABALL_THRESHOLD) caseId |= 1;
				if (tr >= this.METABALL_THRESHOLD) caseId |= 2;
				if (br >= this.METABALL_THRESHOLD) caseId |= 4;
				if (bl >= this.METABALL_THRESHOLD) caseId |= 8;

				// Skip Empty OR Solid Blocks (We only want edges)
				if (caseId === 0 || caseId === 15) continue;

				const x = startX + bx * this.RENDER_RESOLUTION;

				// Recalculate interpolation (Cheaper than storing objects)
				const top = this.getEdgePoint(x, y, tl, x + this.RENDER_RESOLUTION, y, tr);
				const right = this.getEdgePoint(
					x + this.RENDER_RESOLUTION,
					y,
					tr,
					x + this.RENDER_RESOLUTION,
					y + this.RENDER_RESOLUTION,
					br
				);
				const bottom = this.getEdgePoint(
					x + this.RENDER_RESOLUTION,
					y + this.RENDER_RESOLUTION,
					br,
					x,
					y + this.RENDER_RESOLUTION,
					bl
				);
				const left = this.getEdgePoint(x, y + this.RENDER_RESOLUTION, bl, x, y, tl);

				// Simple lines for stroking
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
						ctx.lineTo(left.x, left.y);
						ctx.moveTo(bottom.x, bottom.y);
						ctx.lineTo(right.x, right.y);
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
						ctx.lineTo(right.x, right.y);
						ctx.moveTo(bottom.x, bottom.y);
						ctx.lineTo(left.x, left.y);
						break;
				}
			}
		}
		ctx.stroke();
	}

	private draw() {
		if (!this.ctx) return;
		const ctx = this.ctx;

		ctx.fillStyle = rgbaToString(this.currentColors.background);
		ctx.fillRect(0, 0, this.width, this.height);
		ctx.save();
		ctx.translate(this.pan_offset.x, this.pan_offset.y);
		ctx.scale(this.controls.zoom_level, this.controls.zoom_level);

		const margin = 2;
		const startCol = Math.max(
			0,
			Math.floor(-this.pan_offset.x / this.controls.zoom_level / this.CELL_SIZE) - margin
		);
		const endCol = Math.min(
			this.COLS,
			Math.ceil((this.width - this.pan_offset.x) / this.controls.zoom_level / this.CELL_SIZE) +
				margin
		);
		const startRow = Math.max(
			0,
			Math.floor(-this.pan_offset.y / this.controls.zoom_level / this.CELL_SIZE) - margin
		);
		const endRow = Math.min(
			this.ROWS,
			Math.ceil((this.height - this.pan_offset.y) / this.controls.zoom_level / this.CELL_SIZE) +
				margin
		);

		if (this.controls.zoom_level > 0.5) {
			ctx.strokeStyle = rgbaToString(this.currentColors.grid);
			ctx.lineWidth = 0.5 / this.controls.zoom_level;
			ctx.beginPath();
			for (let i = startRow; i <= endRow; i++) {
				const y = i * this.CELL_SIZE;
				ctx.moveTo(startCol * this.CELL_SIZE, y);
				ctx.lineTo(endCol * this.CELL_SIZE, y);
			}
			for (let i = startCol; i <= endCol; i++) {
				const x = i * this.CELL_SIZE;
				ctx.moveTo(x, startRow * this.CELL_SIZE);
				ctx.lineTo(x, endRow * this.CELL_SIZE);
			}
			ctx.stroke();
		}

		// DRAW HOVER EFFECT
		if (this.hover_pos) {
			const { col, row } = this.hover_pos;
			if (col >= 0 && col < this.COLS && row >= 0 && row < this.ROWS) {
				const x = col * this.CELL_SIZE;
				const y = row * this.CELL_SIZE;
				ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
				ctx.beginPath();
				// Use roundRect if available in your target browser, else rect
				if (ctx.roundRect) {
					ctx.roundRect(x + 2, y + 2, this.CELL_SIZE - 4, this.CELL_SIZE - 4, 4);
				} else {
					ctx.rect(x + 2, y + 2, this.CELL_SIZE - 4, this.CELL_SIZE - 4);
				}
				ctx.fill();
			}
		}

		if (this.visualCells.size > 0) {
			this.drawMetaballs(startRow, endRow, startCol, endCol);
		}

		ctx.restore();
	}

	// --- CONTROLS ---

	togglePlay = () => {
		this.isPlaying = !this.isPlaying;
		if (this.isPlaying) this.timeSinceLastUpdate = 0; // Reset accumulator on play
		this.draw();
	};

	pause = () => {
		if (this.isPlaying) this.togglePlay();
	};

	next_frame = () => {
		this.updateGrid();
	};

	drawPattern(rle_pattern: Pattern, theme?: string) {
		console.log('drawing pattern...', rle_pattern);
		// 1. Reset Physics Clocks
		this.isAnimating = false;
		this.animationProgress = 0;
		this.timeSinceLastUpdate = 0;

		if (theme) this.setTheme(theme);
		// 2. Load Data
		this.current_pattern = rle_pattern;
		this.stats.n_gens = 0;
		this.initGrid();

		const { pattern, width, height } = rle_pattern;
		const startCol = Math.floor((this.COLS - width) / 2);
		const startRow = Math.floor((this.ROWS - height) / 2);

		for (let row = 0; row < height; row++) {
			for (let col = 0; col < width; col++) {
				const gridRow = startRow + row;
				const gridCol = startCol + col;
				this.safeSet(gridRow, gridCol, pattern[row][col]);
			}
		}

		this.syncVisualCells();
		this.draw();
		this.centerView(50);
	}

	centerView(padding = 50) {
		if (this.visualCells.size === 0) {
			this.target_zoom = 1;
			this.target_pan = {
				x: this.width / 2 - (this.width * 1) / 2,
				y: this.height / 2 - (this.height * 1) / 2
			};
			return;
		}

		let minX = Infinity,
			minY = Infinity;
		let maxX = -Infinity,
			maxY = -Infinity;

		for (const cell of this.visualCells.values()) {
			if (cell.dying) continue;
			const cx = cell.gridX * this.CELL_SIZE;
			const cy = cell.gridY * this.CELL_SIZE;
			if (cx < minX) minX = cx;
			if (cy < minY) minY = cy;
			if (cx > maxX) maxX = cx;
			if (cy > maxY) maxY = cy;
		}

		maxX += this.CELL_SIZE;
		maxY += this.CELL_SIZE;

		const patternWidth = maxX - minX;
		const patternHeight = maxY - minY;
		const patternCenterX = minX + patternWidth / 2;
		const patternCenterY = minY + patternHeight / 2;

		const availableWidth = this.width - padding * 2;
		const availableHeight = this.height - padding * 2;
		const scaleX = availableWidth / patternWidth;
		const scaleY = availableHeight / patternHeight;

		let newZoom = Math.min(scaleX, scaleY);
		newZoom = Math.max(MIN_ZOOM, Math.min(newZoom, 2.0));

		this.target_zoom = newZoom;
		this.target_pan = {
			x: this.width / 2 - patternCenterX * newZoom,
			y: this.height / 2 - patternCenterY * newZoom
		};
	}

	zoom(direction: 1 | -1, origin: Vector2) {
		const oldZoom = this.target_zoom;
		if (direction > 0) {
			this.target_zoom = Math.min(MAX_ZOOM, this.target_zoom * (1 + ZOOM_SENSITIVITY));
		} else {
			this.target_zoom = Math.max(MIN_ZOOM, this.target_zoom * (1 - ZOOM_SENSITIVITY));
		}
		const zoomRatio = this.target_zoom / oldZoom;
		this.target_pan.x = origin.x - (origin.x - this.target_pan.x) * zoomRatio;
		this.target_pan.y = origin.y - (origin.y - this.target_pan.y) * zoomRatio;
	}

	private screenToGrid(screenX: number, screenY: number) {
		const worldX = (screenX - this.pan_offset.x) / this.controls.zoom_level;
		const worldY = (screenY - this.pan_offset.y) / this.controls.zoom_level;
		return {
			col: Math.floor(worldX / this.CELL_SIZE),
			row: Math.floor(worldY / this.CELL_SIZE)
		};
	}

	setTheme(themeName: string, duration = 600) {
		// 1. Check if theme actually changed
		if (this.theme === themeName) return;

		// 2. Update state and DOM
		this.theme = themeName;
		document.documentElement.setAttribute('theme', themeName);

		// 3. Snapshot current state as start
		this.transition.startColors = {
			background: { ...this.currentColors.background },
			grid: { ...this.currentColors.grid },
			grid_hover: { ...this.currentColors.grid_hover },
			life_fill: { ...this.currentColors.life_fill },
			life_stroke: { ...this.currentColors.life_stroke }
		};

		// 4. Read Computed Styles from DOM
		// The DOM updates synchronously when setAttribute is called,
		// so getComputedStyle will return the new theme values immediately.
		const styles = getComputedStyle(document.documentElement);

		// 5. Parse and Set Targets
		// Note: I'm keeping your original transparency logic (Grid 0.2, Blob 0.85)
		// as a default override if the CSS provides opaque RGB.
		// If you want full CSS control, change defaultAlpha to 1.
		this.transition.targetColors.background = this.parseCssColor(
			styles.getPropertyValue('--color-bg').trim()
		);
		this.transition.targetColors.grid = this.parseCssColor(
			styles.getPropertyValue('--color-grid').trim()
		);
		this.transition.targetColors.grid_hover = this.parseCssColor(
			styles.getPropertyValue('--color-grid-hover').trim()
		);
		this.transition.targetColors.life_fill = this.parseCssColor(
			styles.getPropertyValue('--color-life-fill').trim()
		);
		this.transition.targetColors.life_stroke = this.parseCssColor(
			styles.getPropertyValue('--color-life-stroke').trim()
		);
		// 6. Start Transition
		this.transition.duration = duration;
		this.transition.startTime = performance.now();
		this.transition.active = true;

		// Ensure loop is running if paused so we see the color change
		if (!this.isPlaying && !this.isAnimating) {
			this.draw();
			requestAnimationFrame(() => this.processColorTransition(performance.now()));
		}
	}
	private processColorTransition(currentTime: number) {
		if (!this.transition.active) return;

		const elapsed = currentTime - this.transition.startTime;
		let progress = elapsed / this.transition.duration;

		if (progress >= 1) {
			progress = 1;
			this.transition.active = false;
		}

		// Custom Easing: Ease Out Quart (1 - (1-x)^4)
		const ease = 1 - Math.pow(1 - progress, 4);

		// Lerp Function
		const lerp = (start: number, end: number, t: number) => start + (end - start) * t;
		const lerpColor = (start: RGBA, end: RGBA, t: number): RGBA => ({
			r: lerp(start.r, end.r, t),
			g: lerp(start.g, end.g, t),
			b: lerp(start.b, end.b, t),
			a: lerp(start.a, end.a, t)
		});

		// Update Current Colors
		this.currentColors.background = lerpColor(
			this.transition.startColors.background,
			this.transition.targetColors.background,
			ease
		);
		this.currentColors.grid = lerpColor(
			this.transition.startColors.grid,
			this.transition.targetColors.grid,
			ease
		);
		this.currentColors.grid_hover = lerpColor(
			this.transition.startColors.grid_hover,
			this.transition.targetColors.grid_hover,
			ease
		);
		this.currentColors.life_fill = lerpColor(
			this.transition.startColors.life_fill,
			this.transition.targetColors.life_fill,
			ease
		);
		this.currentColors.life_stroke = lerpColor(
			this.transition.startColors.life_stroke,
			this.transition.targetColors.life_stroke,
			ease
		);

		// If game is paused, we need to force redraws during transition
		if (!this.isPlaying && this.transition.active) {
			this.draw();
			requestAnimationFrame(() => this.processColorTransition(performance.now()));
		}
	}
	// --- INPUT LISTENERS ---

	private setupListeners() {
		if (!this.canvas) return;
		this.canvas.addEventListener('mousedown', this.onMouseDown);
		window.addEventListener('mouseup', this.onMouseUp);
		window.addEventListener('mousemove', this.onMouseMove);
		this.canvas.addEventListener('wheel', this.onMouseWheel);
		window.addEventListener('keydown', this.onKeyDown);
		window.addEventListener('beforeunload', this.pause);
		document.addEventListener('visibilitychange', this.onVisibilityChange);
	}

	private removeListeners() {
		if (!this.canvas) return;
		this.canvas.removeEventListener('mousedown', this.onMouseDown);
		window.removeEventListener('mouseup', this.onMouseUp);
		window.removeEventListener('mousemove', this.onMouseMove);
		this.canvas.removeEventListener('wheel', this.onMouseWheel);
		window.removeEventListener('keydown', this.onKeyDown);
		window.removeEventListener('beforeunload', this.pause);
		document.removeEventListener('visibilitychange', this.onVisibilityChange);
	}

	private onVisibilityChange = () => {
		if (!document.hidden) this.lastFrameTime = performance.now();
	};

	private onMouseDown = (event: MouseEvent) => {
		if (!this.canvas_rect) return;
		const x = event.clientX - this.canvas_rect.left;
		const y = event.clientY - this.canvas_rect.top;
		const { col, row } = this.screenToGrid(x, y);
		this.safeSet(row, col, !this.grid[row][col]);
		this.syncVisualCells();
		this.isMouseDown = true;
	};

	private onMouseUp = () => {
		this.isMouseDown = false;
	};

	private onMouseMove = (event: MouseEvent) => {
		if (!this.canvas_rect) return;
		const x = event.clientX - this.canvas_rect.left;
		const y = event.clientY - this.canvas_rect.top;
		const { col, row } = this.screenToGrid(x, y);

		// Always update hover position
		this.hover_pos = { col, row };

		if (!this.isMouseDown) return;

		if (row >= 0 && row < this.ROWS && col >= 0 && col < this.COLS) {
			if (!this.grid[row][col]) {
				this.grid[row][col] = true;
				this.syncVisualCells();
			}
		}
	};

	private onMouseWheel = (event: WheelEvent) => {
		if (!this.canvas_rect) return;
		event.preventDefault();
		const x = event.clientX - this.canvas_rect.left;
		const y = event.clientY - this.canvas_rect.top;
		this.zoom(event.deltaY < 0 ? 1 : -1, { x, y });
	};

	private onKeyDown = (event: KeyboardEvent) => {
		if (event.code === 'Space') {
			event.preventDefault();
			this.togglePlay();
		}
		if (event.code === 'ArrowRight') {
			event.preventDefault();
			this.next_frame();
		}
		if (event.code === 'KeyC') {
			this.centerView();
		}
	};
}

export function init_engine() {
	return setContext(GAME_ENGINE_SYMBOL, new Engine());
}

export function get_engine() {
	const store = getContext<Engine>(GAME_ENGINE_SYMBOL);
	if (!store) throw new Error('GAME_ENGINE not initialized');
	return store;
}
