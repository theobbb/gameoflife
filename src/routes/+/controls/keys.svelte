<script>
	import Key from '$lib/ui/key.svelte';
	import { get_engine, TIME_SCALE } from '../../engine.svelte';

	const engine = get_engine();

	const [_, min, max] = TIME_SCALE;
	const step_time = $derived(Number(((max - min) / 10).toFixed(4)));
</script>

<div class="flex flex-col items-end gap-gap">
	<div class="grid grid-cols-3 gap-x-2.5">
		<div class="col-span-full row-start-1">
			<Key
				action={engine.togglePlay}
				label={engine.controls.playing ? 'Arrêter' : 'Démarrer'}
				key="Space"
			>
				<div class="h-0.5 w-10 translate-y-2 bg-text"></div>
			</Key>
			<!-- <div class={[engine.isPlaying ? 'icon-[ri--pause-fill]' : 'icon-[ri--play-fill]']}></div> -->
		</div>
		<div class="col-start-2 row-start-2 -mb-3 w-12">
			<Key
				action={() =>
					(engine.controls.time_scale = Math.min(max, engine.controls.time_scale + step_time))}
				label="temps+"
				key="ArrowUp"
			>
				<div class="icon-[ri--arrow-up-fill] translate-y-2"></div>
			</Key>
		</div>
		<div class="row-start-3 w-12">
			<Key action={engine.next_frame} label="gen-" key="ArrowLeft">
				<div class="icon-[ri--arrow-left-fill] translate-y-1"></div>
			</Key>
		</div>
		<div class="row-start-3 w-12">
			<Key
				action={() =>
					(engine.controls.time_scale = Math.max(min, engine.controls.time_scale - step_time))}
				label="temps-"
				key="ArrowDown"
			>
				<div class="icon-[ri--arrow-down-fill] translate-y-1"></div>
			</Key>
		</div>
		<div class="row-start-3 w-12">
			<Key action={engine.next_frame} label="Gen+" key="ArrowRight">
				<div class="icon-[ri--arrow-right-fill] translate-y-1"></div>
			</Key>
		</div>
		<div class="row-start-4 w-12">
			<Key action={() => engine.centerView()} label="centrer" key="KeyC">
				<div class="translate-y-1">C</div>
			</Key>
		</div>
		<div class="row-start-4 w-12">
			<Key action={engine.clearGrid} label="delete" key="KeyD">
				<div class="translate-y-1">D</div>
			</Key>
		</div>
		<div class="row-start-4 w-12">
			<Key action={engine.resetPattern} label="reset" key="KeyR">
				<div class="translate-y-1">R</div>
			</Key>
		</div>
	</div>
	<div></div>
	<!-- <div>
					<div class="relative flex w-fit flex-col items-center justify-center">
						<div class="size-10 rounded-xl border-2 opacity-30"></div>
						<div
							class="absolute icon-[ri--cursor-fill] translate-x-0.5 translate-y-1 text-2xl"
						></div>
					</div>
					<span class="font-mono text-xs">cells</span>
				</div> -->
</div>
