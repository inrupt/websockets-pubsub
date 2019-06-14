import { Server } from '../../src/server'
let server: Server

test('server', async () => {
  server = new Server(8080, `http://localhost:${8080}`, new URL('https://localhost:8443/profile/card#me'))
  await server.listen()
  server.close()
})
