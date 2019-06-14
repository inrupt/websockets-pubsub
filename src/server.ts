import * as http from 'http'
import Debug from 'debug'
import { BlobTreeInMem, BlobTree, WacLdp } from 'wac-ldp'
import * as WebSocket from 'ws'
import { Hub } from './lib/hub'

const debug = Debug('server')

export class Server {
  storage: BlobTree
  wacLdp: WacLdp
  server: http.Server
  hub: Hub
  port: number
  wsServer: any
  constructor (port: number, aud: string, skipWac: boolean) {
    this.port = port
    this.storage = new BlobTreeInMem() // singleton in-memory storage
    this.wacLdp = new WacLdp(this.storage, aud, new URL(`ws://localhost:${this.port}/`), skipWac)
    this.server = http.createServer(this.wacLdp.handler.bind(this.wacLdp))
    this.wsServer = new WebSocket.Server({
      server: this.server
    })
    this.hub = new Hub(this.wacLdp, aud)
    this.wsServer.on('connection', this.hub.handleConnection.bind(this.hub))
    this.wacLdp.on('change', (event: { url: URL }) => {
      debug('change event from this.wacLdp!', event.url)
      this.hub.publishChange(event.url)
    })
  }
  listen () {
    this.server.listen(this.port)
    debug('listening on port', this.port)
  }
  close () {
    this.server.close()
    this.wsServer.close()
    debug('closing port', this.port)
  }
}

// // on startup:
// const port = parseInt((process.env.PORT ? process.env.PORT : ''), 10) || 8080

// const aud = process.env.AUD || 'https://localhost:8443'
// const server = new Server(port, aud)
// server.listen()
// // server.close()

// export function closeServer () {
//   debug('closing server')
//   server.close()
// }
