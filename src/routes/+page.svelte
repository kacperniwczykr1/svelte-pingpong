<script lang="ts">
	import PingPongBoard from '$lib/components/PingPongBoard.svelte';
	import { createPingPongDataSource, normalizeSessionCode } from '$lib/ping-pong';
	import { goto } from '$app/navigation';
	import './ping-pong-page.css';

	let joinCode = $state('');
	let isCreatingSession = $state(false);

	async function createSession() {
		isCreatingSession = true;

		try {
			const dataSource = createPingPongDataSource();
			const session = await dataSource.createSession();
			await goto(`/s/${session.code}`);
		} finally {
			isCreatingSession = false;
		}
	}

	async function joinSession() {
		const code = normalizeSessionCode(joinCode);
		if (!code) return;

		await goto(`/s/${code}`);
	}
</script>

<svelte:head>
	<title>Ping Pong ELO</title>
	<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
</svelte:head>

<div class="app">
	<section class="card session-entry">
		<div>
			<h2>Sesja ze znajomymi</h2>
			<p class="muted">Utwórz pokój z kodem albo dołącz do istniejącego. Lokalny tryb poniżej zostaje bez zmian.</p>
		</div>

		<div class="session-entry-actions">
			<button class="primary" disabled={isCreatingSession} onclick={createSession}>
				{isCreatingSession ? 'Tworzenie...' : 'Utwórz sesję'}
			</button>

			<div class="join-row">
				<input
					bind:value={joinCode}
					type="text"
					placeholder="Kod sesji"
					onkeydown={(event) => event.key === 'Enter' && joinSession()}
				/>
				<button class="secondary" onclick={joinSession}>Dołącz</button>
			</div>
		</div>
	</section>
</div>

<PingPongBoard mode="local" />
