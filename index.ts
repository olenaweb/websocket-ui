import { EOL } from "os";

import { httpServer } from "./src/http_server/index";
import { createWebSocketServer } from "./src/websocket_server/index";
import "dotenv/config";
export const HTTP_PORT = process.env.PORT
  ? parseInt(process.env.PORT, 10)
  : 3000;

console.log(`✅ Start static http server on the ${HTTP_PORT} port! Ctrl-C to exit.${EOL}`);
httpServer.listen(HTTP_PORT, () => {
  console.log(`*** HTTP server is running on http://localhost:${HTTP_PORT}`);

  //  Start WebSocket server
  createWebSocketServer(httpServer);
  console.log(`*** WebSocket server is running on ws://localhost:${HTTP_PORT}${EOL}`);
});
process.on("SIGINT", () => {
  httpServer.close(() => {
    console.log(`✅ Server HTTP closed on http://localhost:${HTTP_PORT}${EOL}`);
    process.exit(0);
  });
});

process.on("SIGTERM", () => {
  httpServer.close(() => {
    console.log(`✅ Server HTTP closed on http://localhost:${HTTP_PORT}${EOL}`);
    process.exit(0);
  });
});
