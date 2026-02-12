<script lang="ts">
	import { page } from '$app/state';
	import { groups, navigation } from '$lib/static';
	import type { Pattern } from '$lib/types';
	import Button from '$lib/ui/button.svelte';
	import { slugify } from '$lib/utils/slug';

	const { group: current } = $props();

	const current_index = $derived(groups.findIndex((g) => g.name == current.name));

	const prev_slug = $derived(
		slugify(groups[(current_index - 1 + groups.length) % groups.length]?.children[0])
	);
	const next_slug = $derived(
		slugify(groups[(current_index + 1 + groups.length) % groups.length]?.children[0])
	);

	let hovered_index: number = $state(-1);
	let hide_timeout: ReturnType<typeof setTimeout> | null = $state(null);

	const hovered_group = $derived(groups[hovered_index]);

	function onmouseenter(index: number) {
		if (hide_timeout) {
			clearTimeout(hide_timeout);
			hide_timeout = null;
		}
		hovered_index = index;
	}
	function onmouseleave() {
		hide_timeout = setTimeout(() => {
			hovered_index = -1;
		}, 1000);
	}
	function onTooltipEnter() {
		if (hide_timeout) {
			clearTimeout(hide_timeout);
			hide_timeout = null;
		}
	}
</script>

<div class="flex w-full justify-center">
	<div class="pointer-events-auto relative text-white">
		<div
			class="relative z-50 flex gap-1 rounded border border-black/50 bg-black/20 p-1 backdrop-blur"
		>
			{#each groups as group, i}
				<div class="relative flex">
					<!-- <div
						class="absolute -top-4 w-md -translate-x-1/2 -translate-y-full border-black/50 bg-black/20 backdrop-blur"
					>
						<div class="px-gap py-2.5">
							{group.description}
						</div>
					</div> -->
					<a
						onmouseenter={() => onmouseenter(i)}
						{onmouseleave}
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
				</div>
			{/each}
		</div>
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			onmouseenter={onTooltipEnter}
			{onmouseleave}
			class={['absolute -top-2 left-0  w-full -translate-y-full']}
		>
			<div
				class={[
					'min-h-24 rounded border border-black/50 bg-black/20 text-white/85 backdrop-blur',
					hovered_index >= 0 ? '' : 'pointer-events-none translate-y-2 opacity-0',
					'transition duration-200'
				]}
			>
				{#if hovered_group}
					<div class="flex justify-between px-3.5 py-2.5 pr-2.5">
						<div class="max-w-md text-balance">
							{hovered_group.description}
						</div>
						<!-- {#if hovered_group.name == current.name}
							<div class="-mt-1 flex items-center gap-1.5">
								<a
									href="/{prev_slug}"
									onclick={() => hovered_index--}
									class="flex size-8 cursor-pointer items-center justify-center rounded-sm border border-black/30 bg-black/10 p-0! transition duration-100 hover:bg-black/20"
									aria-label="previous group"
								>
									<div class="icon-[ri--arrow-left-line]"></div>
								</a>
								<a
									href="/{next_slug}"
									onclick={() => hovered_index++}
									class="flex size-8 cursor-pointer items-center justify-center rounded-sm border border-black/30 bg-black/10 p-0! transition duration-100 hover:bg-black/20"
									aria-label="next group"
								>
									<div class="icon-[ri--arrow-right-line]"></div>
								</a>
							</div>
						{/if} -->
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>
