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
</script>

<div class="pointer-events-none- flex w-full flex-col items-end justify-end font-mono">
	<button>
		<div class="icon-[ri--settings-line] text-3xl"></div>
	</button>
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
		<Button onclick={engine.next_frame} class="aspect-square p-2!">
			<div class="icon-[ri--arrow-right-line]"></div>
		</Button>
		<Button onclick={engine.clearGrid} class="aspect-square p-2!">
			<div class="icon-[ri--delete-bin-line]"></div>
		</Button>
		<Button onclick={engine.resetPattern} class="aspect-square p-2!">
			<div class="icon-[ri--reset-right-line]"></div>
		</Button>
		<Button onclick={engine.clearGrid} class="aspect-square p-2!">
			<div class="icon-[ri--delete-bin-line]"></div>
		</Button>

		<!-- <button
			class="col-span-2 flex aspect-square cursor-pointer items-center justify-center gap-2 rounded border border-white/80 bg-white/60 backdrop-blur"
			onclick={engine.togglePlay}
		>
			<div class={['icon-[ri--delete-bin-line]']}></div>
		</button> -->
	</div>

	<div
		class="gap-3- pointer-events-auto flex flex-col rounded py-1.5 text-[0.8rem]/[0.9rem] text-balance"
	>
		<Range label="temps" bind:value={engine.controls.time_scale} control={TIME_SCALE}>
			Accélère ou ralentit l’évolution du jeu
		</Range>
		<Range
			label="seuil"
			bind:value={engine.controls.metaball_threshold}
			control={METABALL_THRESHOLD}
		>
			Distance nécessaire pour que les cellules se connectent
		</Range>

		<Range label="rigidité" bind:value={engine.controls.stiffness} control={STIFFNESS}>
			La raideur du ressort pour la physique. Élevée = les cellules rejoignent vite leur cible
		</Range>
		<Range label="amortissement" bind:value={engine.controls.damping} control={DAMPING}>
			Réduit l'oscillation et stabilise le mouvement des cellules
		</Range>
		<Range label="rayon" bind:value={engine.controls.metaball_radius} control={METABALL_RADIUS}>
			Définit la taille visuelle de la zone d'influence de chaque cellule pour l'effet "gluant"
		</Range>

		<Range
			label="résolution"
			bind:value={engine.controls.render_resolution}
			control={RENDER_RESOLUTION}
		>
			Précision du rendu (plus bas = plus précis mais plus lourd)</Range
		>
		<Range
			label="Influence"
			bind:value={engine.controls.influence_radius}
			control={INFLUENCE_RADIUS}
		>
			Distance maximale d’effet sur le champ de force.</Range
		>
	</div>

	<div class="my-4 flex flex-col gap-1">
		<Keys />
	</div>
	<div class="pointer-events-auto mt-4">
		<Stats />
	</div>
</div>
