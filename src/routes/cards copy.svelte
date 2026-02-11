<script lang="ts">
	import { page } from '$app/state';
	import { groups, navigation } from '$lib/static';
	import type { Pattern } from '$lib/types';
	import { slugify } from '$lib/utils/slug';
	import CardGrid from './card-grid.svelte';

	const raw_pattern: Pattern | null = $derived(page.data.pattern);
	const slug = $derived(slugify(page.params.pattern || ''));
	const pattern = $derived(raw_pattern ? navigation.get(slug) : null);
	const group = $derived(groups.find((group) => group.name == pattern?.group));

	const pixel_count = $derived(raw_pattern?.pattern.flat().filter(Boolean).length || 0);
</script>

{#if raw_pattern && group}
	<div class="relative">
		<!-- <div
					class="absolute -top-24 right-24 bottom-0 -left-24 rounded-t-2xl bg-life shadow-2xl brightness-60 backdrop-blur"
				></div>
				<a
					href="/{pattern?.prev}"
					class="absolute -top-12 right-12 bottom-0 -left-8 rounded-t-2xl bg-life shadow-2xl brightness-80 backdrop-blur"
				></a> -->
		<div class="card absolute inset-0 origin-bottom-left -rotate-30 brightness-60"></div>
		<a class="card absolute inset-0 origin-bottom-left -rotate-15 brightness-80" href=""></a>
		<div class="card relative">
			<div class="mb-2 flex justify-between gap-4">
				<div class=" text-3xl/7.5">{raw_pattern.name}</div>
				<div class="text-2 font-mono text-sm">
					{(pattern?.index || 0) + 1}/{group.children.length}
				</div>
			</div>
			<div class="text-2">{raw_pattern.author}</div>

			<div class="">
				{#each raw_pattern.comments as comment}
					<div>{comment}</div>
				{/each}
			</div>
			<div class="grid-12 mt-4 grid">
				<div class="text-2 col-span-8 font-mono">
					<div>{raw_pattern.width}x{raw_pattern.height}</div>
					<div>{pixel_count} cellules</div>
				</div>
				<div class="col-span-4">
					<CardGrid pattern={raw_pattern} />
				</div>
			</div>
		</div>
		<div
			class="card absolute inset-0 origin-bottom-left -translate-x-1/3 translate-y-2/3 rotate-10 brightness-120"
		></div>
		<!-- {#if pattern?.next}
					<a
						href="/{pattern?.next}"
						class="absolute bottom-0 left-12 h-12 w-md rounded-t-2xl bg-life shadow-2xl brightness-120"
					></a>
				{/if} -->
	</div>
{/if}

<style>
	.card {
		color: white;
		background-color: var(--color-bg-2);
		min-height: 20rem;
		border-radius: 1rem;
		padding-inline: calc(var(--spacing) * 4);
		padding-block: calc(var(--spacing) * 3);
	}
</style>
