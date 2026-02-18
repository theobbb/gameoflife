<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		value = $bindable(),
		label,
		control,
		children
	}: { value: number; control: number[]; label: string; children: Snippet } = $props();
	const id = $props.id();

	const [_, min, max] = $derived(control);

	const step = $derived(Number(((max - min) / 10).toFixed(4)));
	const display_value = $derived(Math.round(((value - min) / (max - min)) * 10));
</script>

<div class="group -mb-2.5- relative w-full gap-gap">
	<div
		class="bg-black/5 px-1.5 backdrop-blur group-first:rounded-t group-first:pt-1.5 group-last:rounded-b group-last:pb-1.5"
	>
		<div
			class="flex flex-col gap-1.5 rounded p-1 px-2 py-1.5 pt-2.5 transition duration-100 group-hover:bg-black/10"
		>
			<input
				{id}
				type="range"
				{min}
				{max}
				{step}
				bind:value
				autocomplete="off"
				class="backdrop-blur- h-2 appearance-none rounded bg-life-fill"
			/>
			<label for={id} class="-text-sm flex justify-between gap-gap font-mono lowercase">
				<div>{label}:</div>
				<div>{display_value}</div>
			</label>
		</div>
	</div>
	<div class="pointer-events-none absolute top-1 -right-gap -left-1.5 -translate-x-full">
		<div
			class="translate-x-2 rounded bg-black/10 px-2.5 py-1.5 pr-gap opacity-0 backdrop-blur transition duration-100 group-hover:pointer-events-auto group-hover:translate-x-0 group-hover:opacity-100"
		>
			{@render children?.()}
		</div>
	</div>
</div>

<style>
	input[type='range'] {
		--thumb-color: var(--color-life-fill);
		--thumb-size: 0.9rem;
		--thumb-border-radius: 100%;
	}
	input[type='range']::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		height: var(--thumb-size);
		width: var(--thumb-size);
		border-radius: var(--thumb-border-radius);
		border-color: red;
		background: var(--thumb-color);
		cursor: pointer;

		backdrop-filter: blur(4px);
	}

	input[type='range']::-moz-range-thumb {
		height: var(--thumb-size);
		width: var(--thumb-size);
		border-radius: var(--thumb-border-radius);
		background: var(--color-life-fill);
		border-color: var(--color-life-stroke);
		cursor: pointer;
		backdrop-filter: blur(4px);
	}
</style>
