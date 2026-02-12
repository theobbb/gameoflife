<script>
	import Button from '$lib/ui/button.svelte';
</script>

<header class="pointer-events-none top-0 right-0 left-0 z-10 mb-gap-y">
	<div class="flex justify-between">
		<div class="pointer-events-auto flex w-fit flex-col items-end text-3xl/7.5">
			<div>Le jeu de la vie</div>
			<div class="text-2">organique</div>
		</div>
		<div class="">
			<div
				class="pointer-events-auto rounded border border-black/50 bg-black/20 p-1 text-white backdrop-blur"
			>
				<a
					class=" flex items-center gap-2 rounded px-3 py-1.5 transition duration-200 hover:bg-white/10"
					href="/"
				>
					<div class="icon-[ri--information-2-line] shrink-0 text-lg"></div>
					<div class="">Règles du jeu</div>
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
