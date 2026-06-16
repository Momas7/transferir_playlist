import { Elysia } from "elysia";
import { getSpotifyClientCredentials } from "../config/env";
import {
  buildSpotifyLoginUrl,
  exchangeSpotifyCodeForToken,
  fetchSpotifyCurrentUser,
  fetchSpotifySearchTracks,
} from "../integrations/spotify.client";
import {
  getSpotifyAccessToken,
  getSpotifyTokenScope,
  setSpotifyAuth,
} from "../state/auth-state";
import {
  fetchCurrentUserSpotifyPlaylists,
  fetchSpotifyPlaylistDebug,
  fetchSpotifyPlaylistTracks,
} from "../services/spotify.service";
import { getSpotifyPlaylistId } from "../utils/spotify.util";

export const spotifyRoutes = new Elysia()
  .get("/login", () => {
    const { clientId, redirectUri } = getSpotifyClientCredentials();
    const loginUrl = buildSpotifyLoginUrl(clientId, redirectUri);

    return Response.redirect(loginUrl, 302);
  })
  .get("/callback", async ({ query }) => {
    const code = query.code;

    if (!code) {
      return new Response("Spotify nao enviou o code na callback.", {
        status: 400,
      });
    }

    const { clientId, clientSecret, redirectUri } = getSpotifyClientCredentials();
    const { response, data } = await exchangeSpotifyCodeForToken({
      clientId,
      clientSecret,
      redirectUri,
      code,
    });

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

    setSpotifyAuth(data.access_token, data.scope ?? null);

    return {
      message: "Login com Spotify concluido com sucesso.",
      scope: getSpotifyTokenScope(),
      nextSteps: [
        "Abra /me para testar se o token representa voce.",
        "Abra /search?q=Daft Punk para testar uma busca usando o token do usuario.",
        "Abra /youtube/login para comecar a conexao com o YouTube.",
      ],
    };
  })
  .get("/me", async () => {
    const token = getSpotifyAccessToken();

    if (!token) {
      return new Response("Voce ainda nao fez login. Abra /login primeiro.", {
        status: 401,
      });
    }

    const { response, data } = await fetchSpotifyCurrentUser(token);

    return new Response(JSON.stringify(data, null, 2), {
      status: response.status,
      headers: {
        "Content-Type": "application/json",
      },
    });
  })
  .get("/spotify/auth-info", () => {
    return {
      hasAccessToken: Boolean(getSpotifyAccessToken()),
      scope: getSpotifyTokenScope(),
      redirectUri: process.env.SPOTIFY_REDIRECT_URI,
    };
  })
  .get("/spotify/playlist-debug", async ({ query }) => {
    const playlistInput = query.id;

    if (!getSpotifyAccessToken()) {
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
    const debug = await fetchSpotifyPlaylistDebug(playlistId);

    return {
      playlistId,
      tokenScope: getSpotifyTokenScope(),
      ...debug,
    };
  })
  .get("/playlist", async ({ query }) => {
    const playlistInput = query.id;

    if (!getSpotifyAccessToken()) {
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
            tokenScope: getSpotifyTokenScope(),
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
    if (!getSpotifyAccessToken()) {
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
  .get("/search", async ({ query }) => {
    const search = query.q || "Daft Punk";
    const token = getSpotifyAccessToken();

    if (!token) {
      return new Response("Voce ainda nao fez login. Abra /login primeiro.", {
        status: 401,
      });
    }

    const { response, data } = await fetchSpotifySearchTracks(token, search);

    return new Response(JSON.stringify(data, null, 2), {
      status: response.status,
      headers: {
        "Content-Type": "application/json",
      },
    });
  });
