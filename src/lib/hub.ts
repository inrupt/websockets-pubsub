import * as http from 'http'
import Debug from 'debug'
import { checkAccess, AccessCheckTask, Path, TaskType, BlobTree, determineWebId } from 'wac-ldp'

const debug = Debug('server')

const BEARER_PREFIX = 'Bearer '
const SUBSCRIBE_COMMAND_PREFIX = 'sub '

interface Client {
  webSocket: any,
  webId: string,
  origin: string,
  subscriptions: Array<string>
}

function getOrigin (headers: http.IncomingHttpHeaders): string | undefined {
  if (Array.isArray(headers.origin)) {
    return headers.origin[0]
  }
  return headers.origin
}

function getWebId (headers: http.IncomingHttpHeaders, aud: string): Promise<string | undefined> {
  let header
  if (Array.isArray(headers.authorization)) {
    header = headers.authorization[0]
  } else {
    header = headers.authorization
  }
  if (typeof header !== 'string') {
    return Promise.resolve(undefined)
  }
  if (header.length < BEARER_PREFIX.length) {
    return Promise.resolve(undefined)
  }
  return determineWebId(header.substring(BEARER_PREFIX.length), aud)
}

function hasPrefix (longString: string, shortString: string) {
  const length = shortString.length
  if (longString.length < length) {
    return false
  }
  return (longString.substring(0, length) === shortString)
}

function hasAccess (webId: string, origin: string, path: Path, storage: BlobTree) {
  return checkAccess({
    path,
    isContainer: false,
    webId,
    origin,
    wacLdpTaskType: TaskType.blobRead,
    storage
  } as AccessCheckTask)
}

export class Hub {
  clients: Array<Client>
  aud: string
  constructor (aud: string) {
    this.aud = aud
    this.clients = []
  }
  async handleConnection (ws: any, upgradeRequest: http.IncomingMessage): Promise<void> {
    const newClient = {
      webSocket: ws,
      webId: await getWebId(upgradeRequest.headers, this.aud),
      origin: getOrigin(upgradeRequest.headers),
      subscriptions: []
    } as Client
    ws.on('message', function incoming (message: string): void {
      debug('received: %s', message)
      if (message.substring(0, SUBSCRIBE_COMMAND_PREFIX.length) === SUBSCRIBE_COMMAND_PREFIX) {
        newClient.subscriptions.push(message.substring(SUBSCRIBE_COMMAND_PREFIX.length))
        debug(`Client now subscribed to:`, newClient.subscriptions)
      }
    })
    this.clients.push(newClient)
  }

  publishChange (path: Path, storage: BlobTree) {
    this.clients.map(async (client) => {
      client.subscriptions.map(subscription => {
        if (hasPrefix(path.toString(), subscription) && hasAccess(client.webId, client.origin, path, storage)) {
          client.webSocket.send(`pub ${path.toString()}`)
        }
      })
    })
  }
}
