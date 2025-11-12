import { WebSocketServer, WebSocket } from 'ws';
// In-memory database
class GameDatabase {
    constructor() {
        this.players = new Map();
        this.rooms = new Map();
        this.games = new Map();
        this.playerConnections = new Map();
        this.nextPlayerId = 1;
        this.nextRoomId = 1;
        this.nextGameId = 1;
    }
    // Methods for working with players
    registerPlayer(name, password) {
        const existingPlayer = this.players.get(name);
        if (existingPlayer) {
            if (existingPlayer.password === password) {
                return existingPlayer;
            }
            else {
                throw new Error('Wrong password');
            }
        }
        const newPlayer = {
            name,
            password,
            index: this.nextPlayerId++,
            wins: 0
        };
        this.players.set(name, newPlayer);
        return newPlayer;
    }
    getPlayer(name) {
        return this.players.get(name);
    }
    getAllPlayers() {
        return Array.from(this.players.values());
    }
    //  Methods for working with rooms
    createRoom(player) {
        const room = {
            roomId: this.nextRoomId++,
            players: [player]
        };
        this.rooms.set(room.roomId, room);
        return room;
    }
    getRoom(roomId) {
        return this.rooms.get(roomId);
    }
    getAvailableRooms() {
        return Array.from(this.rooms.values()).filter(room => room.players.length === 1);
    }
    addPlayerToRoom(roomId, player) {
        const room = this.rooms.get(roomId);
        if (!room || room.players.length >= 2) {
            return null;
        }
        room.players.push(player);
        return room;
    }
    removeRoom(roomId) {
        this.rooms.delete(roomId);
    }
    // Methods for working with games
    createGame(room) {
        const game = {
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
    getGame(gameId) {
        return this.games.get(gameId);
    }
    // Methods for working with connections
    setPlayerConnection(playerId, ws) {
        this.playerConnections.set(playerId, ws);
    }
    getPlayerConnection(playerId) {
        return this.playerConnections.get(playerId);
    }
    removePlayerConnection(playerId) {
        this.playerConnections.delete(playerId);
    }
    getAllConnections() {
        return Array.from(this.playerConnections.values());
    }
}
export function createWebSocketServer(httpServer) {
    const wss = new WebSocketServer({ server: httpServer });
    const db = new GameDatabase();
    console.log('WebSocket server created');
    wss.on('connection', (ws) => {
        console.log('New WebSocket connection');
        ws.on('message', (message) => {
            try {
                const parsedMessage = JSON.parse(message);
                console.log('Received command:', parsedMessage.type, parsedMessage.data);
                handleMessage(ws, parsedMessage, db, wss);
            }
            catch (error) {
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
function handleMessage(ws, message, db, wss) {
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
function handleRegistration(ws, data, db, wss) {
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
    }
    catch (error) {
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
function handleCreateRoom(ws, data, db, wss) {
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
function handleAddUserToRoom(ws, data, db, wss) {
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
function sendMessage(ws, message) {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
    }
}
function sendError(ws, errorText) {
    sendMessage(ws, {
        type: 'error',
        data: { errorText },
        id: 0
    });
}
function broadcastRoomUpdate(db, wss) {
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
function broadcastWinnersUpdate(db, wss) {
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
function findPlayerByWebSocket(ws, db) {
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
function handleAddShips(ws, data, db, wss) {
    console.log('handleAddShips - TODO');
}
function handleAttack(ws, data, db, wss) {
    console.log('handleAttack - TODO');
}
function handleRandomAttack(ws, data, db, wss) {
    console.log('handleRandomAttack - TODO');
}
