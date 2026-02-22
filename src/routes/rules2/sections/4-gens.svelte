<script lang="ts">
	import { CELL_COLOR, GENS_DURATION, get_grid, GRID_COLOR } from '../grid.svelte';

	const grid = get_grid();
</script>

<div>
	Le jeu fonctionne par <span class="underline">générations</span>. <br />
	Chaque état détermine automatiquement <br /> le suivant, selon des règles préétablies.
</div>
<div class={['mt-12', grid.step == 4 ? '' : 'opacity-0', 'transition']}>
	<div class="relative flex h-2.5 w-32">
		<div
			class="progress-track w-full overflow-hidden rounded-full"
			style="background-color: {GRID_COLOR};"
		>
			<div
				class="ease h-full origin-left bg-white/80 transition duration-200"
				style="transform: scaleX({(grid.generationCount / grid.maxGenerations) *
					100}%); background-color: {CELL_COLOR};"
			></div>
		</div>
	</div>
</div>

<style>
	/* .progress-track {
		width: 100%;
		height: 6px;
		background: rgba(255, 255, 255, 0.15);
		border-radius: 3px;
		overflow: hidden;
	}
	.progress-bar {
		height: 100%;
		background: white;
		border-radius: 3px;
		transition: width 200ms ease;
	} */
</style>
