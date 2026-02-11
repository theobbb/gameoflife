<script lang="ts">
	import { get_engine } from './engine.svelte';

	const engine = get_engine();
	//console.log(engine);
</script>

<div class="flex items-end font-mono">
	<div class="pointer-events-auto min-w-44">
		<div class="flex flex-col gap-1">
			<button
				onclick={engine.togglePlay}
				class="flex w-full items-center justify-center bg-white/10 py-2 text-xl"
				title="toggle play"
			>
				<div class={[engine.isPlaying ? 'icon-[ri--pause-fill]' : 'icon-[ri--play-fill]']}></div>
			</button>
			<button
				onclick={engine.next_frame}
				class="flex w-full items-center justify-center bg-white/10 py-2 text-xl"
				title="toggle play"
			>
				<div class={'icon-[ri--arrow-right-double-fill]'}></div>
			</button>
			<button
				onclick={engine.next_frame}
				class="flex w-full items-center justify-center bg-white/10 py-2 text-xl"
				title="toggle play"
			>
				<div class={'icon-[ri--delete-bin-line]'}></div>
			</button>
			<button
				onclick={engine.next_frame}
				class="flex w-full items-center justify-center bg-white/10 py-2 text-xl"
				title="toggle play"
			>
				<div class={'icon-[ri--reset-left-fill]'}></div>
			</button>
		</div>
		<input type="range" min="0.1" max="3.0" step="0.1" bind:value={engine.time_scale} />
		<div>Zoom: {(engine.zoom_level * 100).toFixed(0)}%</div>
		<div>Générations: {engine.stats.n_gens}</div>
		<!-- <div>Vivant: {engine.visualCells.size}</div>
		<div>Naissances: {engine.dyingCells.size}</div> -->
		<div>Morts:</div>
	</div>
</div>
