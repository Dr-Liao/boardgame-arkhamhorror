import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { MUSIC_TRACKS, MUSIC_PLAYLISTS, musicTracksForPlaylist } from '../web/music-player.js'
import { contentRegistry } from '../content/registered.js'
import { SCENARIO_MUSIC } from '../web/scenario-music.js'
import { campaignPlaylistId, campaignPresentation } from '../web/campaign-presentation.js'

test('每个已配置关卡都有两到三首独立 BGM，所有音乐均参与关卡分配', () => {
  const used = new Set()
  const registered = contentRegistry.listScenarios()
  const configured = Object.entries(SCENARIO_MUSIC).flatMap(([campaign, chapters]) => Object.keys(chapters).map(id => `${campaign}/${id}`))
  assert.deepEqual(configured.sort(), registered.map(sc => `${sc.campaignId}/${sc.id}`).sort())
  for (const scenario of registered) {
    const id = campaignPresentation(scenario.campaignId, scenario.id).musicPlaylist
    const tracks = musicTracksForPlaylist(id)
    assert.ok(tracks.length >= 2 && tracks.length <= 3, scenario.id)
    assert.equal(new Set(tracks.map(t => t.isrc)).size, tracks.length, scenario.id)
    assert.equal(tracks.length, MUSIC_PLAYLISTS[id].length, 'unknown track references must fail coverage')
    tracks.forEach(track => used.add(track.id))
  }
  assert.deepEqual([...used].sort(), MUSIC_TRACKS.map(track => track.id).sort())
  const earlierTracks = Object.entries(SCENARIO_MUSIC)
    .filter(([campaign]) => ['nightOfTheZealot', 'theDunwichLegacy', 'thePathToCarcosa'].includes(campaign))
    .flatMap(([, chapters]) => Object.values(chapters).flatMap(chapter => chapter.tracks))
  const uses = new Map()
  for (const id of earlierTracks) uses.set(id, (uses.get(id) || 0) + 1)
  assert.ok([...uses.values()].every(count => count <= 2), '前三个战役同一曲目最多出现两次')
  const forgottenTracks = new Set(Object.values(SCENARIO_MUSIC.theForgottenAge).flatMap(chapter => chapter.tracks))
  assert.ok([...uses.keys()].every(id => !forgottenTracks.has(id)), '三循环歌单应使用独立曲库')
})

test('食梦者八关各三首，旧曲复用不超过 40%，新增音频只存通用曲库', () => {
  const chapters = Object.values(SCENARIO_MUSIC.theDreamEaters)
  assert.equal(chapters.length, 8)
  const assigned = chapters.flatMap(chapter => chapter.tracks)
  assert.ok(chapters.every(chapter => chapter.tracks.length === 3 && new Set(chapter.tracks).size === 3))
  const newTracks = new Set(MUSIC_TRACKS.filter(track => track.id.startsWith('tde')).map(track => track.id))
  assert.equal(newTracks.size, 8)
  assert.ok(assigned.filter(id => !newTracks.has(id)).length / assigned.length <= .4)
  assert.ok([...newTracks].every(id => MUSIC_TRACKS.find(track => track.id === id)?.file.startsWith('common/')))
  assert.ok([...newTracks].every(id => assigned.filter(track => track === id).length === 2))
})

test('铁杉谷盛宴十二个场景各三首，旧曲复用不超过 40%，录音互不重复', () => {
  const campaignId = 'theFeastOfHemlockVale'
  const scenarios = contentRegistry.listScenarios().filter(scenario => scenario.campaignId === campaignId)
  assert.equal(scenarios.length, 12)
  const earlierCampaigns = [
    'nightOfTheZealot', 'theDunwichLegacy', 'thePathToCarcosa', 'theForgottenAge',
    'theCircleUndone', 'theDreamEaters', 'theInnsmouthConspiracy', 'edgeOfTheEarth', 'theScarletKeys',
  ]
  const oldTracks = new Set(earlierCampaigns.flatMap(id => musicTracksForPlaylist(id).map(track => track.isrc)))
  const assigned = Object.keys(SCENARIO_MUSIC[campaignId]).flatMap(id => {
    const playlist = campaignPlaylistId({ campaign: { id: campaignId }, scenario: { id }, uiState: 'inScenario' })
    assert.equal(playlist, campaignId + '/' + id)
    const tracks = musicTracksForPlaylist(playlist)
    assert.equal(tracks.length, 3, id)
    return tracks
  })
  assert.equal(assigned.length, scenarios.length * 3)
  assert.equal(new Set(assigned.map(track => track.isrc)).size, assigned.length)
  assert.ok(assigned.filter(track => oldTracks.has(track.isrc)).length / assigned.length <= 0.4)
  assert.deepEqual(musicTracksForPlaylist(campaignId), assigned)
})

test('沉没之城十关各三首，每关最多复用一首，战役内录音互不重复', () => {
  const campaignId = 'theDrownedCity'
  const scenarios = contentRegistry.listScenarios().filter(scenario => scenario.campaignId === campaignId)
  assert.equal(scenarios.length, 10)
  const earlierTracks = new Set(Object.keys(SCENARIO_MUSIC)
    .filter(id => id !== campaignId).flatMap(id => musicTracksForPlaylist(id).map(track => track.isrc)))
  const assigned = scenarios.flatMap(({ id }) => {
    const playlist = campaignPlaylistId({ campaign: { id: campaignId }, scenario: { id }, uiState: 'inScenario' })
    assert.equal(playlist, `${campaignId}/${id}`)
    const tracks = musicTracksForPlaylist(playlist)
    assert.equal(tracks.length, 3, id)
    assert.ok(tracks.filter(track => earlierTracks.has(track.isrc)).length <= 1, id)
    return tracks
  })
  assert.equal(new Set(assigned.map(track => track.isrc)).size, assigned.length)
  assert.deepEqual(musicTracksForPlaylist(campaignId).map(track => track.id).sort(), assigned.map(track => track.id).sort())
  assert.equal(campaignPlaylistId({ campaign: { id: campaignId }, uiState: 'campaignHub' }), campaignId)
})

for (const campaignId of ['theFeastOfHemlockVale', 'theDrownedCity']) {
  test(`${campaignId} 大厅、牌桌与场景插画使用登记的 WebP`, () => {
    assertScenarioArt(campaignId)
  })
}

function assertScenarioArt(campaignId) {
  const base = new URL(`../web/img/campaigns/${campaignId}/`, import.meta.url)
  const manifest = JSON.parse(readFileSync(new URL('assets.json', base), 'utf8'))
  const scenarios = contentRegistry.listScenarios().filter(scenario => scenario.campaignId === campaignId)
  const { hubHero, tableOverlay } = campaignPresentation(campaignId).assets
  const expected = new Map([
    ['hub', hubHero],
    ['table', tableOverlay],
    ...scenarios.map(({ id }) => [id, campaignPresentation(campaignId, id).assets.storyDefault]),
  ])
  assert.equal(manifest.campaignId, campaignId)
  assert.deepEqual(manifest.assets.map(asset => asset.id).sort(), [...expected.keys()].sort())
  for (const asset of manifest.assets) {
    const data = readFileSync(new URL(asset.file, base))
    assert.equal(data.subarray(8, 12).toString(), 'WEBP')
    assert.equal(data.length, asset.bytes)
    assert.equal(createHash('sha256').update(data).digest('hex'), asset.sha256)
    assert.deepEqual([asset.width, asset.height], [1536, 1024])
    assert.equal(expected.get(asset.id), '/mods/arkhamhorror/img/campaigns/' + campaignId + '/' + asset.file)
  }
  assert.equal(new Set(manifest.assets.map(asset => asset.sha256)).size, manifest.assets.length)
}

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
    assert.match(track.file, /^(?:common|campaigns\/(?:thePathToCarcosa|theForgottenAge|theCircleUndone))\/[a-z0-9-]+\.mp3$/)
    const source = manifest.tracks.find(t => t.isrc === track.isrc)
    assert.equal(source.localFile, track.file)
    assert.ok(credits.includes(track.title))
    const data = readFileSync(new URL(track.file, root))
    assert.equal(data.length, source.encoded.bytes)
    assert.equal(createHash('sha256').update(data).digest('hex'), source.encoded.sha256)
    assert.match(source.sha256, /^[0-9a-f]{64}$/)
    assert.ok(source.download.startsWith('https://incompetech.com/music/royalty-free/mp3-royaltyfree/'))
  }
})
