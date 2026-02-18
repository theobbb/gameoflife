<script lang="ts">
	type Rule = [string, string, 'life' | 'death', [number[], number[]]];
	const rules: [string, Rule[]][] = [
		[
			'Cellule vivante',
			[
				['0-1', 'meurt de solitude', 'death', [[0], []]],
				['2-3', 'survit', 'life', [[0, 7], [3]]],
				[
					'4+',
					'surpopulation',
					'death',
					[
						[0, 2, 3, 7, 8],
						[0, 3, 6, 7, 8]
					]
				]
			]
		],
		['Cellule morte', [['3', 'naissance', 'life', [[0, 3, 8], []]]]]
	];

	$effect(() => {
		document.documentElement.setAttribute('theme', 'black');
	});
</script>

<div class="text-lg/6 text-balance">
	<div class="grid-12 my-24">
		<!-- <div class="col-span-6 flex flex-col items-end justify-end pr-gap text-5xl">
			<div>Le jeu de la vie</div>
			<div class="text-2">organique</div>
		</div> -->
		<div class="col-span-6 pl-gap">
			<a
				href="/pulsar"
				class="my-2 flex w-fit items-center gap-2 rounded border border-white bg-white/80 px-5 py-2 pr-4 font-mono text-bg"
			>
				Commencer
				<div class="mt-0.5 icon-[ri--arrow-right-long-fill]"></div>
			</a>
		</div>
		<div class="col-span-full mb-48"></div>
		<div class="col-span-4 col-start-2">
			Le Jeu de la vie est un automate cellulaire créé en 1970 par le mathématicien John Conway.
			<br /> <br /> Il se compose d’une grille de cellules qui évoluent automatiquement à partir d’une
			configuration initiale.
		</div>
		<!-- <div class="col-span-5">
			Certaines formes restent stables, d’autres oscillent ou se déplacent, montrant comment des
			comportements complexes peuvent émerger de règles simples, sans contrôle extérieur.
		</div> -->

		<!-- <div>À chaque génération, on regarde chaque cellule et ses voisines immédiates :</div>
		<div>Une cellule vivante survit si elle a 2 ou 3 voisines vivantes, sinon elle meurt.</div>
		<div>Une cellule morte devient vivante si elle a exactement 3 voisines vivantes.</div>
		<div>
			Toutes les cellules sont mises à jour en même temps, puis on recommence à l’étape suivante.
		</div> -->
	</div>
</div>

<!-- <div class="sticky bottom-4">
	<button> Commencer </button>
</div> -->

<!-- <div>
		<div class="icon-["></div>
	</div> -->
{#snippet grid_renderer(data: number[], step: 0 | 1, type: 'life' | 'death', group_i: number)}
	<div class="grid aspect-square size-16 grid-cols-3 grid-rows-3 gap-0.5">
		{#each { length: 9 } as cell, i}
			<div
				class={[
					i == 4
						? step == 0
							? group_i == 0
								? 'bg-white'
								: 'bg-white/10'
							: type == 'life'
								? 'bg-white'
								: 'bg-white/10'
						: data.includes(i)
							? 'bg-white/50'
							: 'bg-white/5'
				]}
			></div>
		{/each}
	</div>
{/snippet}

<style>
	.dot {
		width: 1rem;
		height: 1rem;
		background-color: var(--color-text-2);
		border-radius: 100%;
	}
	.line-y {
		background-color: var(--color-text-2);
		height: calc(var(--spacing) * 14);
		width: calc(var(--spacing) * 0.5);
	}
</style>
