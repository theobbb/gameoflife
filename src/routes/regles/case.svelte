<script lang="ts">
	import type { Snippet } from 'svelte';

	const {
		label,
		result,
		case_n,
		type
	}: { label: Snippet; result: Snippet; case_n?: number; type: 'life' | 'death' } = $props();
</script>

{#if case_n}
	<div class="text-2 mb-4 text-xl leading-tight">
		Scénario {case_n}:
	</div>
{/if}
<div class="">
	{@render label()}
</div>
<div class="text-2 my-4 translate-x-1 translate-y-0.5">↓</div>
<div class={[type == 'life' ? ' text-green-500' : 'text-red-500']}>
	<div
		class={[
			type == 'life' ? 'icon-[ri--checkbox-circle-line]' : 'icon-[ri--close-circle-line]',
			'translate-y-1.5'
		]}
	></div>
	{@render result()}
</div>
