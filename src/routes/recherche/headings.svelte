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
			{ rootMargin: '-10% 0px -70% 0px' }
		);
		const elements = outline.map(({ id }) => document.getElementById(id)).filter(Boolean);
		elements.forEach((el) => observer.observe(el!));
		return () => observer.disconnect();
	});
</script>

<nav class="text-sm leading-snug">
	<div class=" border-white/10">
		{#each outline as { id, text, depth }, i}
			<a
				href="#{id}"
				class={[
					'block border-l py-0.5 pl-3 transition-colors hover:text-white',

					activeId === id
						? ' border-white font-medium text-white/90'
						: 'border-white/20 text-white/40'
				]}
				style="padding-left: {(depth - minDepth) * 1 + 0.8}rem"
			>
				<span class="block -translate-y-px">{text}</span>
			</a>
		{/each}
	</div>
</nav>

<!-- <nav class="text-sm leading-snug">
	<div class=" border-white/10">
		{#each outline as { id, text, depth }, i}
			<a
				href="#{id}"
				class={[
					'block py-0.5 pl-3 transition-colors hover:text-white',
					depth != 1 && 'border-l',
					outline[i - 1]?.depth == depth ? '' : ' mt-0.5 pt-0',
					outline[i + 1]?.depth == depth ? '' : '',
					activeId === id ? ' border-white font-medium text-white/90' : 'text-white/40'
				]}
				style="margin-left: {(depth - minDepth) * 1}rem"
			>
				<span class="block -translate-y-px">{text}</span>
			</a>
		{/each}
	</div>
</nav> -->
