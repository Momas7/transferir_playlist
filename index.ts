import { Elysia } from "elysia";
import "dotenv/config";

let spotifyAccessToken: string | null = null;
let spotifyTokenScope: string | null = null;
let youtubeAccessToken: string | null = null;

type SpotifyTrack = {
  songName: string | null;
  artists: string[];
  album: string | null;
  spotifyUrl: string | null;
};

type SpotifyPlaylistSummary = {
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

function normalizeSpotifyPlaylistItem(item: any): SpotifyTrack {
  const track = item.track ?? item.item;

  return {
    songName: track?.name ?? null,
    artists: track?.artists?.map((artist: any) => artist.name) ?? [],
    album: track?.album?.name ?? null,
    spotifyUrl: track?.external_urls?.spotify ?? null,
  };
}

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
  const playlistResponse = await fetch(
    `https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}`,
    {
      headers: {
        Authorization: `Bearer ${spotifyAccessToken}`,
      },
    },
  );

  const playlistData = await playlistResponse.json();

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
    const response = await fetch(nextUrl, {
      headers: {
        Authorization: `Bearer ${spotifyAccessToken}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(JSON.stringify(data));
    }

    const pageTracks = data.items.map(normalizeSpotifyPlaylistItem);

    tracks.push(...pageTracks);
    nextUrl = data.next;
  }

  return tracks;
}

async function fetchCurrentUserSpotifyPlaylists() {
  if (!spotifyAccessToken) {
    throw new Error("Voce ainda nao fez login no Spotify. Abra /login primeiro.");
  }

  const playlists: SpotifyPlaylistSummary[] = [];
  let nextUrl = "https://api.spotify.com/v1/me/playlists?limit=50";

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

function buildYoutubeSearchQuery(track: SpotifyTrack) {
  return [track.songName, ...track.artists, "official audio"]
    .filter(Boolean)
    .join(" ");
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableYoutubeError(status: number, data: any) {
  const reason = data?.error?.errors?.[0]?.reason;
  const apiStatus = data?.error?.status;

  return (
    status === 409 ||
    status === 429 ||
    status >= 500 ||
    reason === "SERVICE_UNAVAILABLE" ||
    apiStatus === "ABORTED"
  );
}

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

  const data = await fetchYoutubeWithRetry(searchUrl.toString(), {
    headers: {
      Authorization: `Bearer ${youtubeAccessToken}`,
    },
  });

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

  return await fetchYoutubeWithRetry(
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
}

async function addVideoToYoutubePlaylist(playlistId: string, videoId: string) {
  if (!youtubeAccessToken) {
    throw new Error(
      "Voce ainda nao fez login no YouTube. Abra /youtube/login primeiro.",
    );
  }

  return await fetchYoutubeWithRetry(
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
    authUrl.searchParams.set("show_dialog", "true");
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
      return new Response(
        JSON.stringify(
          {
            message: "O Spotify nao aceitou trocar o code por token.",
            spotifyStatus: response.status,
            spotifyError: data,
          },
          null,
          2,
        ),
        {
        status: response.status,
        headers: {
          "Content-Type": "application/json",
        },
        },
      );
    }

    spotifyAccessToken = data.access_token;
    spotifyTokenScope = data.scope ?? null;

    return {
      message: "Login com Spotify concluido com sucesso.",
      scope: spotifyTokenScope,
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

  .get("/spotify/auth-info", () => {
    return {
      hasAccessToken: Boolean(spotifyAccessToken),
      scope: spotifyTokenScope,
      redirectUri: process.env.SPOTIFY_REDIRECT_URI,
    };
  })

  .get("/spotify/playlist-debug", async ({ query }) => {
    const playlistInput = query.id;

    if (!spotifyAccessToken) {
      return new Response("Voce ainda nao fez login. Abra /login primeiro.", {
        status: 401,
      });
    }

    if (!playlistInput) {
      return new Response(
        "Informe o id ou a URL da playlist. Exemplo: /spotify/playlist-debug?id=SEU_ID_DA_PLAYLIST.",
        { status: 400 },
      );
    }

    const playlistId = getSpotifyPlaylistId(playlistInput);
    const userPlaylists = await fetchCurrentUserSpotifyPlaylists();
    const playlistFromAccount = userPlaylists.find(
      (playlist) => playlist.id === playlistId,
    );

    const playlistResponse = await fetch(
      `https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}`,
      {
        headers: {
          Authorization: `Bearer ${spotifyAccessToken}`,
        },
      },
    );
    const playlistData = await playlistResponse.json();

    const tracksResponse = await fetch(
      `https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}/tracks?limit=10`,
      {
        headers: {
          Authorization: `Bearer ${spotifyAccessToken}`,
        },
      },
    );
    const tracksData = await tracksResponse.json();

    return {
      playlistId,
      tokenScope: spotifyTokenScope,
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

    try {
      const tracks = await fetchSpotifyPlaylistTracks(playlistId);

      return {
        playlistId,
        totalTracks: tracks.length,
        tracks,
      };
    } catch (error) {
      return new Response(
        JSON.stringify(
          {
            message: "Nao consegui buscar as faixas dessa playlist.",
            playlistId,
            tokenScope: spotifyTokenScope,
            error: String(error),
          },
          null,
          2,
        ),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }
  })

  .get("/playlists", async () => {
    if (!spotifyAccessToken) {
      return new Response("Voce ainda nao fez login. Abra /login primeiro.", {
        status: 401,
      });
    }

    try {
      const playlists = await fetchCurrentUserSpotifyPlaylists();

      return {
        total: playlists.length,
        playlists,
      };
    } catch (error) {
      return new Response(String(error), {
        status: 400,
      });
    }
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
    const transferLimit = Math.min(Number(query.limit || 10), 100);
    const transferOffset = Math.max(Number(query.offset || 0), 0);
    const youtubePlaylistTitle =
      query.youtubePlaylistTitle ||
      `Transferida do Spotify ${spotifyPlaylistId}`;
    const youtubePlaylistDescription =
      query.youtubePlaylistDescription ||
      `Playlist criada a partir da playlist ${spotifyPlaylistId} do Spotify.`;

    try {
      const spotifyTracks = await fetchSpotifyPlaylistTracks(spotifyPlaylistId);
      const tracksToTransfer = spotifyTracks.slice(
        transferOffset,
        transferOffset + transferLimit,
      );
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

          await addVideoToYoutubePlaylist(
            youtubePlaylist.id,
            youtubeResult.videoId,
          );

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
        spotifyPlaylistId,
        youtubePlaylistId: youtubePlaylist.id,
        youtubePlaylistTitle: youtubePlaylist.snippet?.title,
        totalSpotifyTracks: spotifyTracks.length,
        requestedTransferOffset: transferOffset,
        requestedTransferLimit: transferLimit,
        processedTracks: tracksToTransfer.length,
        addedCount: addedTracks.length,
        notFoundCount: notFoundTracks.length,
        failedCount: failedTracks.length,
        addedTracks,
        notFoundTracks,
        failedTracks,
      };
    } catch (error) {
      return new Response(String(error), {
        status: 400,
      });
    }
  })
  .listen(3000);

console.log(`Elysia rodando em http://localhost:${app.server.port}`);
