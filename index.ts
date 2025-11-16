import { EOL } from "os";
import { WebSocketServer } from "ws";

import { httpServer } from "./src/http_server/index";
import { createWebSocketServer } from "./src/websocket_server/index";
import "dotenv/config";
export const HTTP_PORT = process.env.PORT
  ? parseInt(process.env.PORT, 10)
  : 3000;

console.log(
  `✅ Start static http server on the ${HTTP_PORT} port! Ctrl-C to exit.${EOL}`
);

let wss: WebSocketServer | null = null;

httpServer.listen(HTTP_PORT, () => {
  console.log(`*** HTTP server is running on http://localhost:${HTTP_PORT}`);

  wss = createWebSocketServer(httpServer);
  console.log(
    `*** WebSocket server is running on ws://localhost:${HTTP_PORT}${EOL}`
  );
});

function gracefulShutdown(signal: string) {
  console.log(`${EOL}🛑 Received ${signal}. Shutting down gracefully...`);

  const shutdownTimeout = setTimeout(() => {
    console.log("⚠️ Force shutdown - timeout exceeded");
    process.exit(1);
  }, 5000);

  if (wss) {
    console.log("*** Closing WebSocket server...");

    let activeClients = 0;
    wss.clients.forEach((client) => {
      if (client.readyState === 1) {
        activeClients++;
        client.close(1000, "Server shutdown");
      }
    });

    if (activeClients > 0) {
      console.log(
        `*** ${activeClients} WebSocket client(s) successfully disconnected`
      );
    } else {
      console.log("*** No active WebSocket clients to disconnect");
    }

    wss.close(() => {
      console.log("✅ WebSocket server closed");
      console.log(
        `*** Server shutdown completed. ${activeClients} client(s) were gracefully disconnected.`
      );

      httpServer.close(() => {
        clearTimeout(shutdownTimeout);
        console.log(
          `✅ Server HTTP closed on http://localhost:${HTTP_PORT}${EOL}`
        );
        process.exit(0);
      });
    });
  } else {
    httpServer.close(() => {
      clearTimeout(shutdownTimeout);
      console.log(
        `✅ Server HTTP closed on http://localhost:${HTTP_PORT}${EOL}`
      );
      process.exit(0);
    });
  }
}

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
