<script lang="ts">
	import PingPongBoard from '$lib/components/PingPongBoard.svelte';
	import '../../ping-pong-page.css';

	let { data } = $props();
</script>

<svelte:head>
	<title>Sesja {data.sessionCode} - Ping Pong ELO</title>
	<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
</svelte:head>

<PingPongBoard mode="session" sessionCode={data.sessionCode} />
