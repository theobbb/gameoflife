export type Cell = {
	gridX: number;
	gridY: number;
	x: number; // actual render position
	y: number;
	vx: number; // velocity
	vy: number;
	targetX: number;
	targetY: number;
	phase: number; // for organic wobble
	phaseSpeed: number;
	alpha: number; // for fade in/out during transitions
	scale: number; // for shrink/grow during transitions
	dying: boolean; // is this cell dying?
};
