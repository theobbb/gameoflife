<script lang="ts">
	import './markdown.css';
	import Headings from './headings.svelte';
	import { page } from '$app/state';

	const { data, children } = $props();
	const { markdown, headings, routes, current } = $derived(data);

	const current_route_i = $derived(routes.findIndex((r) => r.slug == current.slug));

	const prev_route = $derived(routes[current_route_i - 1]);
	const next_route = $derived(routes[current_route_i + 1]);
</script>

<header
	class="text-2 fixed top-0 right-0 left-0 z-10 flex gap-8 bg-neutral-950 px-gap py-1.5 pb-2 select-none"
	style="font-family: 'Segoe UI', sans-serif;"
>
	<a href="/">Le Jeu de la vie organique</a>
	<a href="/recherche" class="text-white/80">Document de recherche</a>
	<!-- <a href="/">← Jeu</a> -->
</header>
<div class="relative mt-16" style="font-family: 'Segoe UI', sans-serif;">
	<div class="relative mx-auto grid max-w-7xl grid-cols-4 gap-24">
		<div class="relative pl-24 select-none">
			<nav class="sticky top-20 flex flex-col gap-2">
				{#each data.routes as route}
					<a
						class={[
							'hover:underline',
							(!page.params.file && !route.slug) || page.params.file == route.slug
								? ' text-orange-500'
								: ''
						]}
						href="/recherche/{route.slug}">{route.name}</a
					>
				{/each}
			</nav>
		</div>
		<div class="col-span-2 pb-32">
			<div class="markdown">{@html markdown}</div>
			<div class="mt-12 flex justify-between gap-4 border-t border-white/20 pt-1">
				<div class="space-y-1">
					<div class="text-2 text-sm">← précédent</div>
					{#if prev_route}
						<a class="text-orange-500" href="/recherche/{prev_route.slug}">{prev_route.name}</a>
					{/if}
				</div>
				<div class="space-y-1 text-right">
					<div class="text-2 text-sm">suivant →</div>
					{#if next_route}
						<a class="text-orange-500" href="/recherche/{next_route.slug}">{next_route.name}</a>
					{/if}
				</div>
			</div>
		</div>
		<div class="relative select-none">
			<div class="sticky top-20 pl-6"><Headings {headings} /></div>
		</div>
	</div>
</div>
{@render children()}
