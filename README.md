# RSSchool NodeJS websocket task
> Static http server and base task packages. 
> By default WebSocket client tries to connect to the 3000 port.

## Installation
`git clone https://github.com/olenaweb/websocket-ui.git`

`git checkout -b develop origin/develop`

`npm install`


## Usage
1.**Development**

running TypeScript files directly from sources using tsx:
`npm run start:dev` -> `npx tsx ./index.ts`

launch with automatic reboot when files change:
`npm run start:watch` -> `"nodemon --exec \"npx tsx ./index.ts\""`

* App served @ `http://localhost:3000` with nodemon

2.**Production**

`npm run start` -> `"start": "webpack --config webpack.config.cjs && node ./dist/index.cjs"`

* App served @ `http://localhost:3000` without nodemon

---

3.**All commands**

Command | Description
--- | ---
`npm run start:dev` | App served @ `http://localhost:3000` without nodemon
`npm run start:watch` | App served @ `http://localhost:3000` with nodemon
`npm run start` | App served @ `http://localhost:3000` without nodemon in Production


#### Code Checks
npm run lint         # Code style check

npm run type-check   # TypeScript type check

npm run fix          # Auto-fix errors

**Note**: replace `npm` with `yarn` in `package.json` if you use yarn.
