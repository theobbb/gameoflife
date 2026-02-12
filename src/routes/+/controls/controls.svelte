<script lang="ts">
	import Button from '$lib/ui/button.svelte';
	import Range from '$lib/ui/range.svelte';
	import {
		DAMPING,
		get_engine,
		INFLUENCE_RADIUS,
		METABALL_RADIUS,
		METABALL_THRESHOLD,
		RENDER_RESOLUTION,
		STIFFNESS,
		TIME_SCALE
	} from '../../engine.svelte';
	import Keys from './keys.svelte';
	import Stats from './stats.svelte';

	const engine = get_engine();
	//console.log(engine);
	$inspect(engine.controls.stiffness);
</script>

<div class="pointer-events-auto flex w-full flex-col items-end justify-end font-mono">
	<div class="mb-6 flex w-full gap-2 text-black/90">
		<!-- <button
			class="col-span-6 flex cursor-pointer items-center justify-center gap-2 rounded border border-white/80 bg-white/60 px-5 py-2 backdrop-blur"
			onclick={engine.togglePlay}
		>
			<div class={[engine.isPlaying ? 'icon-[ri--pause-fill]' : 'icon-[ri--play-fill]']}></div>
			{#if engine.isPlaying}
				Arrêter
			{:else}
				Démarrer
			{/if}
		</button> -->
		<Button onclick={engine.togglePlay}>
			<div
				class={[engine.controls.playing ? 'icon-[ri--pause-fill]' : 'icon-[ri--play-fill]']}
			></div>
			{#if engine.controls.playing}
				Arrêter
			{:else}
				Démarrer
			{/if}
		</Button>

		<button
			class="col-span-2 flex aspect-square cursor-pointer items-center justify-center gap-2 rounded border border-white/80 bg-white/60 backdrop-blur"
			onclick={engine.togglePlay}
			aria-label="reset pattern"
		>
			<div class={['icon-[ri--reset-right-line]']}></div>
		</button>
		<button
			class="col-span-2 flex aspect-square cursor-pointer items-center justify-center gap-2 rounded border border-white/80 bg-white/60 backdrop-blur"
			onclick={engine.togglePlay}
			aria-label="reset engine"
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

	<Range
		label="temps"
		bind:value={engine.controls.time_scale}
		min={TIME_SCALE[1]}
		max={TIME_SCALE[2]}
	/>
	<Range
		label="stiffness"
		bind:value={engine.controls.stiffness}
		min={STIFFNESS[1]}
		max={STIFFNESS[2]}
	/>
	<Range label="damping" bind:value={engine.controls.damping} min={DAMPING[1]} max={DAMPING[2]} />
	<Range
		label="radius"
		bind:value={engine.controls.metaball_radius}
		min={METABALL_RADIUS[1]}
		max={METABALL_RADIUS[2]}
	/>
	<Range
		label="threshold"
		bind:value={engine.controls.metaball_threshold}
		min={METABALL_THRESHOLD[1]}
		max={METABALL_THRESHOLD[2]}
	/>
	<Range
		label="resolution"
		bind:value={engine.controls.render_resolution}
		min={RENDER_RESOLUTION[1]}
		max={RENDER_RESOLUTION[2]}
	/>
	<Range
		label="influence radius"
		bind:value={engine.controls.influence_radius}
		min={INFLUENCE_RADIUS[1]}
		max={INFLUENCE_RADIUS[2]}
	/>

	<div class="my-4 flex flex-col gap-1">
		<Keys />
	</div>
	<div class="mt-4"><Stats /></div>
</div>
