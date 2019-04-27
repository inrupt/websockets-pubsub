import * as http from 'http'
import Debug from 'debug'

const debug = Debug('server')

class Server {
  server: http.Server
  port: number
  constructor (port: number) {
    this.port = port
    const handler = (req: http.IncomingMessage, res: http.ServerResponse): void => { res.end('TODO: implement') }
    this.server = http.createServer(handler)
  }
  listen () {
    this.server.listen(this.port)
    debug('listening on port', this.port)
  }
  close () {
    this.server.close()
    debug('closing port', this.port)
  }
}

// on startup:
const port = parseInt(process.env.PORT ? process.env.PORT : '', 10) || 8080
const server = new Server(port)
server.listen()

export function closeServer () {
  debug('closing server')
  server.close()
}
