<script lang="ts">
	import { onMount } from 'svelte';
	import { GENS_DURATION, init_grid } from './grid.svelte';
	import { useIntersectionObserver } from '$lib/utils/intersection-observer';
	import Case from './case.svelte';
	import Gens from './sections/4-gens.svelte';
	import { page } from '$app/state';
	import Cells from './sections/2-cells.svelte';
	import Footer from './footer.svelte';

	type Rule = [string, string, 'life' | 'death', [number[], number[]]];

	let canvas: HTMLCanvasElement | null = $state(null);

	const from_game = $derived(page.url.searchParams.get('from'));

	const steps = ['grid', 'cells', 'neighbours', 'gens'];

	let TEST = $state(false);

	function onkeydown(event: KeyboardEvent) {
		if (event.code == 'KeyA') {
			TEST = !TEST;
		}
		if (event.code == 'ArrowRight') {
			grid.set_step(grid.step + 1);
		}
		if (event.code == 'ArrowLeft') {
			grid.set_step(grid.step - 1);
		}
	}

	const grid = init_grid();

	function handle_intersect(entry: IntersectionObserverEntry) {
		if (!entry.isIntersecting) return;

		const id = Number(entry.target.id);
		grid.set_step(id);
	}

	function observer_sentinel(el: HTMLElement) {
		$effect(() => {
			const cleanup = useIntersectionObserver(el, handle_intersect, {
				root: null, // The viewport
				rootMargin: '-45% 0px -45% 0px', // We can keep this simple since we use the 1px sentinel
				threshold: 0
			});

			return cleanup;
		});
	}

	onMount(() => {
		if (canvas) {
			grid.mount(canvas);
		}
		document.documentElement.setAttribute('theme', 'black');
		window.addEventListener('keydown', onkeydown);

		return () => {
			window.removeEventListener('keydown', onkeydown);
			grid.destroy();
		};
	});
</script>

<!-- <div class="fixed top-4 right-5 font-mono">
	{grid.step}
	<div class="flex">
		<div></div>
		<div class="relative flex h-4 w-32">
			<div class="progress-track">
				<div
					class="progress-bar"
					style="width: {(grid.generationCount / grid.maxGenerations) * 100}%"
				/>
			</div>
		</div>
	</div>
</div> -->
{#if from_game}
	<div class="fixed top-4 left-4">
		<div
			class="pointer-events-auto rounded border border-white/30 bg-white/15 p-1 text-white backdrop-blur"
		>
			<a
				class="flex items-center gap-2 rounded px-3 py-1.5 pl-2 transition duration-200 hover:bg-white/10"
				href={decodeURIComponent(from_game)}
			>
				<div class="icon-[ri--arrow-left-long-line] shrink-0 text-lg"></div>
				<div class="-mt-px">Retour au jeu</div>
			</a>
		</div>
	</div>
{:else}
	<div class="pointer-events-none fixed right-4 bottom-8 left-4 flex justify-center">
		<div
			class={[
				'pointer-events-auto rounded border border-white/30 bg-white/15 p-1 text-white backdrop-blur',
				grid.step == 12 ? 'pointer-events-none translate-y-4 opacity-0' : '',
				'transition duration-200 ease-in-out'
			]}
		>
			<a
				class="flex items-center gap-2 rounded px-3 py-1.5 pr-2 transition duration-200 hover:bg-white/10"
				href="/pulsar"
			>
				<div class="-mt-px">Sauter les règles</div>
				<div class="icon-[ri--arrow-right-long-line] shrink-0 text-lg"></div>
			</a>
		</div>
	</div>
{/if}

<!-- <div class="fixed right-6 bottom-6 left-6 flex justify-center">
	<a href="" class="text-2">Sauter les règles</a>
</div> -->

<div
	class={[
		'pointer-events-none fixed inset-12 right-2/5 -z-10',
		grid.step == 12 ? 'origin-top -translate-y-8 scale-50  opacity-0' : '',
		'transition duration-700 ease-in-out'
	]}
>
	<div
		class={[
			'relative flex h-full w-full items-center justify-center',
			grid.step == 2 ? 'scale-150 rotate-x-45 rotate-z-45' : '',
			'transition-transform duration-700 ease-in-out'
		]}
		style="perspective: 1000px; transform-style: preserve-3d;"
	>
		<div class="">
			<canvas bind:this={canvas} class={['size-150']}></canvas>
		</div>

		<!-- <div class="absolute top-0 right-0 left-0 h-12 bg-linear-to-t from-transparent to-bg"></div>
		<div class="absolute right-0 bottom-0 left-0 h-12 bg-linear-to-b from-transparent to-bg"></div>
		<div class="absolute top-0 right-0 bottom-0 w-12 bg-linear-to-r from-transparent to-bg"></div>
		<div class="absolute top-0 bottom-0 left-0 w-12 bg-linear-to-l from-transparent to-bg"></div> -->
	</div>
</div>

<div class="mx-16 grid grid-cols-5">
	<div class="col-span-3"></div>

	<div
		class={[
			'col-span-2 space-y-[5svh] overflow-x-hidden pt-[26svh] pl-12 text-3xl leading-tight text-white/80',
			grid.step < 5 ? 'bg-bg' : ''
		]}
	>
		{#each { length: 12 } as section, i}
			<section
				class={['flex min-h-[40svh] items-center  py-[5svh]']}
				use:observer_sentinel
				id={String(i)}
			>
				<div class={[grid.step == i ? '' : 'opacity-40', 'transition duration-300 ease-in-out']}>
					{#if i == 0}
						<div class="text-6xl">
							Les règles <br />
							<div class="text-2">du jeu de la vie</div>
						</div>
						<div></div>
					{:else if i == 1}
						<div>
							Le Jeu de la vie est un jeu à
							{@render number(0)}

							joueur. <br /> Il se déroule sur une
							<span class="underline">grille</span>
							qui s'étend <br /> théoriquement à l'infini.
						</div>
					{:else if i == 2}
						<Cells />
					{:else if i == 3}
						<div>
							Chaque cellule est entourée <br /> de {@render number(8)} cellules adjacentes <br />
							qu'on appelle ses
							<span class="underline">voisines</span>.
						</div>
						<div></div>
					{:else if i == 4}
						<Gens />
					{:else if i == 5}
						<div class="text-6xl">
							Comment <br /> déterminer <br /> la génération <br /> suivante ? <br />
							<div class="text-2"></div>
						</div>
					{:else if i == 6}
						<div class="">
							Pour chaque cellule vivante, <br /> on compte ses voisines vivantes.<br />
							<div class="text-2"></div>
						</div>
					{:else if i == 7}
						<Case type="life" case_n={1}>
							{#snippet label()}
								La cellule a {@render number(2)} ou
								<span class="number">{@render number(3)}</span><br /> voisines vivantes, elle
							{/snippet}
							{#snippet result()}
								survit, les conditions de vie<br /> sont optimales.
							{/snippet}
						</Case>
					{:else if i == 8}
						<Case type="death" case_n={2}>
							{#snippet label()}
								La cellule a {@render number(0)} ou seulement {@render number(1)} <br />voisine
								vivante, elle
							{/snippet}
							{#snippet result()}
								meurt par solitude.
							{/snippet}
						</Case>
					{:else if i == 9}
						<Case type="death" case_n={3}>
							{#snippet label()}
								La cellule a {@render number('4')}<span class="ml-0.5">+</span> <br />voisines
								vivantes, elle
							{/snippet}
							{#snippet result()}
								meurt par surpopulation.
							{/snippet}
						</Case>

						<!-- <div class="text-2 mt-6 text-xl leading-tight">Par surpopulation.</div> -->
					{:else if i == 10}
						<div class="">
							Et finalement... en plus de compter <br /> les voisines de chaque cellule vivante,
							<br /> on compte également les voisines <br /> de
							<span class="underline">chaque cellule morte</span>!
						</div>
					{:else if i == 11}
						<Case type="life">
							{#snippet label()}
								Si une cellule morte <br /> possède exactement {@render number(3)} <br /> voisines vivantes,
								elle
							{/snippet}
							{#snippet result()}
								devient vivante.<br /> La vie crée la vie.
							{/snippet}
						</Case>
					{/if}
				</div>
			</section>
		{/each}
	</div>
</div>

<div use:observer_sentinel id="12" class="relative z-1000">
	<div
		class={[
			grid.step == 12 ? 'delay-200' : 'translate-y-24 opacity-0 ',
			'transition  duration-700 ease-in-out'
		]}
	>
		<Footer></Footer>
	</div>
</div>
<!-- <section>
	<div>La grille est composée de cellules.</div>
	<div>Chaque cellule peut être</div>
	<div>morte ou vivante</div>
</section>
<section>Grid</section> -->

{#snippet number(n: number | string)}
	<div class="mx-0.5 inline-flex items-center justify-center font-mono">
		<div class="flex size-9 items-center justify-center rounded border border-white/30 bg-white/5">
			<div>{n}</div>
		</div>
	</div>
{/snippet}

<style>
	.underline {
		color: rgb(222, 222, 222);
	}
</style>
