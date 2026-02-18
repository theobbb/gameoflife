// src/lib/game.svelte.ts
import type { Pattern } from '$lib/types';
import { rgbaToString, type RGBA } from '$lib/utils/color';
import { getContext, setContext } from 'svelte';

export const TIME_SCALE = [1.0, 0.1, 5.0];
// --- CONSTANTS ---
const BASE_CELL_SIZE = 20;
export const STIFFNESS = [2, 0.5, 6];
export const DAMPING = [0.2, 0.1, 0.5];

// Metaball parameters
export const METABALL_RADIUS = [0.4, 0.2, 0.6];
export const METABALL_THRESHOLD = [1.0, 0.5, 2.0];
export const RENDER_RESOLUTION = [6, 1, 6];
export const INFLUENCE_RADIUS = [6.0, 1.0, 12.0];

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
	isManual?: boolean;
};

export class Engine {
	// --- STATE (Runes) ---
	// controls.playing = $state(false);
	//controls.time_scale = $state(1.0); // 1.0 = Normal, 2.0 = Fast, 0.5 = Slow

	stats = $state({ n_gens: 0, fps: 0, n_active: 0, n_born: 0, n_died: 0 });
	current_pattern: Pattern | null = $state(null);
	theme = $state('default');

	controls = $state({
		playing: false,
		zoom_level: 4.0,
		time_scale: TIME_SCALE[0],
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
	private hover_pos: { col: number; row: number } | null = null;

	// Loop & Time Logic
	private lastFrameTime = 0;
	private timeSinceLastUpdate = 0;

	private isAnimating = false;
	private animationProgress = 0;

	private isMouseDown = false;

	private currentColors = {
		background: { r: 17, g: 17, b: 17, a: 1 },
		grid: { r: 255, g: 255, b: 255, a: 0.2 },
		grid_hover: { r: 255, g: 255, b: 255, a: 0.2 },
		life_stroke: { r: 255, g: 255, b: 255, a: 0.85 },
		life_fill: { r: 255, g: 255, b: 255, a: 0.85 }
	};
	private transition = {
		active: false,
		startTime: 0,
		duration: 0,
		startColors: { ...this.currentColors },
		targetColors: { ...this.currentColors }
	};

	private fpsTimer = 0;
	private frameCount = 0;

	constructor() {
		this.target_zoom = this.controls.zoom_level;
	}

	mount(canvas: HTMLCanvasElement) {
		if (this.initialized) return;

		this.canvas = canvas;
		this.ctx = canvas.getContext('2d', { alpha: false }) as CanvasRenderingContext2D;

		this.canvas_rect = canvas.getBoundingClientRect();
		this.width = this.canvas_rect.width;
		this.height = this.canvas_rect.height;
		this.canvas.width = this.width;
		this.canvas.height = this.height;

		this.COLS = Math.floor(this.width / this.CELL_SIZE);
		this.ROWS = Math.floor(this.height / this.CELL_SIZE);

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

		this.lastFrameTime = performance.now();
		this.fpsTimer = this.lastFrameTime;

		this.animate(this.lastFrameTime);

		console.log('engine initialized');
		this.initialized = true;
	}

	private get_theme() {
		const styles = getComputedStyle(document.documentElement);
		const bg = styles.getPropertyValue('--color-bg').trim();
		const grid = styles.getPropertyValue('--color-grid').trim();
		const grid_hover = styles.getPropertyValue('--color-grid-hover').trim();
		const life_stroke = styles.getPropertyValue('--color-life-stroke').trim();
		const life_fill = styles.getPropertyValue('--color-life-fill').trim();

		if (bg) this.currentColors.background = this.parseCssColor(bg);
		if (grid) this.currentColors.grid = this.parseCssColor(grid);
		if (grid_hover) this.currentColors.grid_hover = this.parseCssColor(grid_hover);
		if (life_stroke) this.currentColors.life_stroke = this.parseCssColor(life_stroke);
		if (life_fill) this.currentColors.life_fill = this.parseCssColor(life_fill);
	}

	private parseCssColor(cssString: string, defaultAlpha = 1): RGBA {
		if (!cssString) return { r: 0, g: 0, b: 0, a: 1 };
		const match = cssString.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);

		if (match) {
			return {
				r: parseInt(match[1], 10),
				g: parseInt(match[2], 10),
				b: parseInt(match[3], 10),
				a: match[4] ? parseFloat(match[4]) : defaultAlpha
			};
		}
		return { r: 0, g: 0, b: 0, a: 1 };
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

		// --- FPS CALCULATION ---
		this.frameCount++;
		if (currentTime - this.fpsTimer >= 1000) {
			this.stats.fps = this.frameCount;
			this.frameCount = 0;
			this.fpsTimer = currentTime;
		}

		let deltaTime = currentTime - this.lastFrameTime;
		this.lastFrameTime = currentTime;

		if (document.hidden) return;
		if (deltaTime > 50) deltaTime = 50;

		const simDelta = deltaTime * this.controls.time_scale;

		if (this.isAnimating) {
			this.animationProgress += simDelta / ANIMATION_DURATION;
			if (this.animationProgress >= 1) {
				this.animationProgress = 1;
				this.completeTransition();
			}
		}

		this.updateCamera();
		this.updatePhysics(deltaTime, this.controls.time_scale);
		this.draw();

		if (this.controls.playing && !this.isAnimating) {
			this.timeSinceLastUpdate += simDelta;
			if (this.timeSinceLastUpdate > UPDATE_INTERVAL) {
				this.updateGrid();
				this.timeSinceLastUpdate -= UPDATE_INTERVAL;
			}
		}
	};

	updateGrid = () => {
		let active = 0;
		let born = 0;
		let died = 0;

		for (let row = 0; row < this.ROWS; row++) {
			for (let col = 0; col < this.COLS; col++) {
				const neighbors = this.countNeighbors(row, col);
				const isAlive = this.grid[row][col];

				// Determine fate
				const willBeAlive = isAlive ? neighbors === 2 || neighbors === 3 : neighbors === 3;
				this.nextGrid[row][col] = willBeAlive;

				// --- STATS COUNTING ---
				if (willBeAlive) active++;
				if (!isAlive && willBeAlive) born++;
				if (isAlive && !willBeAlive) died++;
			}
		}

		this.stats.n_gens++;
		this.stats.n_active = active;
		this.stats.n_born = born;
		this.stats.n_died = died;

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
							scale: 0.1,
							dying: false,
							isManual: true
						});
					}
				}

				// Cells about to be born
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
							isManual: false
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

		// --- OPTIMIZATION START ---
		// Snapshot reactive values to avoid Proxy overhead in the loop
		const STIFFNESS = this.controls.stiffness;
		const DAMPING = this.controls.damping;
		const CELL_SIZE = this.CELL_SIZE;
		// --- OPTIMIZATION END ---

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
				cell.targetX = cell.gridX * CELL_SIZE + CELL_SIZE / 2 + wobbleX;
				cell.targetY = cell.gridY * CELL_SIZE + CELL_SIZE / 2 + wobbleY;

				if (cell.isManual) {
					cell.scale += (1 - cell.scale) * 15 * tSec;
					if (cell.scale > 0.99) {
						cell.scale = 1;
						cell.isManual = false;
					}
				} else if (this.isAnimating && cell.scale < 1) {
					cell.scale = this.lerp(0.5, 1, progress);
				} else if (!this.isAnimating && !cell.isManual) {
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

			// Use local STIFFNESS
			cell.vx += ((dx * STIFFNESS) / 4) * tSec;
			cell.vy += ((dy * STIFFNESS) / 4) * tSec;

			// Use local DAMPING
			const d = Math.pow(DAMPING, tSec);
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

	private getEdgePoint(
		x1: number,
		y1: number,
		val1: number,
		x2: number,
		y2: number,
		val2: number,
		threshold: number
	) {
		if (Math.abs(val1 - val2) < 0.001) return { x: (x1 + x2) / 2, y: (y1 + y2) / 2 };
		const t = (threshold - val1) / (val2 - val1);
		return { x: this.lerp(x1, x2, t), y: this.lerp(y1, y2, t) };
	}

	private drawMetaballs(startRow: number, endRow: number, startCol: number, endCol: number) {
		// --- OPTIMIZATION START ---
		// Snapshot these values! Accessing $derived inside loops kills performance.
		const METABALL_RADIUS_SQ = this.METABALL_RADIUS_SQ;
		const METABALL_THRESHOLD = this.METABALL_THRESHOLD;
		const RENDER_RESOLUTION = this.RENDER_RESOLUTION;
		const INFLUENCE_RADIUS = this.INFLUENCE_RADIUS;
		const CELL_SIZE = this.CELL_SIZE;
		// --- OPTIMIZATION END ---

		const startX = startCol * CELL_SIZE;
		const startY = startRow * CELL_SIZE;
		const endX = endCol * CELL_SIZE;
		const endY = endRow * CELL_SIZE;

		const bufW = Math.ceil((endX - startX) / RENDER_RESOLUTION) + 1;
		const bufH = Math.ceil((endY - startY) / RENDER_RESOLUTION) + 1;
		const reqSize = bufW * bufH;

		if (this.fieldBuffer.length < reqSize) this.fieldBuffer = new Float32Array(reqSize);
		else this.fieldBuffer.fill(0, 0, reqSize);

		this.fieldWidth = bufW;
		this.fieldHeight = bufH;

		// 1. Calculate Field Strengths (Use local vars)
		for (const cell of this.visualCells.values()) {
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
					if (distSq > 0.1) this.fieldBuffer[rowOffset + bx] += strength / distSq;
					else this.fieldBuffer[rowOffset + bx] += 100;
				}
			}
		}

		const ctx = this.ctx!;

		// =========================================
		// PASS 1: FILL (Polygons + Solid Rects)
		// =========================================
		ctx.fillStyle = rgbaToString(this.currentColors.life_fill);
		ctx.beginPath();

		for (let by = 0; by < bufH - 1; by++) {
			const rowOffset = by * bufW;
			const nextRowOffset = (by + 1) * bufW;
			const y = startY + by * RENDER_RESOLUTION;

			for (let bx = 0; bx < bufW - 1; bx++) {
				const tl = this.fieldBuffer[rowOffset + bx];
				const tr = this.fieldBuffer[rowOffset + bx + 1];
				const bl = this.fieldBuffer[nextRowOffset + bx];
				const br = this.fieldBuffer[nextRowOffset + bx + 1];

				let caseId = 0;
				if (tl >= METABALL_THRESHOLD) caseId |= 1;
				if (tr >= METABALL_THRESHOLD) caseId |= 2;
				if (br >= METABALL_THRESHOLD) caseId |= 4;
				if (bl >= METABALL_THRESHOLD) caseId |= 8;

				if (caseId === 0) continue;

				const x = startX + bx * RENDER_RESOLUTION;

				if (caseId === 15) {
					ctx.rect(x, y, RENDER_RESOLUTION, RENDER_RESOLUTION);
					continue;
				}

				// Interpolation using local METABALL_THRESHOLD
				const top = this.getEdgePoint(x, y, tl, x + RENDER_RESOLUTION, y, tr, METABALL_THRESHOLD);
				const right = this.getEdgePoint(
					x + RENDER_RESOLUTION,
					y,
					tr,
					x + RENDER_RESOLUTION,
					y + RENDER_RESOLUTION,
					br,
					METABALL_THRESHOLD
				);
				const bottom = this.getEdgePoint(
					x + RENDER_RESOLUTION,
					y + RENDER_RESOLUTION,
					br,
					x,
					y + RENDER_RESOLUTION,
					bl,
					METABALL_THRESHOLD
				);
				const left = this.getEdgePoint(x, y + RENDER_RESOLUTION, bl, x, y, tl, METABALL_THRESHOLD);

				switch (caseId) {
					case 1:
						ctx.moveTo(top.x, top.y);
						ctx.lineTo(left.x, left.y);
						ctx.lineTo(x, y);
						break;
					case 2:
						ctx.moveTo(right.x, right.y);
						ctx.lineTo(top.x, top.y);
						ctx.lineTo(x + RENDER_RESOLUTION, y);
						break;
					case 3:
						ctx.moveTo(right.x, right.y);
						ctx.lineTo(left.x, left.y);
						ctx.lineTo(x, y);
						ctx.lineTo(x + RENDER_RESOLUTION, y);
						break;
					case 4:
						ctx.moveTo(bottom.x, bottom.y);
						ctx.lineTo(right.x, right.y);
						ctx.lineTo(x + RENDER_RESOLUTION, y + RENDER_RESOLUTION);
						break;
					case 5:
						ctx.moveTo(top.x, top.y);
						ctx.lineTo(left.x, left.y);
						ctx.lineTo(x, y);
						ctx.moveTo(bottom.x, bottom.y);
						ctx.lineTo(right.x, right.y);
						ctx.lineTo(x + RENDER_RESOLUTION, y + RENDER_RESOLUTION);
						break;
					case 6:
						ctx.moveTo(bottom.x, bottom.y);
						ctx.lineTo(top.x, top.y);
						ctx.lineTo(x + RENDER_RESOLUTION, y);
						ctx.lineTo(x + RENDER_RESOLUTION, y + RENDER_RESOLUTION);
						break;
					case 7:
						ctx.moveTo(bottom.x, bottom.y);
						ctx.lineTo(left.x, left.y);
						ctx.lineTo(x, y);
						ctx.lineTo(x + RENDER_RESOLUTION, y);
						ctx.lineTo(x + RENDER_RESOLUTION, y + RENDER_RESOLUTION);
						break;
					case 8:
						ctx.moveTo(left.x, left.y);
						ctx.lineTo(bottom.x, bottom.y);
						ctx.lineTo(x, y + RENDER_RESOLUTION);
						break;
					case 9:
						ctx.moveTo(top.x, top.y);
						ctx.lineTo(bottom.x, bottom.y);
						ctx.lineTo(x, y + RENDER_RESOLUTION);
						ctx.lineTo(x, y);
						break;
					case 10:
						ctx.moveTo(right.x, right.y);
						ctx.lineTo(top.x, top.y);
						ctx.lineTo(x + RENDER_RESOLUTION, y);
						ctx.moveTo(left.x, left.y);
						ctx.lineTo(bottom.x, bottom.y);
						ctx.lineTo(x, y + RENDER_RESOLUTION);
						break;
					case 11:
						ctx.moveTo(right.x, right.y);
						ctx.lineTo(bottom.x, bottom.y);
						ctx.lineTo(x, y + RENDER_RESOLUTION);
						ctx.lineTo(x, y);
						ctx.lineTo(x + RENDER_RESOLUTION, y);
						break;
					case 12:
						ctx.moveTo(left.x, left.y);
						ctx.lineTo(right.x, right.y);
						ctx.lineTo(x + RENDER_RESOLUTION, y + RENDER_RESOLUTION);
						ctx.lineTo(x, y + RENDER_RESOLUTION);
						break;
					case 13:
						ctx.moveTo(top.x, top.y);
						ctx.lineTo(right.x, right.y);
						ctx.lineTo(x + RENDER_RESOLUTION, y + RENDER_RESOLUTION);
						ctx.lineTo(x, y + RENDER_RESOLUTION);
						ctx.lineTo(x, y);
						break;
					case 14:
						ctx.moveTo(top.x, top.y);
						ctx.lineTo(left.x, left.y);
						ctx.lineTo(x, y + RENDER_RESOLUTION);
						ctx.lineTo(x + RENDER_RESOLUTION, y + RENDER_RESOLUTION);
						ctx.lineTo(x + RENDER_RESOLUTION, y);
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
		ctx.strokeStyle = rgbaToString(this.currentColors.life_stroke);

		ctx.beginPath();

		for (let by = 0; by < bufH - 1; by++) {
			const rowOffset = by * bufW;
			const nextRowOffset = (by + 1) * bufW;
			const y = startY + by * RENDER_RESOLUTION;

			for (let bx = 0; bx < bufW - 1; bx++) {
				const tl = this.fieldBuffer[rowOffset + bx];
				const tr = this.fieldBuffer[rowOffset + bx + 1];
				const bl = this.fieldBuffer[nextRowOffset + bx];
				const br = this.fieldBuffer[nextRowOffset + bx + 1];

				let caseId = 0;
				if (tl >= METABALL_THRESHOLD) caseId |= 1;
				if (tr >= METABALL_THRESHOLD) caseId |= 2;
				if (br >= METABALL_THRESHOLD) caseId |= 4;
				if (bl >= METABALL_THRESHOLD) caseId |= 8;

				if (caseId === 0 || caseId === 15) continue;

				const x = startX + bx * RENDER_RESOLUTION;

				const top = this.getEdgePoint(x, y, tl, x + RENDER_RESOLUTION, y, tr, METABALL_THRESHOLD);
				const right = this.getEdgePoint(
					x + RENDER_RESOLUTION,
					y,
					tr,
					x + RENDER_RESOLUTION,
					y + RENDER_RESOLUTION,
					br,
					METABALL_THRESHOLD
				);
				const bottom = this.getEdgePoint(
					x + RENDER_RESOLUTION,
					y + RENDER_RESOLUTION,
					br,
					x,
					y + RENDER_RESOLUTION,
					bl,
					METABALL_THRESHOLD
				);
				const left = this.getEdgePoint(x, y + RENDER_RESOLUTION, bl, x, y, tl, METABALL_THRESHOLD);

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

		// --- OPTIMIZATION START ---
		const ZOOM = this.controls.zoom_level;
		const PAN_X = this.pan_offset.x;
		const PAN_Y = this.pan_offset.y;
		const CELL_SIZE = this.CELL_SIZE;
		// --- OPTIMIZATION END ---

		ctx.fillStyle = rgbaToString(this.currentColors.background);
		ctx.fillRect(0, 0, this.width, this.height);
		ctx.save();
		ctx.translate(PAN_X, PAN_Y);
		ctx.scale(ZOOM, ZOOM);

		const margin = 2;
		const startCol = Math.max(0, Math.floor(-PAN_X / ZOOM / CELL_SIZE) - margin);
		const endCol = Math.min(this.COLS, Math.ceil((this.width - PAN_X) / ZOOM / CELL_SIZE) + margin);
		const startRow = Math.max(0, Math.floor(-PAN_Y / ZOOM / CELL_SIZE) - margin);
		const endRow = Math.min(
			this.ROWS,
			Math.ceil((this.height - PAN_Y) / ZOOM / CELL_SIZE) + margin
		);

		if (ZOOM > 0.5) {
			ctx.strokeStyle = rgbaToString(this.currentColors.grid);
			ctx.lineWidth = 0.5 / ZOOM;
			ctx.beginPath();
			for (let i = startRow; i <= endRow; i++) {
				const y = i * CELL_SIZE;
				ctx.moveTo(startCol * CELL_SIZE, y);
				ctx.lineTo(endCol * CELL_SIZE, y);
			}
			for (let i = startCol; i <= endCol; i++) {
				const x = i * CELL_SIZE;
				ctx.moveTo(x, startRow * CELL_SIZE);
				ctx.lineTo(x, endRow * CELL_SIZE);
			}
			ctx.stroke();
		}

		// DRAW HOVER EFFECT
		if (this.hover_pos) {
			const { col, row } = this.hover_pos;
			if (col >= 0 && col < this.COLS && row >= 0 && row < this.ROWS) {
				const x = col * CELL_SIZE;
				const y = row * CELL_SIZE;
				ctx.fillStyle = rgbaToString(this.currentColors.grid_hover); // Used theme hover color
				ctx.beginPath();
				if (ctx.roundRect) {
					ctx.roundRect(x + 2, y + 2, CELL_SIZE - 4, CELL_SIZE - 4, 4);
				} else {
					ctx.rect(x + 2, y + 2, CELL_SIZE - 4, CELL_SIZE - 4);
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
		this.controls.playing = !this.controls.playing;
		if (this.controls.playing) this.timeSinceLastUpdate = 0;
		this.draw();
	};

	pause = () => {
		if (this.controls.playing) this.togglePlay();
	};

	next_frame = () => {
		this.updateGrid();
	};

	drawPattern(rle_pattern: Pattern, theme?: string) {
		// ... existing setup logic ...
		this.controls.playing = false;
		this.isAnimating = true;
		this.animationProgress = 0;
		this.timeSinceLastUpdate = 0;

		if (theme) this.setTheme(theme);
		this.current_pattern = rle_pattern;

		// Reset Stats
		this.stats.n_gens = 0;
		this.stats.n_born = 0;
		this.stats.n_died = 0;

		// ... existing grid clearing logic ...
		for (let r = 0; r < this.ROWS; r++) {
			this.nextGrid[r].fill(false);
		}

		const { pattern, width, height } = rle_pattern;
		const startCol = Math.floor((this.COLS - width) / 2);
		const startRow = Math.floor((this.ROWS - height) / 2);

		let active = 0; // Track active cells in the new pattern

		for (let row = 0; row < height; row++) {
			for (let col = 0; col < width; col++) {
				const gridRow = startRow + row;
				const gridCol = startCol + col;

				if (gridRow >= 0 && gridRow < this.ROWS && gridCol >= 0 && gridCol < this.COLS) {
					const isAlive = pattern[row][col];
					this.nextGrid[gridRow][gridCol] = isAlive;
					if (isAlive) active++; // Count it
				}
			}
		}

		this.stats.n_active = active; // Update state

		this.syncVisualCells();
		this.centerView(50);
		this.draw();
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
		if (this.theme === themeName) return;
		this.theme = themeName;
		document.documentElement.setAttribute('theme', themeName);

		this.transition.startColors = {
			background: { ...this.currentColors.background },
			grid: { ...this.currentColors.grid },
			grid_hover: { ...this.currentColors.grid_hover },
			life_fill: { ...this.currentColors.life_fill },
			life_stroke: { ...this.currentColors.life_stroke }
		};

		const styles = getComputedStyle(document.documentElement);

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

		this.transition.duration = duration;
		this.transition.startTime = performance.now();
		this.transition.active = true;

		if (!this.controls.playing && !this.isAnimating) {
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

		const ease = 1 - Math.pow(1 - progress, 4);

		const lerp = (start: number, end: number, t: number) => start + (end - start) * t;
		const lerpColor = (start: RGBA, end: RGBA, t: number): RGBA => ({
			r: lerp(start.r, end.r, t),
			g: lerp(start.g, end.g, t),
			b: lerp(start.b, end.b, t),
			a: lerp(start.a, end.a, t)
		});

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

		if (!this.controls.playing && this.transition.active) {
			this.draw();
			requestAnimationFrame(() => this.processColorTransition(performance.now()));
		}
	}

	clearGrid = () => {
		console.log('clearing grid smoothly');
		this.controls.playing = false;
		this.timeSinceLastUpdate = 0;

		// Reset stats
		this.stats.n_gens = 0;
		this.stats.n_active = 0;
		this.stats.n_born = 0;
		this.stats.n_died = 0;

		// ... existing animation logic ...
		for (let row = 0; row < this.ROWS; row++) {
			this.nextGrid[row].fill(false);
		}
		this.isAnimating = true;
		this.animationProgress = 0;
		this.syncVisualCells();
		this.draw();
	};

	resetPattern = () => {
		if (!this.current_pattern) return;

		// 1. Stop playback so it doesn't immediately evolve
		this.controls.playing = false;

		// 2. Reuse drawPattern to handle resetting stats, grid, and recentering
		// We pass the saved pattern back into the loader.
		this.drawPattern(this.current_pattern);
	};

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
