import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { chapters } from '../content/campaigns/theScarletKeys/shared.js'
import { campaignPlaylistId, campaignPresentation } from '../web/campaign-presentation.js'
import { musicTracksForPlaylist } from '../web/music-player.js'
import { SCENARIO_MUSIC } from '../web/scenario-music.js'

const campaignId = 'theScarletKeys'

test('绯红密钥十关各三首，旧曲复用不超过 40%，循环内无重复录音', () => {
  const oldTrackIds = new Set(Object.entries(SCENARIO_MUSIC)
    .filter(([id]) => id !== campaignId)
    .flatMap(([, scenarios]) => Object.values(scenarios).flatMap(scenario => scenario.tracks)))
  assert.deepEqual(Object.keys(SCENARIO_MUSIC[campaignId]).sort(), chapters.map(chapter => chapter.id).sort())

  const assigned = chapters.flatMap(({ id }) => {
    const playlist = campaignPlaylistId({ campaign: { id: campaignId }, scenario: { id }, uiState: 'inScenario' })
    assert.equal(playlist, campaignId + '/' + id)
    const tracks = musicTracksForPlaylist(playlist)
    assert.equal(tracks.length, 3, id)
    return tracks
  })
  assert.equal(new Set(assigned.map(track => track.isrc)).size, 30)
  assert.ok(assigned.filter(track => oldTrackIds.has(track.id)).length / assigned.length <= 0.4)
  assert.deepEqual(musicTracksForPlaylist(campaignId), assigned)
})

test('绯红密钥大厅、牌桌和十关插画的路径及文件校验值一致', () => {
  const root = new URL('../web/img/campaigns/theScarletKeys/', import.meta.url)
  const manifest = JSON.parse(readFileSync(new URL('assets.json', root), 'utf8'))
  const expected = new Map([
    ['hub', campaignPresentation(campaignId).assets.hubHero],
    ['table', campaignPresentation(campaignId).assets.tableOverlay],
    ...chapters.map(({ id }) => [id, campaignPresentation(campaignId, id).assets.storyDefault]),
  ])
  assert.deepEqual(manifest.assets.map(asset => asset.id).sort(), [...expected.keys()].sort())
  for (const asset of manifest.assets) {
    const data = readFileSync(new URL(asset.file, root))
    assert.equal(data.subarray(8, 12).toString(), 'WEBP')
    assert.equal(data.length, asset.bytes)
    assert.equal(createHash('sha256').update(data).digest('hex'), asset.sha256)
    assert.deepEqual([asset.width, asset.height], [1536, 1024])
    assert.equal(expected.get(asset.id), '/mods/arkhamhorror/img/campaigns/theScarletKeys/' + asset.file)
  }
})
