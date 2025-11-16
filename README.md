# Battleship WebSocket Game

> A multiplayer battleship game built with TypeScript, WebSocket, and Node.js. Features both multiplayer and single-player (vs bot) modes with real-time gameplay and winner leaderboard.

##  Game Features

- **Multiplayer Mode**: Play against other players in real-time
- **Single-player Mode**: Challenge an bot opponent
- **Real-time Communication**: WebSocket-based live gameplay
- **Ship Placement Validation**: Comprehensive rule checking
- **Winner Leaderboard**: Track victories across sessions
- **Room Management**: Create and join game rooms
- **TypeScript**: Full type safety with strict typing

##  Quick Start

### Installation

```bash
git clone https://github.com/olenaweb/websocket-ui.git
cd websocket-ui
git checkout -b develop origin/develop
npm install
```

### Development Mode

```bash
npm run start:dev
```
- Runs TypeScript files directly using `tsx`
- HTTP Server available at `http://localhost:3000`
- WebSocket server on `ws://localhost:3000`

### Development with Auto-reload

```bash
npm run start:watch
```
- Automatically restarts on file changes using `nodemon`

### Production Mode

```bash
npm run start
```
- Builds with webpack and runs optimized bundle
- Uses production configuration

## 📋 Available Commands

| Command | Description | Environment |
|---------|-------------|-------------|
| `npm run start:dev` | Direct TypeScript execution | Development |
| `npm run start:watch` | Auto-reload development server | Development |
| `npm run start` | Production build and run | Production |
| `npm run lint` | ESLint code style check | Any |
| `npm run type-check` | TypeScript type validation | Any |
| `npm run fix` | Auto-fix linting errors | Any |

##  Game Rules

- **Ship Types**: 1 huge (4 cells), 2 large (3 cells), 3 medium (2 cells), 4 small (1 cell)
- **Placement**: Ships cannot touch each other (including diagonally)
- **Turns**: Continue shooting on hit, switch turns on miss
- **Victory**: First player to sink all opponent ships wins

##  Architecture

- **Backend**: Node.js + TypeScript + WebSocket (`ws` library)
- **Frontend**: Static HTML/CSS/JS served by HTTP server
- **Database**: In-memory storage with persistent player sessions
- **Build**: Webpack for production bundling

##  Development Notes

- **ES Modules**: Full ESM support with TypeScript 5.9.3
- **Strict Typing**: No `any` types allowed
- **Bot single-player mode**: Automated opponent for single-player mode
- **Real-time Updates**: Live leaderboard and game state synchronization

---

**Note**: You can replace `npm` with `yarn` if preferred.
