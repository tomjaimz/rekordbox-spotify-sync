const fs = require('fs')
if (!fs.existsSync('./config.json')) {
  console.error('config.json missing.')
  if (fs.existsSync('./config.json.sample')) {
    console.error('Maybe you need to edit and rename config.json.sample?')
  }
  process.exit()
}

const builder = require('xmlbuilder')
const { getSyncedPlaylists } = require('./interface')

const db = require('./db')

const {
  SPOTIFY_XML_FILE_LOCATION,
  REKORDBOX_IMPORT_PLAYLIST_PREFIX,
  SPOTIFY_PLAYLIST_PREFIX,
  REKORDBOX_LOCATION_PREFIX,
  NODE_LOCATION_PREFIX,
  URIS_FILENAME,
} = require('./config')

const uriDB = new db(URIS_FILENAME)
const uris = uriDB.get()

const locationOf = uri => {
  const i = Object.values(uris).indexOf(uri)
  return i !== -1 && Object.keys(uris)[i].replace(NODE_LOCATION_PREFIX, REKORDBOX_LOCATION_PREFIX)
}

const main = async () => {
  if (!SPOTIFY_XML_FILE_LOCATION) {
    console.error('Missing SPOTIFY_XML_FILE_LOCATION in config.json')
    return
  }

  console.log('Importing Rekordbox playlists from Spotify')

  const playlists = await getSyncedPlaylists({
    spotifyPrefix: SPOTIFY_PLAYLIST_PREFIX,
    rekordboxPrefix: REKORDBOX_IMPORT_PLAYLIST_PREFIX,
  })

  const tracks = playlists
    .map(e => e.tracks)
    .reduce((a, b) => [...a, ...b])
    .filter((v, i, a) => a.indexOf(v) === i)

  const feedObj = {
    dj_playlists: {
      collection: {
        track: tracks.map((v, i) => ({
          '@TrackID': i + 1,
          '@Location': locationOf(v.uri),
          '@Name': v.name,
          '@Album': v.album,
          '@Artist': v.artist,
        })),
      },
      playlists: {
        node: {
          '@Type': 0,
          '@Name': 'ROOT',
          node: playlists.map(v => ({
            '@Name': v.name,
            '@Type': 1,
            '@KeyType': 0,
            track: v.tracks.map(t => ({ '@Key': tracks.indexOf(t) + 1 })),
          })),
        },
      },
    },
  }

  const feed = builder.create(feedObj, { encoding: 'utf-8' })

  fs.writeFileSync(SPOTIFY_XML_FILE_LOCATION, feed.end({ pretty: true }))

  console.log('Playlists written to', SPOTIFY_XML_FILE_LOCATION)

  playlists.map(playlist => {
    console.log(`${playlist.tracks.length} tracks imported to ${playlist.name}`)
  })
}

main()
