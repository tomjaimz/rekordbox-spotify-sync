const Bottleneck = require('bottleneck')
const readToken = require('./readToken')
const authenticatedCall = require('./authenticatedCall')

const API_PREFIX = 'https://api.spotify.com/v1/'

const limiter = new Bottleneck({ maxConcurrent: 1, minTime: 40 })

const api = limiter.wrap(async request => await apiCall(request))

const apiCall = async ({ url, method, query, body, json }) => {
  const token = await readToken()
  if (!token) return
  const access_token = token.access_token
  try {
    return await authenticatedCall(url, {
      method: method || 'GET',
      headers: { Authorization: `Bearer ${access_token}` },
      query,
      body,
      json,
    })
  } catch (e) {
    if (!e.response) {
      console.error(url)

      console.error(e)
      return e
    } else if (e.response.statusCode === 502) {
      return apiCall({ url, method, query, body })
    } else if (e.response.body === '') {
      const { statusCode, statusMessage } = e.response
      console.error({ statusCode, statusMessage })
    } else {
      return e.response.body
    }
  }
}

const getPaged = async request => {
  let response = { items: [] }
  const type = request.query && request.query.type
  do {
    const page = await api(request)
    if (page.error) {
      request.url = null
    } else {
      request.query = undefined
      const body = type ? page[`${type}s`] : page
      request.url = body.next
      response.items = response.items.concat(body.items)
    }
  } while (request.url)
  return response
}

const getMultiple = async args => {
  const response = { items: args.data.ids.filter((v, i, a) => a.indexOf(v) === i && typeof v === 'string') }
  if (response.items.length) {
    for (let i = 0; i < Math.ceil(response.items.length / args.data.max); i++) {
      const page = await api({
        url: API_PREFIX + args.url,
        method: args.method,
        query: { ids: response.items.slice(0 + i * args.data.max, (i + 1) * args.data.max).join(',') },
      })
      response.items = request.items.map(id => page.body[args.data.label].find(item => item && item.id === id) || id)
    }
  }
  return response
}

const response = async args => {
  if (args.type === 'multiple') return await getMultiple(args)
  args.url = API_PREFIX + args.url
  if (args.type === 'paged') return await getPaged(args)
  return await api(args)
}

module.exports = response
