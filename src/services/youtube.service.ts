import {
  addVideoToYoutubePlaylistRequest,
  createYoutubePlaylistRequest,
  searchYoutubeVideoByQuery,
} from "../integrations/youtube.client";
import { getYoutubeAccessToken } from "../state/auth-state";

function requireYoutubeToken() {
  const token = getYoutubeAccessToken();

  if (!token) {
    throw new Error("Voce ainda nao fez login no YouTube. Abra /youtube/login primeiro.");
  }

  return token;
}

export async function searchYoutubeVideo(query: string) {
  const token = requireYoutubeToken();
  const data = await searchYoutubeVideoByQuery(token, query);
  const firstItem = data.items?.[0];

  if (!firstItem) {
    return null;
  }

  return {
    videoId: firstItem.id?.videoId ?? null,
    title: firstItem.snippet?.title ?? null,
    channelTitle: firstItem.snippet?.channelTitle ?? null,
  };
}

export async function createYoutubePlaylist(title: string, description: string) {
  const token = requireYoutubeToken();

  return await createYoutubePlaylistRequest(token, title, description);
}

export async function addVideoToYoutubePlaylist(
  playlistId: string,
  videoId: string,
) {
  const token = requireYoutubeToken();

  return await addVideoToYoutubePlaylistRequest(token, playlistId, videoId);
}
