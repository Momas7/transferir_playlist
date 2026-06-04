import { Elysia } from "elysia";
import "dotenv/config";

let spotifyAccessToken: string | null = null;
let youtubeAccessToken: string | null = null;

type SpotifyTrack = {
  songName: string | null;
  artists: string[];
  album: string | null;
  spotifyUrl: string | null;
};

function getSpotifyPlaylistId(input: string) {
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

function getGoogleClientCredentials() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "Configure GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET e GOOGLE_REDIRECT_URI no .env.",
    );
  }

  return { clientId, clientSecret, redirectUri };
}

async function fetchSpotifyPlaylistTracks(playlistId: string) {
  if (!spotifyAccessToken) {
    throw new Error(
      "Voce ainda nao fez login no Spotify. Abra /login primeiro.",
    );
  }

  const tracks: SpotifyTrack[] = [];
  let nextUrl = `https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}/tracks`;

  while (nextUrl) {
    const response = await fetch(nextUrl, {
      headers: {
        Authorization: `Bearer ${spotifyAccessToken}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(JSON.stringify(data));
    }

    const pageTracks = data.items.map((item: any) => ({
      songName: item.track?.name ?? null,
      artists: item.track?.artists?.map((artist: any) => artist.name) ?? [],
      album: item.track?.album?.name ?? null,
      spotifyUrl: item.track?.external_urls?.spotify ?? null,
    }));

    tracks.push(...pageTracks);
    nextUrl = data.next;
  }

  return tracks;
}

function buildYoutubeSearchQuery(track: SpotifyTrack) {
  return [track.songName, ...track.artists, "official audio"]
    .filter(Boolean)
    .join(" ");
}

async function searchYoutubeVideo(query: string) {
  if (!youtubeAccessToken) {
    throw new Error(
      "Voce ainda nao fez login no YouTube. Abra /youtube/login primeiro.",
    );
  }

  const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");
  searchUrl.searchParams.set("part", "snippet");
  searchUrl.searchParams.set("type", "video");
  searchUrl.searchParams.set("maxResults", "1");
  searchUrl.searchParams.set("q", query);

  const response = await fetch(searchUrl.toString(), {
    headers: {
      Authorization: `Bearer ${youtubeAccessToken}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }

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

async function createYoutubePlaylist(title: string, description: string) {
  if (!youtubeAccessToken) {
    throw new Error(
      "Voce ainda nao fez login no YouTube. Abra /youtube/login primeiro.",
    );
  }

  const response = await fetch(
    "https://www.googleapis.com/youtube/v3/playlists?part=snippet,status",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${youtubeAccessToken}`,
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

  const data = await response.json();

  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }

  return data;
}

async function addVideoToYoutubePlaylist(playlistId: string, videoId: string) {
  if (!youtubeAccessToken) {
    throw new Error(
      "Voce ainda nao fez login no YouTube. Abra /youtube/login primeiro.",
    );
  }

  const response = await fetch(
    "https://www.googleapis.com/youtube/v3/playlistItems?part=snippet",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${youtubeAccessToken}`,
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

  const data = await response.json();

  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }

  return data;
}

const app = new Elysia()
  .get("/login", () => {
    const authUrl = new URL("https://accounts.spotify.com/authorize");
    authUrl.searchParams.set("client_id", process.env.SPOTIFY_CLIENT_ID!);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("redirect_uri", process.env.SPOTIFY_REDIRECT_URI!);
    authUrl.searchParams.set(
      "scope",
      "playlist-read-private playlist-read-collaborative",
    );
    return Response.redirect(authUrl.toString(), 302);
  })

  .get("/callback", async ({ query }) => {
    const code = query.code;

    if (!code) {
      return new Response("Spotify nao enviou o code na callback.", {
        status: 400,
      });
    }

    const credentials = btoa(
      `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`,
    );

    const response = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: process.env.SPOTIFY_REDIRECT_URI!,
      }).toString(),
    });

    const data = await response.json();

    if (!response.ok) {
      return new Response(JSON.stringify(data, null, 2), {
        status: response.status,
        headers: {
          "Content-Type": "application/json",
        },
      });
    }

    spotifyAccessToken = data.access_token;

    return {
      message: "Login com Spotify concluido com sucesso.",
      nextSteps: [
        "Abra /me para testar se o token representa voce.",
        "Abra /search?q=Daft Punk para testar uma busca usando o token do usuario.",
        "Abra /youtube/login para comecar a conexao com o YouTube.",
      ],
    };
  })

  .get("/youtube/login", () => {
    const { clientId, redirectUri } = getGoogleClientCredentials();
    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");

    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set(
      "scope",
      "https://www.googleapis.com/auth/youtube",
    );
    authUrl.searchParams.set("access_type", "offline");
    authUrl.searchParams.set("prompt", "consent");

    return Response.redirect(authUrl.toString(), 302);
  })

  .get("/youtube/callback", async ({ query }) => {
    const code = query.code;

    if (!code) {
      return new Response("Google nao enviou o code na callback.", {
        status: 400,
      });
    }

    const { clientId, clientSecret, redirectUri } =
      getGoogleClientCredentials();

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }).toString(),
    });

    const data = await response.json();

    if (!response.ok) {
      return new Response(JSON.stringify(data, null, 2), {
        status: response.status,
        headers: {
          "Content-Type": "application/json",
        },
      });
    }

    youtubeAccessToken = data.access_token;

    return {
      message: "Login com Google/YouTube concluido com sucesso.",
      nextSteps: [
        "Abra /youtube/search?q=Daft Punk Get Lucky para testar a busca.",
        "Abra /youtube/create-playlist?title=Minha%20Playlist para criar uma playlist no YouTube.",
        "Abra /transfer?spotifyPlaylistId=SEU_ID para transferir a playlist do Spotify.",
      ],
    };
  })

  .get("/me", async () => {
    if (!spotifyAccessToken) {
      return new Response("Voce ainda nao fez login. Abra /login primeiro.", {
        status: 401,
      });
    }

    const response = await fetch("https://api.spotify.com/v1/me", {
      headers: {
        Authorization: `Bearer ${spotifyAccessToken}`,
      },
    });

    const data = await response.json();

    return new Response(JSON.stringify(data, null, 2), {
      status: response.status,
      headers: {
        "Content-Type": "application/json",
      },
    });
  })

  .get("/playlist", async ({ query }) => {
    const playlistInput = query.id;

    if (!spotifyAccessToken) {
      return new Response("Voce ainda nao fez login. Abra /login primeiro.", {
        status: 401,
      });
    }

    if (!playlistInput) {
      return new Response(
        "Informe o id ou a URL da playlist. Exemplo: /playlist?id=SEU_ID_DA_PLAYLIST. Para ver suas playlists, abra /playlists.",
        { status: 400 },
      );
    }

    const playlistId = getSpotifyPlaylistId(playlistInput);

    const response = await fetch(
      `https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}/tracks`,
      {
        headers: {
          Authorization: `Bearer ${spotifyAccessToken}`,
        },
      },
    );

    const data = await response.json();

    if (!response.ok) {
      return new Response(JSON.stringify(data, null, 2), {
        status: response.status,
        headers: {
          "Content-Type": "application/json",
        },
      });
    }

    const tracks = data.items.map((item: any) => ({
      songName: item.track?.name,
      artists: item.track?.artists?.map((artist: any) => artist.name) || [],
      album: item.track?.album?.name,
      spotifyUrl: item.track?.external_urls?.spotify,
    }));

    return {
      playlistId,
      totalTracks: data.total,
      tracks,
    };
  })

  .get("/playlists", async () => {
    if (!spotifyAccessToken) {
      return new Response("Voce ainda nao fez login. Abra /login primeiro.", {
        status: 401,
      });
    }

    const response = await fetch("https://api.spotify.com/v1/me/playlists", {
      headers: {
        Authorization: `Bearer ${spotifyAccessToken}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return new Response(JSON.stringify(data, null, 2), {
        status: response.status,
        headers: {
          "Content-Type": "application/json",
        },
      });
    }

    const playlists = data.items.map((playlist: any) => ({
      id: playlist.id,
      name: playlist.name,
      totalTracks: playlist.tracks?.total,
      spotifyUrl: playlist.external_urls?.spotify,
    }));

    return {
      total: data.total,
      playlists,
    };
  })

  .get("/youtube/search", async ({ query }) => {
    const searchText = query.q || "Daft Punk Get Lucky official audio";

    try {
      const result = await searchYoutubeVideo(searchText);

      return {
        query: searchText,
        result,
      };
    } catch (error) {
      return new Response(String(error), {
        status: 400,
      });
    }
  })

  .get("/youtube/create-playlist", async ({ query }) => {
    const title = query.title || "Playlist transferida do Spotify";
    const description =
      query.description ||
      "Playlist criada automaticamente pelo projeto transfer_playlist.";

    try {
      const playlist = await createYoutubePlaylist(title, description);

      return {
        playlistId: playlist.id,
        title: playlist.snippet?.title,
        description: playlist.snippet?.description,
        privacyStatus: playlist.status?.privacyStatus,
      };
    } catch (error) {
      return new Response(String(error), {
        status: 400,
      });
    }
  })

  .get("/search", async ({ query }) => {
    const search = query.q || "Daft Punk";

    if (!spotifyAccessToken) {
      return new Response("Voce ainda nao fez login. Abra /login primeiro.", {
        status: 401,
      });
    }

    const response = await fetch(
      `https://api.spotify.com/v1/search?q=${search}&type=track`,
      {
        headers: {
          Authorization: `Bearer ${spotifyAccessToken}`,
        },
      },
    );

    const data = await response.json();

    return new Response(JSON.stringify(data, null, 2), {
      status: response.status,
      headers: {
        "Content-Type": "application/json",
      },
    });
  })

  .get("/transfer", async ({ query }) => {
    const spotifyPlaylistId = getSpotifyPlaylistId(
      query.spotifyPlaylistId || "3cEYpjA9oz9GiPac4AsH4n",
    );
    const youtubePlaylistTitle =
      query.youtubePlaylistTitle ||
      `Transferida do Spotify ${spotifyPlaylistId}`;
    const youtubePlaylistDescription =
      query.youtubePlaylistDescription ||
      `Playlist criada a partir da playlist ${spotifyPlaylistId} do Spotify.`;

    try {
      const spotifyTracks = await fetchSpotifyPlaylistTracks(spotifyPlaylistId);
      const youtubePlaylist = await createYoutubePlaylist(
        youtubePlaylistTitle,
        youtubePlaylistDescription,
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

      for (const track of spotifyTracks) {
        const searchQuery = buildYoutubeSearchQuery(track);
        const youtubeResult = await searchYoutubeVideo(searchQuery);

        if (!youtubeResult?.videoId) {
          notFoundTracks.push({
            spotifySongName: track.songName,
            searchQuery,
          });
          continue;
        }

        await addVideoToYoutubePlaylist(
          youtubePlaylist.id,
          youtubeResult.videoId,
        );

        addedTracks.push({
          spotifySongName: track.songName,
          youtubeVideoId: youtubeResult.videoId,
          youtubeTitle: youtubeResult.title,
        });
      }

      return {
        spotifyPlaylistId,
        youtubePlaylistId: youtubePlaylist.id,
        youtubePlaylistTitle: youtubePlaylist.snippet?.title,
        totalSpotifyTracks: spotifyTracks.length,
        addedCount: addedTracks.length,
        notFoundCount: notFoundTracks.length,
        addedTracks,
        notFoundTracks,
      };
    } catch (error) {
      return new Response(String(error), {
        status: 400,
      });
    }
  })
  .listen(3000);

console.log(`Elysia rodando em http://localhost:${app.server.port}`);
