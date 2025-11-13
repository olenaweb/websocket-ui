import { WebSocket, WebSocketServer } from 'ws';
import { GameDatabase } from '../game-db/game-database';
import { sendMessage, sendError } from '../websocket_server/utils';
import { AddShipsData } from '../types/types';

export function handleAddShips(ws: WebSocket, data: unknown, db: GameDatabase, wss: WebSocketServer): void {
  console.log('handleAddShips - TODO: Implement ships placement logic');
}

// TODO: Implement ship placement and game start logic