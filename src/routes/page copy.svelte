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
		<div class="col-span-6 flex flex-col items-end justify-end pr-gap text-5xl">
			<div>Le jeu de la vie</div>
			<div class="text-2">organique</div>
		</div>
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
			Le Jeu de la vie est un automate cellulaire inventé en 1970 par le mathématicien John Conway.
			Il se présente sous la forme d’une grille de cellules qui évoluent automatiquement au fil du
			temps.
		</div>
		<div class="col-span-5">
			À partir d’une configuration initiale, des formes apparaissent, se transforment ou
			disparaissent. Certaines restent stables, d’autres oscillent ou se déplacent, créant
			l'illusion d’un système vivant. Le Jeu de la vie illustre comment des comportements complexes
			peuvent émerger d’un système très simple, sans contrôle extérieur.
		</div>

		<!-- <div>À chaque génération, on regarde chaque cellule et ses voisines immédiates :</div>
		<div>Une cellule vivante survit si elle a 2 ou 3 voisines vivantes, sinon elle meurt.</div>
		<div>Une cellule morte devient vivante si elle a exactement 3 voisines vivantes.</div>
		<div>
			Toutes les cellules sont mises à jour en même temps, puis on recommence à l’étape suivante.
		</div> -->
	</div>
	<div class="relative -mx-gap bg-bg px-gap py-8" style="--color-bg: oklch(20.5% 0 0);">
		<div class="grid-12 gap-y-0!">
			<div class=" relative z-10 col-span-3 col-start-2">
				<!-- <div class="absolute top-4.5 right-0 left-0 h-0.5 translate-x-1/2 bg-text"></div> -->
				<div class="flex w-fit items-center gap-3.5 bg-bg">
					<div class="text-3xl">Les règles du jeu</div>
					<div class="dot -mb-1"></div>
				</div>
			</div>
			<div class="relative col-span-4 mt-4.5 flex flex-col items-center text-center">
				<div class="absolute top-0 right-0 left-0 h-0.5 -translate-x-1/2 bg-text-2"></div>
				<div class="line-y mb-4"></div>

				<div class="max-w-md">
					À chaque génération, on regarde chaque cellule et ses voisines immédiates
				</div>
				<div class="dot mt-4"></div>
				<div class="line-y"></div>
			</div>
			<div class="col-span-3"></div>
			{#each rules as [group_name, rule_group], group_i}
				<div class={['col-span-3 flex flex-col px-4', group_i == 0 && 'col-start-4']}>
					<div class="relative mb-4 flex flex-col items-center text-center">
						<div
							class={[
								'absolute top-0 right-0 left-0 h-0.5  bg-text-2',
								group_i == 0 ? 'translate-x-1/2' : '-translate-x-1/2'
							]}
						></div>

						<div class="mb-3 h-12 w-0.5 bg-text-2"></div>

						<div>
							<span class="text-2 mr-0.5">{group_name.split(' ')[0]}</span>
							<span>{group_name.split(' ')[1]}</span>
						</div>
					</div>
					<div class="w-full space-y-gap-y">
						{#each rule_group as [n_neighbours, consequence, type, data], i}
							<div
								class={[
									'text-xl- flex min-h-16 w-full flex-col gap-8 rounded border px-3 py-1.5 pb-3 font-medium',
									type == 'life'
										? 'border-green-900 bg-green-600/10 text-green-600'
										: 'border-red-900 bg-red-700/10 text-red-700'
								]}
							>
								<div class="flex w-full justify-between gap-16">
									<div class="text-2-">
										<span class="font-mono">{n_neighbours}</span> voisins
									</div>
									<div class="">{consequence}</div>
								</div>
								<div class="flex items-center justify-between gap-6">
									{@render grid_renderer(data[0], 0, type, group_i)}
									<div class="icon-[ri--arrow-right-line] text-2xl"></div>
									{@render grid_renderer(data[1], 1, type, group_i)}
								</div>
							</div>
						{/each}
					</div>
					<div class="relative flex h-full min-h-20 flex-col items-center">
						<div class="dot mt-4 shrink-0 grow-0"></div>
						<div class="line-y h-full!"></div>
						<div
							class={[
								'absolute right-0 bottom-0 left-0 h-0.5  bg-text-2',
								group_i == 0 ? 'translate-x-1/2' : '-translate-x-1/2'
							]}
						></div>
					</div>
				</div>
			{/each}
		</div>
		<div class="relative mb-12 flex flex-col items-center justify-center text-center">
			<div class="line-y mb-4"></div>

			<div class="max-w-md">
				Toutes les cellules sont mises à jour en même temps, puis on recommence à l’étape suivante.
			</div>
			<!-- <div class="dot mt-4"></div>
			<div class="line-y"></div>
			<div class="absolute bottom-0 left-0 h-0.5 w-1/2 translate-x-full bg-text-2"></div> -->
		</div>
	</div>

	<div>
		<div></div>
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
