<script>
	import { page } from '$app/state';
	import Button from '$lib/ui/button.svelte';
	import { get_engine } from './engine.svelte';

	const engine = get_engine();
</script>

<header class="pointer-events-none top-0 right-0 left-0 z-10 mb-gap-y">
	<div class="items-center- grid grid-cols-3 gap-gap">
		<div class="text-3xl/7.5">
			<a href="/" class="pointer-events-auto flex w-fit flex-col items-end">
				<div>Le jeu de la vie</div>
				<div class="text-2">organique</div>
			</a>
		</div>
		<div class="flex justify-center">
			<div class="pointer-events-auto">
				<!-- <Button
					icon={engine.controls.playing ? 'icon-[ri--pause-line]' : 'icon-[ri--play-line]'}
					onclick={engine.togglePlay}
					class=""
				>
					{#if engine.controls.playing}
						<div>Arrêter</div>
					{:else}
						<div>Démarrer</div>
					{/if}
				</Button>

				<button
					class="group flex w-fit rounded-md border border-white bg-white/70 p-1 font-mono text-xl text-black/85 transition-all"
				>
					<div
						class="-group-hover:text-black flex items-center gap-2 rounded px-5 py-1.5 pr-4 transition group-hover:bg-white"
					>
						<span class="-translate-y-px transition group-hover:-translate-x-2"> Démarrer </span>
						<div class={['icon-[ri--pause-line]', 'transition group-hover:translate-x-2']}></div>
					</div>
				</button> -->

				<button
					class="group mt-1 flex min-w-36 cursor-pointer items-center gap-1 rounded-md border border-white bg-white/60 p-1 font-mono text-lg text-black/80 backdrop-blur"
					onclick={engine.togglePlay}
				>
					<div
						class="flex w-full items-center justify-center gap-2 rounded px-3.5 py-0.5 pr-3 transition group-hover:bg-white"
					>
						{#if engine.controls.playing}
							<div class="-mt-px">Arrêter</div>
							<div class="icon-[ri--pause-line] text-lg"></div>
						{:else}
							<div class="-mt-px">Démarrer</div>
							<div class="icon-[ri--play-line] text-lg"></div>
						{/if}
					</div>
				</button>
				<!-- <a href="/rules">Règles</a> -->
			</div>
		</div>
		<!-- <div class=" flex justify-end">
			<a href="/pulsar" class="pointer-events-auto">Jeu</a>
		</div> -->
		<div class="mt-1 flex justify-end">
			<div>
				<div
					class="pointer-events-auto rounded border border-black/50 bg-black/20 p-1 text-white backdrop-blur"
				>
					<a
						class="flex items-center gap-2 rounded px-3 py-1.5 pl-2 transition duration-200 hover:bg-white/10"
						href="/regles?from={encodeURIComponent(page.url.pathname)}"
					>
						<div class="icon-[ri--information-2-line] shrink-0 text-lg"></div>
						<div class="-mt-px">Règles du jeu</div>
					</a>
				</div>
			</div>
		</div>
		<!-- <a class="col-span-2 rounded border border-text-2 px-3 py-2" href="/">
			<div class="icon-[ri--book-open-line] text-xl"></div>
			<div class="text-lg/5.5">Encyclopédie</div>
		</a>
		<a class="col-span-2 rounded border border-text-2 px-3 py-2" href="/">
			<div class="icon-[ri--book-open-line] text-xl"></div>
			<div class="text-lg/5.5">À propos</div>
		</a> -->
	</div>
</header>
