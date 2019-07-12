const response = require('./response')

const getPlaylists = async () => {
  const playlists = await response({
    type: 'paged',
    url: 'me/playlists',
    query: { offset: 0, limit: 50 },
  })
  return playlists
}

const getPlaylistTracks = async playlist_id => {
  const playlistTracks = await response({
    type: 'paged',
    url: 'playlists/' + playlist_id + '/tracks',
    query: { offset: 0, limit: 100 },
  })
  return playlistTracks.items.map(track => track.track)
}

const createPlaylist = async playlist_name => {
  const me = await response({ url: 'me' })
  playlistWithName = await response({
    url: `users/${me.id}/playlists`,
    json: { name: playlist_name },
    method: 'POST',
  })
  return playlistWithName
}

const getPlaylistId = async playlist_name => {
  const playlists = await getPlaylists()
  let playlistWithName = playlists.items.find(e => e.name === playlist_name)
  if (!playlistWithName) {
    playlistWithName = await createPlaylist(playlist_name)
  }
  return playlistWithName.id
}

const addTracksToPlaylist = async (track_ids, playlist_id) => {
  for (let i = 0; i < Math.ceil(track_ids.length / 100); i++) {
    const uris = track_ids.slice(i * 100, (i + 1) * 100).map(e => 'spotify:track:' + e)
    await response({
      method: 'POST',
      url: 'playlists/' + playlist_id + '/tracks',
      json: { uris },
    })
  }
}

const addToPlaylist = async (track_ids, playlist_name) => {
  const playlist_id = await getPlaylistId(playlist_name)
  if (playlist_id) {
    const existingTracks = await getPlaylistTracks(playlist_id)
    const existingTrackIds = existingTracks.map(existingTrack => existingTrack.id)
    const tracksToAdd = track_ids.filter(
      track_id => !existingTrackIds.some(existingTrackId => existingTrackId === track_id)
    )
    await addTracksToPlaylist(tracksToAdd, playlist_id)
    return { playlist_id, added: tracksToAdd.length }
  }
}

const getSyncedPlaylists = async ({ spotifyPrefix, rekordboxPrefix }) => {
  const playlists = await getPlaylists()

  const syncedPlaylists = playlists.items.filter(playlist => playlist.name.indexOf(spotifyPrefix) === 0)
  for (const [i, playlist] of syncedPlaylists.entries()) {
    const playlistTracks = await getPlaylistTracks(playlist.id)
    syncedPlaylists[i] = {
      name: playlist.name.replace(spotifyPrefix, rekordboxPrefix),
      tracks: playlistTracks.map(track => ({
        uri: track.id,
        name: track.name,
        album: track.album.name,
        artist: track.artists.map(e => e.name).join(', '),
      })),
    }
  }
  return syncedPlaylists
}

module.exports = { addToPlaylist, getSyncedPlaylists }
