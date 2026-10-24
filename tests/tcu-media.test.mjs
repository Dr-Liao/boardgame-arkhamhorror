import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { chapters } from '../content/campaigns/theCircleUndone/shared.js'
import { SCENARIO_MUSIC } from '../web/scenario-music.js'
import { musicTracksForPlaylist } from '../web/music-player.js'
import { campaignPresentation, campaignPlaylistId } from '../web/campaign-presentation.js'

test('四循环九章每关三首，跨循环复用与循环内重复均不超过 30%', () => {
  assert.deepEqual(Object.keys(SCENARIO_MUSIC.theCircleUndone).sort(), chapters.map(c => c.id).sort())
  const oldTracks = new Set(Object.entries(SCENARIO_MUSIC).filter(([id]) => id !== 'theCircleUndone').flatMap(([, rows]) => Object.values(rows).flatMap(c => c.tracks)))
  const assigned = []
  for (const chapter of chapters) {
    const id = campaignPlaylistId({ campaign: { id: 'theCircleUndone' }, hubSelectedScenarioId: chapter.id, uiState: 'scenarioSetup' })
    assert.equal(id, `theCircleUndone/${chapter.id}`)
    const tracks = musicTracksForPlaylist(id)
    assert.equal(tracks.length, 3)
    assert.equal(new Set(tracks.map(t => t.isrc)).size, 3)
    assigned.push(...tracks.map(t => t.id))
  }
  assert.ok(assigned.filter(id => oldTracks.has(id)).length / assigned.length <= .3)
  assert.ok(1 - new Set(assigned).size / assigned.length <= .3)
  assert.equal(musicTracksForPlaylist('theCircleUndone').length, new Set(assigned).size)
})

test('四循环桌布和九章原画均落盘，尺寸、摘要与实际展示接线一致', () => {
  const root = new URL('../web/img/campaigns/theCircleUndone/', import.meta.url)
  const manifest = JSON.parse(readFileSync(new URL('assets.json', root)))
  assert.deepEqual(manifest.assets.map(a => a.id).sort(), ['table', ...chapters.map(c => c.id)].sort())
  for (const asset of manifest.assets) {
    const data = readFileSync(new URL(asset.file, root))
    assert.equal(data.subarray(0, 4).toString(), 'RIFF')
    assert.equal(data.subarray(8, 12).toString(), 'WEBP')
    assert.equal(data.length, asset.bytes)
    assert.equal(createHash('sha256').update(data).digest('hex'), asset.sha256)
    assert.ok(asset.width >= 1536 && asset.height >= 1024)
    const theme = campaignPresentation('theCircleUndone', asset.id)
    assert.equal(theme.id, 'theCircleUndone')
    const key = asset.id === 'table' ? 'tableOverlay' : 'storyDefault'
    assert.equal(theme.assets[key], '/mods/arkhamhorror/img/campaigns/theCircleUndone/' + asset.file)
  }
})
