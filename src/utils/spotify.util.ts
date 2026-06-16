import type { SpotifyTrack } from "../types/spotify.types";

export function normalizeSpotifyPlaylistItem(item: any): SpotifyTrack {
  const track = item.track ?? item.item;

  return {
    songName: track?.name ?? null,
    artists: track?.artists?.map((artist: any) => artist.name) ?? [],
    album: track?.album?.name ?? null,
    spotifyUrl: track?.external_urls?.spotify ?? null,
  };
}

export function getSpotifyPlaylistId(input: string) {
  const trimmedInput = input.trim();

  if (trimmedInput.includes("open.spotify.com/playlist/")) {
    let url: URL;

    try {
      url = new URL(trimmedInput);
    } catch {
      throw new Error("A URL da playlist do Spotify esta invalida.");
    }

    const pathParts = url.pathname.split("/").filter(Boolean);
    const playlistId = pathParts[pathParts.length - 1];

    if (!playlistId) {
      throw new Error("Nao consegui encontrar o id da playlist nessa URL.");
    }

    return playlistId;
  }

  return trimmedInput;
}
