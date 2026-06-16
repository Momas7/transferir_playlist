import { isRetryableYoutubeError, sleep } from "../utils/retry.util";

async function fetchYoutubeWithRetry(url: string, options: RequestInit) {
  const maxAttempts = 4;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const response = await fetch(url, options);
    const data = await response.json();

    if (response.ok) {
      return data;
    }

    const shouldRetry = isRetryableYoutubeError(response.status, data);

    if (!shouldRetry || attempt === maxAttempts) {
      throw new Error(JSON.stringify(data));
    }

    await sleep(1000 * attempt);
  }

  throw new Error("A chamada para o YouTube falhou apos varias tentativas.");
}

export async function searchYoutubeVideoByQuery(
  accessToken: string,
  query: string,
) {
  const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");
  searchUrl.searchParams.set("part", "snippet");
  searchUrl.searchParams.set("type", "video");
  searchUrl.searchParams.set("maxResults", "1");
  searchUrl.searchParams.set("q", query);

  return await fetchYoutubeWithRetry(searchUrl.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export async function createYoutubePlaylistRequest(
  accessToken: string,
  title: string,
  description: string,
) {
  return await fetchYoutubeWithRetry(
    "https://www.googleapis.com/youtube/v3/playlists?part=snippet,status",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        snippet: {
          title,
          description,
        },
        status: {
          privacyStatus: "private",
        },
      }),
    },
  );
}

export async function addVideoToYoutubePlaylistRequest(
  accessToken: string,
  playlistId: string,
  videoId: string,
) {
  return await fetchYoutubeWithRetry(
    "https://www.googleapis.com/youtube/v3/playlistItems?part=snippet",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        snippet: {
          playlistId,
          resourceId: {
            kind: "youtube#video",
            videoId,
          },
        },
      }),
    },
  );
}
