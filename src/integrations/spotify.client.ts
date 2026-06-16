type RequestOptions = {
  method?: string;
  body?: string;
  accessToken?: string;
  contentType?: string;
  authorization?: string;
};

async function requestSpotify(url: string, options: RequestOptions = {}) {
  const response = await fetch(url, {
    method: options.method,
    headers: {
      ...(options.authorization
        ? { Authorization: options.authorization }
        : {}),
      ...(options.accessToken
        ? { Authorization: `Bearer ${options.accessToken}` }
        : {}),
      ...(options.contentType ? { "Content-Type": options.contentType } : {}),
    },
    body: options.body,
  });

  const data = await response.json();

  return { response, data };
}

export function buildSpotifyLoginUrl(clientId: string, redirectUri: string) {
  const authUrl = new URL("https://accounts.spotify.com/authorize");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set(
    "scope",
    "playlist-read-private playlist-read-collaborative",
  );
  authUrl.searchParams.set("show_dialog", "true");

  return authUrl.toString();
}

export async function exchangeSpotifyCodeForToken(params: {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  code: string;
}) {
  const credentials = btoa(`${params.clientId}:${params.clientSecret}`);

  return await requestSpotify("https://accounts.spotify.com/api/token", {
    method: "POST",
    contentType: "application/x-www-form-urlencoded",
    authorization: `Basic ${credentials}`,
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: params.code,
      redirect_uri: params.redirectUri,
    }).toString(),
  });
}

export async function fetchSpotifyCurrentUser(accessToken: string) {
  return await requestSpotify("https://api.spotify.com/v1/me", {
    accessToken,
  });
}

export async function fetchSpotifySearchTracks(
  accessToken: string,
  query: string,
) {
  return await requestSpotify(
    `https://api.spotify.com/v1/search?q=${query}&type=track`,
    {
      accessToken,
    },
  );
}

export async function fetchSpotifyPlaylistById(
  accessToken: string,
  playlistId: string,
) {
  return await requestSpotify(
    `https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}`,
    {
      accessToken,
    },
  );
}

export async function fetchSpotifyPlaylistTracksById(
  accessToken: string,
  playlistId: string,
  limit = 10,
) {
  return await requestSpotify(
    `https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}/tracks?limit=${limit}`,
    {
      accessToken,
    },
  );
}

export async function fetchSpotifyPlaylistsPage(
  accessToken: string,
  url = "https://api.spotify.com/v1/me/playlists?limit=50",
) {
  return await requestSpotify(url, {
    accessToken,
  });
}

export async function fetchSpotifyByUrl(accessToken: string, url: string) {
  return await requestSpotify(url, {
    accessToken,
  });
}
