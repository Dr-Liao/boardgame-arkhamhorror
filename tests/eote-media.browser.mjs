import {test,expect} from '@playwright/test'
import {readFileSync} from 'node:fs'
import {fileURLToPath} from 'node:url'
import {SCENARIO_MUSIC} from '../web/scenario-music.js'
import {MUSIC_TRACKS} from '../web/music-player.js'
const manifest=JSON.parse(readFileSync(new URL('../web/img/campaigns/edgeOfTheEarth/assets.json',import.meta.url)))
for(const [name,width,height] of [['desktop',1440,950],['mobile',390,844]]){
 test(`地球边缘插画解码、八章歌单切换与三首实播 ${name}`,async({page})=>{
  test.setTimeout(90000)
  await page.setViewportSize({width,height})
  const errors=[]
  page.on('pageerror',e=>errors.push(e.message))
  await page.route('**/eote-media-fixture',r=>r.fulfill({contentType:'text/html',body:'<meta name="viewport" content="width=device-width,initial-scale=1"><main></main>'}))
  await page.goto('/eote-media-fixture')
  const sizes=await page.evaluate(async assets=>{
   document.head.insertAdjacentHTML('beforeend','<link rel="stylesheet" href="/mods/arkhamhorror/music-player.css">')
   document.body.style.cssText='background:#0c1722;color:#deeff3;font:14px sans-serif;margin:12px'
   const main=document.querySelector('main')
   main.style.cssText='display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px'
   const results=[]
   for(const asset of assets){
    const img=new Image()
    img.src='/mods/arkhamhorror/img/campaigns/edgeOfTheEarth/'+asset.file
    img.style.width='100%'
    await img.decode()
    const figure=document.createElement('figure')
    figure.style.margin='0'
    const caption=document.createElement('figcaption')
    caption.textContent=asset.title
    figure.append(img,caption);main.append(figure)
    results.push([img.naturalWidth,img.naturalHeight])
   }
   const h=(tag,attrs={},...children)=>{
    const node=document.createElement(tag)
    for(const [key,value] of Object.entries(attrs)){
     if(key.startsWith('on')) node[key]=value
     else node.setAttribute(key==='className'?'class':key,value)
    }
    node.append(...children.flat(Infinity).filter(c=>c!=null));return node
   }
   localStorage.clear()
   const NativeAudio=window.Audio
   window.Audio=function(){window.musicAudio=new NativeAudio();window.musicAudio.muted=true;return window.musicAudio}
   const {createMusicPlayer}=await import('/mods/arkhamhorror/music-player.js')
   const {campaignPlaylistId}=await import('/mods/arkhamhorror/campaign-presentation.js')
   window.player=createMusicPlayer(h)
   window.selectChapter=id=>window.player.render(true,campaignPlaylistId({campaign:{id:'edgeOfTheEarth'},scenario:{id},uiState:'inScenario'}))
   document.body.append(window.selectChapter('iceAndDeathPart1'))
   window.musicAudio.muted=true
   return results
  },manifest.assets)
  expect(sizes).toEqual(manifest.assets.map(()=>[1536,1024]))
  await page.getByRole('button',{name:'展开音乐播放器',exact:true}).click()
  for(const [id,chapter] of Object.entries(SCENARIO_MUSIC.edgeOfTheEarth)){
   await page.evaluate(id=>window.selectChapter(id),id)
   await expect(page.locator('.ah-music-track')).toHaveCount(3)
   for(const trackId of chapter.tracks){
    const track=MUSIC_TRACKS.find(t=>t.id===trackId)
    await page.getByRole('button',{name:'播放 '+track.title,exact:true}).click()
    await expect(page.locator('.ah-music-now')).toHaveText(track.title)
    expect(await page.evaluate(()=>new URL(window.musicAudio.src).pathname)).toBe('/mods/arkhamhorror/audio/music/'+track.file)
    await expect.poll(()=>page.evaluate(()=>window.musicAudio.currentTime)).toBeGreaterThan(.05)
   }
  }
  await page.locator('.ah-music-launcher').click()
  await page.screenshot({path:fileURLToPath(new URL(`../../../artifacts/eote-media/browser-${name}.png`,import.meta.url)),fullPage:true})
  expect(errors).toEqual([])
 })
}
