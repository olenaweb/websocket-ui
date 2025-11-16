import { WebSocket } from "ws";
import { GameDatabase } from "../game-db/game-database";
import { sendMessage, sendError } from "../websocket_server/utils";
import { logShipsPlacement } from "./ships";
import {
  Ship,
  CreateGameData,
  UpdateRoomResponse,
  AttackData,
  Player,
} from "../types/types";

function createBot(): { name: string; index: number; wins: number } {
  return {
    name: "Bot",
    index: -1,
    wins: 0,
  };
}

function generateBotShips(): Ship[] {
  const ships: Ship[] = [];
  const board = Array(10)
    .fill(null)
    .map(() => Array(10).fill(false));

  const shipTypes = [
    { type: "huge" as const, length: 4, count: 1 },
    { type: "large" as const, length: 3, count: 2 },
    { type: "medium" as const, length: 2, count: 3 },
    { type: "small" as const, length: 1, count: 4 },
  ];

  for (const shipType of shipTypes) {
    for (let i = 0; i < shipType.count; i++) {
      let placed = false;
      let attempts = 0;
      // true = vertical, false = horizontal
      while (!placed && attempts < 100) {
        const direction = Math.random() < 0.5;
        const x = Math.floor(Math.random() * 10);
        const y = Math.floor(Math.random() * 10);

        if (canPlaceShip(board, x, y, shipType.length, direction)) {
          placeShipOnBoard(board, x, y, shipType.length, direction);
          ships.push({
            position: { x, y },
            direction,
            length: shipType.length,
            type: shipType.type,
          });
          placed = true;
        }
        attempts++;
      }
    }
  }

  return ships;
}

function canPlaceShip(
  board: boolean[][],
  x: number,
  y: number,
  length: number,
  direction: boolean
): boolean {
  // boundaries
  const endX = direction ? x : x + length - 1;
  const endY = direction ? y + length - 1 : y;

  if (endX >= 10 || endY >= 10) return false;

  // cell occupancy and spacing
  for (let i = 0; i < length; i++) {
    const cellX = direction ? x : x + i;
    const cellY = direction ? y + i : y;

    // ship cell and all around it
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const checkX = cellX + dx;
        const checkY = cellY + dy;

        if (checkX >= 0 && checkX < 10 && checkY >= 0 && checkY < 10) {
          if (board[checkY][checkX]) return false;
        }
      }
    }
  }

  return true;
}

function placeShipOnBoard(
  board: boolean[][],
  x: number,
  y: number,
  length: number,
  direction: boolean
): void {
  for (let i = 0; i < length; i++) {
    const cellX = direction ? x : x + i;
    const cellY = direction ? y + i : y;
    board[cellY][cellX] = true;
  }
}

function createBotBoard(ships: Ship[]): string[][] {
  const board = Array(10)
    .fill(null)
    .map(() => Array(10).fill("empty"));

  for (const ship of ships) {
    const { x, y } = ship.position;
    for (let i = 0; i < ship.length; i++) {
      const cellX = ship.direction ? x : x + i;
      const cellY = ship.direction ? y + i : y;
      board[cellY][cellX] = "ship";
    }
  }

  return board;
}

export function handleSinglePlay(
  ws: WebSocket,
  data: unknown,
  db: GameDatabase
): void {
  try {
    const player = db.findPlayerByWebSocket(ws);
    if (!player) {
      sendError(ws, "Player not found");
      return;
    }

    console.log(`*** Player "${player.name}" started single player mode`);

    const room = db.createRoom(player);

    const bot = createBot();
    room.players.push(bot as unknown as Player);

    console.log(`*** Room ${room.roomId} created for single player mode`);

    const game = db.createGame(room);

    // Generating ships for the bot
    const botShips = generateBotShips();
    const botBoard = createBotBoard(botShips);

    const botPlayer = game.players.find((p) => p.index === -1);
    if (botPlayer) {
      botPlayer.ships = botShips;
      botPlayer.board = botBoard;
      console.log(`*** Bot placed ${botShips.length} ships automatically`);

      // Use the shared logging function for bot ships
      logShipsPlacement(botShips, "Bot ships", -1);
    }

    broadcastRoomUpdates(db);

    const createGameData: CreateGameData = {
      idGame: game.gameId,
      idPlayer: player.index,
    };

    sendMessage(ws, {
      type: "create_game",
      data: createGameData,
      id: 0,
    });

    console.log(`*** Game ${game.gameId} created for single player mode`);

    broadcastRoomUpdates(db);
  } catch (error) {
    console.error("❌ Error in handleSinglePlay:", error);
    sendError(ws, "Internal server error in single player mode");
  }
}

function broadcastRoomUpdates(db: GameDatabase): void {
  const rooms = db.getAvailableRooms();
  const roomData: UpdateRoomResponse = rooms.map((room) => ({
    roomId: room.roomId,
    roomUsers: room.players.map((player) => ({
      name: player.name,
      index: player.index,
    })),
  }));

  const allPlayers = db.getAllPlayers();
  for (const player of allPlayers) {
    const playerWs = db.getPlayerConnection(player.index);
    if (playerWs) {
      sendMessage(playerWs, {
        type: "update_room",
        data: roomData,
        id: 0,
      });
    }
  }
}

export function makeBotMove(gameId: number, db: GameDatabase): void {
  const game = db.getGame(gameId);
  if (!game || !game.isStarted) return;

  if (game.currentPlayerIndex !== -1) return;

  const humanPlayer = game.players.find((p) => p.index !== -1);
  if (!humanPlayer) return;

  const availableCells: Array<{ x: number; y: number }> = [];
  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 10; x++) {
      if (
        humanPlayer.board[y][x] === "empty" ||
        humanPlayer.board[y][x] === "ship"
      ) {
        availableCells.push({ x, y });
      }
    }
  }

  if (availableCells.length === 0) return;

  const randomIndex = Math.floor(Math.random() * availableCells.length);
  const { x, y } = availableCells[randomIndex];

  console.log(`🤖 Bot attacks (${x}, ${y})`);

  setTimeout(
    async () => {
      try {
        await simulateBotAttack(gameId, x, y, db);
      } catch (error) {
        console.error("❌ Error in bot attack:", error);
      }
    },
    100 + Math.random() * 2000
  );
}

async function simulateBotAttack(
  gameId: number,
  x: number,
  y: number,
  db: GameDatabase
): Promise<void> {
  const game = db.getGame(gameId);
  if (!game) return;

  const humanPlayer = game.players.find((p) => p.index !== -1);
  const botPlayer = game.players.find((p) => p.index === -1);
  if (!humanPlayer || !botPlayer) return;

  const { handleAttack } = await import("./attacks");

  // stub WebSocket for the bot
  const botWs = {
    send: () => { },
    readyState: 1,
    close: () => { },
    addEventListener: () => { },
    removeEventListener: () => { },
    isBot: true,
  } as unknown as WebSocket;

  const attackData: AttackData = {
    gameId,
    x,
    y,
    indexPlayer: -1,
  };

  handleAttack(botWs, attackData, db);
}
