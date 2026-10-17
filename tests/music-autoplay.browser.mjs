import { test, expect } from '@playwright/test'

async function fixture(page) {
  await page.route('**/music-autoplay-fixture', route => route.fulfill({contentType:'text/html',body:'<button id="game-action">继续调查</button><main></main>'}))
  await page.goto('/music-autoplay-fixture')
  await page.evaluate(async()=>{
    localStorage.setItem('arkham-music-v1',JSON.stringify({index:3,volume:.18,muted:true}))
    const nativePlay=HTMLMediaElement.prototype.play
    window.attempts=0;window.blockMusic=true
    HTMLMediaElement.prototype.play=function(){
      window.attempts++;window.musicAudio=this
      return window.blockMusic?Promise.reject(new DOMException('Requires a gesture','NotAllowedError')):nativePlay.call(this)
    }
    const h=(tag,attrs={},...children)=>{
      const node=document.createElement(tag)
      for(const [key,value] of Object.entries(attrs)) {
        if(key.startsWith('on'))node[key]=value
        else node.setAttribute(key==='className'?'class':key,value)
      }
      node.append(...children.flat(Infinity));return node
    }
    const {createMusicPlayer}=await import('/mods/arkhamhorror/music-player.js')
    window.player=createMusicPlayer(h)
    document.querySelector('main').append(window.player.render(true))
  })
  await expect(page.locator('.ah-music-launcher')).toContainText('点击后自动播放')
}

test('浏览器阻止自动播放时首个点击恢复，手动暂停不被重绘或后续操作覆盖',async({page})=>{
  await fixture(page)
  expect(await page.evaluate(()=>window.attempts)).toBe(1)
  await page.evaluate(()=>{window.player.render(true);window.player.render(true);window.blockMusic=false})
  expect(await page.evaluate(()=>window.attempts)).toBe(1)
  await page.locator('#game-action').click()
  await expect.poll(()=>page.evaluate(()=>window.musicAudio.currentTime)).toBeGreaterThan(.1)
  expect(await page.evaluate(()=>({volume:window.musicAudio.volume,muted:window.musicAudio.muted}))).toEqual({volume:.18,muted:true})
  await page.locator('.ah-music-mini').click()
  await page.evaluate(()=>window.player.render(true))
  await page.locator('#game-action').click()
  expect(await page.evaluate(()=>window.musicAudio.paused)).toBe(true)
  expect(await page.evaluate(()=>window.attempts)).toBe(2)
  await page.evaluate(()=>{window.player.render(false);window.player.render(true)})
  await expect.poll(()=>page.evaluate(()=>window.musicAudio.paused)).toBe(false)
  expect(await page.evaluate(()=>window.attempts)).toBe(3)
})

test('离开时取消等待，不在大厅意外播放；重新进入可用按键解锁',async({page})=>{
  await fixture(page)
  await page.evaluate(()=>{window.player.render(false);window.blockMusic=false})
  await page.locator('#game-action').click()
  expect(await page.evaluate(()=>window.attempts)).toBe(1)
  await page.evaluate(()=>{window.blockMusic=true;window.player.render(true)})
  await expect(page.locator('.ah-music-launcher')).toContainText('点击后自动播放')
  await page.evaluate(()=>{window.blockMusic=false})
  await page.keyboard.press('Enter')
  await expect.poll(()=>page.evaluate(()=>window.musicAudio.currentTime)).toBeGreaterThan(.1)
  expect(await page.evaluate(()=>window.attempts)).toBe(3)
})
