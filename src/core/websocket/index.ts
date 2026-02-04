import WebSocket from 'ws';

// Store connected clients
const clients: Set<WebSocket> = new Set();

export function addClient(ws: WebSocket) {
  clients.add(ws);
}

export function removeClient(ws: WebSocket) {
  clients.delete(ws);
}

export function broadcast(data: any) {
  const message = JSON.stringify(data);
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

export function getClientCount(): number {
  return clients.size;
}
