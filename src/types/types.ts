import { WebSocket } from 'ws';

export interface Player {
  name: string;
  password: string;
  index: number;
  wins: number;
  ws?: WebSocket;
}

export interface Room {
  roomId: number;
  players: Player[];
  gameState?: GameState;
}

export interface GameState {
  gameId: number;
  players: GamePlayer[];
  currentPlayerIndex: number;
  isStarted: boolean;
}

export interface GamePlayer {
  index: number;
  ships: Ship[];
  board: string[][]; // 'empty', 'ship', 'hit', 'miss'
}

export interface Ship {
  position: { x: number; y: number };
  direction: boolean;
  length: number;
  type: 'small' | 'medium' | 'large' | 'huge';
}

export interface WSMessage {
  type: string;
  data: unknown;
  id: number;
}

//  Types for message data
export interface RegistrationData {
  name: string;
  password: string;
}

export interface RegistrationResponse {
  name: string;
  index: number;
  error: boolean;
  errorText: string;
}

export interface AddUserToRoomData {
  indexRoom: number;
}

export interface CreateRoomData {
  // Empty string according to specification
}

export interface CreateGameData {
  idGame: number;
  idPlayer: number;
}

export interface AddShipsData {
  gameId: number;
  ships: Ship[];
  indexPlayer: number;
}

export interface StartGameData {
  ships: Ship[];
  currentPlayerIndex: number;
}

export interface AttackData {
  gameId: number;
  x: number;
  y: number;
  indexPlayer: number;
}

export interface RandomAttackData {
  gameId: number;
  indexPlayer: number;
}

export interface AttackResponse {
  position: { x: number; y: number };
  currentPlayer: number;
  status: 'miss' | 'killed' | 'shot';
}

export interface TurnData {
  currentPlayer: number;
}

export interface FinishData {
  winPlayer: number;
}

export interface RoomData {
  roomId: number;
  roomUsers: Array<{
    name: string;
    index: number;
  }>;
}

export interface WinnerData {
  name: string;
  wins: number;
}

// Array types for responses
export type UpdateRoomResponse = RoomData[];
export type UpdateWinnersResponse = WinnerData[];

// Union type for all possible message data types
export type MessageDataType =
  | RegistrationData
  | RegistrationResponse
  | CreateRoomData
  | AddUserToRoomData
  | CreateGameData
  | AddShipsData
  | StartGameData
  | AttackData
  | RandomAttackData
  | AttackResponse
  | TurnData
  | FinishData
  | UpdateRoomResponse
  | UpdateWinnersResponse
  | string; // For empty data

// General type for sent messages
export interface WSResponse<T = MessageDataType> {
  type: string;
  data: T;
  id: number;
}