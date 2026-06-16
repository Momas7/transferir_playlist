let spotifyAccessToken: string | null = null;
let spotifyTokenScope: string | null = null;
let youtubeAccessToken: string | null = null;

export function setSpotifyAuth(accessToken: string, scope: string | null) {
  spotifyAccessToken = accessToken;
  spotifyTokenScope = scope;
}

export function getSpotifyAccessToken() {
  return spotifyAccessToken;
}

export function getSpotifyTokenScope() {
  return spotifyTokenScope;
}

export function setYoutubeAccessToken(accessToken: string) {
  youtubeAccessToken = accessToken;
}

export function getYoutubeAccessToken() {
  return youtubeAccessToken;
}
