<script lang="ts">
	import { page } from '$app/state';
	import { groups, navigation } from '$lib/static';
	import type { Pattern } from '$lib/types';
	import { slugify } from '$lib/utils/slug';

	const pattern: Pattern | null = $derived(page.data.pattern);

	const slug = $derived(slugify(page.params.pattern || ''));

	const pattern_nav = $derived(pattern ? navigation.get(slug) : null);

	const group = $derived(groups.find((group) => group.name == pattern_nav?.group));

	const theme = $derived(pattern_nav?.theme);
</script>

{#if pattern && group}
	<div class="pointer-events-none fixed right-0 bottom-0 left-0 z-200">
		<div class="grid-12">
			<div class="col-span-4">
				<div class="relative min-h-72 rounded-t-2xl bg-life px-6 py-4 text-bg">
					<div class="mb-2 text-3xl/7.5">{group.name}</div>

					<div class="font-mono">
						{group.description}
					</div>
				</div>
				<div class="absolute bottom-0 left-gap">
					<div class="rounded-t bg-bg px-6 py-3 text-text">
						<div class="flex items-center gap-2">
							<div class="icon-[ri--menu-fill]"></div>
							Catégories
						</div>
					</div>
				</div>
			</div>
			<div class="relative col-span-4">
				<!-- <div
					class="absolute -top-24 right-24 bottom-0 -left-24 rounded-t-2xl bg-life shadow-2xl brightness-60 backdrop-blur"
				></div>
				<a
					href="/{pattern_nav?.prev}"
					class="absolute -top-12 right-12 bottom-0 -left-8 rounded-t-2xl bg-life shadow-2xl brightness-80 backdrop-blur"
				></a> -->
				<div class="relative min-h-72 rounded-t-2xl bg-life px-6 py-4 text-bg">
					<div class="mb-2 text-3xl/7.5">{pattern.name}</div>
					<div>{pattern_nav?.group}</div>
					<div>{pattern.author}</div>
					<div class="font-mono">
						{#each pattern.comments as comment}
							<div>{comment}</div>
						{/each}
					</div>
					<div class="font-mono">
						{pattern.width}x{pattern.height}
					</div>
				</div>
				<!-- {#if pattern_nav?.next}
					<a
						href="/{pattern_nav?.next}"
						class="absolute bottom-0 left-12 h-12 w-md rounded-t-2xl bg-life shadow-2xl brightness-120"
					></a>
				{/if} -->
				<div class="absolute bottom-0 left-gap">
					<div class="rounded-t bg-bg px-6 py-3 text-text">
						<div class="flex items-center gap-2">
							<div class="icon-[ri--menu-fill]"></div>
							Structures
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
{/if}
