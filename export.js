const fs = require('fs')
if (!fs.existsSync('./config.js')) {
  console.error('config.js missing.')
  if (fs.existsSync('./config.js.sample')) {
    console.error('Maybe you need to edit and rename config.js.sample?')
  }
  process.exit()
}

const util = require('util')
const mm = require('music-metadata')
const xml2js = require('xml2js')

const search = require('./search')
const { addToPlaylist } = require('./interface')
const db = require('./db')

const {
  REKORDBOX_XML_FILE_LOCATION,
  REKORDBOX_EXPORT_PLAYLIST_PREFIX,
  SPOTIFY_PLAYLIST_PREFIX,
  SPOTIFY_URI_ID3_TAG,
  REKORDBOX_LOCATION_PREFIX,
  NODE_LOCATION_PREFIX,
  URIS_FILENAME,
} = require('./config')

const playlists = {}

const playlistNode = (node, prefix, process = false) => {
  if (node.$.Type === '0') {
    for (const playlist of node.NODE) {
      playlistNode(
        playlist,
        `${prefix + node.$.Name}/`,
        process || node.$.Name.indexOf(REKORDBOX_EXPORT_PLAYLIST_PREFIX) === 0
      )
    }
  } else if (process) {
    if (+node.$.Entries > 0) {
      playlists[`${prefix + node.$.Name}`] = node.TRACK.map(({ $ }) => +$.Key)
    }
  }
}

const main = async () => {
  if (!REKORDBOX_XML_FILE_LOCATION) {
    console.error('Missing REKORDBOX_XML_FILE_LOCATION in config.js')
    return
  }

  console.log('Exporting Rekordbox playlists to Spotify')
  console.log('Reading file:', REKORDBOX_XML_FILE_LOCATION)

  const parser = new xml2js.Parser()
  const parseStringSync = util.promisify(parser.parseString)

  const data = fs.readFileSync(REKORDBOX_XML_FILE_LOCATION)
  const result = await parseStringSync(data)
  const tracks = []

  const uriDB = new db(URIS_FILENAME)
  const uris = uriDB.get()

  for (const track of result.DJ_PLAYLISTS.COLLECTION[0].TRACK.map(({ $ }) => $)) {
    const { TrackID, Location, Artist, Label, TotalTime, Album, Name } = track
    const File = decodeURIComponent(Location).replace(REKORDBOX_LOCATION_PREFIX, NODE_LOCATION_PREFIX)
    tracks[TrackID] = { File, Artist, Label, TotalTime, Album, Name }
  }

  for (const playlist of result.DJ_PLAYLISTS.PLAYLISTS[0].NODE[0].NODE) {
    playlistNode(playlist, '')
  }

  for (const [name, playlistTracks] of Object.entries(playlists)) {
    for (let i = 0; i < playlistTracks.length; i += 1) {
      const id = playlistTracks[i]
      const filename = tracks[id].File
      if (uris[filename] && !tracks[id].URI) {
        tracks[id].URI = uris[filename]
      }
      if (!tracks[id].URI && SPOTIFY_URI_ID3_TAG) {
        if (fs.existsSync(filename)) {
          const metadata = await mm.parseFile(filename, { native: true })
          const tags = metadata.native['ID3v2.4'] || metadata.native['ID3v2.3']
          if (tags) {
            const uri_tag = tags.find(v => v.id === SPOTIFY_URI_ID3_TAG)
            if (uri_tag) {
              uris[filename] = tracks[id].URI = uri_tag.value
              uriDB.set(uris)
            }
          }
        } else {
          console.log('Track missing:', filename)
        }
      }

      if (!tracks[id].URI) {
        const { Artist, Label, TotalTime, Album, Name } = tracks[id]
        const searchTerms = {
          artist: Artist,
          label: Label,
          duration_ms: TotalTime * 1000,
          release: Album,
          name: Name,
        }
        const searchResult = await search(searchTerms)
        if (searchResult && searchResult.score < 30) {
          uris[filename] = tracks[id].URI = searchResult.id
          uriDB.set(uris)
        }
      }
    }

    const playlist_name = `${SPOTIFY_PLAYLIST_PREFIX}${name.replace(REKORDBOX_EXPORT_PLAYLIST_PREFIX, '')}`
    const response = await addToPlaylist(playlistTracks.map(id => tracks[id].URI).filter(id => id), playlist_name)
    const { playlist_id, added } = response

    console.log(`${added} tracks from ${playlist_name} exported to https://open.spotify.com/playlist/${playlist_id}`)
  }
}

main()
