import { WebSocket } from "ws";
import { Player, Room, GameState } from "../types/types";
export class GameDatabase {
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
        const existingConnection = this.getPlayerConnection(
          existingPlayer.index
        );
        if (existingConnection) {
          throw new Error(`Player "${name}" is already connected`);
        }
        return existingPlayer;
      } else {
        throw new Error("Wrong password");
      }
    }

    const newPlayer: Player = {
      name,
      password,
      index: this.nextPlayerId++,
      wins: 0,
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

  getPlayerById(playerId: number): Player | undefined {
    for (const player of this.players.values()) {
      if (player.index === playerId) {
        return player;
      }
    }
    return undefined;
  }

  updatePlayerWins(playerId: number): void {
    const player = this.getPlayerById(playerId);
    if (player) {
      player.wins++;
    }
  }

  // Methods for working with rooms
  createRoom(player: Player): Room {
    const room: Room = {
      roomId: this.nextRoomId++,
      players: [player],
    };

    this.rooms.set(room.roomId, room);
    return room;
  }

  getRoom(roomId: number): Room | undefined {
    return this.rooms.get(roomId);
  }

  getAvailableRooms(): Room[] {
    return Array.from(this.rooms.values()).filter(
      (room) => room.players.length === 1
    );
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
      players: room.players.map((p) => ({
        index: p.index,
        ships: [],
        board: Array(10)
          .fill(null)
          .map(() => Array(10).fill("empty")),
      })),
      currentPlayerIndex: room.players[0].index,
      isStarted: false,
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

  findPlayerByWebSocket(ws: WebSocket): Player | undefined {
    for (const [playerId, connection] of this.playerConnections) {
      if (connection === ws) {
        return this.getPlayerById(playerId);
      }
    }
    return undefined;
  }
}
