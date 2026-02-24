<script>
	import { page } from '$app/state';
	import Button from '$lib/ui/button.svelte';
	import { get_engine } from './engine.svelte';

	const engine = get_engine();
</script>

<header class="pointer-events-none top-0 right-0 left-0 z-10 mb-gap-y">
	<div class="flex justify-between">
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
		<div class="pointer-events-auto">
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
		</div>
	</div>

	<div class="items-center- grid- hidden! grid-cols-3 gap-gap">
		<div class="text-3xl/7.5">
			<a href="/" class="pointer-events-auto flex w-fit flex-col items-end">
				<div>Le jeu de la vie</div>
				<div class="text-2">organique</div>
			</a>
		</div>
		<div class="flex justify-center">
			<div class="pointer-events-auto">
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
			</div>
		</div>

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
	</div>
</header>
