<script lang="ts">
	import { page } from '$app/state';
	import { groups, navigation } from '$lib/static';
	import type { Pattern } from '$lib/types.js';
	import { slugify } from '$lib/utils/slug.js';
	import { get_engine, TIME_SCALE } from '../engine.svelte';

	const { data } = $props();
	const engine = get_engine();

	// const theme = {
	// 	background: '#402545',
	// 	grid: '#003300',
	// 	blob: '#00FF00'
	// };
	const pattern: Pattern | null = $derived(data.pattern);

	const slug = $derived(slugify(page.params.pattern || ''));

	const pattern_nav = $derived(pattern ? navigation.get(slug) : null);
	const theme = $derived(pattern_nav?.theme);

	//$inspect(engine.initialized, pattern.name, engine.current_pattern?.name);
	$effect(() => {
		if (engine.initialized && pattern && pattern.name != engine.current_pattern?.name) {
			engine.drawPattern(pattern, theme);
		}
	});

	$effect(() => {
		if (engine.theme == 'black') {
			engine.controls.time_scale = TIME_SCALE[0];
			engine.controls.playing = false;
			engine.drawPattern(pattern, theme);
		}
	});
</script>
