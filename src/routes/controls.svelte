<script lang="ts">
	import Key from '$lib/ui/key.svelte';
	import { get_engine } from './engine.svelte';

	const engine = get_engine();
	//console.log(engine);
</script>

<div class="pointer-events-auto flex w-full flex-col items-end justify-end font-mono">
	<div class="mb-6 flex w-full gap-2">
		<button
			class="col-span-6 flex cursor-pointer items-center justify-center gap-2 rounded border border-white/80 bg-white/60 px-5 py-2 backdrop-blur"
			onclick={engine.togglePlay}
		>
			<div class={[engine.isPlaying ? 'icon-[ri--pause-fill]' : 'icon-[ri--play-fill]']}></div>
			{#if engine.isPlaying}
				Arrêter
			{:else}
				Démarrer
			{/if}
		</button>
		<button
			class="col-span-2 flex aspect-square cursor-pointer items-center justify-center gap-2 rounded border border-white/80 bg-white/60 backdrop-blur"
			onclick={engine.togglePlay}
		>
			<div class={['icon-[ri--reset-right-line]']}></div>
		</button>
		<button
			class="col-span-2 flex aspect-square cursor-pointer items-center justify-center gap-2 rounded border border-white/80 bg-white/60 backdrop-blur"
			onclick={engine.togglePlay}
		>
			<div class={['icon-[ri--delete-bin-line]']}></div>
		</button>
		<!-- <button
			class="col-span-2 flex aspect-square cursor-pointer items-center justify-center gap-2 rounded border border-white/80 bg-white/60 backdrop-blur"
			onclick={engine.togglePlay}
		>
			<div class={['icon-[ri--delete-bin-line]']}></div>
		</button> -->
	</div>
	<div class="flex flex-col gap-1">
		<div class="flex items-end gap-gap">
			<button onclick={engine.togglePlay} class="w-44">
				<Key label="play/pause">
					<div class="h-0.5 w-10 -translate-y-2 bg-text"></div>
				</Key>
				<!-- <div class={[engine.isPlaying ? 'icon-[ri--pause-fill]' : 'icon-[ri--play-fill]']}></div> -->
			</button>
			<div class="grid grid-cols-3 grid-rows-2 gap-x-1.5">
				<button onclick={engine.next_frame} class="col-start-2 w-11">
					<Key label="time+">
						<div class={'icon-[ri--arrow-up-fill] -translate-y-2'}></div>
					</Key>
				</button>
				<button onclick={engine.next_frame} class="row-start-2 w-11">
					<Key label="gen-">
						<div class={'icon-[ri--arrow-left-fill] -translate-x-2 -translate-y-2'}></div>
					</Key>
				</button>
				<button onclick={engine.next_frame} class="row-start-2 w-11">
					<Key label="Time-">
						<div class={'icon-[ri--arrow-down-fill] -translate-y-2'}></div>
					</Key>
				</button>
				<button onclick={engine.next_frame} class="row-start-2 w-11">
					<Key label="Gen+">
						<div class={'icon-[ri--arrow-right-fill] translate-x-2 -translate-y-2'}></div>
					</Key>
				</button>
			</div>
			<!-- <div>
					<div class="relative flex w-fit flex-col items-center justify-center">
						<div class="size-10 rounded-xl border-2 opacity-30"></div>
						<div
							class="absolute icon-[ri--cursor-fill] translate-x-0.5 translate-y-1 text-2xl"
						></div>
					</div>
					<span class="font-mono text-xs">cells</span>
				</div> -->
		</div>

		<!-- <button
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
			</button> -->
	</div>
	<div class="text-sm/4">
		<input type="range" min="0.1" max="3.0" step="0.1" bind:value={engine.time_scale} />
		<div>Zoom: {(engine.zoom_level * 100).toFixed(0)}%</div>
		<div>Générations: {engine.stats.n_gens}</div>
		<!-- <div>Vivant: {engine.visualCells.size}</div>
			<div>Naissances: {engine.dyingCells.size}</div> -->
		<div>Morts:</div>
	</div>
</div>
