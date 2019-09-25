# rekordbox-spotify-sync

Export playlists from Rekordbox to Spotify, and import them back from Spotify to Rekordbox.

## Installation

You will need to:

1. Run `npm install`

1. Create a Spotify Client ID from https://developer.spotify.com/dashboard/applications. You will need to add `http://localhost:8888/` as a **Redirect URI**.

1. Export your Rekordbox Libarary as XML

1. Edit the `config.js.sample` file, and save it as `config.js`. You will need to add or verify the values for:

- REKORDBOX_XML_FILE_LOCATION (Where you saved the exported library from step 3)
- REKORDBOX_LOCATION_PREFIX 
- NODE_LOCATION_PREFIX
- CLIENT_ID (From your Spotify app you created in Step 2)
- CLIENT_SECRET (From your Spotify app you created in Step 2)
