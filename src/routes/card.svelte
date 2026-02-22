<script lang="ts">
	import type { Pattern } from '$lib/types';
	import type { Snippet } from 'svelte';

	const {
		is_active_group,
		active_i,

		i,
		children
	}: {
		is_active_group: boolean;
		active_i: number;
		group: {
			name: string;
			description: string;
			theme: string;
			children: string[];
		};
		item: string;
		i: number;
		children?: Snippet;
	} = $props();

	// const style = $derived.by(() => {
	//     let
	// })

	const under = $derived(is_active_group && active_i > i);
	const difference = $derived(Math.abs(active_i - i));

	const active = $derived(active_i == i);

	const rotation: number = $derived.by(() => {
		if (!is_active_group) return -180;

		if (under) {
			return Math.min(180, (active_i - i) * 15 + 60);
		}
		return (active_i - i) * 15;
		//is_active_group ? (active_i - i) * 15 : -180
	});

	const opacity: number = $derived.by(() => {
		if (!is_active_group) return 0;
		if (difference > 4) return 0;
		return 1;
	});

	const delay: number = $derived.by(() => {
		return Math.max(0, (i - active_i) * 50);
	});
	// $inspect(delay);
	const brightness: number = $derived(is_active_group ? (100 - (i - active_i) * 10) / 100 : 0);
</script>

<div
	class="absolute inset-0 w-full origin-bottom-left rounded-2xl bg-bg-2 transition duration-300"
	style="transform: rotate({rotation}deg); filter: brightness({brightness}); opacity: {opacity}; z-index: {1000 -
		i}; transition-delay: {delay}ms;"
>
	{@render children?.()}
</div>

<style>
	/* div {
		transition: all 0.3s cubic-bezier(0.46, -0.56, 0.42, 1.42);
	} */
</style>
