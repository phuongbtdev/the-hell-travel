import { Server } from 'colyseus';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { UnderworldRoom } from './UnderworldRoom.js';

const port = Number(process.env.PORT ?? 2567);
const server = new Server({ transport: new WebSocketTransport() });
server.define('underworld_hall', UnderworldRoom);
server.listen(port).then(() => {
  console.log(`Underworld Colyseus server listening on http://localhost:${port}`);
});
