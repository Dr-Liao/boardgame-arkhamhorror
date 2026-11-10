import { test, expect } from '@playwright/test'

for (const width of [1400, 390]) test('image lifecycle at viewport ' + width, async ({ page }) => {
  // Avoid external CDN traffic: this test checks DOM/request lifecycle, while
  // image-cache.test.mjs checks real WebP encoding and dimensions.
  await page.route('**/mods/arkhamhorror/img/**', route => route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64') }))
  await page.setViewportSize({ width, height: 950 })
  await page.goto('/index.html')
  const result = await page.evaluate(async () => {
    const { renderImage } = await import('/mods/arkhamhorror/catalog.js')
    const { retainTableArt } = await import('/mods/arkhamhorror/table-art.js')
    const { disposeImageResources } = await import('/mods/arkhamhorror/image-lifecycle.js')
    const h = (tag, props) => {
      const el = document.createElement(tag)
      for (const [key, value] of Object.entries(props || {})) {
        if (key === 'className') el.className = value
        else el.setAttribute(key, value)
      }
      return el
    }
    const descriptor = { front: { candidates: [{ path: 'cards/01001.avif' }] } }
    const before = document.createElement('div'), after = document.createElement('div')
    document.body.append(before)
    const old = h('div', { className: 'ah-table-art', 'data-art-code': '01001' })
    old.append(renderImage(h, descriptor, 'front', { thumbnail: true }))
    before.append(old)
    await new Promise(resolve => setTimeout(resolve, 100))
    const small = old.querySelector('img').getAttribute('src')
    const replacement = h('div', { className: 'ah-table-art', 'data-art-code': '01001' })
    replacement.append(renderImage(h, descriptor, 'front', { thumbnail: true }))
    after.append(replacement)
    retainTableArt(before, after)
    before.replaceWith(after)
    await new Promise(resolve => setTimeout(resolve, 0))
    const retained = after.firstChild === old && !!old.querySelector('img').getAttribute('src')
    const full = renderImage(h, descriptor)
    document.body.append(full)
    await new Promise(resolve => setTimeout(resolve, 100))
    const fullUrl = full.querySelector('img').getAttribute('src')
    const removed = []
    for (let i = 0; i < 80; i++) {
      const node = renderImage(h, descriptor, 'front', { compact: true })
      document.body.append(node)
      removed.push(node.querySelector('img'))
      node.remove()
    }
    after.remove()
    full.remove()
    await new Promise(resolve => setTimeout(resolve, 0))
    const cleaned = [...removed, old.querySelector('img'), full.querySelector('img')].every(img => !img.hasAttribute('src'))
    disposeImageResources()
    return { small, fullUrl, retained, cleaned }
  })
  expect(result.small).toContain('/img/thumbs/cards/01001.webp')
  expect(result.fullUrl).toContain('/img/cards/01001.avif')
  expect(result.retained).toBe(true)
  expect(result.cleaned).toBe(true)
})

for (const width of [1440, 390]) test('offscreen list art unloads and restores without scrolling jumps at ' + width, async ({ page }) => {
  await page.route('**/mods/arkhamhorror/img/**', route => route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64') }))
  await page.setViewportSize({ width, height: 950 })
  await page.goto('/index.html')
  await page.evaluate(async () => {
    const { renderImage } = await import('/mods/arkhamhorror/catalog.js')
    const h = (tag, props) => {
      const el = document.createElement(tag)
      for (const [key, value] of Object.entries(props || {})) {
        if (key === 'className') el.className = value
        else el.setAttribute(key, value)
      }
      return el
    }
    const descriptor = { front: { candidates: [{ path: 'cards/01001.avif' }] } }
    const root = document.createElement('div')
    root.id = 'memory-list'
    root.style.cssText = 'position:fixed;top:0;left:0;z-index:999999;width:200px;height:260px;overflow:auto;background:#333'
    const first = renderImage(h, descriptor, 'front', { compact: true })
    first.id = 'memory-first'
    first.style.cssText = 'width:160px;height:220px;min-height:220px;margin:0'
    const spacer = document.createElement('div'); spacer.style.height = '5000px'
    const last = renderImage(h, descriptor, 'front', { compact: true }); last.id = 'memory-last'
    root.append(first, spacer, last)
    const resident = renderImage(h, descriptor)
    resident.id = 'memory-resident'
    resident.style.cssText = 'position:fixed;top:0;right:0;width:100px;height:180px;z-index:999999'
    document.body.append(root, resident)
  })
  const first = page.locator('#memory-first')
  await expect(first).toHaveAttribute('data-image-state', 'displayable')
  await expect(page.locator('#memory-resident')).toHaveAttribute('data-image-state', 'displayable')
  expect(await page.locator('#memory-last img').getAttribute('src')).toBeNull()
  const height = await page.locator('#memory-list').evaluate(node => node.scrollHeight)
  await page.locator('#memory-list').evaluate(node => { node.scrollTop = 2500 })
  await page.waitForTimeout(300)
  await expect(first.locator('img')).toHaveAttribute('src', /thumbs/)
  await page.locator('#memory-list').evaluate(node => { node.scrollTop = 0 })
  await page.waitForTimeout(100)
  await page.locator('#memory-list').evaluate(node => { node.scrollTop = 2500 })
  await expect(first).toHaveAttribute('data-image-state', 'suspended', { timeout: 6000 })
  expect(await first.locator('img').getAttribute('src')).toBeNull()
  expect(await page.locator('#memory-list').evaluate(node => node.scrollHeight)).toBe(height)
  await expect(page.locator('#memory-resident img')).toHaveAttribute('src', /cards\/01001.avif/)
  await page.locator('#memory-list').evaluate(node => { node.scrollTop = 0 })
  await expect(first).toHaveAttribute('data-image-state', 'displayable')
  await expect(first.locator('img')).toHaveAttribute('src', /thumbs/)
  expect(await page.locator('#memory-list').evaluate(node => node.scrollHeight)).toBe(height)
})

for (const width of [1440, 390]) test('hub upgrade portraits load inside clipped portrait frames at ' + width, async ({ page }) => {
  await page.setViewportSize({ width, height: 950 })
  await page.route('**/api/mods/arkhamhorror/**', route => {
    const code = new URL(route.request().url()).pathname.split('/').at(-1)
    return route.fulfill({ json: code === 'meta' ? { ok: true, resourceVersion: 'portrait-test' } : {
      ok: true, images: { front: { candidates: [{ path: 'cards/' + code + '.avif' }] } },
    } })
  })
  await page.route('**/mods/arkhamhorror/img/**', route => route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64') }))
  await page.goto('/index.html')
  await page.addStyleTag({ url: '/mods/arkhamhorror/style.css' })
  await page.addStyleTag({ url: '/mods/arkhamhorror/hub-office.css' })
  await page.evaluate(async () => {
    const { tableArt } = await import('/mods/arkhamhorror/table-art.js')
    const h = (tag, props, ...children) => {
      const el = document.createElement(tag)
      for (const [key, value] of Object.entries(props || {})) {
        if (key === 'className') el.className = value
        else el.setAttribute(key, value)
      }
      el.append(...children.flat().filter(value => value != null))
      return el
    }
    const office = h('div', { className: 'ah-office', id: 'portrait-regression' })
    office.style.cssText = 'position:fixed;top:0;left:0;z-index:999999;display:flex;gap:20px;overflow:auto;width:200px;height:240px'
    for (const code of ['06004', '02001']) office.append(h('div', { className: 'ah-office-portrait' }, tableArt(h, code, code, { unloadOffscreen: true })))
    document.body.append(office)
  })
  for (const portrait of await page.locator('#portrait-regression .ah-office-portrait').all()) {
    await expect(portrait.locator('.ah-art')).toHaveAttribute('data-image-state', 'displayable', { timeout: 4000 })
    await expect(portrait.locator('img')).toBeVisible()
  }
  // stablePanel keeps media nodes while replacing their scroll container.
  await page.evaluate(() => {
    const previous = document.getElementById('portrait-regression')
    const next = previous.cloneNode(false)
    next.append(...previous.childNodes)
    previous.replaceWith(next)
  })
  await page.waitForTimeout(3500)
  for (const portrait of await page.locator('#portrait-regression .ah-office-portrait').all()) {
    await expect(portrait.locator('.ah-art')).toHaveAttribute('data-image-state', 'displayable')
    await expect(portrait.locator('img')).toBeVisible()
  }
})

for (const width of [1440, 390]) test('cinematic card art uses original resolution after table thumbnails at ' + width, async ({ page }) => {
  const { default: sharp } = await import('sharp')
  const original = await sharp({ create: { width: 1000, height: 1400, channels: 3, background: '#405060' } }).png().toBuffer()
  const thumbnail = await sharp(original).resize({ height: 480 }).png().toBuffer()
  await page.setViewportSize({ width, height: 950 })
  await page.route('**/api/mods/arkhamhorror/**', route => route.fulfill({ json:
    route.request().url().includes('/catalog/meta') ? { ok: true, resourceVersion: 'cinematic-test' }
      : { ok: true, images: { front: { candidates: [{ path: 'cards/01001.avif' }] } } },
  }))
  await page.route('**/mods/arkhamhorror/img/**', route => route.fulfill({ contentType: 'image/png', body:
    route.request().url().includes('/thumbs/') ? thumbnail : route.request().url().includes('/cards/') ? original
      : Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64'),
  }))
  await page.goto('/index.html')
  await page.addStyleTag({ url: '/mods/arkhamhorror/style.css' })
  await page.addStyleTag({ url: '/mods/arkhamhorror/noir.css' })
  await page.evaluate(async () => {
    const { tableArt } = await import('/mods/arkhamhorror/table-art.js')
    const h = (tag, props, ...children) => {
      const el = document.createElement(tag)
      for (const [key, value] of Object.entries(props || {})) {
        if (key === 'className') el.className = value
        else el.setAttribute(key, value)
      }
      el.append(...children.flat().filter(value => value != null))
      return el
    }
    window.cinematicArt = (code, name, options) => tableArt(h, code, name, options)
    const small = tableArt(h, '01001', 'card')
    small.id = 'cinematic-source-thumbnail'
    small.style.cssText = 'position:fixed;left:0;top:0;width:80px;height:112px'
    document.body.append(small)
  })
  await expect(page.locator('#cinematic-source-thumbnail img')).toHaveJSProperty('naturalHeight', 480)
  await page.evaluate(async () => {
    const { createTablePresentation } = await import('/mods/arkhamhorror/table-presentation.js')
    const presentation = createTablePresentation({ art: window.cinematicArt })
    window.imageTestPresentation = presentation
    const state = { revision: 1, uiState: 'inScenario', round: 2, investigators: [], locations: [], enemies: [],
      acts: [], agendas: [], actIndex: 0, agendaIndex: 0, legalMoves: [], skillTest: null }
    presentation.sync({ sessionId: 'cinematic-resolution', players: [{ seat: 0, role: 'human' }], state, events: [] })
    presentation.sync({ sessionId: 'cinematic-resolution', players: [{ seat: 0, role: 'human' }], state: { ...state, revision: 2 }, events: [{ seq: 1,
      presentation: { kind: 'story', title: 'Card reveal', name: 'Card', code: '01001', text: 'Inspect original card art.' },
    }] })
  })
  const image = page.locator('.ah-cinematic-card img')
  await expect(image).toHaveAttribute('src', /\/img\/cards\/01001\.avif/)
  await expect(image).toHaveJSProperty('naturalWidth', 1000)
  await expect(image).toHaveJSProperty('naturalHeight', 1400)
  expect(await image.getAttribute('src')).not.toContain('/thumbs/')
  await page.evaluate(() => window.imageTestPresentation.reset())
})
