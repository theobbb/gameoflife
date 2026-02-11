<script lang="ts">
	import { page } from '$app/state';
	import { groups, navigation } from '$lib/static';
	import type { Pattern } from '$lib/types';
	import { slugify } from '$lib/utils/slug';
	import CardGrid from './card-grid.svelte';
	import Card from './card.svelte';

	const raw_pattern: Pattern | null = $derived(page.data.pattern);
	const slug = $derived(slugify(page.params.pattern || ''));
	const pattern = $derived(raw_pattern ? navigation.get(slug) : null);
	const current_group = $derived(groups.find((group) => group.name == pattern?.group));

	const pixel_count = $derived(raw_pattern?.pattern.flat().filter(Boolean).length || 0);
</script>

<div class="bg-red-500- pointer-events-auto relative aspect-square w-full">
	{#each groups as group}
		<div>
			{#each group.children as item, i}
				<Card
					active_i={pattern?.index}
					is_active_group={group.name == current_group?.name}
					{group}
					{item}
					{i}
				>
					{#if pattern?.index == i && group.name == current_group?.name}
						<div>{@render content()}</div>
					{:else}
						<a href="/{slugify(item)}" class="absolute inset-0 flex h-full w-full"></a>
					{/if}
				</Card>
				<!-- <div
					class="absolute inset-0 w-full rounded-2xl bg-bg-2"
					style="transform: rotate({i * 5}deg); filter: brightness({(100 - i * 5) / 100});"
				></div> -->
			{/each}
		</div>
	{/each}
</div>

{#snippet content()}
	{#if raw_pattern && current_group}
		<div class="relative px-4 py-3 text-text">
			<div class="mb-2 flex justify-between gap-4">
				<div class=" text-3xl/7.5">{raw_pattern.name}</div>
				<div class="font-mono text-white/60">
					{(pattern?.index || 0) + 1}/{current_group.children.length}
				</div>
			</div>
			<div class="text-white/60">{raw_pattern.author}</div>

			<div class="mt-12">
				{#each raw_pattern.comments as comment}
					<div>{comment}</div>
				{/each}
			</div>
			<div class="grid-12 mt-4 grid">
				<div class="col-span-8 font-mono text-white/60">
					<div>{raw_pattern.width}x{raw_pattern.height}</div>
					<div>{pixel_count} cellules</div>
				</div>
				<div class="col-span-4">
					<CardGrid pattern={raw_pattern} />
				</div>
			</div>
		</div>
	{/if}
{/snippet}

<!-- {#if raw_pattern && group}
	<div class="relative">
	
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
		
	</div>
{/if} -->
<!-- <div
					class="absolute -top-24 right-24 bottom-0 -left-24 rounded-t-2xl bg-life shadow-2xl brightness-60 backdrop-blur"
				></div>
				<a
					href="/{pattern?.prev}"
					class="absolute -top-12 right-12 bottom-0 -left-8 rounded-t-2xl bg-life shadow-2xl brightness-80 backdrop-blur"
				></a> -->
<!-- {#if pattern?.next}
					<a
						href="/{pattern?.next}"
						class="absolute bottom-0 left-12 h-12 w-md rounded-t-2xl bg-life shadow-2xl brightness-120"
					></a>
				{/if} -->
<style>
	.card {
		width: 20rem;
		color: white;
		background-color: var(--color-bg-2);
		min-height: 20rem;
		border-radius: 1rem;
		padding-inline: calc(var(--spacing) * 4);
		padding-block: calc(var(--spacing) * 3);
	}
</style>
