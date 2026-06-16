import "dotenv/config";
import { createApp } from "./app";

const app = createApp().listen(3000);

console.log(`Elysia rodando em http://localhost:${app.server.port}`);
