import { WebSocket, WebSocketServer } from 'ws';
import { GameDatabase } from '../game-db/game-database';
import { sendMessage, sendError } from '../websocket_server/utils';
import { AttackData, RandomAttackData } from '../types/types';

export function handleAttack(ws: WebSocket, data: unknown, db: GameDatabase, wss: WebSocketServer): void {
  console.log('handleAttack - TODO: Implement attack logic');
}

export function handleRandomAttack(ws: WebSocket, data: unknown, db: GameDatabase, wss: WebSocketServer): void {
  console.log('handleRandomAttack - TODO: Implement random attack logic');
}

// TODO: Implement battle logic