<script lang="ts">
	import type { HTMLButtonAttributes } from 'svelte/elements';

	let { class: cx, children, ...props }: HTMLButtonAttributes = $props();
</script>

<button
	class={[
		cx,
		'flex cursor-pointer items-center justify-center gap-2 rounded border border-white/80 bg-white/60   px-5 py-2 backdrop-blur'
	]}
	{...props}
>
	{@render children?.()}
</button>
