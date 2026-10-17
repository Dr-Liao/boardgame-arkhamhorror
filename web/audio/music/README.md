# Campaign music layout

- `common/`: licensed tracks that may be reused by any campaign.
- `campaigns/<campaignId>/`: tracks originally collected for that campaign; their CC BY licence also permits reuse in other chapters.
- Chapter moods and ordered playlists live in `web/scenario-music.js`; the track catalogue and fallback playlists live in `web/music-player.js`; state selection lives in `web/campaign-presentation.js`.
- See [SCENARIO-PLAYLISTS.md](SCENARIO-PLAYLISTS.md) for all 19 chapter playlists (at least two distinct tracks per chapter).

The setup dialog must not mount the player. Playback starts only after a game session enters its campaign hub or table.
