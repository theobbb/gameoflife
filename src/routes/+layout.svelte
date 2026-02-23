<script lang="ts">
	import '$lib/style/layout.css';
	import '$lib/style/fonts.css';
	import '$lib/style/themes.css';
	import favicon from '$lib/assets/favicon.svg';
	import { init_engine } from './engine.svelte';
	import Controls from './+/controls/controls.svelte';

	import Card from './cards.svelte';
	import Wiki from './wiki.svelte';
	import Header from './header.svelte';
	import { page } from '$app/state';

	import Nav from './nav.svelte';
	import type { Pattern } from '$lib/types.js';
	import { slugify } from '$lib/utils/slug.js';
	import { groups, navigation } from '$lib/static.js';
	import { onMount } from 'svelte';
	import { MediaQuery } from 'svelte/reactivity';

	let { data, children } = $props();

	const engine = init_engine();

	let canvas: HTMLCanvasElement | null = $state(null);

	const canvas_visible = $derived(!!page.params.pattern);

	// function init(canvas: HTMLCanvasElement) {
	// 	// if (engine.initialized) return;
	// 	console.log('init');
	// 	engine.mount(canvas);
	// 	return () => {
	// 		console.log('destroy');
	// 		//engine.destroy();
	// 	};
	// }
	$effect(() => {
		if (canvas) {
			engine.mount(canvas);
		} else {
			//console.log('unmounting canvas');
			engine.destroy();
			engine.setTheme('black');
		}

		// return () => {
		// 	engine.destroy();
		// };
	});
	// $effect(() => {
	// 	if (!page.route.id) {
	// 		engine.controls.playing = true;
	// 	}
	// });

	const raw_pattern: Pattern | null = $derived(page.data.pattern);
	const slug = $derived(slugify(page.params.pattern || ''));
	const pattern = $derived(raw_pattern ? navigation.get(slug) : null);
	const group = $derived(groups.find((group) => group.name == pattern?.group));

	const desktop = new MediaQuery('min-width: 1300px');
	// $inspect('%%', engine.initialized);
</script>

{#if (page.params.pattern || page.route.id == '/') && desktop.current}
	<canvas
		bind:this={canvas}
		class={[
			'-z-10- fixed inset-0 h-full w-full',
			page.route.id == '/' ? 'pointer-events-none opacity-20' : '',
			'transition duration-300 ease-in-out'
		]}
	></canvas>
{/if}
{#if page.params.pattern}
	<div class="grid-12 pointer-events-none fixed inset-gap z-100 max-[1300px]:hidden">
		<div class="col-span-3 flex items-end">
			<Card />
		</div>
		<div class="col-span-6 flex items-end">
			<Nav {group} />
		</div>
		<div class="col-span-3 flex items-end justify-end">
			<Controls />
		</div>
	</div>
{/if}

<div class="grid min-h-svh grid-rows-[auto_1fr] px-gap py-gap-y max-[1300px]:hidden">
	{#if page.params.pattern}
		<Header />
	{/if}
	<div class="">{@render children()}</div>
</div>

<div class="fixed inset-4 flex items-center justify-center min-[1301px]:hidden">
	<div class="text-center text-xl/6.5">
		<div>Oups!</div>
		<div>
			Veuillez consulter ce site <br /> sur un <span class="underline">écran plus grand</span>.
		</div>
	</div>
</div>

<!-- <div class="relative z-10"><Wiki /></div> -->
<svelte:head>
	<title>Le jeu de la vie</title>
	<link rel="icon" href={favicon} />
</svelte:head>
