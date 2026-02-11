<script lang="ts">
	const { label, children } = $props();
</script>

<div class="w-full pb-1.5">
	<div class="relative w-full">
		<div class="-skew-z-4 absolute inset-0 translate-y-3 rounded border bg-bg"></div>
		<div class="relative z-10 h-8 w-full rounded border bg-bg">
			<div class="flex items-center justify-center py-4">{@render children()}</div>
		</div>
	</div>
	<div class="mt-3.5 font-mono text-xs lowercase">{label}</div>
</div>
