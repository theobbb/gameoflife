<script lang="ts">
	import type { HTMLButtonAttributes, HTMLAnchorAttributes } from 'svelte/elements';

	let {
		href,
		icon = 'icon-[ri--arrow-right-long-fill]',
		class: cx,
		children,
		...props
	}: HTMLButtonAttributes & { href?: string; icon?: string } = $props();

	const bipolar_props = $derived(href ? { href } : {});
</script>

<svelte:element
	this={href ? 'a' : 'button'}
	class={[cx, 'cursor-pointer']}
	{...bipolar_props}
	{...props}
>
	<div
		class="group my-2 flex w-fit rounded-md border border-white bg-white/70 p-1 font-mono text-xl text-black/85 transition-all"
	>
		<div
			class="-group-hover:text-black flex items-center gap-2 rounded px-5 py-1.5 pr-4 transition group-hover:bg-white"
		>
			<span class="-translate-y-px transition group-hover:-translate-x-2">
				{@render children?.()}
			</span>
			<div class={[icon, 'transition group-hover:translate-x-2']}></div>
		</div>
	</div>
</svelte:element>
<!-- <a
	href="/regles"
	class="group my-2 flex w-fit rounded-md border border-white bg-white/70 p-1 font-mono text-xl text-bg transition"
>
	<div
		class="-group-hover:text-black flex items-center gap-2 rounded px-5 py-1.5 pr-4 transition group-hover:bg-white"
	>
		<span class="-mt-px transition group-hover:-translate-x-2">Commencer</span>
		<div class="icon-[ri--arrow-right-long-fill] transition group-hover:translate-x-2"></div>
	</div>
</a> -->
