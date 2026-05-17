<!-- src/routes/+page.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import {
    INITIAL_ELO,
    STORAGE_KEY,
    calculateNewRatings,
    getCurrentServerId,
    getWinnerId,
    loadPingPongState,
    savePingPongState,
    type Match,
    type MatchSide,
    type Player
  } from '$lib/ping-pong';
  import './ping-pong-page.css';

  let players = $state<Player[]>([]);
  let matches = $state<Match[]>([]);

  let newPlayerName = $state('');
  let playerAId = $state('');
  let playerBId = $state('');

  let isMatchOpen = $state(false);
  let liveScoreA = $state(0);
  let liveScoreB = $state(0);
  let firstServerId = $state('');
  let manualServerOffset = $state(0);
  let hasLoadedStorage = $state(false);

  function uid() {
    return crypto.randomUUID();
  }

  function resetLiveMatch() {
    liveScoreA = 0;
    liveScoreB = 0;
    firstServerId = '';
    manualServerOffset = 0;
  }

  function addPlayer() {
    const name = newPlayerName.trim();

    if (!name) return;

    const alreadyExists = players.some(
      (player) => player.name.toLowerCase() === name.toLowerCase()
    );

    if (alreadyExists) {
      alert('Zawodnik o takiej nazwie już istnieje.');
      return;
    }

    players = [
      ...players,
      {
        id: uid(),
        name,
        elo: INITIAL_ELO,
        wins: 0,
        losses: 0
      }
    ];

    newPlayerName = '';
  }

  function startMatch() {
    if (!playerAId || !playerBId) {
      alert('Wybierz obu zawodników.');
      return;
    }

    if (playerAId === playerBId) {
      alert('Nie można rozegrać meczu tego samego zawodnika przeciwko sobie.');
      return;
    }

    resetLiveMatch();
    isMatchOpen = true;
  }

  function closeMatch() {
    if (!confirm('Zamknąć aktualny mecz bez zapisywania wyniku?')) return;

    isMatchOpen = false;
    resetLiveMatch();
  }

  function chooseFirstServer(playerId: string) {
    firstServerId = playerId;
    manualServerOffset = 0;
  }

  function restartCurrentMatch() {
    if (!confirm('Zrestartować wynik aktualnego meczu?')) return;

    resetLiveMatch();
  }

  function addPoint(player: MatchSide) {
    if (!firstServerId) {
      alert('Najpierw wybierz, kto zaczyna serwować.');
      return;
    }

    if (matchWinnerId) return;

    if (player === 'A') {
      liveScoreA += 1;
    } else {
      liveScoreB += 1;
    }
  }

  function subtractPoint(player: MatchSide) {
    if (matchWinnerId) return;

    if (player === 'A' && liveScoreA > 0) {
      liveScoreA -= 1;
    }

    if (player === 'B' && liveScoreB > 0) {
      liveScoreB -= 1;
    }
  }

  function toggleServer() {
    if (!firstServerId || matchWinnerId) return;
    manualServerOffset += 1;
  }

  function saveFinishedMatch() {
    const winnerId = matchWinnerId;

    if (!winnerId) {
      alert('Mecz nie jest jeszcze zakończony. Gra trwa do 11 punktów i minimum 2 punktów przewagi.');
      return;
    }

    const playerA = players.find((player) => player.id === playerAId);
    const playerB = players.find((player) => player.id === playerBId);

    if (!playerA || !playerB) return;

    const winner = winnerId === playerAId ? 'A' : 'B';
    const { newA, newB } = calculateNewRatings(playerA.elo, playerB.elo, winner);

    const newMatch: Match = {
      id: uid(),
      playerAId,
      playerBId,
      winnerId,
      date: new Date().toLocaleString('pl-PL'),
      scoreA: liveScoreA,
      scoreB: liveScoreB,
      eloBeforeA: playerA.elo,
      eloBeforeB: playerB.elo,
      eloAfterA: newA,
      eloAfterB: newB
    };

    players = players.map((player) => {
      if (player.id === playerAId) {
        return {
          ...player,
          elo: newA,
          wins: winner === 'A' ? player.wins + 1 : player.wins,
          losses: winner === 'B' ? player.losses + 1 : player.losses
        };
      }

      if (player.id === playerBId) {
        return {
          ...player,
          elo: newB,
          wins: winner === 'B' ? player.wins + 1 : player.wins,
          losses: winner === 'A' ? player.losses + 1 : player.losses
        };
      }

      return player;
    });

    matches = [newMatch, ...matches];

    isMatchOpen = false;
    resetLiveMatch();
    playerAId = '';
    playerBId = '';
  }

  function resetAll() {
    if (!confirm('Na pewno wyczyścić wszystkich zawodników i mecze?')) return;

    players = [];
    matches = [];
    playerAId = '';
    playerBId = '';
    resetLiveMatch();
    isMatchOpen = false;
  }

  function getPlayerName(playerId: string) {
    return players.find((player) => player.id === playerId)?.name ?? 'Nieznany zawodnik';
  }

  const ranking = $derived([...players].sort((a, b) => b.elo - a.elo));
  const selectedPlayerA = $derived(players.find((player) => player.id === playerAId));
  const selectedPlayerB = $derived(players.find((player) => player.id === playerBId));
  const matchWinnerId = $derived(getWinnerId(liveScoreA, liveScoreB, { playerAId, playerBId }));
  const currentServerId = $derived(
    getCurrentServerId({
      firstServerId,
      manualServerOffset,
      playerAId,
      playerBId,
      scoreA: liveScoreA,
      scoreB: liveScoreB
    })
  );

  const eloPreview = $derived.by(() => {
    const playerA = players.find((player) => player.id === playerAId);
    const playerB = players.find((player) => player.id === playerBId);

    if (!playerA || !playerB || !matchWinnerId) return null;

    const winner = matchWinnerId === playerAId ? 'A' : 'B';
    const { newA, newB } = calculateNewRatings(playerA.elo, playerB.elo, winner);

    return {
      deltaA: newA - playerA.elo,
      deltaB: newB - playerB.elo,
      newA,
      newB
    };
  });

  onMount(() => {
    const savedState = loadPingPongState(localStorage, STORAGE_KEY);
    players = savedState.players;
    matches = savedState.matches;
    hasLoadedStorage = true;
  });

  $effect(() => {
    if (hasLoadedStorage) {
      savePingPongState(localStorage, STORAGE_KEY, { players, matches });
    }
  });
</script>

<svelte:head>
  <title>Ping Pong ELO</title>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
</svelte:head>

<div class="app">
  <header>
    <h1>🏓 Ping Pong ELO</h1>
    <p>Dodawaj zawodników, rozgrywaj mecze na żywo i śledź ranking ELO.</p>
  </header>

  <section class="card">
    <h2>Dodaj zawodnika</h2>
    <div class="row">
      <input
        bind:value={newPlayerName}
        type="text"
        placeholder="Np. Kacper"
        onkeydown={(event) => event.key === 'Enter' && addPlayer()}
      />
      <button onclick={addPlayer}>Dodaj</button>
    </div>
  </section>

  <section class="card">
    <h2>Nowy mecz</h2>

    {#if players.length < 2}
      <p class="muted">Dodaj przynajmniej 2 zawodników, aby rozpocząć mecz.</p>
    {:else}
      <div class="form-grid">
        <label>
          <span>Zawodnik A</span>
          <select bind:value={playerAId}>
            <option value="">Wybierz</option>
            {#each ranking as player}
              <option value={player.id}>{player.name} ({player.elo})</option>
            {/each}
          </select>
        </label>

        <label>
          <span>Zawodnik B</span>
          <select bind:value={playerBId}>
            <option value="">Wybierz</option>
            {#each ranking as player}
              <option value={player.id}>{player.name} ({player.elo})</option>
            {/each}
          </select>
        </label>
      </div>

      <div class="actions">
        <button class="primary" onclick={startMatch}>Start meczu</button>
      </div>
    {/if}
  </section>

  <section class="card">
    <div class="section-header">
      <h2>Ranking</h2>
      <button class="danger" onclick={resetAll}>Wyczyść wszystko</button>
    </div>

    {#if ranking.length === 0}
      <p class="muted">Brak zawodników.</p>
    {:else}
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Zawodnik</th>
              <th>ELO</th>
              <th>Wygrane</th>
              <th>Porażki</th>
            </tr>
          </thead>
          <tbody>
            {#each ranking as player, index}
              <tr>
                <td>{index + 1}</td>
                <td>{player.name}</td>
                <td><strong>{player.elo}</strong></td>
                <td>{player.wins}</td>
                <td>{player.losses}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </section>

  <section class="card">
    <h2>Historia meczów</h2>

    {#if matches.length === 0}
      <p class="muted">Brak rozegranych meczów.</p>
    {:else}
      <div class="matches">
        {#each matches as match}
          <article class="match-item">
            <div class="match-top">
              <strong>{getPlayerName(match.playerAId)} {match.scoreA}:{match.scoreB} {getPlayerName(match.playerBId)}</strong>
              <span>{match.date}</span>
            </div>
            <div class="match-bottom">
              <span>Zwycięzca: <strong>{getPlayerName(match.winnerId)}</strong></span>
              <span>ELO: {match.eloBeforeA} → {match.eloAfterA} / {match.eloBeforeB} → {match.eloAfterB}</span>
            </div>
          </article>
        {/each}
      </div>
    {/if}
  </section>
</div>

{#if isMatchOpen && selectedPlayerA && selectedPlayerB}
  <div class="match-screen" role="dialog" aria-modal="true" aria-labelledby="match-title">
    <div class="match-toolbar">
      <button class="secondary compact" onclick={closeMatch}>Zamknij</button>

      <div class="match-status" id="match-title">
        {#if matchWinnerId}
          <span>Zwycięzca</span>
          <strong>{getPlayerName(matchWinnerId)}</strong>
        {:else if firstServerId}
          <span>Serwuje</span>
          <strong>{getPlayerName(currentServerId)}</strong>
        {:else}
          <span>Przed startem</span>
          <strong>Wybierz serwującego</strong>
        {/if}
      </div>

      <button class="secondary compact" onclick={restartCurrentMatch}>Restart</button>
    </div>

    {#if !firstServerId}
      <div class="first-server-panel">
        <span>Kto zaczyna serwować?</span>
        <div class="first-server-buttons">
          <button onclick={() => chooseFirstServer(playerAId)}>{selectedPlayerA.name}</button>
          <button onclick={() => chooseFirstServer(playerBId)}>{selectedPlayerB.name}</button>
        </div>
      </div>
    {:else}
      <div class="match-controls-row">
        <button class="switch-server-button" disabled={!!matchWinnerId} onclick={toggleServer}>
          Zmień serwującego
        </button>
        <span>Gra do 11, przewaga 2</span>
      </div>
    {/if}

    <div class="live-scoreboard">
      <section class:serving={currentServerId === playerAId && !matchWinnerId} class="live-player">
        <button class="minus-button" aria-label="Odejmij punkt" disabled={!firstServerId || !!matchWinnerId} onclick={() => subtractPoint('A')}>−</button>

        <button class="score-tap-area" aria-label="Dodaj punkt zawodnikowi A" disabled={!firstServerId || !!matchWinnerId} onclick={() => addPoint('A')}>
          <span class="live-player-name">{selectedPlayerA.name}</span>
          <strong class="live-score">{liveScoreA}</strong>
          <span class="tap-hint">dotknij, żeby dodać punkt</span>
          {#if currentServerId === playerAId && !matchWinnerId}
            <span class="serve-badge">SERWIS</span>
          {/if}
        </button>
      </section>

      <div class="score-divider">:</div>

      <section class:serving={currentServerId === playerBId && !matchWinnerId} class="live-player">
        <button class="minus-button" aria-label="Odejmij punkt" disabled={!firstServerId || !!matchWinnerId} onclick={() => subtractPoint('B')}>−</button>

        <button class="score-tap-area" aria-label="Dodaj punkt zawodnikowi B" disabled={!firstServerId || !!matchWinnerId} onclick={() => addPoint('B')}>
          <span class="live-player-name">{selectedPlayerB.name}</span>
          <strong class="live-score">{liveScoreB}</strong>
          <span class="tap-hint">dotknij, żeby dodać punkt</span>
          {#if currentServerId === playerBId && !matchWinnerId}
            <span class="serve-badge">SERWIS</span>
          {/if}
        </button>
      </section>
    </div>

    {#if matchWinnerId && eloPreview}
      <div class="match-finished-overlay">
        <div class="match-finished-card">
          <span class="finished-label">Mecz zakończony</span>
          <h2>{getPlayerName(matchWinnerId)} wygrywa!</h2>
          <p class="final-score">{selectedPlayerA.name} {liveScoreA}:{liveScoreB} {selectedPlayerB.name}</p>

          <div class="elo-summary">
            <div class="elo-player-result">
              <span>{selectedPlayerA.name}</span>
              <strong class:elo-positive={eloPreview.deltaA > 0} class:elo-negative={eloPreview.deltaA < 0}>
                {eloPreview.deltaA > 0 ? '+' : ''}{eloPreview.deltaA} ELO
              </strong>
              <small>{selectedPlayerA.elo} → {eloPreview.newA}</small>
            </div>

            <div class="elo-player-result">
              <span>{selectedPlayerB.name}</span>
              <strong class:elo-positive={eloPreview.deltaB > 0} class:elo-negative={eloPreview.deltaB < 0}>
                {eloPreview.deltaB > 0 ? '+' : ''}{eloPreview.deltaB} ELO
              </strong>
              <small>{selectedPlayerB.elo} → {eloPreview.newB}</small>
            </div>
          </div>

          <button class="save-match-button" onclick={saveFinishedMatch}>
            Zapisz wynik meczu
          </button>
        </div>
      </div>
    {/if}
  </div>
{/if}

<style>
  :global(body) {
    margin: 0;
    font-family: Inter, system-ui, Arial, sans-serif;
    background: #f3f4f6;
    color: #111827;
  }

  :global(button) {
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
  }

  .app {
    max-width: 1000px;
    margin: 0 auto;
    padding: 24px;
  }

  header {
    margin-bottom: 24px;
  }

  h1 {
    margin: 0 0 8px;
    font-size: 2rem;
  }

  h2 {
    margin-top: 0;
    font-size: 1.2rem;
  }

  p {
    margin: 0;
  }

  .card {
    background: white;
    border-radius: 16px;
    padding: 20px;
    margin-bottom: 20px;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.06);
  }

  .row,
  .actions,
  .section-header,
  .match-top,
  .match-bottom {
    display: flex;
    gap: 12px;
    align-items: center;
    justify-content: space-between;
  }

  .actions {
    margin-top: 16px;
  }

  .form-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 16px;
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  input,
  select,
  button {
    font: inherit;
  }

  input,
  select {
    padding: 12px 14px;
    border-radius: 10px;
    border: 1px solid #d1d5db;
    background: white;
  }

  button {
    border: none;
    border-radius: 10px;
    padding: 12px 16px;
    cursor: pointer;
    font-weight: 600;
  }

  button:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  .primary {
    background: #2563eb;
    color: white;
  }

  .secondary {
    background: #e5e7eb;
    color: #111827;
  }

  .danger {
    background: #dc2626;
    color: white;
  }

  .compact {
    min-width: 92px;
    padding: 10px 14px;
  }

  .muted {
    color: #6b7280;
  }

  .table-wrapper {
    overflow-x: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
  }

  th,
  td {
    text-align: left;
    padding: 12px;
    border-bottom: 1px solid #e5e7eb;
  }

  .matches {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .match-item {
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    padding: 14px;
    background: #fafafa;
  }

  .match-top,
  .match-bottom {
    flex-wrap: wrap;
  }

  .match-top {
    margin-bottom: 8px;
  }

  .match-screen {
    position: fixed;
    inset: 0;
    z-index: 50;
    display: grid;
    grid-template-rows: auto auto 1fr;
    gap: 10px;
    padding: max(10px, env(safe-area-inset-top)) max(10px, env(safe-area-inset-right)) max(10px, env(safe-area-inset-bottom)) max(10px, env(safe-area-inset-left));
    background: #0f172a;
    color: white;
  }

  .match-toolbar {
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: 10px;
    align-items: center;
  }

  .match-status {
    min-width: 0;
    text-align: center;
  }

  .match-status span {
    display: block;
    color: #93c5fd;
    font-size: 0.75rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .match-status strong {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: clamp(1rem, 3vw, 1.7rem);
  }

  .first-server-panel {
    display: grid;
    gap: 12px;
    padding: 14px;
    border-radius: 16px;
    background: rgba(59, 130, 246, 0.16);
    text-align: center;
  }

  .first-server-panel span {
    color: #bfdbfe;
    font-size: 0.95rem;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .first-server-buttons {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  .first-server-buttons button {
    min-height: 64px;
    border-radius: 16px;
    background: #2563eb;
    color: white;
    font-size: clamp(1rem, 3vw, 1.5rem);
    font-weight: 900;
  }

  .match-controls-row {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 10px;
    align-items: center;
    padding: 8px 10px;
    border-radius: 14px;
    background: rgba(59, 130, 246, 0.16);
    color: #bfdbfe;
  }

  .switch-server-button {
    padding: 14px;
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.12);
    color: white;
    font-size: 1rem;
    font-weight: 900;
  }

  .live-scoreboard {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
    gap: 10px;
    min-height: 0;
  }

  .live-player {
    position: relative;
    display: grid;
    grid-template-rows: auto 1fr;
    gap: 10px;
    min-width: 0;
    min-height: 0;
    border: 3px solid rgba(255, 255, 255, 0.12);
    border-radius: 22px;
    background: #111827;
    overflow: hidden;
  }

  .live-player.serving {
    border-color: #60a5fa;
    box-shadow: 0 0 0 4px rgba(96, 165, 250, 0.2);
  }

  .minus-button {
    justify-self: end;
    margin: 10px 10px 0 0;
    width: 56px;
    height: 44px;
    padding: 0;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.12);
    color: white;
    font-size: 1.8rem;
    line-height: 1;
  }

  .score-tap-area {
    display: grid;
    place-items: center;
    align-content: center;
    gap: 8px;
    width: 100%;
    min-height: 0;
    padding: 10px;
    border-radius: 0;
    background: transparent;
    color: white;
  }

  .score-tap-area:active {
    background: rgba(37, 99, 235, 0.22);
  }

  .live-player-name {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: clamp(1.1rem, 4vw, 2rem);
    font-weight: 900;
  }

  .live-score {
    font-size: clamp(5rem, 22vw, 13rem);
    line-height: 0.9;
    letter-spacing: -0.08em;
  }

  .tap-hint {
    color: #9ca3af;
    font-size: clamp(0.8rem, 2vw, 1rem);
  }

  .serve-badge {
    padding: 8px 14px;
    border-radius: 999px;
    background: #2563eb;
    color: white;
    font-size: clamp(0.8rem, 2vw, 1rem);
    font-weight: 900;
    letter-spacing: 0.08em;
  }

  .score-divider {
    align-self: center;
    color: #64748b;
    font-size: clamp(2rem, 8vw, 5rem);
    font-weight: 900;
  }

  .match-finished-overlay {
    position: fixed;
    inset: 0;
    z-index: 60;
    display: grid;
    place-items: center;
    padding: 20px;
    background: rgba(2, 6, 23, 0.86);
    backdrop-filter: blur(6px);
  }

  .match-finished-card {
    width: min(560px, 100%);
    display: flex;
    flex-direction: column;
    gap: 18px;
    padding: 28px;
    border-radius: 28px;
    background: white;
    color: #111827;
    text-align: center;
    box-shadow: 0 30px 80px rgba(0, 0, 0, 0.45);
  }

  .finished-label {
    color: #2563eb;
    font-size: 0.9rem;
    font-weight: 900;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .match-finished-card h2 {
    margin: 0;
    font-size: clamp(2rem, 6vw, 3.2rem);
    line-height: 1;
  }

  .final-score {
    color: #4b5563;
    font-size: 1.1rem;
    font-weight: 800;
  }

  .elo-summary {
    display: grid;
    gap: 14px;
  }

  .elo-player-result {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 16px;
    border-radius: 18px;
    background: #f3f4f6;
  }

  .elo-player-result span {
    font-size: 1rem;
    font-weight: 700;
  }

  .elo-player-result strong {
    font-size: 2rem;
    line-height: 1;
  }

  .elo-player-result small {
    color: #6b7280;
    font-size: 0.95rem;
  }

  .elo-positive {
    color: #16a34a;
  }

  .elo-negative {
    color: #dc2626;
  }

  .save-match-button {
    width: 100%;
    min-height: 88px;
    border-radius: 24px;
    background: #16a34a;
    color: white;
    font-size: clamp(1.3rem, 4vw, 2rem);
    font-weight: 900;
    box-shadow: 0 14px 40px rgba(22, 163, 74, 0.4);
  }

  @media (orientation: landscape) and (max-height: 520px) {
    .match-screen {
      grid-template-rows: auto auto 1fr;
      gap: 8px;
    }

    .match-toolbar {
      min-height: 44px;
    }

    .live-player {
      border-radius: 18px;
    }

    .minus-button {
      width: 48px;
      height: 36px;
      margin: 8px 8px 0 0;
      font-size: 1.5rem;
    }

    .live-score {
      font-size: clamp(4.5rem, 19vw, 10rem);
    }

    .tap-hint {
      display: none;
    }
  }

  @media (max-width: 640px) {
    .app {
      padding: 16px;
    }

    .row,
    .section-header {
      flex-direction: column;
      align-items: stretch;
    }

    .live-scoreboard {
      grid-template-columns: 1fr;
      grid-template-rows: minmax(0, 1fr) auto minmax(0, 1fr);
    }

    .score-divider {
      justify-self: center;
      line-height: 0.6;
    }

    .match-controls-row {
      grid-template-columns: 1fr;
      text-align: center;
    }
  }

  @media (orientation: landscape) and (max-width: 950px) {
    .live-scoreboard {
      grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
      grid-template-rows: 1fr;
    }
  }
</style>
