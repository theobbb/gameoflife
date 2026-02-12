<script lang="ts">
	let {
		value = $bindable(),
		min,
		max,
		label
	}: { value: number; min: number; max: number; label: string } = $props();

	const step = $derived((max - min) / 10);
</script>

<div>
	<label>{label} {value}</label>
	<input
		type="range"
		min={Number(min)}
		max={Number(max)}
		step="0.1"
		bind:value
		autocomplete="off"
	/>
</div>
