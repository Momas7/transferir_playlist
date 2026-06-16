import { Elysia } from "elysia";
import { spotifyRoutes } from "./routes/spotify.routes";
import { transferRoutes } from "./routes/transfer.routes";
import { youtubeRoutes } from "./routes/youtube.routes";

export function createApp() {
  return new Elysia().use(spotifyRoutes).use(youtubeRoutes).use(transferRoutes);
}
