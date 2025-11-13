import { WebSocket, WebSocketServer } from 'ws';
import { GameDatabase } from '../game-db/game-database';
import { sendMessage, broadcastRoomUpdate, broadcastWinnersUpdate } from '../websocket_server/utils';
import { RegistrationData, RegistrationResponse } from '../types/types';

function isRegistrationData(data: unknown): data is RegistrationData {
  return typeof data === 'object' &&
    data !== null &&
    'name' in data &&
    'password' in data &&
    typeof (data as RegistrationData).name === 'string' &&
    typeof (data as RegistrationData).password === 'string';
}

export function handleRegistration(ws: WebSocket, data: unknown, db: GameDatabase, wss: WebSocketServer): void {
  try {
    if (!isRegistrationData(data)) {
      throw new Error('Invalid registration data format');
    }

    const { name, password } = data;
    const player = db.registerPlayer(name, password);

    // Save connection
    db.setPlayerConnection(player.index, ws);

    // Send response to player
    sendMessage(ws, {
      type: 'reg',
      data: {
        name: player.name,
        index: player.index,
        error: false,
        errorText: ''
      },
      id: 0
    });

    console.log(`✅ Player registered: ${name} (ID: ${player.index})`);

    // Send updates to all clients
    broadcastRoomUpdate(db, wss);
    broadcastWinnersUpdate(db, wss);

  } catch (error) {
    const responseData: RegistrationResponse = {
      name: isRegistrationData(data) ? data.name : 'unknown',
      index: 0,
      error: true,
      errorText: error instanceof Error ? error.message : 'Registration failed'
    };

    sendMessage(ws, {
      type: 'reg',
      data: responseData,
      id: 0
    });
  }
}