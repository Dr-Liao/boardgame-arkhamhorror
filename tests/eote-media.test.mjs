import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {chapters} from '../content/campaigns/edgeOfTheEarth/shared.js'
import {SCENARIO_MUSIC} from '../web/scenario-music.js'
import {MUSIC_TRACKS, musicTracksForPlaylist} from '../web/music-player.js'
import {campaignPresentation,campaignPlaylistId} from '../web/campaign-presentation.js'

test('地球边缘八章各三首，实际旧曲复用低于 40%，循环内无重复',()=>{
 const config=SCENARIO_MUSIC.edgeOfTheEarth
 assert.deepEqual(Object.keys(config).sort(),chapters.map(c=>c.id).sort())
 const old=new Set(Object.entries(SCENARIO_MUSIC).filter(([id])=>id!=='edgeOfTheEarth').flatMap(([,c])=>Object.values(c).flatMap(r=>r.tracks)))
 const sources=JSON.parse(readFileSync(new URL('../web/audio/music/sources.json',import.meta.url)))
 const assigned=[]
 for(const c of chapters){
  const playlist=campaignPlaylistId({campaign:{id:'edgeOfTheEarth'},scenario:{id:c.id},uiState:'inScenario'})
  assert.equal(playlist,`edgeOfTheEarth/${c.id}`)
  const tracks=musicTracksForPlaylist(playlist)
  assert.equal(tracks.length,3)
  assert.equal(new Set(tracks.map(t=>t.isrc)).size,3)
  assigned.push(...tracks)
 }
 assert.equal(new Set(assigned.map(t=>t.isrc)).size,24)
 assert.equal(assigned.filter(t=>old.has(t.id)).length,8)
 assert.ok(assigned.filter(t=>old.has(t.id)).length/assigned.length<=.4)
 const fresh=assigned.filter(t=>!old.has(t.id))
 assert.equal(fresh.length,16)
 for(const t of fresh){
  assert.ok(t.file.startsWith('common/'))
  assert.equal(sources.tracks.find(s=>s.isrc===t.isrc).retrieved,'2026-11-08')
 }
 assert.equal(musicTracksForPlaylist('edgeOfTheEarth').length,24)
 assert.ok(fresh.every(t=>MUSIC_TRACKS.some(s=>s.id===t.id)))
})

test('地球边缘十张 WebP 的尺寸、摘要、章节插画与桌布展示接线一致',()=>{
 const root=new URL('../web/img/campaigns/edgeOfTheEarth/',import.meta.url)
 const manifest=JSON.parse(readFileSync(new URL('assets.json',root)))
 assert.deepEqual(manifest.assets.map(a=>a.id).sort(),['hub','table',...chapters.map(c=>c.id)].sort())
 for(const a of manifest.assets){
  const data=readFileSync(new URL(a.file,root))
  assert.equal(data.subarray(0,4).toString(),'RIFF')
  assert.equal(data.subarray(8,12).toString(),'WEBP')
  assert.equal(data.length,a.bytes)
  assert.equal(createHash('sha256').update(data).digest('hex'),a.sha256)
  assert.equal(a.width,1536)
  assert.equal(a.height,1024)
  assert.ok(a.prompt.length>100)
  const theme=campaignPresentation('edgeOfTheEarth',a.id)
  assert.equal(theme.id,'edgeOfTheEarth')
  const key=a.id==='table'?'tableOverlay':a.id==='hub'?'hubHero':'storyDefault'
  assert.equal(theme.assets[key],'/mods/arkhamhorror/img/campaigns/edgeOfTheEarth/'+a.file)
 }
})
