import type { SpotifyTrack } from "../types/spotify.types";
import { sleep } from "../utils/retry.util";
import { fetchSpotifyPlaylistTracks } from "./spotify.service";
import {
  addVideoToYoutubePlaylist,
  createYoutubePlaylist,
  searchYoutubeVideo,
} from "./youtube.service";

export function buildYoutubeSearchQuery(track: SpotifyTrack) {
  return [track.songName, ...track.artists, "official audio"]
    .filter(Boolean)
    .join(" ");
}

export async function transferSpotifyPlaylistToYoutube(params: {
  spotifyPlaylistId: string;
  transferLimit: number;
  transferOffset: number;
  youtubePlaylistTitle: string;
  youtubePlaylistDescription: string;
}) {
  const spotifyTracks = await fetchSpotifyPlaylistTracks(params.spotifyPlaylistId);
  const tracksToTransfer = spotifyTracks.slice(
    params.transferOffset,
    params.transferOffset + params.transferLimit,
  );
  const youtubePlaylist = await createYoutubePlaylist(
    params.youtubePlaylistTitle,
    params.youtubePlaylistDescription,
  );

  const addedTracks: Array<{
    spotifySongName: string | null;
    youtubeVideoId: string;
    youtubeTitle: string | null;
  }> = [];
  const notFoundTracks: Array<{
    spotifySongName: string | null;
    searchQuery: string;
  }> = [];
  const failedTracks: Array<{
    spotifySongName: string | null;
    searchQuery: string;
    error: string;
  }> = [];

  for (const track of tracksToTransfer) {
    const searchQuery = buildYoutubeSearchQuery(track);

    try {
      const youtubeResult = await searchYoutubeVideo(searchQuery);

      if (!youtubeResult?.videoId) {
        notFoundTracks.push({
          spotifySongName: track.songName,
          searchQuery,
        });
        continue;
      }

      await addVideoToYoutubePlaylist(youtubePlaylist.id, youtubeResult.videoId);

      addedTracks.push({
        spotifySongName: track.songName,
        youtubeVideoId: youtubeResult.videoId,
        youtubeTitle: youtubeResult.title,
      });
    } catch (error) {
      failedTracks.push({
        spotifySongName: track.songName,
        searchQuery,
        error: String(error),
      });
    }

    await sleep(500);
  }

  return {
    youtubePlaylist,
    spotifyTracks,
    tracksToTransfer,
    addedTracks,
    notFoundTracks,
    failedTracks,
  };
}
