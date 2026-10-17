import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { MUSIC_TRACKS, MUSIC_PLAYLISTS, musicTracksForPlaylist } from '../web/music-player.js'
import { contentRegistry } from '../content/registered.js'
import { SCENARIO_MUSIC } from '../web/scenario-music.js'
import { campaignPlaylistId, campaignPresentation } from '../web/campaign-presentation.js'

test('每个已开放关卡都有至少两首独立 BGM，所有音乐均参与关卡分配', () => {
  const used = new Set()
  // Catalog-only cycles (e.g. the Forgotten Age baseline) have no playable
  // scenarios and no presentation assets yet; BGM coverage starts at promotion.
  const registered = contentRegistry.listScenarios().filter(scenario =>
    ['playable', 'verified'].includes(contentRegistry.getCampaign(scenario.campaignId).status))
  const configured = Object.entries(SCENARIO_MUSIC).flatMap(([campaign, chapters]) => Object.keys(chapters).map(id => `${campaign}/${id}`))
  assert.deepEqual(configured.sort(), registered.map(sc => `${sc.campaignId}/${sc.id}`).sort())
  for (const scenario of registered) {
    const id = campaignPresentation(scenario.campaignId, scenario.id).musicPlaylist
    const tracks = musicTracksForPlaylist(id)
    assert.ok(tracks.length >= 2, scenario.id)
    assert.equal(new Set(tracks.map(t => t.isrc)).size, tracks.length, scenario.id)
    assert.equal(tracks.length, MUSIC_PLAYLISTS[id].length, 'unknown track references must fail coverage')
    tracks.forEach(track => used.add(track.id))
  }
  assert.deepEqual([...used].sort(), MUSIC_TRACKS.map(track => track.id).sort())
})

test('关间准备跟随下一关，桌面继续使用正在进行的关卡，未知关卡安全回退', () => {
  const state = { campaign: { id: 'theDunwichLegacy' }, scenario: { id: 'theMiskatonicMuseum' }, hubSelectedScenarioId: 'theEssexCountyExpress' }
  assert.equal(campaignPlaylistId({ ...state, uiState: 'scenarioSetup' }), 'theDunwichLegacy/theEssexCountyExpress')
  assert.equal(campaignPlaylistId({ ...state, uiState: 'interlude' }), 'theDunwichLegacy/theEssexCountyExpress')
  assert.equal(campaignPlaylistId({ ...state, uiState: 'inScenario' }), 'theDunwichLegacy/theMiskatonicMuseum')
  assert.equal(campaignPresentation('theDunwichLegacy', 'unknown').musicPlaylist, 'theDunwichLegacy')
  assert.equal(campaignPlaylistId({}), 'common')
})

test('内置音乐、官方授权署名和文件校验一致', () => {
  const root = new URL('../web/audio/music/', import.meta.url)
  const manifest = JSON.parse(readFileSync(new URL('sources.json', root), 'utf8'))
  const credits = readFileSync(new URL('CREDITS.txt', root), 'utf8')
  assert.equal(manifest.license, 'CC BY 4.0')
  assert.match(credits, /Kevin MacLeod \(incompetech.com\)/)
  assert.ok(credits.includes(manifest.licenseUrl))
  assert.deepEqual(musicTracksForPlaylist('nightOfTheZealot').map(track => track.id), MUSIC_PLAYLISTS.nightOfTheZealot)
  assert.deepEqual(musicTracksForPlaylist('unknown').map(track => track.id), MUSIC_PLAYLISTS.common)
  for (const track of MUSIC_TRACKS) {
    assert.match(track.file, /^(?:common|campaigns\/thePathToCarcosa)\/[a-z0-9-]+\.mp3$/)
    const source = manifest.tracks.find(t => t.isrc === track.isrc)
    assert.equal(source.localFile, track.file)
    assert.ok(credits.includes(track.title))
    const data = readFileSync(new URL(track.file, root))
    assert.equal(data.length, source.bytes)
    assert.equal(createHash('sha256').update(data).digest('hex'), source.sha256)
    assert.ok(source.download.startsWith('https://incompetech.com/music/royalty-free/mp3-royaltyfree/'))
  }
})
