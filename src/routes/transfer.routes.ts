import { Elysia } from "elysia";
import { transferSpotifyPlaylistToYoutube } from "../services/transfer.service";
import { getSpotifyPlaylistId } from "../utils/spotify.util";

export const transferRoutes = new Elysia().get("/transfer", async ({ query }) => {
  const spotifyPlaylistId = getSpotifyPlaylistId(
    query.spotifyPlaylistId || "3cEYpjA9oz9GiPac4AsH4n",
  );
  const transferLimit = Math.min(Number(query.limit || 10), 100);
  const transferOffset = Math.max(Number(query.offset || 0), 0);
  const youtubePlaylistTitle =
    query.youtubePlaylistTitle || `Transferida do Spotify ${spotifyPlaylistId}`;
  const youtubePlaylistDescription =
    query.youtubePlaylistDescription ||
    `Playlist criada a partir da playlist ${spotifyPlaylistId} do Spotify.`;

  try {
    const result = await transferSpotifyPlaylistToYoutube({
      spotifyPlaylistId,
      transferLimit,
      transferOffset,
      youtubePlaylistTitle,
      youtubePlaylistDescription,
    });

    return {
      spotifyPlaylistId,
      youtubePlaylistId: result.youtubePlaylist.id,
      youtubePlaylistTitle: result.youtubePlaylist.snippet?.title,
      totalSpotifyTracks: result.spotifyTracks.length,
      requestedTransferOffset: transferOffset,
      requestedTransferLimit: transferLimit,
      processedTracks: result.tracksToTransfer.length,
      addedCount: result.addedTracks.length,
      notFoundCount: result.notFoundTracks.length,
      failedCount: result.failedTracks.length,
      addedTracks: result.addedTracks,
      notFoundTracks: result.notFoundTracks,
      failedTracks: result.failedTracks,
    };
  } catch (error) {
    return new Response(String(error), {
      status: 400,
    });
  }
});
