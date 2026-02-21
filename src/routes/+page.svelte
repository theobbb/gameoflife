<script lang="ts">
	import { page } from '$app/state';
	import { navigation } from '$lib/static';
	import type { Pattern } from '$lib/types';
	import { slugify } from '$lib/utils/slug';
	import { untrack } from 'svelte';
	import { get_engine } from './engine.svelte';

	const { data } = $props();

	type Rule = [string, string, 'life' | 'death', [number[], number[]]];
	const rules: [string, Rule[]][] = [
		[
			'Cellule vivante',
			[
				['0-1', 'meurt de solitude', 'death', [[0], []]],
				['2-3', 'survit', 'life', [[0, 7], [3]]],
				[
					'4+',
					'surpopulation',
					'death',
					[
						[0, 2, 3, 7, 8],
						[0, 3, 6, 7, 8]
					]
				]
			]
		],
		['Cellule morte', [['3', 'naissance', 'life', [[0, 3, 8], []]]]]
	];

	$effect(() => {
		document.documentElement.setAttribute('theme', 'black');
	});

	const engine = get_engine();

	const pattern: Pattern | null = $derived(data.pattern);
	engine.controls.interactive = false;

	function init() {
		if (!pattern) return;
		engine.drawPattern(pattern, 'black');
		engine.setZoom(6.0);

		//engine.controls.zoom_level = 6.0;
		engine.controls.playing = true;

		setTimeout(() => {
			engine.controls.time_scale = 0.15;
		}, 220);
	}

	//$inspect(engine.initialized, pattern.name, engine.current_pattern?.name);
	$effect(() => {
		if (engine.initialized && pattern) {
			// Everything inside untrack() is hidden from Svelte's dependency tracker
			untrack(() => {
				init();
			});
		}
	});
</script>

<div
	class="pointer-events-auto fixed inset-0 z-10 grid h-full grid-rows-3 px-4 text-lg/6 mix-blend-difference"
>
	<div></div>
	<div class="my-12 grid h-full grid-cols-2 justify-center gap-16">
		<div class="flex flex-col items-end text-6xl">
			<div>Le jeu de la vie</div>
			<div class="text-2">organique</div>
		</div>
		<div class="">
			<a
				href="/pulsar"
				class="my-2 flex w-fit items-center gap-2 rounded border border-white bg-white/80 px-5 py-2 pr-4 font-mono text-xl text-bg transition hover:bg-white"
			>
				Commencer
				<div class="mt-0.5 icon-[ri--arrow-right-long-fill]"></div>
			</a>
		</div>
		<div class="col-span-full mb-48"></div>
	</div>
	<div class="text-2 mb-16 flex items-end justify-between text-2xl">
		<div class=" flex gap-6">
			<div class="mt-1 icon-[ri--information-line] text-balance"></div>
			<div class="max-w-lg-">
				Le Jeu de la vie est un automate cellulaire <br /> créé en 1970 par le mathématicien John
				Conway.
				<br />
				Il se compose d’une grille de cellules qui évoluent <br /> automatiquement à partir d’une configuration
				initiale.
			</div>
		</div>
		<div class="flex flex-col items-end text-xl">
			<a href="" class="flex items-center gap-6">
				Accéder directement au jeu
				<div class="mt-0.5 icon-[ri--arrow-right-long-fill]"></div>
			</a>
			<a href="/recherche" class="flex items-center gap-6">
				Recherche
				<div class="mt-0.5 icon-[ri--arrow-right-long-fill]"></div>
			</a>
		</div>
	</div>
</div>

<!-- <div class="sticky bottom-4">
	<button> Commencer </button>
</div> -->

<!-- <div>
		<div class="icon-["></div>
	</div> -->
{#snippet grid_renderer(data: number[], step: 0 | 1, type: 'life' | 'death', group_i: number)}
	<div class="grid aspect-square size-16 grid-cols-3 grid-rows-3 gap-0.5">
		{#each { length: 9 } as cell, i}
			<div
				class={[
					i == 4
						? step == 0
							? group_i == 0
								? 'bg-white'
								: 'bg-white/10'
							: type == 'life'
								? 'bg-white'
								: 'bg-white/10'
						: data.includes(i)
							? 'bg-white/50'
							: 'bg-white/5'
				]}
			></div>
		{/each}
	</div>
{/snippet}

<style>
	.dot {
		width: 1rem;
		height: 1rem;
		background-color: var(--color-text-2);
		border-radius: 100%;
	}
	.line-y {
		background-color: var(--color-text-2);
		height: calc(var(--spacing) * 14);
		width: calc(var(--spacing) * 0.5);
	}
</style>
