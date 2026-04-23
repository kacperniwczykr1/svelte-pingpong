<!-- src/routes/+page.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';

  type Player = {
    id: string;
    name: string;
    elo: number;
    wins: number;
    losses: number;
  };

  type Match = {
    id: string;
    playerAId: string;
    playerBId: string;
    winnerId: string;
    date: string;
    eloBeforeA: number;
    eloBeforeB: number;
    eloAfterA: number;
    eloAfterB: number;
  };

  const STORAGE_KEY = 'ping-pong-elo-app';
  const INITIAL_ELO = 1000;
  const K_FACTOR = 32;

  let players = $state<Player[]>([]);
  let matches = $state<Match[]>([]);

  let newPlayerName = $state('');

  let playerAId = $state('');
  let playerBId = $state('');
  let winnerId = $state('');

  function uid() {
    return crypto.randomUUID();
  }

  function expectedScore(playerRating: number, opponentRating: number) {
    return 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
  }

  function calculateNewRatings(playerARating: number, playerBRating: number, winner: 'A' | 'B') {
    const expectedA = expectedScore(playerARating, playerBRating);
    const expectedB = expectedScore(playerBRating, playerARating);

    const scoreA = winner === 'A' ? 1 : 0;
    const scoreB = winner === 'B' ? 1 : 0;

    const newA = Math.round(playerARating + K_FACTOR * (scoreA - expectedA));
    const newB = Math.round(playerBRating + K_FACTOR * (scoreB - expectedB));

    return { newA, newB };
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

  function registerMatch() {
    if (!playerAId || !playerBId || !winnerId) {
      alert('Wybierz obu zawodników i zwycięzcę.');
      return;
    }

    if (playerAId === playerBId) {
      alert('Nie można rozegrać meczu tego samego zawodnika przeciwko sobie.');
      return;
    }

    if (winnerId !== playerAId && winnerId !== playerBId) {
      alert('Zwycięzca musi być jednym z wybranych zawodników.');
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

    playerAId = '';
    playerBId = '';
    winnerId = '';
  }

  function resetAll() {
    if (!confirm('Na pewno wyczyścić wszystkich zawodników i mecze?')) return;

    players = [];
    matches = [];
    playerAId = '';
    playerBId = '';
    winnerId = '';
  }

  function getPlayerName(playerId: string) {
    return players.find((player) => player.id === playerId)?.name ?? 'Nieznany zawodnik';
  }

  const ranking = $derived([...players].sort((a, b) => b.elo - a.elo));
  const availableWinnerOptions = $derived(
    ranking.filter((player) => player.id === playerAId || player.id === playerBId)
  );

  onMount(() => {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (!saved) return;

    try {
      const parsed = JSON.parse(saved);
      players = parsed.players ?? [];
      matches = parsed.matches ?? [];
    } catch (error) {
      console.error('Błąd odczytu danych z localStorage:', error);
    }
  });

  $effect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        players,
        matches
      })
    );
  });
</script>

<svelte:head>
  <title>Ping Pong ELO</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</svelte:head>

<div class="app">
  <header>
    <h1>🏓 Ping Pong ELO</h1>
    <p>Dodawaj zawodników, zapisuj mecze i śledź ranking ELO.</p>
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
    <h2>Zarejestruj mecz</h2>

    {#if players.length < 2}
      <p class="muted">Dodaj przynajmniej 2 zawodników, aby zapisać mecz.</p>
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

        <label>
          <span>Zwycięzca</span>
          <select bind:value={winnerId}>
            <option value="">Wybierz</option>
            {#each availableWinnerOptions as player}
              <option value={player.id}>{player.name}</option>
            {/each}
          </select>
        </label>
      </div>

      <div class="actions">
        <button class="primary" onclick={registerMatch}>Zapisz mecz</button>
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
              <strong>{getPlayerName(match.playerAId)} vs {getPlayerName(match.playerBId)}</strong>
              <span>{match.date}</span>
            </div>
            <div class="match-bottom">
              <span>Zwycięzca: <strong>{getPlayerName(match.winnerId)}</strong></span>
              <span>
                ELO: {match.eloBeforeA} → {match.eloAfterA} / {match.eloBeforeB} → {match.eloAfterB}
              </span>
            </div>
          </article>
        {/each}
      </div>
    {/if}
  </section>
</div>

<style>
  :global(body) {
    margin: 0;
    font-family: Inter, system-ui, Arial, sans-serif;
    background: #f3f4f6;
    color: #111827;
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

  button:hover {
    opacity: 0.92;
  }

  .primary {
    background: #2563eb;
    color: white;
  }

  .danger {
    background: #dc2626;
    color: white;
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

  @media (max-width: 640px) {
    .app {
      padding: 16px;
    }

    .row {
      flex-direction: column;
      align-items: stretch;
    }

    .section-header {
      flex-direction: column;
      align-items: stretch;
    }
  }
</style>