const querystring = require('querystring')
const https = require('https')

const authenticatedCall = (url, options) =>
  new Promise((resolve, reject) => {
    const body = options.body && querystring.stringify(options.body)
    const json = options.json && JSON.stringify(options.json)
    const query = options.query ? `?${querystring.stringify(options.query)}` : ''
    if (body) {
      options.headers['Content-Type'] = 'application/x-www-form-urlencoded'
      options.headers['Content-Length'] = body.length
    }
    if (json) {
      options.headers['Content-Type'] = 'application/json'
      options.headers['Content-Length'] = json.length
    }
    const req = https.request(url + query, options, res => {
      if (res.statusCode === 200 || res.statusCode === 201) {
        res.data = ''
        res.on('data', d => {
          res.data += d
        })
        res.on('end', () => {
          const parsedResponse = JSON.parse(res.data)
          if (parsedResponse.error) {
            reject(parsedResponse)
          }
          resolve(parsedResponse)
        })
      } else {
        const { statusCode, statusMessage } = res
        reject({ statusCode, statusMessage })
      }
    })
    req.on('error', error => {
      reject(error)
    })
    if (body) {
      req.write(body)
    }
    if (json) {
      req.write(json)
    }
    req.end()
  })

module.exports = authenticatedCall
