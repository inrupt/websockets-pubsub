import { Server } from '../../src/server'

let server: Server

export function startServer (port: number) {
  server = new Server(port, `http://localhost:${port}`, new URL('https://localhost:8443/profile/card#me'))
  server.listen()
}

export function stopServer () {
  server.close()
}
