import { WebSocketServer, WebSocket } from "ws";
import { Server } from "http";
import { GameDatabase } from "../game-db/game-database";
import { WSMessage } from "../types/types";
import { sendError, getErrorMessage } from "./utils";
import { handleRegistration } from "../game-handlers/registration";
import { handleCreateRoom, handleAddUserToRoom } from "../game-handlers/rooms";
import { handleAddShips } from "../game-handlers/ships";
import { handleAttack, handleRandomAttack } from "../game-handlers/attacks";
import { handleSinglePlay } from "../game-handlers/single-play";

export function createWebSocketServer(httpServer: Server): WebSocketServer {
  const wss = new WebSocketServer({ server: httpServer });
  const db = new GameDatabase();

  wss.on("connection", (ws: WebSocket) => {
    const clientCount = wss.clients.size;
    console.log(
      `*** New WebSocket connection established (Total clients: ${clientCount})`
    );

    ws.on("message", (message: string) => {
      try {
        const parsedMessage: WSMessage = JSON.parse(message);

        // If data came as a JSON string, parse it
        if (typeof parsedMessage.data === "string") {
          try {
            parsedMessage.data = JSON.parse(parsedMessage.data);
          } catch (e) {
            console.warn(
              " New Room . No data available. " + getErrorMessage(e)
            );
          }
        }

        console.log(`🠈 inbound message: ${JSON.stringify(parsedMessage)}`);
        handleMessage(ws, parsedMessage, db);
      } catch (error) {
        console.error("❌ Error parsing message:", error);
        sendError(ws, "Invalid message format");
      }
    });
    ws.on("close", (code, reason) => {
      const clientCount = wss.clients.size;
      console.log(
        `*** WebSocket connection closed (Code: ${code}, Reason: ${reason || "No reason"}, Remaining clients: ${clientCount})`
      );

      // Remove connection from database
      let disconnectedPlayer = null;
      for (const [playerId, connection] of db["playerConnections"]) {
        if (connection === ws) {
          disconnectedPlayer = db.getPlayerById(playerId);
          db.removePlayerConnection(playerId);
          break;
        }
      }

      if (disconnectedPlayer) {
        console.log(
          `*** Player "${disconnectedPlayer.name}" (ID: ${disconnectedPlayer.index}) disconnected`
        );
      }
    });

    ws.on("error", (error) => {
      console.error("❌ WebSocket error occurred:", error.message);

      let errorPlayer = null;
      for (const [playerId, connection] of db["playerConnections"]) {
        if (connection === ws) {
          errorPlayer = db.getPlayerById(playerId);
          break;
        }
      }

      if (errorPlayer) {
        console.error(
          `*** Error for player "${errorPlayer.name}" (ID: ${errorPlayer.index})`
        );
      }
    });
  });

  return wss;
}

function handleMessage(
  ws: WebSocket,
  message: WSMessage,
  db: GameDatabase
): void {
  const { type, data } = message;

  switch (type) {
    case "reg":
      handleRegistration(ws, data, db);
      break;
    case "create_room":
      handleCreateRoom(ws, data, db);
      break;
    case "add_user_to_room":
      handleAddUserToRoom(ws, data, db);
      break;
    case "add_ships":
      handleAddShips(ws, data, db);
      break;
    case "attack":
      handleAttack(ws, data, db);
      break;
    case "randomAttack":
      handleRandomAttack(ws, data, db);
      break;
    case "single_play":
      handleSinglePlay(ws, data, db);
      break;
    default:
      sendError(ws, `Unknown command: ${type}`);
  }
}
