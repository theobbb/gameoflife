<script lang="ts">
	import { page } from '$app/state';
	import { groups, navigation } from '$lib/static';
	import type { Pattern } from '$lib/types';
	import { slugify } from '$lib/utils/slug';

	const { group: current } = $props();
</script>

<div class="flex w-full justify-center">
	<div
		class="pointer-events-auto flex gap-1 rounded border border-black/50 bg-black/20 p-1 whitespace-nowrap text-white backdrop-blur"
	>
		{#each groups as group}
			<a
				class={[
					'rounded px-5 py-2 ',
					current?.name == group.name ? 'bg-white/20' : 'hover:bg-white/10',
					'transition duration-200'
				]}
				href="/{slugify(group.children[0])}"
			>
				<div class="flex items-center gap-1.5">
					{group.name}
					<span class="font-mono text-white/50">{group.children.length}</span>
				</div>
			</a>
		{/each}
	</div>
</div>
