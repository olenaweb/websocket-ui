import { WebSocket, WebSocketServer } from 'ws';
import { GameDatabase } from '../game-db/game-database';
import { WSResponse, RoomData, WinnerData } from '../types/types';

export function sendMessage<T = unknown>(ws: WebSocket, message: WSResponse<T>): void {
  if (ws.readyState === WebSocket.OPEN) {
    //  Prepare message with data as JSON string
    const messageToSend = {
      type: message.type,
      data: JSON.stringify(message.data),
      id: message.id
    };

    const messageString = JSON.stringify(messageToSend);
    console.log(`outbound message -> ${JSON.stringify(messageToSend)}`);
    ws.send(messageString);
  }
}

export function sendError(ws: WebSocket, errorText: string): void {
  sendMessage(ws, {
    type: 'error',
    data: { errorText },
    id: 0
  });
}

export function broadcastRoomUpdate(db: GameDatabase, wss: WebSocketServer): void {
  const availableRooms: RoomData[] = db.getAvailableRooms().map(room => ({
    roomId: room.roomId,
    roomUsers: room.players.map(p => ({
      name: p.name,
      index: p.index
    }))
  }));

  const message: WSResponse<RoomData[]> = {
    type: 'update_room',
    data: availableRooms,
    id: 0
  };

  db.getAllConnections().forEach(ws => {
    sendMessage(ws, message);
  });
}

export function broadcastWinnersUpdate(db: GameDatabase, wss: WebSocketServer): void {
  const winners: WinnerData[] = db.getAllPlayers()
    .sort((a, b) => b.wins - a.wins)
    .map(p => ({
      name: p.name,
      wins: p.wins
    }));

  const message: WSResponse<WinnerData[]> = {
    type: 'update_winners',
    data: winners,
    id: 0
  };

  db.getAllConnections().forEach(ws => {
    sendMessage(ws, message);
  });
}