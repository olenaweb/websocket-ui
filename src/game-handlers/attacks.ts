import { WebSocket } from "ws";
import { GameDatabase } from "../game-db/game-database";
import { sendMessage, sendError } from "../websocket_server/utils";
import {
  AttackData,
  RandomAttackData,
  AttackResponse,
  TurnData,
  FinishData,
  GamePlayer,
  GameState,
} from "../types/types";

function isAttackData(data: unknown): data is AttackData {
  return (
    typeof data === "object" &&
    data !== null &&
    "gameId" in data &&
    "x" in data &&
    "y" in data &&
    "indexPlayer" in data &&
    typeof (data as AttackData).x === "number" &&
    typeof (data as AttackData).y === "number" &&
    typeof (data as AttackData).indexPlayer === "number"
  );
}

function isRandomAttackData(data: unknown): data is RandomAttackData {
  return (
    typeof data === "object" &&
    data !== null &&
    "gameId" in data &&
    "indexPlayer" in data &&
    typeof (data as RandomAttackData).indexPlayer === "number"
  );
}

function processAttack(
  targetPlayer: GamePlayer,
  x: number,
  y: number
): {
  status: "miss" | "shot" | "killed";
  isShipDestroyed: boolean;
  destroyedShipCells?: Array<{ x: number; y: number }>;
} {
  if (x < 0 || x >= 10 || y < 0 || y >= 10) {
    throw new Error("Attack coordinates out of bounds");
  }

  const currentCell = targetPlayer.board[y][x];
  if (currentCell === "hit" || currentCell === "miss") {
    throw new Error("Cell already attacked");
  }

  if (currentCell === "ship") {
    targetPlayer.board[y][x] = "hit";

    const destroyedShip = checkIfShipDestroyed(targetPlayer, x, y);

    if (destroyedShip) {
      console.log(`✅ Ship destroyed at (${x}, ${y})!`);
      return {
        status: "killed",
        isShipDestroyed: true,
        destroyedShipCells: destroyedShip.cells,
      };
    } else {
      console.log(`*** Hit at (${x}, ${y})!`);
      return {
        status: "shot",
        isShipDestroyed: false,
      };
    }
  } else {
    targetPlayer.board[y][x] = "miss";
    console.log(`*** Miss at (${x}, ${y})`);
    return {
      status: "miss",
      isShipDestroyed: false,
    };
  }
}

function checkIfShipDestroyed(
  player: GamePlayer,
  hitX: number,
  hitY: number
): { cells: Array<{ x: number; y: number }> } | null {
  const shipCells: Array<{ x: number; y: number }> = [];

  let minX = hitX,
    maxX = hitX;

  // the left boundary
  while (
    minX > 0 &&
    (player.board[hitY][minX - 1] === "ship" ||
      player.board[hitY][minX - 1] === "hit")
  ) {
    minX--;
  }

  // the right boundary
  while (
    maxX < 9 &&
    (player.board[hitY][maxX + 1] === "ship" ||
      player.board[hitY][maxX + 1] === "hit")
  ) {
    maxX++;
  }

  // horizontal direction
  if (minX !== maxX) {
    for (let x = minX; x <= maxX; x++) {
      if (player.board[hitY][x] === "ship" || player.board[hitY][x] === "hit") {
        shipCells.push({ x, y: hitY });
      }
    }
  } else {
    // vertical direction
    let minY = hitY,
      maxY = hitY;

    // top boundary
    while (
      minY > 0 &&
      (player.board[minY - 1][hitX] === "ship" ||
        player.board[minY - 1][hitX] === "hit")
    ) {
      minY--;
    }

    // bottom boundary
    while (
      maxY < 9 &&
      (player.board[maxY + 1][hitX] === "ship" ||
        player.board[maxY + 1][hitX] === "hit")
    ) {
      maxY++;
    }

    for (let y = minY; y <= maxY; y++) {
      if (player.board[y][hitX] === "ship" || player.board[y][hitX] === "hit") {
        shipCells.push({ x: hitX, y });
      }
    }
  }

  const allHit = shipCells.every(
    (cell) => player.board[cell.y][cell.x] === "hit"
  );

  if (allHit && shipCells.length > 0) {
    return { cells: shipCells };
  }

  return null;
}

function markAroundDestroyedShip(
  player: GamePlayer,
  shipCells: Array<{ x: number; y: number }>
): Array<{ x: number; y: number }> {
  const missedCells: Array<{ x: number; y: number }> = [];

  for (const cell of shipCells) {
    // 8 surrounding cells
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue; // Skip the ship cell itself

        const x = cell.x + dx;
        const y = cell.y + dy;

        // field boundaries
        if (x >= 0 && x < 10 && y >= 0 && y < 10) {
          if (player.board[y][x] === "empty") {
            player.board[y][x] = "miss";
            missedCells.push({ x, y });
          }
        }
      }
    }
  }

  return missedCells;
}

function checkGameEnd(game: GameState): number | null {
  for (const player of game.players) {
    const hasAliveShips = player.board.some((row: string[]) =>
      row.some((cell: string) => cell === "ship")
    );

    if (!hasAliveShips) {
      const winner = game.players.find(
        (p: GamePlayer) => p.index !== player.index
      );
      return winner ? winner.index : null;
    }
  }

  return null; // Game continues
}

function switchTurn(game: GameState): void {
  const currentIndex = game.players.findIndex(
    (p: GamePlayer) => p.index === game.currentPlayerIndex
  );
  const nextIndex = (currentIndex + 1) % game.players.length;
  game.currentPlayerIndex = game.players[nextIndex].index;
}

function broadcastAttackResult(
  game: GameState,
  db: GameDatabase,
  attackResult: AttackResponse,
  missedAroundShip?: Array<{ x: number; y: number }>
): void {
  for (const gamePlayer of game.players) {
    const playerWs = db.getPlayerConnection(gamePlayer.index);
    if (playerWs) {
      sendMessage(playerWs, {
        type: "attack",
        data: attackResult,
        id: 0,
      });
    }
  }

  // If the ship is destroyed, send misses around the ship
  if (missedAroundShip && missedAroundShip.length > 0) {
    for (const missCell of missedAroundShip) {
      for (const gamePlayer of game.players) {
        const playerWs = db.getPlayerConnection(gamePlayer.index);
        if (playerWs) {
          sendMessage(playerWs, {
            type: "attack",
            data: {
              position: { x: missCell.x, y: missCell.y },
              currentPlayer: attackResult.currentPlayer,
              status: "miss",
            },
            id: 0,
          });
        }
      }
    }
  }
}

function broadcastTurn(game: GameState, db: GameDatabase): void {
  const turnData: TurnData = {
    currentPlayer: game.currentPlayerIndex,
  };

  for (const gamePlayer of game.players) {
    const playerWs = db.getPlayerConnection(gamePlayer.index);
    if (playerWs) {
      sendMessage(playerWs, {
        type: "turn",
        data: turnData,
        id: 0,
      });
    }
  }
}

function broadcastGameEnd(
  game: GameState,
  db: GameDatabase,
  winnerId: number
): void {
  const finishData: FinishData = {
    winPlayer: winnerId,
  };

  for (const gamePlayer of game.players) {
    const playerWs = db.getPlayerConnection(gamePlayer.index);
    if (playerWs) {
      sendMessage(playerWs, {
        type: "finish",
        data: finishData,
        id: 0,
      });
    }
  }

  const winner = db.getPlayerById(winnerId);
  if (winner) {
    winner.wins++;
    console.log(
      `✅ Player "${winner.name}" won the game! Total wins: ${winner.wins}`
    );
  }
}

export function handleAttack(
  ws: WebSocket,
  data: unknown,
  db: GameDatabase
): void {
  try {
    if (!isAttackData(data)) {
      sendError(ws, "Invalid attack data format");
      return;
    }

    const { gameId, x, y, indexPlayer } = data;

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

    if (!game.isStarted) {
      sendError(ws, "Game not started yet");
      return;
    }

    if (game.currentPlayerIndex !== indexPlayer) {
      sendError(ws, "Not your turn");
      return;
    }

    const targetPlayer = game.players.find(
      (p: GamePlayer) => p.index !== indexPlayer
    );
    if (!targetPlayer) {
      sendError(ws, "Target player not found");
      return;
    }

    console.log(`*** Player ${indexPlayer} attacks (${x}, ${y})`);

    try {
      const result = processAttack(targetPlayer, x, y);

      const attackResponse: AttackResponse = {
        position: { x, y },
        currentPlayer: game.currentPlayerIndex,
        status: result.status,
      };

      let missedAroundShip: Array<{ x: number; y: number }> | undefined;

      // ship is destroyed, mark the cells around it as misses
      if (result.isShipDestroyed && result.destroyedShipCells) {
        missedAroundShip = markAroundDestroyedShip(
          targetPlayer,
          result.destroyedShipCells
        );
      }

      broadcastAttackResult(game, db, attackResponse, missedAroundShip);

      const winnerId = checkGameEnd(game);
      if (winnerId !== null) {
        console.log(`✅ Game ${gameId} ended! Winner: ${winnerId}`);
        broadcastGameEnd(game, db, winnerId);
        return;
      }

      if (result.status === "miss") {
        switchTurn(game);
      }
      broadcastTurn(game, db);
    } catch (attackError) {
      if (attackError instanceof Error) {
        sendError(ws, attackError.message);
      } else {
        sendError(ws, "Invalid attack");
      }
    }
  } catch (error) {
    console.error("❌ Error in handleAttack:", error);
    sendError(ws, "Internal server error during attack");
  }
}

export function handleRandomAttack(
  ws: WebSocket,
  data: unknown,
  db: GameDatabase
): void {
  try {
    if (!isRandomAttackData(data)) {
      sendError(ws, "Invalid random attack data format");
      return;
    }

    const { gameId, indexPlayer } = data;

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

    if (!game.isStarted) {
      sendError(ws, "Game not started yet");
      return;
    }

    if (game.currentPlayerIndex !== indexPlayer) {
      sendError(ws, "Not your turn");
      return;
    }

    const targetPlayer = game.players.find(
      (p: GamePlayer) => p.index !== indexPlayer
    );
    if (!targetPlayer) {
      sendError(ws, "Target player not found");
      return;
    }

    // not yet attacked
    const availableCells: Array<{ x: number; y: number }> = [];
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 10; x++) {
        if (
          targetPlayer.board[y][x] === "empty" ||
          targetPlayer.board[y][x] === "ship"
        ) {
          availableCells.push({ x, y });
        }
      }
    }

    if (availableCells.length === 0) {
      sendError(ws, "No available cells for random attack");
      return;
    }

    const randomIndex = Math.floor(Math.random() * availableCells.length);
    const { x, y } = availableCells[randomIndex];

    console.log(
      `*** Player ${indexPlayer} makes random attack at (${x}, ${y})`
    );

    const attackData: AttackData = {
      gameId,
      x,
      y,
      indexPlayer,
    };

    handleAttack(ws, attackData, db);
  } catch (error) {
    console.error("❌ Error in handleRandomAttack:", error);
    sendError(ws, "Internal server error during random attack");
  }
}
