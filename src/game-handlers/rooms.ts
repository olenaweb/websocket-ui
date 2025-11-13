import { WebSocket, WebSocketServer } from 'ws';
import { GameDatabase } from '../game-db/game-database';
import { sendMessage, sendError, broadcastRoomUpdate } from '../websocket_server/utils';
import { AddUserToRoomData, CreateGameData } from '../types/types';

function isAddUserToRoomData(data: unknown): data is AddUserToRoomData {
  return typeof data === 'object' &&
    data !== null &&
    'indexRoom' in data &&
    typeof (data as AddUserToRoomData).indexRoom === 'number';
}

export function handleCreateRoom(ws: WebSocket, data: unknown, db: GameDatabase, wss: WebSocketServer): void {
  // Find player by WebSocket connection
  const player = db.findPlayerByWebSocket(ws);
  if (!player) {
    sendError(ws, 'Player not found');
    return;
  }

  const room = db.createRoom(player);
  console.log(`Room created: ${room.roomId} by player ${player.name}`);

  broadcastRoomUpdate(db, wss);
}

export function handleAddUserToRoom(ws: WebSocket, data: unknown, db: GameDatabase, wss: WebSocketServer): void {
  const player = db.findPlayerByWebSocket(ws);
  if (!player) {
    sendError(ws, 'Player not found');
    return;
  }

  if (!isAddUserToRoomData(data)) {
    sendError(ws, 'Invalid room data format');
    return;
  }

  const { indexRoom } = data;
  const room = db.addPlayerToRoom(indexRoom, player);

  if (!room) {
    sendError(ws, 'Cannot join room');
    return;
  }

  // Create game
  const game = db.createGame(room);

  // Send create_game to both players
  room.players.forEach(p => {
    const playerWs = db.getPlayerConnection(p.index);
    if (playerWs) {
      const gameData: CreateGameData = {
        idGame: game.gameId,
        idPlayer: p.index
      };

      sendMessage(playerWs, {
        type: 'create_game',
        data: gameData,
        id: 0
      });
    }
  });

  console.log(`Player ${player.name} joined room ${room.roomId}, game ${game.gameId} created`);

  // Remove room from available
  db.removeRoom(room.roomId);
  broadcastRoomUpdate(db, wss);
}