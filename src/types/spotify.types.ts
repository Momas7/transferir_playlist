export type SpotifyTrack = {
  songName: string | null;
  artists: string[];
  album: string | null;
  spotifyUrl: string | null;
};

export type SpotifyPlaylistSummary = {
  id: string;
  name: string;
  owner: string | null;
  ownerId: string | null;
  isPublic: boolean | null;
  isCollaborative: boolean;
  totalTracks: number;
  tracksHref: string | null;
  spotifyUrl: string | null;
};
