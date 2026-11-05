import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import sharp from 'sharp'
import { chapters } from '../content/campaigns/theInnsmouthConspiracy/shared.js'
import { SCENARIO_MUSIC } from '../web/scenario-music.js'
import { musicTracksForPlaylist } from '../web/music-player.js'
import { campaignPresentation, campaignPlaylistId } from '../web/campaign-presentation.js'

test('六循环八关各三首，旧曲复用不超过40%，循环内无重复且战役歌单完整', () => {
  const campaign = 'theInnsmouthConspiracy'
  const rows = SCENARIO_MUSIC[campaign]
  assert.deepEqual(Object.keys(rows).sort(), chapters.map(ch => ch.id).sort())
  const old = new Set(Object.entries(SCENARIO_MUSIC).filter(([id]) => id !== campaign).flatMap(([, rows]) => Object.values(rows).flatMap(ch => ch.tracks)))
  const assigned = []
  for (const ch of chapters) {
    const playlist = campaignPlaylistId({ campaign: { id: campaign }, hubSelectedScenarioId: ch.id, uiState: 'scenarioSetup' })
    assert.equal(playlist, `${campaign}/${ch.id}`)
    const tracks = musicTracksForPlaylist(playlist)
    assert.equal(tracks.length, 3)
    assert.equal(new Set(tracks.map(t => t.isrc)).size, 3)
    assigned.push(...tracks.map(t => t.id))
  }
  assert.ok(assigned.filter(id => old.has(id)).length / assigned.length <= .4)
  assert.equal(new Set(assigned).size, assigned.length)
  assert.deepEqual(new Set(musicTracksForPlaylist(campaign).map(t => t.id)), new Set(assigned))
})

test('六循环牌桌、战役图及八关WebP尺寸与哈希正确，实际展示引用全部接通', async () => {
  const root = new URL('../web/img/campaigns/theInnsmouthConspiracy/', import.meta.url)
  const manifest = JSON.parse(readFileSync(new URL('assets.json', root)))
  assert.deepEqual(manifest.assets.map(a => a.id).sort(), ['hub', 'table', ...chapters.map(ch => ch.id)].sort())
  for (const asset of manifest.assets) {
    const data = readFileSync(new URL(asset.file, root))
    const metadata = await sharp(data).metadata()
    assert.equal(metadata.format, 'webp')
    assert.equal(metadata.width, asset.width)
    assert.equal(metadata.height, asset.height)
    assert.ok(metadata.width >= 1536 && metadata.height >= 1024)
    assert.equal(data.length, asset.bytes)
    assert.equal(createHash('sha256').update(data).digest('hex'), asset.sha256)
    assert.ok(asset.prompt.length > 100)
    const theme = campaignPresentation('theInnsmouthConspiracy', asset.id)
    assert.equal(theme.id, 'theInnsmouthConspiracy')
    const key = asset.id === 'table' ? 'tableOverlay' : asset.id === 'hub' ? 'hubHero' : 'storyDefault'
    assert.equal(theme.assets[key], '/mods/arkhamhorror/img/campaigns/theInnsmouthConspiracy/' + asset.file)
  }
})
