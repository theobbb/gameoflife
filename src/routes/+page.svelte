<script lang="ts">
	import type { Pattern } from '$lib/types';
	import { onMount, untrack } from 'svelte';
	import { get_engine } from './engine.svelte';
	import Button from '$lib/ui/button.svelte';

	const { data } = $props();

	onMount(() => {
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

<div class="pointer-events-auto fixed inset-0 z-10 grid h-full grid-rows-3 px-4 text-lg/6">
	<div></div>
	<div class="my-12 grid h-full grid-cols-2 justify-center gap-16">
		<div class="flex flex-col items-end text-6xl">
			<div>Le jeu de la vie</div>
			<div class="text-2">organique</div>
		</div>
		<div class="">
			<Button href="/regles">Commencer</Button>
		</div>
		<div class="col-span-full mb-48"></div>
	</div>
	<div class="text-2 mb-16 flex items-end justify-between text-2xl leading-tight">
		<div class="flex gap-6">
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
			<a href="/pulsar" class="hover:underline- flex items-center gap-6 transition hover:text-text">
				Accéder directement au jeu
				<div class="mt-0.5 icon-[ri--arrow-right-long-fill]"></div>
			</a>
			<a
				href="/recherche"
				class="hover:underline- flex items-center gap-6 transition hover:text-text"
			>
				Recherche
				<div class="mt-0.5 icon-[ri--arrow-right-long-fill]"></div>
			</a>
		</div>
	</div>
</div>
