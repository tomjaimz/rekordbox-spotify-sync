const http = require('http')
const url = require('url')

const authenticatedCall = require('./authenticatedCall')

const db = require('./db')

const { CLIENT_ID, CLIENT_SECRET, TOKEN_FILENAME } = require('./config')

// local
const PORT = 8888
const REDIRECT_URI = `http://localhost:${PORT}/`

// spotify
const HOSTNAME = 'https://accounts.spotify.com/'
const AUTHORIZE_URL = `${HOSTNAME}authorize`
const API_TOKEN_URL = `${HOSTNAME}api/token`
const SCOPE =
  'user-read-playback-state user-modify-playback-state playlist-modify-private playlist-read-private playlist-modify-public playlist-modify-private'

const authorizeURL = new URL(AUTHORIZE_URL)
authorizeURL.searchParams.set('response_type', 'code')
authorizeURL.searchParams.set('client_id', CLIENT_ID)
authorizeURL.searchParams.set('redirect_uri', REDIRECT_URI)
authorizeURL.searchParams.set('scope', SCOPE.split(' '))

const tokenDB = new db(TOKEN_FILENAME)

const getTokenFromAPI = async data => {
  try {
    const token = await authenticatedCall(API_TOKEN_URL, {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64'),
      },
      body: data,
    })
    if (data.refresh_token) {
      token.refresh_token = data.refresh_token
    }
    token.expires_at = new Date().setSeconds(new Date().getSeconds() + token.expires_in)
    tokenDB.set(token)
    return token
  } catch (e) {
    console.error(e)
  }
}

const refreshToken = async refresh_token => {
  try {
    return await getTokenFromAPI({ refresh_token, grant_type: 'refresh_token' })
  } catch (e) {
    console.error(e)
  }
}

const getTokenFromUser = () =>
  new Promise((resolve, reject) => {
    http
      .createServer(async (req, res) => {
        const { code } = url.parse(req.url, true).query
        if (code) {
          try {
            const token = await getTokenFromAPI({ code, grant_type: 'authorization_code', redirect_uri: REDIRECT_URI })
            resolve(token)
          } catch (e) {
            reject(e)
          }
        }
        res.writeHead(200, { 'Content-Type': 'text/plain' })
        res.end('You may close this window.\n')
      })
      .listen(PORT)

    console.log(`Click here: ${authorizeURL.toString()}`)
  })

const readToken = async () => {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    console.log(
      'You need a CLIENT_ID and a CLIENT_SECRET in the config.js.  Go to https://developer.spotify.com/dashboard/applications.'
    )
  }

  const token = tokenDB.get()
  if (!token.access_token) {
    return await getTokenFromUser()
  }
  if (new Date(token.expires_at) > new Date()) {
    return token
  } else {
    return await refreshToken(token.refresh_token)
  }
}

module.exports = readToken
