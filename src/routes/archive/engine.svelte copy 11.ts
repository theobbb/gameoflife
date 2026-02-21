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
export const RENDER_RESOLUTION = [5, 1, 9];
export const INFLUENCE_RADIUS = [6.0, 1.0, 11.0];

const ANIMATION_DURATION = 500;
const UPDATE_INTERVAL = 100;

// Camera Settings
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 8;
const ZOOM_SENSITIVITY = 0.1;
const CAMERA_SMOOTHING = 0.25; // Adjusted for snappier feel

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

// Cached color strings to avoid string manipulation every frame
type ColorCache = {
	background: string;
	grid: string;
	grid_hover: string;
	life_stroke: string;
	life_fill: string;
};

export class Engine {
	// --- STATE (Runes) ---
	stats = $state({ n_gens: 0, fps: 0, n_active: 0, n_born: 0, n_died: 0 });
	current_pattern: Pattern | null = $state(null);
	theme = $state('default');

	controls = $state({
		playing: false,
		interactive: false,
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

	// --- INFINITE GRID DATA ---
	private CELL_SIZE = BASE_CELL_SIZE;

	// Sparse storage: "x,y" strings
	private activeCells: Set<string> = new Set();
	private nextActiveCells: Set<string> = new Set();

	// Visuals & Physics
	private visualCells: Map<string, Cell> = new Map();
	private dyingCells: Map<string, Cell> = new Map();
	private fieldBuffer = new Float32Array(0);

	// Reuse Paths to avoid GC
	private fillPath: Path2D | null = null;
	private strokePath: Path2D | null = null;

	// Camera Physics
	private pan_offset: Vector2 = { x: 0, y: 0 };
	private target_zoom = 4;
	private target_pan: Vector2 = { x: 0, y: 0 };

	// Input State
	private hover_pos: { col: number; row: number } | null = null;
	private isMouseDown = false;
	private isPanning = false;
	private lastMousePos: Vector2 = { x: 0, y: 0 };

	// Loop & Time Logic
	private lastFrameTime = 0;
	private timeSinceLastUpdate = 0;
	private isAnimating = false;
	private animationProgress = 0;
	private fpsTimer = 0;
	private frameCount = 0;

	private currentColors = {
		background: { r: 17, g: 17, b: 17, a: 1 },
		grid: { r: 255, g: 255, b: 255, a: 0.2 },
		grid_hover: { r: 255, g: 255, b: 255, a: 0.2 },
		life_stroke: { r: 255, g: 255, b: 255, a: 0.85 },
		life_fill: { r: 255, g: 255, b: 255, a: 0.85 }
	};

	// Pre-computed CSS strings
	private cachedColors: ColorCache = {
		background: 'rgba(17,17,17,1)',
		grid: 'rgba(255,255,255,0.2)',
		grid_hover: 'rgba(255,255,255,0.2)',
		life_stroke: 'rgba(255,255,255,0.85)',
		life_fill: 'rgba(255,255,255,0.85)'
	};

	private transition = {
		active: false,
		startTime: 0,
		duration: 0,
		startColors: { ...this.currentColors },
		targetColors: { ...this.currentColors }
	};

	constructor() {
		this.target_zoom = this.controls.zoom_level;
	}

	mount(canvas: HTMLCanvasElement) {
		if (this.initialized) return;

		this.canvas = canvas;
		this.ctx = canvas.getContext('2d', { alpha: false }) as CanvasRenderingContext2D;

		this.resize();
		this.pan_offset = {
			x: this.width / 2,
			y: this.height / 2
		};
		this.target_pan = { ...this.pan_offset };

		this.setupListeners();
		this.get_theme();
		this.syncVisualCells();

		this.lastFrameTime = performance.now();
		this.fpsTimer = this.lastFrameTime;
		this.animate(this.lastFrameTime);

		console.log('engine initialized (Infinite Grid / Optimized)');
		this.initialized = true;
	}

	private get_theme() {
		const styles = getComputedStyle(document.documentElement);
		const getCol = (name: string) => styles.getPropertyValue(name).trim();

		const bg = getCol('--color-bg');
		const grid = getCol('--color-grid');
		const hover = getCol('--color-grid-hover');
		const stroke = getCol('--color-life-stroke');
		const fill = getCol('--color-life-fill');

		if (bg) this.currentColors.background = this.parseCssColor(bg);
		if (grid) this.currentColors.grid = this.parseCssColor(grid);
		if (hover) this.currentColors.grid_hover = this.parseCssColor(hover);
		if (stroke) this.currentColors.life_stroke = this.parseCssColor(stroke);
		if (fill) this.currentColors.life_fill = this.parseCssColor(fill);

		this.updateColorCache();
	}

	private updateColorCache() {
		this.cachedColors.background = rgbaToString(this.currentColors.background);
		this.cachedColors.grid = rgbaToString(this.currentColors.grid);
		this.cachedColors.grid_hover = rgbaToString(this.currentColors.grid_hover);
		this.cachedColors.life_stroke = rgbaToString(this.currentColors.life_stroke);
		this.cachedColors.life_fill = rgbaToString(this.currentColors.life_fill);
	}

	private resize() {
		if (!this.canvas) return;
		this.canvas_rect = this.canvas.getBoundingClientRect();
		this.width = this.canvas_rect.width;
		this.height = this.canvas_rect.height;
		this.canvas.width = this.width;
		this.canvas.height = this.height;
	}

	destroy() {
		console.log('destroying engine...');
		if (this.animationId) cancelAnimationFrame(this.animationId);
		this.removeListeners();
		this.initialized = false;
		this.current_pattern = null;
	}

	// --- COORDINATE HELPERS ---

	// Simple string concatenation is fast enough for sparse grids
	private getKey(col: number, row: number) {
		return `${col},${row}`;
	}

	private parseKey(key: string): { col: number; row: number } {
		// Optimized: avoid creating array if possible, but split is robust
		const split = key.split(',');
		return { col: +split[0], row: +split[1] };
	}

	// --- GAME LOOP ---

	private animate = (currentTime: number) => {
		this.animationId = requestAnimationFrame(this.animate);
		this.processColorTransition(currentTime);

		// FPS Calculation
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
		if (this.isAnimating) this.completeTransition();

		const neighborCounts = new Map<string, number>();
		const potentialCells = new Set<string>();

		// 1. Identify all active cells and their neighbors
		for (const key of this.activeCells) {
			potentialCells.add(key);
			const { col, row } = this.parseKey(key);

			// Unrolled loop for performance
			let nKey: string;
			// Top Row
			nKey = this.getKey(col - 1, row - 1);
			neighborCounts.set(nKey, (neighborCounts.get(nKey) || 0) + 1);
			potentialCells.add(nKey);
			nKey = this.getKey(col, row - 1);
			neighborCounts.set(nKey, (neighborCounts.get(nKey) || 0) + 1);
			potentialCells.add(nKey);
			nKey = this.getKey(col + 1, row - 1);
			neighborCounts.set(nKey, (neighborCounts.get(nKey) || 0) + 1);
			potentialCells.add(nKey);
			// Middle Row
			nKey = this.getKey(col - 1, row);
			neighborCounts.set(nKey, (neighborCounts.get(nKey) || 0) + 1);
			potentialCells.add(nKey);
			nKey = this.getKey(col + 1, row);
			neighborCounts.set(nKey, (neighborCounts.get(nKey) || 0) + 1);
			potentialCells.add(nKey);
			// Bottom Row
			nKey = this.getKey(col - 1, row + 1);
			neighborCounts.set(nKey, (neighborCounts.get(nKey) || 0) + 1);
			potentialCells.add(nKey);
			nKey = this.getKey(col, row + 1);
			neighborCounts.set(nKey, (neighborCounts.get(nKey) || 0) + 1);
			potentialCells.add(nKey);
			nKey = this.getKey(col + 1, row + 1);
			neighborCounts.set(nKey, (neighborCounts.get(nKey) || 0) + 1);
			potentialCells.add(nKey);
		}

		this.nextActiveCells.clear();
		let active = 0,
			born = 0,
			died = 0;

		// 2. Apply Rules
		for (const key of potentialCells) {
			const count = neighborCounts.get(key) || 0;
			const wasAlive = this.activeCells.has(key);
			const willBeAlive = wasAlive ? count === 2 || count === 3 : count === 3;

			if (willBeAlive) {
				this.nextActiveCells.add(key);
				active++;
				if (!wasAlive) born++;
			} else if (wasAlive) {
				died++;
			}
		}

		// 3. Update Stats & Trigger Animation
		this.stats.n_gens++;
		this.stats.n_active = active;
		this.stats.n_born = born;
		this.stats.n_died = died;

		this.isAnimating = true;
		this.animationProgress = 0;
		this.syncVisualCells();
	};

	private syncVisualCells() {
		const allKeys = new Set([...this.activeCells, ...this.nextActiveCells]);
		this.dyingCells.clear();

		for (const key of allKeys) {
			const isAlive = this.activeCells.has(key);
			const willBeAlive = this.nextActiveCells.has(key);

			// Existing / Manual Add
			if (isAlive) {
				if (!this.visualCells.has(key)) {
					const { col, row } = this.parseKey(key);
					this.createVisualCell(key, col, row, true);
				}
			}

			// Born
			if (!isAlive && willBeAlive && this.isAnimating) {
				if (!this.visualCells.has(key)) {
					const { col, row } = this.parseKey(key);
					this.createBornCell(key, col, row);
				}
			}

			// Dying
			if (isAlive && !willBeAlive && this.isAnimating) {
				const cell = this.visualCells.get(key);
				if (cell) {
					cell.dying = true;
					// Random dispersion for dying cells
					const angle = Math.random() * 6.28318;
					const dist = this.CELL_SIZE * 2.5;
					cell.targetX = cell.x + Math.cos(angle) * dist;
					cell.targetY = cell.y + Math.sin(angle) * dist;
					this.dyingCells.set(key, cell);
				}
			}
		}

		if (!this.isAnimating) {
			// Prune dead cells immediately if not animating
			for (const key of this.visualCells.keys()) {
				if (!this.activeCells.has(key)) this.visualCells.delete(key);
			}
		}
	}

	private createVisualCell(key: string, col: number, row: number, isManual: boolean) {
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
			phase: Math.random() * 6.28318,
			phaseSpeed: 0.5 + Math.random() * 0.5,
			alpha: 1,
			scale: 0.1,
			dying: false,
			isManual: isManual
		});
	}

	private createBornCell(key: string, col: number, row: number) {
		const targetX = col * this.CELL_SIZE + this.CELL_SIZE / 2;
		const targetY = row * this.CELL_SIZE + this.CELL_SIZE / 2;

		let startX = targetX;
		let startY = targetY;

		// Optimization: Check neighbors via simple string math first
		for (let dy = -1; dy <= 1; dy++) {
			for (let dx = -1; dx <= 1; dx++) {
				if (dx === 0 && dy === 0) continue;
				if (this.activeCells.has(this.getKey(col + dx, row + dy))) {
					startX -= dx * this.CELL_SIZE;
					startY -= dy * this.CELL_SIZE;
					// Break out of both loops
					dy = 2;
					break;
				}
			}
		}

		this.visualCells.set(key, {
			gridX: col,
			gridY: row,
			x: startX,
			y: startY,
			vx: 0,
			vy: 0,
			targetX,
			targetY,
			phase: Math.random() * 6.28318,
			phaseSpeed: 0.5 + Math.random() * 0.5,
			alpha: 1,
			scale: 0.5,
			dying: false,
			isManual: false
		});
	}

	private completeTransition() {
		const temp = this.activeCells;
		this.activeCells = this.nextActiveCells;
		this.nextActiveCells = temp;
		this.nextActiveCells.clear();

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

	// --- PHYSICS ---

	private lerp(a: number, b: number, t: number): number {
		return a + (b - a) * t;
	}

	private updatePhysics(dt: number, scale: number) {
		const tSec = (dt / 1000) * scale;
		const STIFFNESS = this.controls.stiffness;
		const DAMPING = Math.pow(this.controls.damping, tSec); // Pre-calc damping power
		const CELL_SIZE = this.CELL_SIZE;

		// Pre-calc animation curve
		const progress = this.isAnimating
			? this.animationProgress < 0.5
				? 4 * this.animationProgress ** 3
				: 1 - Math.pow(-2 * this.animationProgress + 2, 3) / 2
			: 0;

		for (const cell of this.visualCells.values()) {
			cell.phase += cell.phaseSpeed * tSec;

			// Optimization: select wobble amount once
			const wobbleAmount = this.isAnimating ? this.lerp(2, 0.5, Math.sin(progress * Math.PI)) : 2;
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
					cell.scale = 0.5 + 0.5 * progress; // Inlined Lerp
				} else if (!this.isAnimating && !cell.isManual) {
					cell.scale = 1;
				}
			} else {
				cell.scale = 1 - progress;
				cell.alpha = 1 - progress;
			}

			// Spring Physics
			const dx = cell.targetX - cell.x;
			const dy = cell.targetY - cell.y;

			cell.vx += dx * STIFFNESS * 0.25 * tSec;
			cell.vy += dy * STIFFNESS * 0.25 * tSec;

			cell.vx *= DAMPING;
			cell.vy *= DAMPING;

			cell.x += cell.vx * tSec * 60;
			cell.y += cell.vy * tSec * 60;
		}
	}

	private updateCamera() {
		// Smooth Camera Transition
		this.controls.zoom_level += (this.target_zoom - this.controls.zoom_level) * CAMERA_SMOOTHING;
		this.pan_offset.x += (this.target_pan.x - this.pan_offset.x) * CAMERA_SMOOTHING;
		this.pan_offset.y += (this.target_pan.y - this.pan_offset.y) * CAMERA_SMOOTHING;

		// Snapping for crispness when settled
		if (Math.abs(this.target_zoom - this.controls.zoom_level) < 0.0001)
			this.controls.zoom_level = this.target_zoom;

		if (Math.abs(this.target_pan.x - this.pan_offset.x) < 0.01)
			this.pan_offset.x = this.target_pan.x;

		if (Math.abs(this.target_pan.y - this.pan_offset.y) < 0.01)
			this.pan_offset.y = this.target_pan.y;
	}

	// --- DRAWING ---

	private drawMetaballs(minX: number, maxX: number, minY: number, maxY: number) {
		const RENDER_RES = this.RENDER_RESOLUTION;
		const INF_RAD = this.INFLUENCE_RADIUS;

		// 1. Setup Buffers
		// Round to resolution alignment
		const startX = Math.floor(minX / RENDER_RES) * RENDER_RES - INF_RAD;
		const endX = Math.ceil(maxX / RENDER_RES) * RENDER_RES + INF_RAD;
		const startY = Math.floor(minY / RENDER_RES) * RENDER_RES - INF_RAD;
		const endY = Math.ceil(maxY / RENDER_RES) * RENDER_RES + INF_RAD;

		const bufW = Math.ceil((endX - startX) / RENDER_RES) + 1;
		const bufH = Math.ceil((endY - startY) / RENDER_RES) + 1;
		const reqSize = bufW * bufH;

		if (this.fieldBuffer.length < reqSize) this.fieldBuffer = new Float32Array(reqSize);
		this.fieldBuffer.fill(0, 0, reqSize);

		const META_RAD_SQ = this.METABALL_RADIUS_SQ;
		const META_THRESH = this.METABALL_THRESHOLD;

		// 2. Splatting: Add cells to field
		for (const cell of this.visualCells.values()) {
			if (
				cell.x < startX - INF_RAD ||
				cell.x > endX + INF_RAD ||
				cell.y < startY - INF_RAD ||
				cell.y > endY + INF_RAD
			)
				continue;

			const strength = META_RAD_SQ * (cell.scale * cell.scale) * cell.alpha;
			if (strength < 0.01) continue;

			// Optimization: Integer conversions moved out of loop
			const fx = (cell.x - startX) / RENDER_RES;
			const fy = (cell.y - startY) / RENDER_RES;
			const radUnits = INF_RAD / RENDER_RES;

			const cMinX = Math.max(0, Math.floor(fx - radUnits));
			const cMaxX = Math.min(bufW - 1, Math.ceil(fx + radUnits));
			const cMinY = Math.max(0, Math.floor(fy - radUnits));
			const cMaxY = Math.min(bufH - 1, Math.ceil(fy + radUnits));

			for (let by = cMinY; by <= cMaxY; by++) {
				const worldY = startY + by * RENDER_RES;
				const dy = worldY - cell.y;
				const dy2 = dy * dy;
				const rowOffset = by * bufW;

				for (let bx = cMinX; bx <= cMaxX; bx++) {
					const worldX = startX + bx * RENDER_RES;
					const dx = worldX - cell.x;
					const distSq = dx * dx + dy2;

					// Avoid expensive sqrt, use inverse square law
					if (distSq > 0.1) this.fieldBuffer[rowOffset + bx] += strength / distSq;
					else this.fieldBuffer[rowOffset + bx] += 100; // Cap singularity
				}
			}
		}

		// 3. Marching Squares (Optimized Dual-Path)
		const ctx = this.ctx!;
		ctx.fillStyle = this.cachedColors.life_fill;
		ctx.strokeStyle = this.cachedColors.life_stroke;
		ctx.lineWidth = 3 / this.controls.zoom_level;
		ctx.lineCap = 'round';
		ctx.lineJoin = 'round';

		// Clear paths without GC
		this.fillPath = new Path2D();
		this.strokePath = new Path2D();

		this.march(startX, startY, bufW, bufH, RENDER_RES, META_THRESH);

		ctx.fill(this.fillPath);
		ctx.stroke(this.strokePath);
	}

	private march(startX: number, startY: number, w: number, h: number, res: number, thresh: number) {
		if (!this.fillPath || !this.strokePath) return;

		let x = 0,
			y = 0;
		let tl = 0,
			tr = 0,
			bl = 0,
			br = 0;
		let caseId = 0;

		let tx = 0,
			ry = 0,
			bx_pos = 0,
			ly = 0;

		for (let by = 0; by < h - 1; by++) {
			const rowOffset = by * w;
			const nextRowOffset = (by + 1) * w;
			y = startY + by * res;

			for (let bx = 0; bx < w - 1; bx++) {
				tl = this.fieldBuffer[rowOffset + bx];
				tr = this.fieldBuffer[rowOffset + bx + 1];
				bl = this.fieldBuffer[nextRowOffset + bx];
				br = this.fieldBuffer[nextRowOffset + bx + 1];

				caseId = 0;
				if (tl >= thresh) caseId |= 1;
				if (tr >= thresh) caseId |= 2;
				if (br >= thresh) caseId |= 4;
				if (bl >= thresh) caseId |= 8;

				if (caseId === 0) continue;

				x = startX + bx * res;

				// Optimization: Case 15 (Full Block) -> Rectangle (Clockwise)
				if (caseId === 15) {
					this.fillPath.rect(x, y, res, res);
					continue;
				}

				const xRes = x + res;
				const yRes = y + res;

				// --- Safe Interpolation ---
				// Defaults to center if values are identical (prevents Infinity/NaN)
				if (Math.abs(tr - tl) > 0.0001) tx = x + (res * (thresh - tl)) / (tr - tl);
				else tx = x + res / 2;

				if (Math.abs(br - tr) > 0.0001) ry = y + (res * (thresh - tr)) / (br - tr);
				else ry = y + res / 2;

				if (Math.abs(br - bl) > 0.0001) bx_pos = x + (res * (thresh - bl)) / (br - bl);
				else bx_pos = x + res / 2;

				if (Math.abs(bl - tl) > 0.0001) ly = y + (res * (thresh - tl)) / (bl - tl);
				else ly = y + res / 2;

				// --- Geometry Construction (Strictly Clockwise) ---
				// TL=1, TR=2, BR=4, BL=8

				switch (caseId) {
					// --- Single Corner Cases ---
					case 1: // TL
						this.fillPath.moveTo(x, ly);
						this.fillPath.lineTo(tx, y);
						this.fillPath.lineTo(x, y);
						this.fillPath.closePath();
						this.strokePath.moveTo(x, ly);
						this.strokePath.lineTo(tx, y);
						break;
					case 2: // TR
						this.fillPath.moveTo(tx, y);
						this.fillPath.lineTo(xRes, ry);
						this.fillPath.lineTo(xRes, y);
						this.fillPath.closePath();
						this.strokePath.moveTo(tx, y);
						this.strokePath.lineTo(xRes, ry);
						break;
					case 4: // BR
						this.fillPath.moveTo(xRes, ry);
						this.fillPath.lineTo(bx_pos, yRes);
						this.fillPath.lineTo(xRes, yRes);
						this.fillPath.closePath();
						this.strokePath.moveTo(xRes, ry);
						this.strokePath.lineTo(bx_pos, yRes);
						break;
					case 8: // BL
						this.fillPath.moveTo(bx_pos, yRes);
						this.fillPath.lineTo(x, ly);
						this.fillPath.lineTo(x, yRes);
						this.fillPath.closePath();
						this.strokePath.moveTo(bx_pos, yRes);
						this.strokePath.lineTo(x, ly);
						break;

					// --- Full Edge Cases (Rows/Cols) ---
					case 3: // TL | TR (Top Row) -> Clockwise: LeftCut -> RightCut -> TR -> TL
						this.fillPath.moveTo(x, ly);
						this.fillPath.lineTo(xRes, ry);
						this.fillPath.lineTo(xRes, y);
						this.fillPath.lineTo(x, y);
						this.fillPath.closePath();
						this.strokePath.moveTo(x, ly);
						this.strokePath.lineTo(xRes, ry);
						break;
					case 6: // TR | BR (Right Col) -> Clockwise: TopCut -> BottomCut -> BR -> TR
						this.fillPath.moveTo(tx, y);
						this.fillPath.lineTo(bx_pos, yRes);
						this.fillPath.lineTo(xRes, yRes);
						this.fillPath.lineTo(xRes, y);
						this.fillPath.closePath();
						this.strokePath.moveTo(tx, y);
						this.strokePath.lineTo(bx_pos, yRes);
						break;
					case 9: // TL | BL (Left Col) -> Clockwise: TopCut -> TL -> BL -> BottomCut
						// Note: Previous glitch was here (was CCW).
						this.fillPath.moveTo(tx, y);
						this.fillPath.lineTo(x, y);
						this.fillPath.lineTo(x, yRes);
						this.fillPath.lineTo(bx_pos, yRes);
						this.fillPath.closePath();
						this.strokePath.moveTo(tx, y);
						this.strokePath.lineTo(bx_pos, yRes);
						break;
					case 12: // BL | BR (Bottom Row) -> Clockwise: LeftCut -> BL -> BR -> RightCut
						this.fillPath.moveTo(x, ly);
						this.fillPath.lineTo(x, yRes);
						this.fillPath.lineTo(xRes, yRes);
						this.fillPath.lineTo(xRes, ry);
						this.fillPath.closePath();
						this.strokePath.moveTo(x, ly);
						this.strokePath.lineTo(xRes, ry);
						break;

					// --- Saddle Cases (Two Corners) ---
					case 5: // TL | BR
						this.fillPath.moveTo(x, ly);
						this.fillPath.lineTo(tx, y);
						this.fillPath.lineTo(x, y);
						this.fillPath.closePath();
						this.fillPath.moveTo(xRes, ry);
						this.fillPath.lineTo(bx_pos, yRes);
						this.fillPath.lineTo(xRes, yRes);
						this.fillPath.closePath();
						this.strokePath.moveTo(x, ly);
						this.strokePath.lineTo(tx, y);
						this.strokePath.moveTo(xRes, ry);
						this.strokePath.lineTo(bx_pos, yRes);
						break;
					case 10: // TR | BL
						this.fillPath.moveTo(tx, y);
						this.fillPath.lineTo(xRes, ry);
						this.fillPath.lineTo(xRes, y);
						this.fillPath.closePath();
						this.fillPath.moveTo(bx_pos, yRes);
						this.fillPath.lineTo(x, ly);
						this.fillPath.lineTo(x, yRes);
						this.fillPath.closePath();
						this.strokePath.moveTo(tx, y);
						this.strokePath.lineTo(xRes, ry);
						this.strokePath.moveTo(bx_pos, yRes);
						this.strokePath.lineTo(x, ly);
						break;

					// --- 3-Corner Cases (Inverse Corners) ---
					case 7: // !BL (TL, TR, BR) -> Clockwise: LeftCut -> Top-Left -> Top-Right -> Bottom-Right -> BottomCut
						this.fillPath.moveTo(x, ly);
						this.fillPath.lineTo(x, y);
						this.fillPath.lineTo(xRes, y);
						this.fillPath.lineTo(xRes, yRes);
						this.fillPath.lineTo(bx_pos, yRes);
						this.fillPath.closePath();
						this.strokePath.moveTo(x, ly);
						this.strokePath.lineTo(bx_pos, yRes);
						break;
					case 11: // !BR (TL, TR, BL) -> Clockwise: RightCut -> Top-Right -> Top-Left -> Bottom-Left -> BottomCut
						this.fillPath.moveTo(xRes, ry);
						this.fillPath.lineTo(xRes, y);
						this.fillPath.lineTo(x, y);
						this.fillPath.lineTo(x, yRes);
						this.fillPath.lineTo(bx_pos, yRes);
						this.fillPath.closePath();
						this.strokePath.moveTo(xRes, ry);
						this.strokePath.lineTo(bx_pos, yRes);
						break;
					case 13: // !TR (TL, BL, BR) -> Clockwise: TopCut -> Top-Left -> Bottom-Left -> Bottom-Right -> RightCut
						this.fillPath.moveTo(tx, y);
						this.fillPath.lineTo(x, y);
						this.fillPath.lineTo(x, yRes);
						this.fillPath.lineTo(xRes, yRes);
						this.fillPath.lineTo(xRes, ry);
						this.fillPath.closePath();
						this.strokePath.moveTo(tx, y);
						this.strokePath.lineTo(xRes, ry);
						break;
					case 14: // !TL (TR, BL, BR) -> Clockwise: TopCut -> Top-Right -> Bottom-Right -> Bottom-Left -> LeftCut
						this.fillPath.moveTo(tx, y);
						this.fillPath.lineTo(xRes, y);
						this.fillPath.lineTo(xRes, yRes);
						this.fillPath.lineTo(x, yRes);
						this.fillPath.lineTo(x, ly);
						this.fillPath.closePath();
						this.strokePath.moveTo(tx, y);
						this.strokePath.lineTo(x, ly);
						break;
				}
			}
		}
	}

	private draw() {
		if (!this.ctx) return;
		const ctx = this.ctx;
		const ZOOM = this.controls.zoom_level;
		const PAN_X = this.pan_offset.x;
		const PAN_Y = this.pan_offset.y;
		const CELL_SIZE = this.CELL_SIZE;

		ctx.fillStyle = this.cachedColors.background;
		ctx.fillRect(0, 0, this.width, this.height);

		ctx.save();
		ctx.translate(PAN_X, PAN_Y);
		ctx.scale(ZOOM, ZOOM);

		// Visible Viewport Calculation (Grid Units)
		const startCol = Math.floor(-PAN_X / ZOOM / CELL_SIZE) - 1;
		const endCol = Math.ceil((this.width - PAN_X) / ZOOM / CELL_SIZE) + 1;
		const startRow = Math.floor(-PAN_Y / ZOOM / CELL_SIZE) - 1;
		const endRow = Math.ceil((this.height - PAN_Y) / ZOOM / CELL_SIZE) + 1;

		// Optimized Grid Lines (Batch Draw)
		if (ZOOM > 0.5) {
			ctx.strokeStyle = this.cachedColors.grid;
			ctx.lineWidth = 0.5 / ZOOM;
			ctx.beginPath();
			// Vertical
			for (let i = startCol; i <= endCol; i++) {
				const x = i * CELL_SIZE;
				ctx.moveTo(x, startRow * CELL_SIZE);
				ctx.lineTo(x, endRow * CELL_SIZE);
			}
			// Horizontal
			for (let i = startRow; i <= endRow; i++) {
				const y = i * CELL_SIZE;
				ctx.moveTo(startCol * CELL_SIZE, y);
				ctx.lineTo(endCol * CELL_SIZE, y);
			}
			ctx.stroke();
		}

		// Draw Hover
		if (this.hover_pos) {
			const { col, row } = this.hover_pos;
			const x = col * CELL_SIZE;
			const y = row * CELL_SIZE;
			ctx.fillStyle = this.cachedColors.grid_hover;
			ctx.beginPath();
			// Optimization: avoid roundRect if zoomed out too far
			if (ZOOM > 2 && ctx.roundRect)
				ctx.roundRect(x + 2, y + 2, CELL_SIZE - 4, CELL_SIZE - 4, 4 / ZOOM);
			else ctx.rect(x + 2, y + 2, CELL_SIZE - 4, CELL_SIZE - 4);
			ctx.fill();
		}

		if (this.visualCells.size > 0) {
			this.drawMetaballs(
				startCol * CELL_SIZE,
				endCol * CELL_SIZE,
				startRow * CELL_SIZE,
				endRow * CELL_SIZE
			);
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

	clearGrid = () => {
		if (this.isAnimating) this.completeTransition();

		this.controls.playing = false;
		this.timeSinceLastUpdate = 0;

		// Stats
		this.stats.n_gens = 0;
		this.stats.n_active = 0;
		this.stats.n_born = 0;
		this.stats.n_died = 0;

		this.nextActiveCells.clear();
		this.isAnimating = true;
		this.animationProgress = 0;
		this.syncVisualCells();
		this.draw();
	};

	drawPattern(rle_pattern: Pattern, theme?: string) {
		if (this.isAnimating) this.completeTransition();

		//this.controls.playing = false;
		this.isAnimating = true;
		this.animationProgress = 0;
		this.timeSinceLastUpdate = 0;

		if (theme) this.setTheme(theme);
		this.current_pattern = rle_pattern;

		this.stats.n_gens = 0;
		this.stats.n_born = 0;
		this.stats.n_died = 0;

		this.nextActiveCells.clear();

		const { pattern, width, height } = rle_pattern;
		const startCol = -Math.floor(width / 2);
		const startRow = -Math.floor(height / 2);

		let active = 0;
		for (let row = 0; row < height; row++) {
			for (let col = 0; col < width; col++) {
				if (pattern[row][col]) {
					this.nextActiveCells.add(this.getKey(startCol + col, startRow + row));
					active++;
				}
			}
		}
		this.stats.n_active = active;

		this.syncVisualCells();
		this.centerView(50);
		this.draw();
	}

	centerView(padding = 50) {
		if (this.visualCells.size === 0) {
			this.target_zoom = 1;
			this.target_pan = { x: this.width / 2, y: this.height / 2 };
			return;
		}

		let minX = Infinity,
			minY = Infinity;
		let maxX = -Infinity,
			maxY = -Infinity;

		for (const cell of this.visualCells.values()) {
			if (cell.dying) continue;
			if (cell.x < minX) minX = cell.x;
			if (cell.y < minY) minY = cell.y;
			if (cell.x > maxX) maxX = cell.x;
			if (cell.y > maxY) maxY = cell.y;
		}

		if (minX === Infinity) return;

		const pW = maxX - minX + this.CELL_SIZE;
		const pH = maxY - minY + this.CELL_SIZE;
		const cX = minX + pW / 2;
		const cY = minY + pH / 2;

		const availW = this.width - padding * 2;
		const availH = this.height - padding * 2;

		let newZoom = Math.min(availW / pW, availH / pH);
		newZoom = Math.max(MIN_ZOOM, Math.min(newZoom, 2.0));

		this.target_zoom = newZoom;
		this.target_pan = {
			x: this.width / 2 - cX * newZoom,
			y: this.height / 2 - cY * newZoom
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

	setZoom(level: number) {
		this.target_zoom = level;
		this.controls.zoom_level = level; // Snap instantly without smoothing
	}

	resetPattern = () => {
		if (this.current_pattern) this.drawPattern(this.current_pattern);
	};

	// --- INPUT LISTENERS ---

	private setupListeners() {
		if (!this.canvas) return;
		this.canvas.addEventListener('mousedown', this.onMouseDown);
		window.addEventListener('mouseup', this.onMouseUp);
		window.addEventListener('mousemove', this.onMouseMove);
		this.canvas.addEventListener('wheel', this.onMouseWheel, { passive: false });
		window.addEventListener('resize', this.onWindowResize);
		//window.addEventListener('keydown', this.onKeyDown);
		window.addEventListener('beforeunload', this.pause);
		document.addEventListener('visibilitychange', this.onVisibilityChange);
	}

	private removeListeners() {
		if (!this.canvas) return;
		this.canvas.removeEventListener('mousedown', this.onMouseDown);
		window.removeEventListener('mouseup', this.onMouseUp);
		window.removeEventListener('mousemove', this.onMouseMove);
		this.canvas.removeEventListener('wheel', this.onMouseWheel);
		window.removeEventListener('resize', this.onWindowResize);
		//window.removeEventListener('keydown', this.onKeyDown);
		window.removeEventListener('beforeunload', this.pause);
		document.removeEventListener('visibilitychange', this.onVisibilityChange);
	}

	private onWindowResize = () => {
		this.resize();
		this.draw();
	};

	private onVisibilityChange = () => {
		if (!document.hidden) this.lastFrameTime = performance.now();
	};

	private screenToGrid(screenX: number, screenY: number) {
		const worldX = (screenX - this.pan_offset.x) / this.controls.zoom_level;
		const worldY = (screenY - this.pan_offset.y) / this.controls.zoom_level;
		return {
			col: Math.floor(worldX / this.CELL_SIZE),
			row: Math.floor(worldY / this.CELL_SIZE)
		};
	}

	private onMouseDown = (event: MouseEvent) => {
		if (!this.controls.interactive || !this.canvas_rect) return;

		// Middle Mouse Panning (Button 1)
		if (event.button === 1) {
			this.isPanning = true;
			this.lastMousePos = { x: event.clientX, y: event.clientY };
			document.body.style.cursor = 'grabbing';
			event.preventDefault();
			return;
		}

		// Left Click (Drawing)
		if (event.button === 0) {
			if (this.isAnimating) this.completeTransition();
			const { col, row } = this.screenToGrid(
				event.clientX - this.canvas_rect.left,
				event.clientY - this.canvas_rect.top
			);
			const key = this.getKey(col, row);

			if (this.activeCells.has(key)) {
				this.activeCells.delete(key);
				this.nextActiveCells.delete(key);
			} else {
				this.activeCells.add(key);
				this.nextActiveCells.add(key);
			}

			this.isAnimating = false;
			this.syncVisualCells();
			this.isMouseDown = true;
			this.draw();
		}
	};

	private onMouseUp = () => {
		if (!this.controls.interactive) return;
		this.isMouseDown = false;
		if (this.isPanning) {
			this.isPanning = false;
			document.body.style.cursor = 'default';
		}
	};

	private onMouseMove = (event: MouseEvent) => {
		if (!this.controls.interactive || !this.canvas_rect) return;

		if (this.isPanning) {
			const dx = event.clientX - this.lastMousePos.x;
			const dy = event.clientY - this.lastMousePos.y;
			this.target_pan.x += dx;
			this.target_pan.y += dy;
			this.lastMousePos = { x: event.clientX, y: event.clientY };
			return;
		}

		const { col, row } = this.screenToGrid(
			event.clientX - this.canvas_rect.left,
			event.clientY - this.canvas_rect.top
		);
		this.hover_pos = { col, row };

		if (this.isMouseDown) {
			const key = this.getKey(col, row);
			if (!this.activeCells.has(key)) {
				this.activeCells.add(key);
				this.nextActiveCells.add(key);
				this.syncVisualCells();
				this.draw();
			}
		}
	};

	private onMouseWheel = (event: WheelEvent) => {
		if (!this.controls.interactive || !this.canvas_rect) return;
		event.preventDefault();

		if (event.ctrlKey) {
			const x = event.clientX - this.canvas_rect.left;
			const y = event.clientY - this.canvas_rect.top;
			this.zoom(event.deltaY < 0 ? 1 : -1, { x, y });
			return;
		}

		const isTrackpad = Math.abs(event.deltaY) < 50 && event.deltaX !== 0;

		if (isTrackpad) {
			this.target_pan.x -= event.deltaX;
			this.target_pan.y -= event.deltaY;
		} else {
			const x = event.clientX - this.canvas_rect.left;
			const y = event.clientY - this.canvas_rect.top;
			this.zoom(event.deltaY < 0 ? 1 : -1, { x, y });
		}
	};

	// private onKeyDown = (event: KeyboardEvent) => {
	// 	if (event.code === 'Space') {
	// 		event.preventDefault();
	// 		this.togglePlay();
	// 	}
	// 	if (event.code === 'ArrowRight') {
	// 		event.preventDefault();
	// 		this.next_frame();
	// 	}
	// 	if (event.code === 'KeyC') {
	// 		this.centerView();
	// 	}
	// };

	setTheme(themeName: string, duration = 600) {
		if (this.theme === themeName) return;
		this.theme = themeName;
		document.documentElement.setAttribute('theme', themeName);

		this.transition.startColors = { ...this.currentColors };

		const styles = getComputedStyle(document.documentElement);
		const getCol = (name: string) => styles.getPropertyValue(name).trim();

		this.transition.targetColors.background = this.parseCssColor(getCol('--color-bg'));
		this.transition.targetColors.grid = this.parseCssColor(getCol('--color-grid'));
		this.transition.targetColors.grid_hover = this.parseCssColor(getCol('--color-grid-hover'));
		this.transition.targetColors.life_fill = this.parseCssColor(getCol('--color-life-fill'));
		this.transition.targetColors.life_stroke = this.parseCssColor(getCol('--color-life-stroke'));

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

		const s = this.transition.startColors;
		const e = this.transition.targetColors;

		this.currentColors.background = lerpColor(s.background, e.background, ease);
		this.currentColors.grid = lerpColor(s.grid, e.grid, ease);
		this.currentColors.grid_hover = lerpColor(s.grid_hover, e.grid_hover, ease);
		this.currentColors.life_fill = lerpColor(s.life_fill, e.life_fill, ease);
		this.currentColors.life_stroke = lerpColor(s.life_stroke, e.life_stroke, ease);

		// IMPORTANT: Update cache during transition
		this.updateColorCache();

		if (!this.controls.playing && this.transition.active) {
			this.draw();
			requestAnimationFrame(() => this.processColorTransition(performance.now()));
		}
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

	toggleInteractive = () => {
		this.controls.interactive = !this.controls.interactive;

		// If we just disabled it, gracefully release any active mouse states
		if (!this.controls.interactive) {
			this.isMouseDown = false;
			if (this.isPanning) {
				this.isPanning = false;
				document.body.style.cursor = 'default';
			}
			this.hover_pos = null; // Clear the hover highlight

			// Force a frame update to erase the hover box immediately if paused
			if (!this.controls.playing && !this.isAnimating) this.draw();
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
