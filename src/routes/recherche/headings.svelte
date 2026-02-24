<script lang="ts">
	import type { Heading } from './renderer';
	const { headings }: { headings: Heading[] } = $props();
	let activeId = $state('');

	const outline = $derived(headings.slice(1));
	const minDepth = $derived(Math.min(...outline.map((h) => h.depth)));

	$effect(() => {
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) {
						activeId = entry.target.id;
					}
				}
			},
			{ rootMargin: '0px 0px -80% 0px' }
		);
		const elements = outline.map(({ id }) => document.getElementById(id)).filter(Boolean);
		elements.forEach((el) => observer.observe(el!));
		return () => observer.disconnect();
	});
</script>

<nav class="text-sm">
	<div class="space-y-0.5- border-white/10">
		{#each outline as { id, text, depth }}
			<div class="border-l" style="padding-left: {(depth - minDepth) * 1}rem">
				<a
					href="#{id}"
					class="block py-1 pl-3 leading-snug transition-colors hover:text-white
                        {activeId === id
						? '-ml-px border-l-2 border-white font-medium text-white/90'
						: 'text-white/40'}"
				>
					{text}
				</a>
			</div>
		{/each}
	</div>
</nav>
