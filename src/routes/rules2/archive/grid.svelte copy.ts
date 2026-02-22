import { getContext, setContext } from 'svelte';

const GRID_RULES_SYMBOL = Symbol('GRID_RULES_SYMBOL');

export class Grid {
	mount(canvas: HTMLCanvasElement) {
		if (this.initialized) return;

		this.canvas = canvas;
		this.ctx = canvas.getContext('2d', { alpha: false }) as CanvasRenderingContext2D;

		this.animate(this.lastFrameTime);

		console.log('grid initialized');
		this.initialized = true;
	}
}

export function init_engine() {
	return setContext(GRID_RULES_SYMBOL, new Grid());
}

export function get_engine() {
	const store = getContext<Grid>(GRID_RULES_SYMBOL);
	if (!store) throw new Error('GAME_ENGINE not initialized');
	return store;
}
