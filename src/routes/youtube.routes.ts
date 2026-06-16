import { Elysia } from "elysia";
import { getGoogleClientCredentials } from "../config/env";
import {
  buildGoogleYoutubeLoginUrl,
  exchangeGoogleCodeForToken,
} from "../integrations/google-oauth.client";
import { setYoutubeAccessToken } from "../state/auth-state";
import {
  createYoutubePlaylist,
  searchYoutubeVideo,
} from "../services/youtube.service";

export const youtubeRoutes = new Elysia()
  .get("/youtube/login", () => {
    const { clientId, redirectUri } = getGoogleClientCredentials();
    const loginUrl = buildGoogleYoutubeLoginUrl(clientId, redirectUri);

    return Response.redirect(loginUrl, 302);
  })
  .get("/youtube/callback", async ({ query }) => {
    const code = query.code;

    if (!code) {
      return new Response("Google nao enviou o code na callback.", {
        status: 400,
      });
    }

    const { clientId, clientSecret, redirectUri } = getGoogleClientCredentials();
    const { response, data } = await exchangeGoogleCodeForToken({
      code,
      clientId,
      clientSecret,
      redirectUri,
    });

    if (!response.ok) {
      return new Response(JSON.stringify(data, null, 2), {
        status: response.status,
        headers: {
          "Content-Type": "application/json",
        },
      });
    }

    setYoutubeAccessToken(data.access_token);

    return {
      message: "Login com Google/YouTube concluido com sucesso.",
      nextSteps: [
        "Abra /youtube/search?q=Daft Punk Get Lucky para testar a busca.",
        "Abra /youtube/create-playlist?title=Minha%20Playlist para criar uma playlist no YouTube.",
        "Abra /transfer?spotifyPlaylistId=SEU_ID para transferir a playlist do Spotify.",
      ],
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
  });
