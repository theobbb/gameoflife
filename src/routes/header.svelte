<script>
	import { page } from '$app/state';
	import Button from '$lib/ui/button.svelte';
	import { get_engine } from './engine.svelte';

	const engine = get_engine();
</script>

<header class="pointer-events-none top-0 right-0 left-0 z-10 mb-gap-y">
	<div class="grid grid-cols-3 items-center gap-gap">
		<div class="text-3xl/7.5">
			<a href="/" class="pointer-events-auto flex w-fit flex-col items-end">
				<div>Le jeu de la vie</div>
				<div class="text-2">organique</div>
			</a>
		</div>
		<div class="flex justify-center">
			<div class="pointer-events-auto">
				<button
					class="flex min-w-28 cursor-pointer items-center gap-1 rounded bg-white/40 px-4 py-1 text-lg backdrop-blur"
					onclick={engine.togglePlay}
				>
					{#if engine.controls.playing}
						<div>Arrêter</div>
						<div class="icon-[ri--pause-line] text-lg"></div>
					{:else}
						<div>Démarrer</div>
						<div class="icon-[ri--play-line] text-lg"></div>
					{/if}
				</button>
				<!-- <a href="/rules">Règles</a> -->
			</div>
		</div>
		<!-- <div class=" flex justify-end">
			<a href="/pulsar" class="pointer-events-auto">Jeu</a>
		</div> -->
		<div class="flex justify-end">
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
