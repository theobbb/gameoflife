<script lang="ts">
	import { get_engine } from '../../engine.svelte';

	const engine = get_engine();
</script>

<div class="grid grid-cols-2 gap-gap text-sm/4">
	<div class="stats rounded bg-black/5 px-3 py-2 backdrop-blur">
		<div>
			<div>génération:</div>
			<div>{engine.stats.n_gens}</div>
		</div>
		<div>
			<div>en vie:</div>
			<div>{engine.stats.n_active}</div>
		</div>
		<div>
			<div>naissances:</div>
			<div>{engine.stats.n_born}</div>
		</div>
		<div>
			<div>morts:</div>
			<div>{engine.stats.n_died}</div>
		</div>
	</div>
	<div class="stats rounded bg-black/5 px-3 py-2 backdrop-blur">
		<div>
			<div>zoom:</div>
			<div>{(engine.controls.zoom_level * 100).toFixed(0)}%</div>
		</div>
		<div>
			<div>fps:</div>
			<div>{engine.stats.fps}</div>
		</div>
	</div>
</div>

<style>
	.stats > div {
		display: flex;
		justify-content: space-between;
		gap: var(--spacing-gap);
	}
</style>
