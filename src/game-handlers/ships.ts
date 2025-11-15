import { WebSocket } from "ws";
import { GameDatabase } from "../game-db/game-database";
import { sendMessage, sendError } from "../websocket_server/utils";
import { AddShipsData, StartGameData, Ship } from "../types/types";

// direction: true = vertical (increases along Y),
// false = horizontal (increases along X)

function isAddShipsData(data: unknown): data is AddShipsData {
  return (
    typeof data === "object" &&
    data !== null &&
    "gameId" in data &&
    "ships" in data &&
    "indexPlayer" in data &&
    Array.isArray((data as AddShipsData).ships) &&
    typeof (data as AddShipsData).indexPlayer === "number"
  );
}

function validateShips(ships: Ship[]): { isValid: boolean; error?: string } {
  const shipCounts = { huge: 0, large: 0, medium: 0, small: 0 };
  const expectedCounts = { huge: 1, large: 2, medium: 3, small: 4 };

  for (const ship of ships) {
    if (!["huge", "large", "medium", "small"].includes(ship.type)) {
      return { isValid: false, error: `Invalid ship type: ${ship.type}` };
    }

    const expectedLength = { huge: 4, large: 3, medium: 2, small: 1 }[
      ship.type
    ];
    if (ship.length !== expectedLength) {
      return {
        isValid: false,
        error: `Ship type "${ship.type}" must have length ${expectedLength}, got ${ship.length}`,
      };
    }

    shipCounts[ship.type]++;
  }

  // correct number of ships of each type
  for (const [type, expectedCount] of Object.entries(expectedCounts)) {
    const actualCount = shipCounts[type as keyof typeof shipCounts];
    if (actualCount !== expectedCount) {
      return {
        isValid: false,
        error: `Expected ${expectedCount} ${type} ship(s), got ${actualCount}`,
      };
    }
  }

  // ship positions and overlaps
  const occupiedCells = new Set<string>();
  const shipCells = new Map<string, number>(); // cell -> ship index

  for (let shipIndex = 0; shipIndex < ships.length; shipIndex++) {
    const ship = ships[shipIndex];
    const { x, y } = ship.position;

    // initial position is within bounds
    if (x < 0 || x >= 10 || y < 0 || y >= 10) {
      return {
        isValid: false,
        error: `Ship ${shipIndex + 1} position out of bounds: (${x}, ${y})`,
      };
    }

    // the ship fits on the board
    const endX = ship.direction ? x : x + ship.length - 1;
    const endY = ship.direction ? y + ship.length - 1 : y;

    if (endX >= 10 || endY >= 10) {
      return {
        isValid: false,
        error: `Ship ${shipIndex + 1} extends beyond field boundaries: from (${x}, ${y}) to (${endX}, ${endY})`,
      };
    }

    // each cell of the current ship
    const currentShipCells: string[] = [];
    for (let i = 0; i < ship.length; i++) {
      const cellX = ship.direction ? x : x + i;
      const cellY = ship.direction ? y + i : y;
      const cellKey = `${cellX},${cellY}`;

      currentShipCells.push(cellKey);

      // overlaps with other ships
      if (occupiedCells.has(cellKey)) {
        const overlappingShipIndex = shipCells.get(cellKey);
        return {
          isValid: false,
          error: `Ship ${shipIndex + 1} overlaps with ship ${(overlappingShipIndex || 0) + 1} at position (${cellX}, ${cellY})`,
        };
      }

      occupiedCells.add(cellKey);
      shipCells.set(cellKey, shipIndex);
    }

    // distance between ships (no touching, including diagonals)
    for (const cellKey of currentShipCells) {
      const [cellX, cellY] = cellKey.split(",").map(Number);

      // all 8 surrounding cells
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          if (dx === 0 && dy === 0) continue; // Skip the ship cell itself

          const adjacentX = cellX + dx;
          const adjacentY = cellY + dy;
          const adjacentKey = `${adjacentX},${adjacentY}`;

          // Skip if adjacent cell is out of bounds
          if (
            adjacentX < 0 ||
            adjacentX >= 10 ||
            adjacentY < 0 ||
            adjacentY >= 10
          ) {
            continue;
          }

          // Skip if adjacent cell belongs to the same ship
          if (currentShipCells.includes(adjacentKey)) {
            continue;
          }

          // Check if adjacent cell is occupied by another ship
          if (occupiedCells.has(adjacentKey)) {
            const adjacentShipIndex = shipCells.get(adjacentKey);
            return {
              isValid: false,
              error: `Ship ${shipIndex + 1} is too close to ship ${(adjacentShipIndex || 0) + 1} at position (${cellX}, ${cellY}) - ships must be separated by at least one empty cell`,
            };
          }
        }
      }
    }
  }

  return { isValid: true };
}

function placeShipsOnBoard(ships: Ship[]): string[][] {
  const board = Array(10)
    .fill(null)
    .map(() => Array(10).fill("empty"));

  for (let shipIndex = 0; shipIndex < ships.length; shipIndex++) {
    const ship = ships[shipIndex];
    const { x, y } = ship.position;

    for (let i = 0; i < ship.length; i++) {
      const cellX = ship.direction ? x : x + i;
      const cellY = ship.direction ? y + i : y;

      if (cellX >= 0 && cellX < 10 && cellY >= 0 && cellY < 10) {
        board[cellY][cellX] = "ship";
      }
    }
  }

  return board;
}

export function handleAddShips(
  ws: WebSocket,
  data: unknown,
  db: GameDatabase
): void {
  try {
    if (!isAddShipsData(data)) {
      sendError(ws, "Invalid add_ships data format");
      return;
    }

    const { gameId, ships, indexPlayer } = data;

    const player = db.findPlayerByWebSocket(ws);
    if (!player) {
      sendError(ws, "Player not found");
      return;
    }

    if (player.index !== indexPlayer) {
      sendError(
        ws,
        `Player ID mismatch: expected ${player.index}, got ${indexPlayer}`
      );
      return;
    }

    const game = db.getGame(gameId);
    if (!game) {
      sendError(ws, `Game not found: ${gameId}`);
      return;
    }

    const gamePlayer = game.players.find((p) => p.index === indexPlayer);
    if (!gamePlayer) {
      sendError(ws, `Player not found in game: ${indexPlayer}`);
      return;
    }

    if (gamePlayer.ships.length > 0) {
      sendError(ws, "Ships already placed for this player");
      return;
    }

    // Detailed logging of received ships for debugging
    console.log(
      `🔍 Player "${player.name}" (ID: ${player.index}) sent ships for validation:`
    );
    ships.forEach((ship, index) => {
      const endX = ship.direction
        ? ship.position.x
        : ship.position.x + ship.length - 1;
      const endY = ship.direction
        ? ship.position.y + ship.length - 1
        : ship.position.y;
      console.log(
        `  Ship ${index + 1}: ${ship.type} (length: ${ship.length}), position: (${ship.position.x}, ${ship.position.y}), direction: ${ship.direction ? "vertical" : "horizontal"}, end: (${endX}, ${endY})`
      );
    });

    const validation = validateShips(ships);
    if (!validation.isValid) {
      console.log(
        `❌ Ship validation failed for player "${player.name}": ${validation.error}`
      );
      sendError(ws, `Invalid ships: ${validation.error}`);
      return;
    }

    //  Save ships and update board
    gamePlayer.ships = ships;
    gamePlayer.board = placeShipsOnBoard(ships);

    console.log(
      `*** Player "${player.name}" (ID: ${player.index}) placed ${ships.length} ships in game ${gameId}`
    );

    // Check if both players have placed ships
    const allPlayersReady = game.players.every((p) => p.ships.length > 0);

    if (allPlayersReady) {
      console.log(
        `✅ Game ${gameId} is ready to start - both players placed ships`
      );

      game.isStarted = true;

      // Send start_game to each player (with their ships)
      for (const gamePlayer of game.players) {
        const playerWs = db.getPlayerConnection(gamePlayer.index);
        if (playerWs) {
          const startGameData: StartGameData = {
            ships: gamePlayer.ships, // Send only this player's ships
            currentPlayerIndex: game.currentPlayerIndex, // Who goes first
          };

          sendMessage(playerWs, {
            type: "start_game",
            data: startGameData,
            id: 0,
          });

          console.log(`*** Sent start_game to player ${gamePlayer.index}`);
        }
      }

      console.log(
        `✅ Game ${gameId} started! Current player: ${game.currentPlayerIndex}`
      );
    } else {
      console.log(
        `*** Game ${gameId} waiting for other player(s) to place ships`
      );
    }
  } catch (error) {
    console.error("❌ Error in handleAddShips:", error);
    sendError(ws, "Internal server error while placing ships");
  }
}
export { validateShips, placeShipsOnBoard };
