<script lang="ts">
	import { groups } from '$lib/static';

	function name_to_slug(str: string) {
		return str.replaceAll(' ', '').replaceAll('$', '').replaceAll('.', '').toLowerCase();
	}
</script>

<div class="">
	{#each groups as group}
		<div>
			<div>{group.name}</div>
			<div>
				{#each group.children as child}
					<a
						data-sveltekit-keepfocus
						data-sveltekit-noscroll
						class="pointer-events-auto ml-8 block w-fit"
						href="/{name_to_slug(child)}">{child}</a
					>
				{/each}
			</div>
		</div>
	{/each}
</div>
