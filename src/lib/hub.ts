import * as http from 'http'
import Debug from 'debug'
import { WacLdp, determineWebId, ACL, BEARER_PARAM_NAME } from 'wac-ldp'

const debug = Debug('server')

const BEARER_PREFIX = 'Bearer '
const SUBSCRIBE_COMMAND_PREFIX = 'sub '

interface Client {
  webSocket: any
  webId: URL
  origin: string
  subscriptions: Array<URL>
}

function getOrigin (headers: http.IncomingHttpHeaders): string | undefined {
  if (Array.isArray(headers.origin)) {
    return headers.origin[0]
  }
  return headers.origin
}
function hasPrefix (longString: string, shortString: string) {
  const length = shortString.length
  if (longString.length < length) {
    return false
  }
  return (longString.substring(0, length) === shortString)
}

export class Hub {
  clients: Array<Client>
  wacLdp: WacLdp
  audience: string
  constructor (wacLdp: WacLdp, audience: string) {
    this.clients = []
    this.wacLdp = wacLdp
    this.audience = audience
  }
  async handleConnection (ws: any, upgradeRequest: http.IncomingMessage): Promise<void> {
    const newClient = {
      webSocket: ws,
      webId: await this.getWebId(upgradeRequest),
      origin: getOrigin(upgradeRequest.headers),
      subscriptions: []
    } as Client
    ws.on('message', function incoming (message: string): void {
      debug('received: %s', message)
      if (message.substring(0, SUBSCRIBE_COMMAND_PREFIX.length) === SUBSCRIBE_COMMAND_PREFIX) {
        newClient.subscriptions.push(new URL(message.substring(SUBSCRIBE_COMMAND_PREFIX.length)))
        debug(`Client now subscribed to:`, newClient.subscriptions)
      }
    })
    this.clients.push(newClient)
  }

  getWebIdFromAuthorizationHeader (headers: http.IncomingHttpHeaders): Promise<URL | undefined> {
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
    return determineWebId(header.substring(BEARER_PREFIX.length), this.audience)
  }

  getWebIdFromQueryParameter (url: URL): Promise<URL | undefined> {
    const bearerToken = url.searchParams.get(BEARER_PARAM_NAME)

    if (typeof bearerToken !== 'string') {
      return Promise.resolve(undefined)
    }
    debug('determining WebId from query parameter', bearerToken, this.audience)
    return determineWebId(bearerToken, this.audience)
  }

  async getWebId (httpReq: http.IncomingMessage): Promise<URL | undefined> {
    debug('getting WebId from upgrade request')
    const fromAuthorizationHeader = await this.getWebIdFromAuthorizationHeader(httpReq.headers)
    if (fromAuthorizationHeader) {
      debug('from authorization header')
      return fromAuthorizationHeader
    }
    if (httpReq.url) {
      debug('looking at url', httpReq.url, this.audience, new URL(httpReq.url, this.audience))
      return this.getWebIdFromQueryParameter(new URL(httpReq.url, this.audience))
    }
  }

  publishChange (url: URL) {
    debug('publishChange', url)
    this.clients.map(async (client) => {
      debug('publishChange client', url, client.subscriptions)
      client.subscriptions.map(subscription => {
        debug('hasPrefix', url.toString(), subscription.toString(), hasPrefix(url.toString(), subscription.toString()))
        debug('hasAccess', client.webId, client.origin, url, ACL.Read, this.wacLdp.hasAccess(client.webId, client.origin, url, ACL.Read))
        if (hasPrefix(url.toString(), subscription.toString()) && this.wacLdp.hasAccess(client.webId, client.origin, url, ACL.Read)) {
          client.webSocket.send(`pub ${url.toString()}`)
        }
      })
    })
  }
}
