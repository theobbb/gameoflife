<script lang="ts">
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
</script>

<div class="flex w-full flex-col items-end justify-end font-mono">
	<!-- <div class="flex justify-center">
		<div class="pointer-events-auto">
			<button
				class="group mt-1 mr-0.5 flex min-w-36 cursor-pointer items-center gap-1 rounded-md border border-white bg-white/60 p-1 font-mono text-lg text-black/80 backdrop-blur"
				onclick={engine.togglePlay}
			>
				<div
					class="flex w-full items-center justify-center gap-2 rounded px-3.5 py-0.5 pr-3 transition group-hover:bg-white"
				>
					{#if engine.controls.playing}
						<div class="-mt-px">Arrêter</div>
						<div class="icon-[ri--pause-line] text-lg"></div>
					{:else}
						<div class="-mt-px">Démarrer</div>
						<div class="icon-[ri--play-line] text-lg"></div>
					{/if}
				</div>
			</button>
		</div>
	</div> -->
	<div class="flex w-42 flex-col items-center">
		<div class="my-4 flex flex-col gap-1">
			<Keys />
		</div>

		<div
			class="pointer-events-auto flex w-full flex-col rounded text-[0.8rem]/[0.9rem] text-balance"
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

		<div class="pointer-events-auto mt-3.5 w-full">
			<Stats />
		</div>
	</div>
</div>
