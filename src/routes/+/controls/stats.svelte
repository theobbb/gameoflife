<script lang="ts">
	import { get_engine } from '../../engine.svelte';

	const engine = get_engine();
</script>

<div class="text-sm/4">
	<div>Zoom: {(engine.controls.zoom_level * 100).toFixed(0)}%</div>
	<div>Générations: {engine.stats.n_gens}</div>
	<!-- <div>Vivant: {engine.visualCells.size}</div>
			<div>Naissances: {engine.dyingCells.size}</div> -->
	<div>Morts:</div>
</div>
