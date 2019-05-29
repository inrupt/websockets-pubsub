import { startServer, stopServer } from './helper'
import fetch from 'node-fetch'
import WebSocket from 'ws'

let wsClient: WebSocket
let received: Promise<string>

beforeEach(async () => {
  startServer(8081)
  wsClient = new WebSocket('ws://localhost:8081')
  received = new Promise((resolve) => {
    wsClient.on('message', function incoming (data) {
      resolve(data.toString())
    })
  })
  await new Promise((resolve) => {
    wsClient.on('open', function open () {
      wsClient.send('sub http://localhost:8081/asdf/')
      resolve(undefined)
    })
  })
})
afterEach(() => {
  wsClient.close()
  stopServer()
})

test.only('publishes a change event', async () => {
  await fetch('http://localhost:8081/asdf/test.txt', {
    method: 'PUT',
    body:  'hello'
  })
  const notif = await received
  expect(notif).toEqual('pub http://localhost:8081/asdf/test.txt')
})
