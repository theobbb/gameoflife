<script lang="ts">
	import '$lib/style/layout.css';
	import '$lib/style/fonts.css';
	import '$lib/style/themes.css';

	import favicon from '$lib/assets/favicon.svg';
	import { init_engine } from './engine.svelte';
	import Controls from './+/controls/controls.svelte';
	import { onMount, untrack } from 'svelte';
	import Card from './cards.svelte';
	import Wiki from './wiki.svelte';
	import Header from './header.svelte';
	import { page } from '$app/state';
	import Footer from './footer.svelte';
	import Nav from './nav.svelte';
	import type { Pattern } from '$lib/types.js';
	import { slugify } from '$lib/utils/slug.js';
	import { groups, navigation } from '$lib/static.js';

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
			//console.log('mounting canvas');
			engine.mount(canvas);
		} else {
			//console.log('unmounting canvas');
			engine.destroy();
		}

		// return () => {
		// 	engine.destroy();
		// };
	});

	const raw_pattern: Pattern | null = $derived(page.data.pattern);
	const slug = $derived(slugify(page.params.pattern || ''));
	const pattern = $derived(raw_pattern ? navigation.get(slug) : null);
	const group = $derived(groups.find((group) => group.name == pattern?.group));

	// $inspect('%%', engine.initialized);
</script>

{#if page.params.pattern}
	<canvas bind:this={canvas} class={['-z-10- fixed inset-0 h-full w-full']}></canvas>
	<div class="grid-12 pointer-events-none fixed inset-gap z-100">
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

<div class="grid min-h-svh grid-rows-[auto_1fr_auto] px-gap py-gap-y">
	{#if page.route.id != '/'}
		<Header />
	{/if}
	<div>{@render children()}</div>
	<Footer />
</div>

<!-- <div class="relative z-10"><Wiki /></div> -->
<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>
