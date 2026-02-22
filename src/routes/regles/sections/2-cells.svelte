<script>
	import { get_grid, GRID_COLOR } from '../grid.svelte';

	const grid = get_grid();
</script>

La grille est composée de <span class="underline">cellules</span>. <br /> Chaque cellule peut
être... <br />

<span class="underline">morte</span> ou <span class="underline">vivante</span>.

<div class="relative mt-24 overflow-visible">
	<div
		class={[
			'absolute top-0 left-0 flex h-full w-full items-center justify-center',
			grid.step == 2 ? 'scale-200 rotate-x-45 rotate-z-45' : 'opacity-0',
			'transition duration-700'
		]}
		style="perspective: 1000px; transform-style: preserve-3d;"
	>
		<div class="flex flex-col items-center">
			<div class="size-9 bg-white"></div>
			<div class="size-9"></div>
			<div class="size-9 outline" style="color:{GRID_COLOR};"></div>
		</div>
	</div>
</div>
