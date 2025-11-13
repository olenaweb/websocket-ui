import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { GameDatabase } from '../game-db/game-database';
import { WSMessage } from '../types/types';
import { sendError } from './utils';
import { handleRegistration } from '../game-handlers/registration';
import { handleCreateRoom, handleAddUserToRoom } from '../game-handlers/rooms';
import { handleAddShips } from '../game-handlers/ships';
import { handleAttack, handleRandomAttack } from '../game-handlers/attacks';

export function createWebSocketServer(httpServer: Server): WebSocketServer {
  const wss = new WebSocketServer({ server: httpServer });
  const db = new GameDatabase();

  console.log('WebSocket server created');

  wss.on('connection', (ws: WebSocket) => {
    console.log('*** New WebSocket connection');

    ws.on('message', (message: string) => {
      try {
        const parsedMessage: WSMessage = JSON.parse(message);

        // If data came as a JSON string, parse it
        if (typeof parsedMessage.data === 'string') {
          try {
            parsedMessage.data = JSON.parse(parsedMessage.data);
          } catch (e) {
            // If not a JSON string, leave as is
          }
        }

        console.log(`-> inbound message ${JSON.stringify(parsedMessage)}`);
        handleMessage(ws, parsedMessage, db, wss);
      } catch (error) {
        console.error('❌ Error parsing message:', error);
        sendError(ws, 'Invalid message format');
      }
    }); ws.on('close', () => {
      console.log('❌ WebSocket connection closed');
      // Remove connection from database
      for (const [playerId, connection] of db['playerConnections']) {
        if (connection === ws) {
          db.removePlayerConnection(playerId);
          break;
        }
      }
    });

    ws.on('error', (error) => {
      console.error('❌ WebSocket error:', error);
    });
  });

  return wss;
}

function handleMessage(ws: WebSocket, message: WSMessage, db: GameDatabase, wss: WebSocketServer): void {
  const { type, data } = message;

  switch (type) {
    case 'reg':
      handleRegistration(ws, data, db, wss);
      break;
    case 'create_room':
      handleCreateRoom(ws, data, db, wss);
      break;
    case 'add_user_to_room':
      handleAddUserToRoom(ws, data, db, wss);
      break;
    case 'add_ships':
      handleAddShips(ws, data, db, wss);
      break;
    case 'attack':
      handleAttack(ws, data, db, wss);
      break;
    case 'randomAttack':
      handleRandomAttack(ws, data, db, wss);
      break;
    default:
      sendError(ws, `Unknown command: ${type}`);
  }
}
