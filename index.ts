import { Elysia } from "elysia";
import "dotenv/config";

let spotifyAccessToken: string | null = null;

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
    const playlistId = query.id || "3cEYpjA9oz9GiPac4AsH4n";

    if (!spotifyAccessToken) {
      return new Response("Voce ainda nao fez login. Abra /login primeiro.", {
        status: 401,
      });
    }

    const response = await fetch(
      `https://api.spotify.com/v1/playlists/${playlistId}/tracks`,
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
  .listen(3000);

console.log(`Elysia rodando em http://localhost:${app.server.port}`);
