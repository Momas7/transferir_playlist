import {
  fetchSpotifyByUrl,
  fetchSpotifyPlaylistById,
  fetchSpotifyPlaylistsPage,
  fetchSpotifyPlaylistTracksById,
} from "../integrations/spotify.client";
import { getSpotifyAccessToken } from "../state/auth-state";
import type {
  SpotifyPlaylistSummary,
  SpotifyTrack,
} from "../types/spotify.types";
import { normalizeSpotifyPlaylistItem } from "../utils/spotify.util";

function requireSpotifyToken() {
  const token = getSpotifyAccessToken();

  if (!token) {
    throw new Error("Voce ainda nao fez login no Spotify. Abra /login primeiro.");
  }

  return token;
}

export async function fetchSpotifyPlaylistTracks(
  playlistId: string,
): Promise<SpotifyTrack[]> {
  const token = requireSpotifyToken();
  const tracks: SpotifyTrack[] = [];

  const { response: playlistResponse, data: playlistData } =
    await fetchSpotifyPlaylistById(token, playlistId);

  if (!playlistResponse.ok) {
    throw new Error(JSON.stringify(playlistData));
  }

  const firstPage = playlistData.items;

  if (!firstPage?.items?.length) {
    return tracks;
  }

  tracks.push(...firstPage.items.map(normalizeSpotifyPlaylistItem));

  let nextUrl = firstPage.next;

  while (nextUrl) {
    const { response, data } = await fetchSpotifyByUrl(token, nextUrl);

    if (!response.ok) {
      throw new Error(JSON.stringify(data));
    }

    const pageTracks = data.items.map(normalizeSpotifyPlaylistItem);

    tracks.push(...pageTracks);
    nextUrl = data.next;
  }

  return tracks;
}

export async function fetchCurrentUserSpotifyPlaylists(): Promise<
  SpotifyPlaylistSummary[]
> {
  const token = requireSpotifyToken();
  const playlists: SpotifyPlaylistSummary[] = [];
  let nextUrl = "https://api.spotify.com/v1/me/playlists?limit=50";

  while (nextUrl) {
    const { response, data } = await fetchSpotifyPlaylistsPage(token, nextUrl);

    if (!response.ok) {
      throw new Error(JSON.stringify(data));
    }

    const pagePlaylists = data.items.map((playlist: any) => ({
      id: playlist.id,
      name: playlist.name,
      owner: playlist.owner?.display_name ?? null,
      ownerId: playlist.owner?.id ?? null,
      isPublic: playlist.public,
      isCollaborative: playlist.collaborative,
      totalTracks: playlist.tracks?.total ?? playlist.items?.total ?? 0,
      tracksHref: playlist.tracks?.href ?? playlist.items?.href ?? null,
      spotifyUrl: playlist.external_urls?.spotify ?? null,
    }));

    playlists.push(...pagePlaylists);
    nextUrl = data.next;
  }

  return playlists;
}

export async function fetchSpotifyPlaylistDebug(playlistId: string) {
  const token = requireSpotifyToken();
  const userPlaylists = await fetchCurrentUserSpotifyPlaylists();
  const playlistFromAccount = userPlaylists.find(
    (playlist) => playlist.id === playlistId,
  );

  const { response: playlistResponse, data: playlistData } =
    await fetchSpotifyPlaylistById(token, playlistId);
  const { response: tracksResponse, data: tracksData } =
    await fetchSpotifyPlaylistTracksById(token, playlistId, 10);

  return {
    foundInYourPlaylists: Boolean(playlistFromAccount),
    playlistFromAccount,
    fullPlaylistEndpoint: {
      status: playlistResponse.status,
      data: playlistData,
    },
    tracksEndpoint: {
      status: tracksResponse.status,
      data: tracksData,
    },
  };
}
