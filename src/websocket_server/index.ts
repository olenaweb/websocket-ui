import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';

interface Player {
  name: string;
  password: string;
  index: number;
  wins: number;
  ws?: WebSocket;
}

interface Room {
  roomId: number;
  players: Player[];
  gameState?: GameState;
}

interface GameState {
  gameId: number;
  players: GamePlayer[];
  currentPlayerIndex: number;
  isStarted: boolean;
}

interface GamePlayer {
  index: number;
  ships: Ship[];
  board: string[][]; // 'empty', 'ship', 'hit', 'miss'
}

interface Ship {
  position: { x: number; y: number };
  direction: boolean;
  length: number;
  type: 'small' | 'medium' | 'large' | 'huge';
}

interface WSMessage {
  type: string;
  data: any;
  id: number;
}

// In-memory database
class GameDatabase {
  private players: Map<string, Player> = new Map();
  private rooms: Map<number, Room> = new Map();
  private games: Map<number, GameState> = new Map();
  private playerConnections: Map<number, WebSocket> = new Map();
  private nextPlayerId = 1;
  private nextRoomId = 1;
  private nextGameId = 1;

  // Methods for working with players
  registerPlayer(name: string, password: string): Player {
    const existingPlayer = this.players.get(name);

    if (existingPlayer) {
      if (existingPlayer.password === password) {
        return existingPlayer;
      } else {
        throw new Error('Wrong password');
      }
    }

    const newPlayer: Player = {
      name,
      password,
      index: this.nextPlayerId++,
      wins: 0
    };

    this.players.set(name, newPlayer);
    return newPlayer;
  }

  getPlayer(name: string): Player | undefined {
    return this.players.get(name);
  }

  getAllPlayers(): Player[] {
    return Array.from(this.players.values());
  }

  //  Methods for working with rooms
  createRoom(player: Player): Room {
    const room: Room = {
      roomId: this.nextRoomId++,
      players: [player]
    };

    this.rooms.set(room.roomId, room);
    return room;
  }

  getRoom(roomId: number): Room | undefined {
    return this.rooms.get(roomId);
  }

  getAvailableRooms(): Room[] {
    return Array.from(this.rooms.values()).filter(room => room.players.length === 1);
  }

  addPlayerToRoom(roomId: number, player: Player): Room | null {
    const room = this.rooms.get(roomId);
    if (!room || room.players.length >= 2) {
      return null;
    }

    room.players.push(player);
    return room;
  }

  removeRoom(roomId: number): void {
    this.rooms.delete(roomId);
  }

  // Methods for working with games
  createGame(room: Room): GameState {
    const game: GameState = {
      gameId: this.nextGameId++,
      players: room.players.map(p => ({
        index: p.index,
        ships: [],
        board: Array(10).fill(null).map(() => Array(10).fill('empty'))
      })),
      currentPlayerIndex: room.players[0].index,
      isStarted: false
    };

    this.games.set(game.gameId, game);
    room.gameState = game;
    return game;
  }

  getGame(gameId: number): GameState | undefined {
    return this.games.get(gameId);
  }

  // Methods for working with connections
  setPlayerConnection(playerId: number, ws: WebSocket): void {
    this.playerConnections.set(playerId, ws);
  }

  getPlayerConnection(playerId: number): WebSocket | undefined {
    return this.playerConnections.get(playerId);
  }

  removePlayerConnection(playerId: number): void {
    this.playerConnections.delete(playerId);
  }

  getAllConnections(): WebSocket[] {
    return Array.from(this.playerConnections.values());
  }
}

export function createWebSocketServer(httpServer: Server): WebSocketServer {
  const wss = new WebSocketServer({ server: httpServer });
  const db = new GameDatabase();

  console.log('WebSocket server created');

  wss.on('connection', (ws: WebSocket) => {
    console.log('New WebSocket connection');

    ws.on('message', (message: string) => {
      try {
        const parsedMessage: WSMessage = JSON.parse(message);
        console.log('Received command:', parsedMessage.type, parsedMessage.data);

        handleMessage(ws, parsedMessage, db, wss);
      } catch (error) {
        console.error('Error parsing message:', error);
        sendError(ws, 'Invalid message format');
      }
    });

    ws.on('close', () => {
      console.log('WebSocket connection closed');
      // Remove connection from database
      for (const [playerId, connection] of db['playerConnections']) {
        if (connection === ws) {
          db.removePlayerConnection(playerId);
          break;
        }
      }
    });
  });

  return wss;
}

function handleMessage(ws: WebSocket, message: WSMessage, db: GameDatabase, wss: WebSocketServer): void {
  const { type, data, id } = message;

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

function handleRegistration(ws: WebSocket, data: any, db: GameDatabase, wss: WebSocketServer): void {
  try {
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

    console.log(`Player registered: ${name} (ID: ${player.index})`);

    // Send updates to all clients
    broadcastRoomUpdate(db, wss);
    broadcastWinnersUpdate(db, wss);

  } catch (error) {
    sendMessage(ws, {
      type: 'reg',
      data: {
        name: data.name,
        index: 0,
        error: true,
        errorText: error instanceof Error ? error.message : 'Registration failed'
      },
      id: 0
    });
  }
}

function handleCreateRoom(ws: WebSocket, data: any, db: GameDatabase, wss: WebSocketServer): void {
  // Find player by WebSocket connection
  const player = findPlayerByWebSocket(ws, db);
  if (!player) {
    sendError(ws, 'Player not found');
    return;
  }

  const room = db.createRoom(player);
  console.log(`Room created: ${room.roomId} by player ${player.name}`);

  broadcastRoomUpdate(db, wss);
}

function handleAddUserToRoom(ws: WebSocket, data: any, db: GameDatabase, wss: WebSocketServer): void {
  const player = findPlayerByWebSocket(ws, db);
  if (!player) {
    sendError(ws, 'Player not found');
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
      sendMessage(playerWs, {
        type: 'create_game',
        data: {
          idGame: game.gameId,
          idPlayer: p.index
        },
        id: 0
      });
    }
  });

  console.log(`Player ${player.name} joined room ${room.roomId}, game ${game.gameId} created`);

  // Remove room from available
  db.removeRoom(room.roomId);
  broadcastRoomUpdate(db, wss);
}

// Helper functions for sending messages
function sendMessage(ws: WebSocket, message: any): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

function sendError(ws: WebSocket, errorText: string): void {
  sendMessage(ws, {
    type: 'error',
    data: { errorText },
    id: 0
  });
}

function broadcastRoomUpdate(db: GameDatabase, wss: WebSocketServer): void {
  const availableRooms = db.getAvailableRooms().map(room => ({
    roomId: room.roomId,
    roomUsers: room.players.map(p => ({
      name: p.name,
      index: p.index
    }))
  }));

  const message = {
    type: 'update_room',
    data: availableRooms,
    id: 0
  };

  db.getAllConnections().forEach(ws => {
    sendMessage(ws, message);
  });
}

function broadcastWinnersUpdate(db: GameDatabase, wss: WebSocketServer): void {
  const winners = db.getAllPlayers()
    .sort((a, b) => b.wins - a.wins)
    .map(p => ({
      name: p.name,
      wins: p.wins
    }));

  const message = {
    type: 'update_winners',
    data: winners,
    id: 0
  };

  db.getAllConnections().forEach(ws => {
    sendMessage(ws, message);
  });
}

function findPlayerByWebSocket(ws: WebSocket, db: GameDatabase): Player | undefined {
  for (const [playerId, connection] of db['playerConnections']) {
    if (connection === ws) {
      // Find player by ID
      for (const player of db.getAllPlayers()) {
        if (player.index === playerId) {
          return player;
        }
      }
    }
  }
  return undefined;
}

// Stubs for other handlers (to be implemented in the following steps)
function handleAddShips(ws: WebSocket, data: any, db: GameDatabase, wss: WebSocketServer): void {
  console.log('handleAddShips - TODO');
}

function handleAttack(ws: WebSocket, data: any, db: GameDatabase, wss: WebSocketServer): void {
  console.log('handleAttack - TODO');
}

function handleRandomAttack(ws: WebSocket, data: any, db: GameDatabase, wss: WebSocketServer): void {
  console.log('handleRandomAttack - TODO');
}
