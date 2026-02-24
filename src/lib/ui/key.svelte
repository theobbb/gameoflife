<script lang="ts">
	import type { Snippet } from 'svelte';

	const {
		key,
		label,
		action,
		children
	}: { key: string; label: string; action: () => void; children: Snippet } = $props();

	let pressed = $state(false);

	function onkeydown(event: KeyboardEvent) {
		if (event.code === key) {
			event.preventDefault();
			pressed = true;
			action();
		}
	}
	function onkeyup(event: KeyboardEvent) {
		if (event.code === key) {
			event.preventDefault();
			pressed = false;
		}
	}
	$effect(() => {
		window.addEventListener('keydown', onkeydown);
		window.addEventListener('keyup', onkeyup);

		return () => {
			window.removeEventListener('keydown', onkeydown);
			window.removeEventListener('keyup', onkeyup);
		};
	});
</script>

<button class=" pointer-events-auto w-full cursor-pointer pb-5" onclick={action}>
	<div class="group relative w-full">
		<div class="absolute inset-0 translate-y-3 rounded border border-text bg-bg"></div>
		<div
			class={[
				'relative z-10 h-9 w-full rounded border border-text bg-bg',
				pressed ? 'translate-y-1.5' : 'group-hover:translate-y-0.5 group-active:translate-y-1.5',
				'transition duration-50'
			]}
		>
			<div class="py-4- flex items-center justify-center">{@render children()}</div>
		</div>
	</div>
	<div class="mt-3.5 font-mono text-xs lowercase">{label}</div>
</button>
