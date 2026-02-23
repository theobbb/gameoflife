// src/lib/game.svelte.ts
import type { Pattern } from '$lib/types';
import { rgbaToString, type RGBA } from '$lib/utils/color';
import { getContext, setContext } from 'svelte';

export const TIME_SCALE = [1.0, 0.1, 5.0];

// --- CONSTANTS ---
const BASE_CELL_SIZE = 20;
export const STIFFNESS = [2, 0.5, 6];
export const DAMPING = [0.2, 0.1, 0.5];
export const METABALL_RADIUS = [0.4, 0.2, 0.6];
export const METABALL_THRESHOLD = [1.0, 0.5, 2.0];
export const RENDER_RESOLUTION = [5, 1, 9];
export const INFLUENCE_RADIUS = [6.0, 1.0, 11.0];

const ANIMATION_DURATION = 500;
const UPDATE_INTERVAL = 100;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 8;
const ZOOM_SENSITIVITY = 0.1;
const CAMERA_SMOOTHING = 0.25;

// ─── Packed integer key ─────────────────────────────────────────────────────
// Encode (col, row) as a single float64-safe integer.
// We offset by 0x8000 so negative coords map to positive integers.
const OFFSET = 0x8000; // supports ±32767 grid range
const PACK_MUL = 0x10000; // 65536

function packKey(col: number, row: number): number {
	return (col + OFFSET) * PACK_MUL + (row + OFFSET);
}

function unpackKey(key: number): { col: number; row: number } {
	const r = (key % PACK_MUL) - OFFSET;
	const c = Math.floor(key / PACK_MUL) - OFFSET;
	return { col: c, row: r };
}

// Inline-friendly versions (avoid object allocation in hot paths)
function unpackCol(key: number): number {
	return Math.floor(key / PACK_MUL) - OFFSET;
}
function unpackRow(key: number): number {
	return (key % PACK_MUL) - OFFSET;
}

// ─── Lightweight open-addressing integer hash set ────────────────────────────
// Much faster than JS Set<number> for integer keys (no boxing overhead).
const HS_EMPTY = -1;
const HS_DELETED = -2;
const HS_INIT_CAP = 512;

class IntSet {
	private table: Float64Array;
	private _size = 0;
	private cap: number;
	private mask: number;

	constructor(cap = HS_INIT_CAP) {
		this.cap = cap;
		this.mask = cap - 1;
		this.table = new Float64Array(cap).fill(HS_EMPTY);
	}

	get size() {
		return this._size;
	}

	private rehash() {
		const old = this.table;
		this.cap <<= 1;
		this.mask = this.cap - 1;
		this.table = new Float64Array(this.cap).fill(HS_EMPTY);
		this._size = 0;
		for (let i = 0; i < old.length; i++) {
			const v = old[i];
			if (v !== HS_EMPTY && v !== HS_DELETED) this.add(v);
		}
	}

	add(key: number): void {
		if (this._size * 2 >= this.cap) this.rehash();
		let i = (key ^ (key >>> 16)) & this.mask;
		while (true) {
			const v = this.table[i];
			if (v === key) return;
			if (v === HS_EMPTY || v === HS_DELETED) {
				this.table[i] = key;
				this._size++;
				return;
			}
			i = (i + 1) & this.mask;
		}
	}

	has(key: number): boolean {
		let i = (key ^ (key >>> 16)) & this.mask;
		while (true) {
			const v = this.table[i];
			if (v === key) return true;
			if (v === HS_EMPTY) return false;
			i = (i + 1) & this.mask;
		}
	}

	delete(key: number): void {
		let i = (key ^ (key >>> 16)) & this.mask;
		while (true) {
			const v = this.table[i];
			if (v === key) {
				this.table[i] = HS_DELETED;
				this._size--;
				return;
			}
			if (v === HS_EMPTY) return;
			i = (i + 1) & this.mask;
		}
	}

	clear(): void {
		this.table.fill(HS_EMPTY);
		this._size = 0;
	}

	// Iterate alive keys
	forEach(cb: (key: number) => void): void {
		const t = this.table;
		for (let i = 0; i < t.length; i++) {
			const v = t[i];
			if (v !== HS_EMPTY && v !== HS_DELETED) cb(v);
		}
	}

	keys(): number[] {
		const out: number[] = [];
		this.forEach((k) => out.push(k));
		return out;
	}

	swap(other: IntSet): void {
		// Swap internal buffers — O(1) generation flip
		[this.table, other.table] = [other.table, this.table];
		[this._size, other._size] = [other._size, this._size];
		[this.cap, other.cap] = [other.cap, this.cap];
		[this.mask, other.mask] = [other.mask, this.mask];
	}
}

// ─── Types ───────────────────────────────────────────────────────────────────

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
	isManual: boolean;
};

type ColorCache = {
	background: string;
	grid: string;
	grid_hover: string;
	life_stroke: string;
	life_fill: string;
};

const GAME_ENGINE_SYMBOL = Symbol('GAME_ENGINE_SYMBOL');

// ─── Engine ──────────────────────────────────────────────────────────────────

export class Engine {
	// --- STATE (Runes) ---
	stats = $state({ n_gens: 0, fps: 0, n_active: 0, n_born: 0, n_died: 0 });
	current_pattern: Pattern | null = $state(null);
	theme = $state('');

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

	// Derived metaball params (cached as class fields, updated on demand)
	private METABALL_RADIUS = $derived(BASE_CELL_SIZE * this.controls.metaball_radius);
	private METABALL_RADIUS_SQ = $derived(this.METABALL_RADIUS * this.METABALL_RADIUS);
	private METABALL_THRESHOLD = $derived(this.controls.metaball_threshold);
	private RENDER_RESOLUTION = $derived(this.controls.render_resolution);
	private INFLUENCE_RADIUS = $derived(this.METABALL_RADIUS * this.controls.influence_radius);

	initialized = $state(false);

	// --- CANVAS ---
	private canvas: HTMLCanvasElement | null = null;
	private ctx: CanvasRenderingContext2D | null = null;
	private canvas_rect: DOMRect | null = null;
	private width = 0;
	private height = 0;
	private animationId = 0;

	private CELL_SIZE = BASE_CELL_SIZE;

	// ─── Cell Storage (integer-keyed hash sets) ───────────────────────────────
	private activeCells: IntSet = new IntSet();
	private nextActiveCells: IntSet = new IntSet();

	// Visual cells stored in a Map<number, Cell> — number keys avoid string alloc
	private visualCells: Map<number, Cell> = new Map();
	private dyingCells: Map<number, Cell> = new Map();

	// Field buffer for metaballs
	private fieldBuffer = new Float32Array(0);

	// Reusable Path2D objects
	private fillPath: Path2D | null = null;
	private strokePath: Path2D | null = null;

	// --- Camera ---
	private pan_offset: Vector2 = { x: 0, y: 0 };
	private target_zoom: number = 4;
	private target_pan: Vector2 = { x: 0, y: 0 };

	// --- Input ---
	private hover_pos: { col: number; row: number } | null = null;
	private isMouseDown = false;
	private isPanning = false;
	private lastMousePos: Vector2 = { x: 0, y: 0 };

	// --- Loop / Timing ---
	private lastFrameTime = 0;
	private timeSinceLastUpdate = 0;
	private isAnimating = false;
	private animationProgress = 0;
	private fpsTimer = 0;
	private frameCount = 0;

	// --- Colors ---
	private currentColors = {
		background: { r: 17, g: 17, b: 17, a: 1 } as RGBA,
		grid: { r: 255, g: 255, b: 255, a: 0.2 } as RGBA,
		grid_hover: { r: 255, g: 255, b: 255, a: 0.2 } as RGBA,
		life_stroke: { r: 255, g: 255, b: 255, a: 0.85 } as RGBA,
		life_fill: { r: 255, g: 255, b: 255, a: 0.85 } as RGBA
	};

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

	// Scratch array reused every updateGrid() to avoid allocation
	private neighborScratch: Float64Array = new Float64Array(8);

	constructor() {
		this.target_zoom = this.controls.zoom_level;
	}

	// ─── Mount / Destroy ─────────────────────────────────────────────────────

	mount(canvas: HTMLCanvasElement) {
		if (this.initialized) return;

		this.canvas = canvas;
		this.ctx = canvas.getContext('2d', { alpha: false }) as CanvasRenderingContext2D;

		this.resize();
		this.pan_offset = { x: this.width / 2, y: this.height / 2 };
		this.target_pan = { ...this.pan_offset };

		this.setupListeners();
		this.get_theme();
		this.syncVisualCells();

		this.lastFrameTime = performance.now();
		this.fpsTimer = this.lastFrameTime;
		this.animate(this.lastFrameTime);

		this.initialized = true;
	}

	destroy() {
		if (this.animationId) cancelAnimationFrame(this.animationId);
		this.removeListeners();
		this.initialized = false;
		this.current_pattern = null;
	}

	// ─── Theme ───────────────────────────────────────────────────────────────

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

	// ─── Game Loop ───────────────────────────────────────────────────────────

	private animate = (currentTime: number) => {
		this.animationId = requestAnimationFrame(this.animate);
		this.processColorTransition(currentTime);

		// FPS
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

	// ─── Game of Life Update ─────────────────────────────────────────────────

	updateGrid = () => {
		if (this.isAnimating) this.completeTransition();

		// Use a Map<number,number> for neighbor counts.
		// Reuse one Map instance and clear it each tick.
		const neighborCounts = this._neighborCounts;
		neighborCounts.clear();

		const potentialSet = this._potentialSet;
		potentialSet.clear();

		// 1. Compute neighbor counts for all candidate cells
		this.activeCells.forEach((key) => {
			potentialSet.add(key);
			const col = unpackCol(key);
			const row = unpackRow(key);

			// Unrolled 8-neighbor update
			const k0 = packKey(col - 1, row - 1);
			neighborCounts.set(k0, (neighborCounts.get(k0) || 0) + 1);
			potentialSet.add(k0);
			const k1 = packKey(col, row - 1);
			neighborCounts.set(k1, (neighborCounts.get(k1) || 0) + 1);
			potentialSet.add(k1);
			const k2 = packKey(col + 1, row - 1);
			neighborCounts.set(k2, (neighborCounts.get(k2) || 0) + 1);
			potentialSet.add(k2);
			const k3 = packKey(col - 1, row);
			neighborCounts.set(k3, (neighborCounts.get(k3) || 0) + 1);
			potentialSet.add(k3);
			const k4 = packKey(col + 1, row);
			neighborCounts.set(k4, (neighborCounts.get(k4) || 0) + 1);
			potentialSet.add(k4);
			const k5 = packKey(col - 1, row + 1);
			neighborCounts.set(k5, (neighborCounts.get(k5) || 0) + 1);
			potentialSet.add(k5);
			const k6 = packKey(col, row + 1);
			neighborCounts.set(k6, (neighborCounts.get(k6) || 0) + 1);
			potentialSet.add(k6);
			const k7 = packKey(col + 1, row + 1);
			neighborCounts.set(k7, (neighborCounts.get(k7) || 0) + 1);
			potentialSet.add(k7);
		});

		this.nextActiveCells.clear();
		let active = 0,
			born = 0,
			died = 0;

		// 2. Apply Conway rules
		potentialSet.forEach((key) => {
			const count = neighborCounts.get(key) || 0;
			const wasAlive = this.activeCells.has(key);
			const alive = wasAlive ? count === 2 || count === 3 : count === 3;

			if (alive) {
				this.nextActiveCells.add(key);
				active++;
				if (!wasAlive) born++;
			} else if (wasAlive) {
				died++;
			}
		});

		this.stats.n_gens++;
		this.stats.n_active = active;
		this.stats.n_born = born;
		this.stats.n_died = died;

		this.isAnimating = true;
		this.animationProgress = 0;
		this.syncVisualCells();
	};

	// Persistent scratch structures to avoid per-tick allocation
	private _neighborCounts: Map<number, number> = new Map();
	private _potentialSet: IntSet = new IntSet();

	// ─── Visual Cell Sync ────────────────────────────────────────────────────

	private syncVisualCells() {
		this.dyingCells.clear();

		// Handle existing active cells
		this.activeCells.forEach((key) => {
			if (!this.visualCells.has(key)) {
				const col = unpackCol(key);
				const row = unpackRow(key);
				this.createVisualCell(key, col, row, true);
			}

			// Mark dying
			if (this.isAnimating && !this.nextActiveCells.has(key)) {
				const cell = this.visualCells.get(key)!;
				if (cell) {
					cell.dying = true;
					const angle = Math.random() * 6.28318;
					const dist = this.CELL_SIZE * 2.5;
					cell.targetX = cell.x + Math.cos(angle) * dist;
					cell.targetY = cell.y + Math.sin(angle) * dist;
					this.dyingCells.set(key, cell);
				}
			}
		});

		// Handle born cells
		if (this.isAnimating) {
			this.nextActiveCells.forEach((key) => {
				if (!this.activeCells.has(key) && !this.visualCells.has(key)) {
					const col = unpackCol(key);
					const row = unpackRow(key);
					this.createBornCell(key, col, row);
				}
			});
		}

		// Prune dead visual cells immediately if not animating
		if (!this.isAnimating) {
			for (const key of this.visualCells.keys()) {
				if (!this.activeCells.has(key)) this.visualCells.delete(key);
			}
		}
	}

	private createVisualCell(key: number, col: number, row: number, isManual: boolean) {
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
			isManual
		});
	}

	private createBornCell(key: number, col: number, row: number) {
		const targetX = col * this.CELL_SIZE + this.CELL_SIZE / 2;
		const targetY = row * this.CELL_SIZE + this.CELL_SIZE / 2;

		let startX = targetX;
		let startY = targetY;
		let startPhase = Math.random() * 6.28318;

		// Spawn from a live neighbor to look organic
		outer: for (let dy = -1; dy <= 1; dy++) {
			for (let dx = -1; dx <= 1; dx++) {
				if (dx === 0 && dy === 0) continue;
				const nKey = packKey(col + dx, row + dy);
				if (this.activeCells.has(nKey)) {
					const neighbor = this.visualCells.get(nKey);
					if (neighbor) {
						startX = neighbor.x;
						startY = neighbor.y;
						startPhase = neighbor.phase;
					} else {
						startX += dx * this.CELL_SIZE;
						startY += dy * this.CELL_SIZE;
					}
					break outer;
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
			phase: startPhase,
			phaseSpeed: 0.5 + Math.random() * 0.5,
			alpha: 1,
			scale: 0.0,
			dying: false,
			isManual: false
		});
	}

	private completeTransition() {
		// O(1) generation swap via internal buffer swap
		this.activeCells.swap(this.nextActiveCells);
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

	// ─── Physics ─────────────────────────────────────────────────────────────

	private updatePhysics(dt: number, scale: number) {
		const tSec = (dt / 1000) * scale;
		const STIFF = this.controls.stiffness * 0.25 * tSec;
		const DAMP = Math.pow(this.controls.damping, tSec);
		const CELL_SIZE = this.CELL_SIZE;
		const VEL_SCALE = tSec * 60;

		// Pre-calc eased animation progress once per frame
		const ap = this.animationProgress;
		const progress = this.isAnimating
			? ap < 0.5
				? 4 * ap * ap * ap
				: 1 - (-2 * ap + 2) ** 3 / 2
			: 0;

		const animating = this.isAnimating;

		for (const cell of this.visualCells.values()) {
			cell.phase += cell.phaseSpeed * tSec;

			const wobbleAmt = animating ? 0.5 : 2;
			const wobbleX = Math.sin(cell.phase) * wobbleAmt;
			const wobbleY = Math.cos(cell.phase * 1.3) * wobbleAmt;

			if (!cell.dying) {
				cell.targetX = cell.gridX * CELL_SIZE + CELL_SIZE / 2 + wobbleX;
				cell.targetY = cell.gridY * CELL_SIZE + CELL_SIZE / 2 + wobbleY;

				if (cell.isManual) {
					cell.scale += (1 - cell.scale) * 15 * tSec;
					if (cell.scale > 0.99) {
						cell.scale = 1;
						cell.isManual = false;
					}
				} else if (animating && cell.scale < 1) {
					cell.scale = progress;
				} else if (!animating) {
					cell.scale = 1;
				}
			} else {
				cell.targetX += wobbleX * 0.1;
				cell.targetY += wobbleY * 0.1;
				cell.scale = 1 - progress;
				cell.alpha = 1 - progress;
			}

			// Spring physics
			const dx = cell.targetX - cell.x;
			const dy = cell.targetY - cell.y;
			cell.vx += dx * STIFF;
			cell.vy += dy * STIFF;
			cell.vx *= DAMP;
			cell.vy *= DAMP;
			cell.x += cell.vx * VEL_SCALE;
			cell.y += cell.vy * VEL_SCALE;
		}
	}

	private updateCamera() {
		const s = CAMERA_SMOOTHING;
		this.controls.zoom_level += (this.target_zoom - this.controls.zoom_level) * s;
		this.pan_offset.x += (this.target_pan.x - this.pan_offset.x) * s;
		this.pan_offset.y += (this.target_pan.y - this.pan_offset.y) * s;

		if (Math.abs(this.target_zoom - this.controls.zoom_level) < 0.0001)
			this.controls.zoom_level = this.target_zoom;
		if (Math.abs(this.target_pan.x - this.pan_offset.x) < 0.01)
			this.pan_offset.x = this.target_pan.x;
		if (Math.abs(this.target_pan.y - this.pan_offset.y) < 0.01)
			this.pan_offset.y = this.target_pan.y;
	}

	// ─── Metaball Rendering ───────────────────────────────────────────────────

	private drawMetaballs(minX: number, maxX: number, minY: number, maxY: number) {
		const RENDER_RES = this.RENDER_RESOLUTION;
		const INF_RAD = this.INFLUENCE_RADIUS;
		const META_RAD_SQ = this.METABALL_RADIUS_SQ;
		const META_THRESH = this.METABALL_THRESHOLD;

		const startX = Math.floor(minX / RENDER_RES) * RENDER_RES - INF_RAD;
		const endX = Math.ceil(maxX / RENDER_RES) * RENDER_RES + INF_RAD;
		const startY = Math.floor(minY / RENDER_RES) * RENDER_RES - INF_RAD;
		const endY = Math.ceil(maxY / RENDER_RES) * RENDER_RES + INF_RAD;

		const bufW = Math.ceil((endX - startX) / RENDER_RES) + 1;
		const bufH = Math.ceil((endY - startY) / RENDER_RES) + 1;
		const reqSize = bufW * bufH;

		if (this.fieldBuffer.length < reqSize) this.fieldBuffer = new Float32Array(reqSize);
		this.fieldBuffer.fill(0, 0, reqSize);

		const radUnits = INF_RAD / RENDER_RES;
		const field = this.fieldBuffer;

		// Splat each visible cell into the field
		for (const cell of this.visualCells.values()) {
			const strength = META_RAD_SQ * cell.scale * cell.scale * cell.alpha;
			if (strength < 0.01) continue;
			if (
				cell.x < startX - INF_RAD ||
				cell.x > endX + INF_RAD ||
				cell.y < startY - INF_RAD ||
				cell.y > endY + INF_RAD
			)
				continue;

			const fx = (cell.x - startX) / RENDER_RES;
			const fy = (cell.y - startY) / RENDER_RES;

			const cMinX = Math.max(0, Math.floor(fx - radUnits));
			const cMaxX = Math.min(bufW - 1, Math.ceil(fx + radUnits));
			const cMinY = Math.max(0, Math.floor(fy - radUnits));
			const cMaxY = Math.min(bufH - 1, Math.ceil(fy + radUnits));

			const cx = cell.x;
			const cy = cell.y;

			for (let by = cMinY; by <= cMaxY; by++) {
				const worldY = startY + by * RENDER_RES;
				const dy = worldY - cy;
				const dy2 = dy * dy;
				const rowOff = by * bufW;

				for (let bx = cMinX; bx <= cMaxX; bx++) {
					const worldX = startX + bx * RENDER_RES;
					const dx = worldX - cx;
					const distSq = dx * dx + dy2;
					field[rowOff + bx] += distSq > 0.1 ? strength / distSq : 100;
				}
			}
		}

		const ctx = this.ctx!;
		ctx.fillStyle = this.cachedColors.life_fill;
		ctx.strokeStyle = this.cachedColors.life_stroke;
		ctx.lineWidth = 3 / this.controls.zoom_level;
		ctx.lineCap = 'round';
		ctx.lineJoin = 'round';

		// Reset paths without re-allocating (reset via new Path2D — cheapest way in browser)
		this.fillPath = new Path2D();
		this.strokePath = new Path2D();

		this.march(startX, startY, bufW, bufH, RENDER_RES, META_THRESH);

		ctx.fill(this.fillPath);
		ctx.stroke(this.strokePath);
	}

	private march(startX: number, startY: number, w: number, h: number, res: number, thresh: number) {
		const fp = this.fillPath;
		const sp = this.strokePath;
		const fb = this.fieldBuffer;

		for (let by = 0; by < h - 1; by++) {
			const rowOff = by * w;
			const nextOff = (by + 1) * w;
			const y = startY + by * res;

			for (let bx = 0; bx < w - 1; bx++) {
				const tl = fb[rowOff + bx];
				const tr = fb[rowOff + bx + 1];
				const bl = fb[nextOff + bx];
				const br = fb[nextOff + bx + 1];

				let caseId = 0;
				if (tl >= thresh) caseId |= 1;
				if (tr >= thresh) caseId |= 2;
				if (br >= thresh) caseId |= 4;
				if (bl >= thresh) caseId |= 8;

				if (caseId === 0) continue;

				const x = startX + bx * res;
				const xR = x + res;
				const yR = y + res;

				// Full block — fastest path
				if (caseId === 15) {
					fp.rect(x, y, res, res);
					continue;
				}

				// Interpolated edge midpoints (safe — guard against div-by-zero)
				const tx = Math.abs(tr - tl) > 0.0001 ? x + (res * (thresh - tl)) / (tr - tl) : x + res / 2;
				const ry = Math.abs(br - tr) > 0.0001 ? y + (res * (thresh - tr)) / (br - tr) : y + res / 2;
				const bx_ =
					Math.abs(br - bl) > 0.0001 ? x + (res * (thresh - bl)) / (br - bl) : x + res / 2;
				const ly = Math.abs(bl - tl) > 0.0001 ? y + (res * (thresh - tl)) / (bl - tl) : y + res / 2;

				switch (caseId) {
					case 1:
						fp.moveTo(x, ly);
						fp.lineTo(tx, y);
						fp.lineTo(x, y);
						fp.closePath();
						sp.moveTo(x, ly);
						sp.lineTo(tx, y);
						break;
					case 2:
						fp.moveTo(tx, y);
						fp.lineTo(xR, ry);
						fp.lineTo(xR, y);
						fp.closePath();
						sp.moveTo(tx, y);
						sp.lineTo(xR, ry);
						break;
					case 4:
						fp.moveTo(xR, ry);
						fp.lineTo(bx_, yR);
						fp.lineTo(xR, yR);
						fp.closePath();
						sp.moveTo(xR, ry);
						sp.lineTo(bx_, yR);
						break;
					case 8:
						fp.moveTo(bx_, yR);
						fp.lineTo(x, ly);
						fp.lineTo(x, yR);
						fp.closePath();
						sp.moveTo(bx_, yR);
						sp.lineTo(x, ly);
						break;
					case 3:
						fp.moveTo(x, ly);
						fp.lineTo(xR, ry);
						fp.lineTo(xR, y);
						fp.lineTo(x, y);
						fp.closePath();
						sp.moveTo(x, ly);
						sp.lineTo(xR, ry);
						break;
					case 6:
						fp.moveTo(tx, y);
						fp.lineTo(bx_, yR);
						fp.lineTo(xR, yR);
						fp.lineTo(xR, y);
						fp.closePath();
						sp.moveTo(tx, y);
						sp.lineTo(bx_, yR);
						break;
					case 9:
						fp.moveTo(tx, y);
						fp.lineTo(x, y);
						fp.lineTo(x, yR);
						fp.lineTo(bx_, yR);
						fp.closePath();
						sp.moveTo(tx, y);
						sp.lineTo(bx_, yR);
						break;
					case 12:
						fp.moveTo(x, ly);
						fp.lineTo(x, yR);
						fp.lineTo(xR, yR);
						fp.lineTo(xR, ry);
						fp.closePath();
						sp.moveTo(x, ly);
						sp.lineTo(xR, ry);
						break;
					case 5:
						fp.moveTo(x, ly);
						fp.lineTo(tx, y);
						fp.lineTo(x, y);
						fp.closePath();
						fp.moveTo(xR, ry);
						fp.lineTo(bx_, yR);
						fp.lineTo(xR, yR);
						fp.closePath();
						sp.moveTo(x, ly);
						sp.lineTo(tx, y);
						sp.moveTo(xR, ry);
						sp.lineTo(bx_, yR);
						break;
					case 10:
						fp.moveTo(tx, y);
						fp.lineTo(xR, ry);
						fp.lineTo(xR, y);
						fp.closePath();
						fp.moveTo(bx_, yR);
						fp.lineTo(x, ly);
						fp.lineTo(x, yR);
						fp.closePath();
						sp.moveTo(tx, y);
						sp.lineTo(xR, ry);
						sp.moveTo(bx_, yR);
						sp.lineTo(x, ly);
						break;
					case 7:
						fp.moveTo(x, ly);
						fp.lineTo(x, y);
						fp.lineTo(xR, y);
						fp.lineTo(xR, yR);
						fp.lineTo(bx_, yR);
						fp.closePath();
						sp.moveTo(x, ly);
						sp.lineTo(bx_, yR);
						break;
					case 11:
						fp.moveTo(xR, ry);
						fp.lineTo(xR, y);
						fp.lineTo(x, y);
						fp.lineTo(x, yR);
						fp.lineTo(bx_, yR);
						fp.closePath();
						sp.moveTo(xR, ry);
						sp.lineTo(bx_, yR);
						break;
					case 13:
						fp.moveTo(tx, y);
						fp.lineTo(x, y);
						fp.lineTo(x, yR);
						fp.lineTo(xR, yR);
						fp.lineTo(xR, ry);
						fp.closePath();
						sp.moveTo(tx, y);
						sp.lineTo(xR, ry);
						break;
					case 14:
						fp.moveTo(tx, y);
						fp.lineTo(xR, y);
						fp.lineTo(xR, yR);
						fp.lineTo(x, yR);
						fp.lineTo(x, ly);
						fp.closePath();
						sp.moveTo(tx, y);
						sp.lineTo(x, ly);
						break;
				}
			}
		}
	}

	// ─── Draw ────────────────────────────────────────────────────────────────

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

		const startCol = Math.floor(-PAN_X / ZOOM / CELL_SIZE) - 1;
		const endCol = Math.ceil((this.width - PAN_X) / ZOOM / CELL_SIZE) + 1;
		const startRow = Math.floor(-PAN_Y / ZOOM / CELL_SIZE) - 1;
		const endRow = Math.ceil((this.height - PAN_Y) / ZOOM / CELL_SIZE) + 1;

		// Grid lines (batch)
		if (ZOOM > 0.5) {
			ctx.strokeStyle = this.cachedColors.grid;
			ctx.lineWidth = 0.5 / ZOOM;
			ctx.beginPath();
			for (let i = startCol; i <= endCol; i++) {
				const x = i * CELL_SIZE;
				ctx.moveTo(x, startRow * CELL_SIZE);
				ctx.lineTo(x, endRow * CELL_SIZE);
			}
			for (let i = startRow; i <= endRow; i++) {
				const y = i * CELL_SIZE;
				ctx.moveTo(startCol * CELL_SIZE, y);
				ctx.lineTo(endCol * CELL_SIZE, y);
			}
			ctx.stroke();
		}

		// Hover
		if (this.hover_pos) {
			const { col, row } = this.hover_pos;
			const x = col * CELL_SIZE;
			const y = row * CELL_SIZE;
			ctx.fillStyle = this.cachedColors.grid_hover;
			ctx.beginPath();
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

	// ─── Controls ────────────────────────────────────────────────────────────

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
		this.stats.n_gens = 0;
		this.stats.n_active = 0;
		this.stats.n_born = 0;
		this.stats.n_died = 0;
		this.nextActiveCells.clear();
		this.activeCells.clear();
		this.visualCells.clear();
		this.dyingCells.clear();
		this.isAnimating = false;
		this.animationProgress = 0;
		this.draw();
	};

	drawPattern(rle_pattern: Pattern, theme?: string) {
		if (this.isAnimating) this.completeTransition();
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
					this.nextActiveCells.add(packKey(startCol + col, startRow + row));
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
		const cX = (minX + maxX) / 2;
		const cY = (minY + maxY) / 2;
		const aW = this.width - padding * 2;
		const aH = this.height - padding * 2;
		let newZoom = Math.min(aW / pW, aH / pH);
		newZoom = Math.max(MIN_ZOOM, Math.min(newZoom, 2.0));

		this.target_zoom = newZoom;
		this.target_pan = {
			x: this.width / 2 - cX * newZoom,
			y: this.height / 2 - cY * newZoom
		};
	}

	zoom(direction: 1 | -1, origin: Vector2) {
		const oldZoom = this.target_zoom;
		this.target_zoom =
			direction > 0
				? Math.min(MAX_ZOOM, this.target_zoom * (1 + ZOOM_SENSITIVITY))
				: Math.max(MIN_ZOOM, this.target_zoom * (1 - ZOOM_SENSITIVITY));
		const ratio = this.target_zoom / oldZoom;
		this.target_pan.x = origin.x - (origin.x - this.target_pan.x) * ratio;
		this.target_pan.y = origin.y - (origin.y - this.target_pan.y) * ratio;
	}

	setZoom(level: number) {
		this.target_zoom = level;
		this.controls.zoom_level = level;
	}

	resetPattern = () => {
		if (this.current_pattern) this.drawPattern(this.current_pattern);
	};

	// ─── Input ───────────────────────────────────────────────────────────────

	private setupListeners() {
		if (!this.canvas) return;
		this.canvas.addEventListener('mousedown', this.onMouseDown);
		window.addEventListener('mouseup', this.onMouseUp);
		window.addEventListener('mousemove', this.onMouseMove);
		this.canvas.addEventListener('wheel', this.onMouseWheel, { passive: false });
		window.addEventListener('resize', this.onWindowResize);
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

		if (event.button === 1) {
			this.isPanning = true;
			this.lastMousePos = { x: event.clientX, y: event.clientY };
			document.body.style.cursor = 'grabbing';
			event.preventDefault();
			return;
		}

		if (event.button === 0) {
			if (this.isAnimating) this.completeTransition();
			const { col, row } = this.screenToGrid(
				event.clientX - this.canvas_rect.left,
				event.clientY - this.canvas_rect.top
			);
			const key = packKey(col, row);
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
			this.target_pan.x += event.clientX - this.lastMousePos.x;
			this.target_pan.y += event.clientY - this.lastMousePos.y;
			this.lastMousePos = { x: event.clientX, y: event.clientY };
			return;
		}

		const { col, row } = this.screenToGrid(
			event.clientX - this.canvas_rect.left,
			event.clientY - this.canvas_rect.top
		);
		this.hover_pos = { col, row };

		if (this.isMouseDown) {
			const key = packKey(col, row);
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

	// ─── Theme / Color Transition ─────────────────────────────────────────────

	setTheme(themeName: string, duration = 600) {
		if (this.theme === themeName) return;
		this.theme = themeName;
		document.documentElement.setAttribute('theme', themeName);

		this.transition.startColors = { ...this.currentColors };

		const styles = getComputedStyle(document.documentElement);
		const getCol = (n: string) => styles.getPropertyValue(n).trim();

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
		const s = this.transition.startColors;
		const e = this.transition.targetColors;

		const lerpC = (a: RGBA, b: RGBA, t: number): RGBA => ({
			r: a.r + (b.r - a.r) * t,
			g: a.g + (b.g - a.g) * t,
			b: a.b + (b.b - a.b) * t,
			a: a.a + (b.a - a.a) * t
		});

		this.currentColors.background = lerpC(s.background, e.background, ease);
		this.currentColors.grid = lerpC(s.grid, e.grid, ease);
		this.currentColors.grid_hover = lerpC(s.grid_hover, e.grid_hover, ease);
		this.currentColors.life_fill = lerpC(s.life_fill, e.life_fill, ease);
		this.currentColors.life_stroke = lerpC(s.life_stroke, e.life_stroke, ease);
		this.updateColorCache();

		if (!this.controls.playing && this.transition.active) {
			this.draw();
			requestAnimationFrame(() => this.processColorTransition(performance.now()));
		}
	}

	private parseCssColor(cssString: string, defaultAlpha = 1): RGBA {
		if (!cssString) return { r: 0, g: 0, b: 0, a: 1 };
		const m = cssString.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
		if (m) return { r: +m[1], g: +m[2], b: +m[3], a: m[4] ? +m[4] : defaultAlpha };
		return { r: 0, g: 0, b: 0, a: 1 };
	}

	toggleInteractive = () => {
		this.controls.interactive = !this.controls.interactive;
		if (!this.controls.interactive) {
			this.isMouseDown = false;
			if (this.isPanning) {
				this.isPanning = false;
				document.body.style.cursor = 'default';
			}
			this.hover_pos = null;
			if (!this.controls.playing && !this.isAnimating) this.draw();
		}
	};
}

// ─── Context Helpers ─────────────────────────────────────────────────────────

export function init_engine() {
	return setContext(GAME_ENGINE_SYMBOL, new Engine());
}

export function get_engine() {
	const store = getContext<Engine>(GAME_ENGINE_SYMBOL);
	if (!store) throw new Error('GAME_ENGINE not initialized');
	return store;
}
