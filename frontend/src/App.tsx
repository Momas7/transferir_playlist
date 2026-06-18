import { useState } from "react";
import "./App.css";

type Playlist = {
  id: string;
  name: string;
  totalTracks: number;
  spotifyUrl: string | null;
};

type Track = {
  songName: string | null;
  artists: string[];
  album: string | null;
  spotifyUrl: string | null;
};

type TransferResult = {
  spotifyPlaylistId: string;
  youtubePlaylistId: string;
  youtubePlaylistTitle: string;
  totalSpotifyTracks: number;
  requestedTransferOffset: number;
  requestedTransferLimit: number;
  processedTracks: number;
  addedCount: number;
  notFoundCount: number;
  failedCount: number;
};

const spotifyApiBase = "http://127.0.0.1:3000";
const youtubeApiBase = "http://localhost:3000";

function App() {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState("");
  const [tracks, setTracks] = useState<Track[]>([]);
  const [transferResult, setTransferResult] = useState<TransferResult | null>(
    null,
  );
  const [limit, setLimit] = useState(10);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function handleSpotifyLogin() {
    window.location.href = `${spotifyApiBase}/login`;
  }

  function handleYoutubeLogin() {
    window.location.href = `${youtubeApiBase}/youtube/login`;
  }

  async function loadPlaylists() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(`${spotifyApiBase}/playlists`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Erro ao carregar playlists.");
      }

      setPlaylists(data.playlists ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido.");
    } finally {
      setLoading(false);
    }
  }

  async function loadPlaylistTracks(playlistId: string) {
    try {
      setLoading(true);
      setError("");
      setSelectedPlaylistId(playlistId);
      setTransferResult(null);

      const response = await fetch(
        `${spotifyApiBase}/playlist?id=${encodeURIComponent(playlistId)}`,
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Erro ao carregar musicas.");
      }

      setTracks(data.tracks ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido.");
    } finally {
      setLoading(false);
    }
  }

  async function handleTransfer() {
    if (!selectedPlaylistId) {
      setError("Escolha uma playlist antes de transferir.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setTransferResult(null);

      const params = new URLSearchParams({
        spotifyPlaylistId: selectedPlaylistId,
        limit: String(limit),
        offset: String(offset),
      });

      const response = await fetch(
        `${youtubeApiBase}/transfer?${params.toString()}`,
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Erro ao transferir playlist.");
      }

      setTransferResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <p className="eyebrow">Spotify to YouTube</p>
        <h1>Transfer Playlist</h1>
        <p className="hero-copy">
          Conecte as duas contas, escolha sua playlist e envie as faixas para o
          YouTube com controle de offset e limite.
        </p>
      </section>

      <section className="card auth-panel">
        <h2>1. Conectar contas</h2>
        <div className="actions-row">
          <button type="button" onClick={handleSpotifyLogin}>
            Login Spotify
          </button>
          <button type="button" onClick={handleYoutubeLogin}>
            Login YouTube
          </button>
        </div>
      </section>

      <section className="card playlists-panel">
        <div className="section-header">
          <h2>2. Escolher playlist</h2>
          <button type="button" onClick={loadPlaylists} disabled={loading}>
            {loading ? "Carregando..." : "Carregar playlists"}
          </button>
        </div>

        {playlists.length === 0 ? (
          <p className="muted">Nenhuma playlist carregada ainda.</p>
        ) : (
          <div className="playlist-list">
            {playlists.map((playlist) => (
              <article key={playlist.id} className="playlist-card">
                <h3>{playlist.name}</h3>
                <p>{playlist.totalTracks} musicas</p>
                <p>
                  <code>{playlist.id}</code>
                </p>
                <div className="actions-row compact">
                  <button
                    type="button"
                    onClick={() => loadPlaylistTracks(playlist.id)}
                    disabled={loading}
                  >
                    Ver musicas
                  </button>
                  {playlist.spotifyUrl && (
                    <a
                      href={playlist.spotifyUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="ghost-link"
                    >
                      Abrir no Spotify
                    </a>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="card tracks-panel">
        <div className="section-header">
          <h2>3. Conferir musicas</h2>
          {selectedPlaylistId && <code>{selectedPlaylistId}</code>}
        </div>

        {tracks.length === 0 ? (
          <p className="muted">Nenhuma musica carregada ainda.</p>
        ) : (
          <div className="track-list">
            {tracks.map((track, index) => (
              <article
                key={`${track.spotifyUrl}-${index}`}
                className="track-card"
              >
                <h3>{track.songName ?? "Sem nome"}</h3>
                <p>{track.artists.join(", ") || "Sem artista"}</p>
                <p>{track.album ?? "Sem album"}</p>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="card transfer-panel">
        <h2>4. Transferir</h2>

        <div className="transfer-controls">
          <label>
            Offset
            <input
              type="number"
              min={0}
              value={offset}
              onChange={(event) => setOffset(Number(event.target.value))}
            />
          </label>

          <label>
            Limit
            <input
              type="number"
              min={1}
              max={100}
              value={limit}
              onChange={(event) => setLimit(Number(event.target.value))}
            />
          </label>
        </div>

        <button
          type="button"
          onClick={handleTransfer}
          disabled={loading || !selectedPlaylistId}
        >
          {loading ? "Transferindo..." : "Transferir para YouTube"}
        </button>

        {transferResult && (
          <div className="transfer-result">
            <h3>Resultado</h3>
            <p>Playlist YouTube: {transferResult.youtubePlaylistTitle}</p>
            <p>Total no Spotify: {transferResult.totalSpotifyTracks}</p>
            <p>Offset: {transferResult.requestedTransferOffset}</p>
            <p>Limit: {transferResult.requestedTransferLimit}</p>
            <p>Processadas: {transferResult.processedTracks}</p>
            <p>Adicionadas: {transferResult.addedCount}</p>
            <p>Nao encontradas: {transferResult.notFoundCount}</p>
            <p>Falharam: {transferResult.failedCount}</p>
          </div>
        )}

        {error && <p className="error">{error}</p>}
      </section>
    </main>
  );
}

export default App;
