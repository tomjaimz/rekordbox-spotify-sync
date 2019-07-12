const accents = require('remove-accents')
const response = require('./response')

const parseString = safe =>
  accents
    .remove(safe)
    // .replace(//g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/[&#039;’]/g, "'")
    .replace(/ feat. [^(]*/g, '')
    .replace(/[^a-zA-Z0-9._']+/g, ' ')
    .toLowerCase()
    .trim()

const parseArtists = artists =>
  artists
    .map(artist => artist.replace(/&amp;/g, '&').replace(/ \([A-Z]{2}\)$/g, ''))
    .map(artist => artist.split(' & '))
    .reduce((a, b) => a.concat(b), [])
    .map(artist => artist.split(' , '))
    .reduce((a, b) => a.concat(b), [])
    .map(e => parseString(e))
    .filter((v, i, a) => a.indexOf(v) === i)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))

const compareArtists = (a, b) => {
  let fails = 0
  for (const artist of a) {
    fails += !b.includes(artist) ? 1 : 0
  }
  for (const artist of b) {
    fails += !a.includes(artist) ? 1 : 0
  }
  return fails / (a.length + b.length)
}

const search = async data => {
  const { artist, label, release_date, duration_ms, release, name, mixName } = data
  if (!artist) {
    console.error('Missing artists in:', data)
  }
  const artists = artist ? artist.split(',') : []
  const featuring_reg_ex = / feat. ([^(]*)/g
  const featuring_match = name.match(featuring_reg_ex)
  if (featuring_match) {
    artists.push(featuring_match[0].replace(featuring_reg_ex, '$1'))
  }
  const parsedArtists = parseArtists(artists)
  const parsedRelease = release ? parseString(release) : ''
  const track = name + (mixName === 'Original Mix' || !mixName ? '' : ` (${mixName})`)
  const q = `"${parseString(track)}" "${parsedArtists.length ? parsedArtists[0] : ''}"${
    label ? ` label:"${parseString(label)}"` : ''
  }`

  const result = await response({
    type: 'paged',
    url: 'search',
    query: { q, type: 'track', offset: 0, limit: 50 },
  })

  const matches = result.items.map(e => {
    const match = {}
    match.name = parseString(e.name)
    match.id = e.id
    match.title = e.artists.map(e => e.name).join(', ') + ' - ' + e.name
    match.artists = parseArtists(e.artists.map(e => e.name))
    match.album = parseString(e.album.name)
    match.release_date = e.album.release_date
    match.duration_ms = e.duration_ms

    match.duration_score = duration_ms ? Math.abs((duration_ms - match.duration_ms) / duration_ms) : 10
    match.album_score = release ? (parsedRelease.includes(match.album) ? 0 : 5) : 10
    match.artist_compare = compareArtists(match.artists, parsedArtists)
    match.artist_score = match.artist_compare < 1 ? match.artist_compare * 10 : 50
    match.name_score = parseString(track) === match.name ? 0 : 10
    match.release_date_score = release_date
      ? Math.abs(new Date(release_date).getTime() - new Date(match.release_date).getTime())
      : 10

    match.score =
      match.duration_score + match.album_score + match.artist_score + match.name_score + match.release_date_score

    match.duration_ms_match = duration_ms
      ? duration_ms / match.duration_ms > 0.95 && duration_ms / match.duration_ms < 1.05
      : true
    match.album_match = release ? parsedRelease.includes(match.album) : true
    match.artist_match = compareArtists(match.artists, parsedArtists) < 1
    match.name_match = parseString(track) === match.name
    match.release_date_match = release_date ? release_date === match.release_date : true

    if (match.artist_match && match.duration_ms_match && match.album_match && match.release_date_match) {
      match.match = 'match'
    } else if (match.artist_match && match.name_match && match.album_match && match.release_date_match) {
      match.match = 'match_diff_length'
    } else if (match.artist_match && match.duration_ms_match && match.album_match) {
      match.match = 'match_diff_release_date'
    } else if (match.artist_match && match.duration_ms_match && match.release_date_match) {
      match.match = 'match_diff_release_date'
    } else if (match.artist_match && match.duration_ms_match) {
      match.match = 'match_diff_album_diff_release_date'
    } else if (match.artist_match && match.duration_ms_match && match.name_match && label === '') {
      match.match = 'diff_release_match'
    }

    return match
  })

  // console.log(q, matches)

  const match = matches
    .filter(e => e.match)
    .sort((a, b) => b.score - a.score)
    .pop()

  if (match) return match

  if (label !== '') {
    return await search({ artist, label: '', release_date, duration_ms, release, name, mixName })
  }
}

module.exports = search
