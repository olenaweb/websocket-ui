import { httpServer } from "./src/http_server/index.js";
import { createWebSocketServer } from "./src/websocket_server/index.js";

const HTTP_PORT: number = 8181;

console.log(`Start static http server on the ${HTTP_PORT} port!`);
httpServer.listen(HTTP_PORT, () => {
  console.log(`HTTP server is running on http://localhost:${HTTP_PORT}`);

  //  Start WebSocket server
  const wss = createWebSocketServer(httpServer);
  console.log(`WebSocket server is running on ws://localhost:${HTTP_PORT}`);
});
