<script lang="ts">
	import Button from '$lib/ui/button.svelte';
	import { get_grid } from './grid.svelte';

	const grid = get_grid();
</script>

<div
	class="relative grid min-h-[calc(100svh-1.5rem)] grid-rows-[1fr_auto] overflow-hidden pt-16 text-2xl leading-tight"
>
	<div
		class={[
			'pointer-events-auto h-full rounded-2xl bg-neutral-900',
			grid.step == 12 ? 'delay-200-' : 'translate-y-24 opacity-0 ',
			'transition duration-700 ease-in-out'
		]}
	>
		<div
			class={[
				'grid h-full grid-rows-[auto_1fr] text-3xl',
				grid.step == 12 ? '' : 'opacity-40',
				'transition duration-300 ease-in-out'
			]}
		>
			<div class="grid grid-cols-5 px-16">
				<div class="col-span-3 col-start-2 border-b border-white/10 py-12">
					<div class="mb-4">Voici les règles&nbsp;!</div>

					<div class="text-2">
						Malgré leur simplicité, elles sont à l’origine <br /> d’un univers complexe et inattendu.
					</div>
				</div>
			</div>

			<div class="flex h-full items-center">
				<div class="grid w-full grid-cols-5 px-16 pb-12">
					<div class="col-span-2 col-start-2">
						<div class="items-end- flex flex-col text-6xl">
							<div>Le jeu de la vie</div>
							<div class="text-2">organique</div>
						</div>
						<div class="text-2 mt-12">
							<div>
								Dans cette version alternative, <br /> les cellules ne sont plus de simples pixels.
							</div>
							<div>
								Elles évoluent dans une forme <span class="underline">organique</span>,<br /> inspirée
								des dynamiques du vivant.
							</div>
						</div>
					</div>
					<div class="col-span-1 pl-12">
						<div><Button href="/pulsar">Jouer</Button></div>
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="text-2 pointer-events-auto mt-3 mb-12 flex items-end justify-between text-xl">
		<a href="/" class="flex items-center gap-6 transition hover:text-text">
			<div class="mt-0.5 icon-[ri--arrow-left-long-fill]"></div>
			Retour à l'accueil
		</a>
		<a href="/recherche" class="flex items-center gap-6 transition hover:text-text">
			Recherche
			<div class="mt-0.5 icon-[ri--arrow-right-long-fill]"></div>
		</a>
	</div>
</div>
