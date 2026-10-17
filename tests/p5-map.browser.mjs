import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { contentRegistry } from '../content/registered.js'
import { locationEntryErrors } from '../src/integration/presentation-state.js'

const root = fileURLToPath(new URL('../../..', import.meta.url))

async function mapFixture(page, scenarioId, { noCoordinates = false, variant = false, choice = false, hunter = false, massive = false, victoryPoints = [], attachment = false, oneWay = false, barrierReleased = false, difficulty = 'standard' } = {}) {
  const manifest = contentRegistry.getScenario(scenarioId)
  const scenario = contentRegistry.getScenarioData(scenarioId)
  let session
  const submitted = []
  await page.route('**/api/start', async route => {
    const response = await route.fetch({ postData: JSON.stringify({ modId: 'arkhamhorror', settings: {
      legacyAutoStart: true, playerInvestigator: '01001', teammates: 0, seed: 'p5-map',
    } }) })
    const payload = await response.json()
    session = payload.session
    const st = session.state
    st.difficulty = difficulty
    const locations = manifest.locations.map(entry => ({ ...scenario.locations[entry.id],
      originalCode: entry.frontCode, revealed: entry.id === scenario.startLocation,
      clues: entry.id === scenario.startLocation ? 1 : 0 }))
    if (oneWay) for (const loc of locations) loc.connections = (loc.connections || []).filter(id => loc.id < id)
    if (variant) {
      const southside = locations.find(loc => loc.id === 'southside')
      southside.name = '南区 · 老马旅社'
      southside.originalCode = '01127'
    }
    st.scenario = { id: scenarioId, name: scenario.name, layout: noCoordinates ? { locations: {}, edges: [] } : manifest.layout }
    st.acts = structuredClone(scenario.acts); st.actIndex = 0
    st.agendas = structuredClone(scenario.agendas); st.agendaIndex = 0
    st.locations = locations
    st.investigators[0].location = scenario.startLocation
    if (barrierReleased) {
      st.actIndex = 2
      st.locations.find(loc => loc.id === 'parlor').revealed = true
    }
    st.locationEntryErrors = locationEntryErrors(st)
    st.enemies = victoryPoints.length
      ? victoryPoints.map((victory, index) => ({ id: `victory-${victory}-${index}`, code: '01111', name: `胜利点 ${victory}`,
        location: 'yourHouse', victory, health: 2, damageTaken: 0, fight: 2, evade: 2, damage: 1, horror: 1 }))
      : hunter || massive ? [{ id: 'hunter-1', code: '01111', name: massive ? '庞大敌人' : '猎手',
        location: 'yourHouse', hunter, massive, health: 2, damageTaken: 0, fight: 2, evade: 2, damage: 1, horror: 1 }] : []
    if (hunter) st.investigators[0].location = 'northside'
    st.storyAssets = attachment ? [{ id: 'story-1', code: '01117', location: scenario.startLocation,
      exhausted: false }] : []
    st.pendingChoice = choice ? { id: 'location-choice', kind: 'target', seat: 0, prompt: '选择地点',
      options: [{ id: locations[1].id, label: locations[1].name }] } : null
    st.legalMoves = choice
      ? [{ action: 'choose', choiceId: 'location-choice', optionId: locations[1].id, label: '选择地点' }]
      : scenario.locations[scenario.startLocation].connections[0]
        ? [{ action: 'move', locationId: scenario.locations[scenario.startLocation].connections[0], label: '移动到相邻地点' }]
        : []
    await route.fulfill({ response, json: payload })
  })
  await page.route('**/api/move', async route => {
    const body = route.request().postDataJSON()
    submitted.push(body)
    if (body.move.action === 'move') session.state.investigators[0].location = body.move.locationId
    session.state.pendingChoice = null
    session.state.revision++
    session.state.legalMoves = []
    await route.fulfill({ json: { ok: true, session } })
  })
  await page.goto('/index.html')
  await page.locator('.bg-card').filter({ hasText: '诡镇奇谈' }).click()
  await page.getByRole('button', { name: '开始新游戏' }).click()
  await page.getByRole('button', { name: '跳过演出' }).click()
  await expect(page.locator('.ah-map-viewport')).toBeVisible()
  return { manifest, scenario, submitted, get session() { return session } }
}

test('剧本书左右顺序、按难度提示卡、方向箭头与悬停高亮', async ({ page }) => {
  await mapFixture(page, 'theMidnightMasks', { difficulty: 'hard' })
  const pages = page.locator('.ah-story-book .ah-script-card')
  await expect(pages.nth(0)).toHaveAttribute('aria-label', '当前密谋')
  await expect(pages.nth(1)).toHaveAttribute('aria-label', '当前场景')
  const reference = page.locator('.ah-reference-card')
  await expect(reference).toHaveAttribute('data-reference-code', '01120')
  await expect(reference).toHaveAttribute('data-reference-face', 'back')
  await expect(reference.locator('.ah-table-art')).toHaveAttribute('data-image-state', 'displayable')
  await reference.click()
  await expect(page.getByRole('dialog', { name: '卡牌详情' })).toContainText('困难/专家')
  await page.getByRole('button', { name: '关闭卡牌详情' }).click()
  const edges = page.locator('.ah-map-edges line')
  expect(await edges.count()).toBeGreaterThan(0)
  for (const edge of await edges.all()) {
    await expect(edge).toHaveAttribute('marker-end', 'url(#ah-map-arrow)')
    await expect(edge).toHaveAttribute('marker-start', 'url(#ah-map-arrow)')
    await expect(edge).toHaveAttribute('data-direction', 'both')
  }
  const node = page.locator('[data-location-id="yourHouse"]')
  await node.hover()
  await expect(page.locator('.ah-map-scene')).toHaveClass(/has-focused-route/)
  const related = page.locator('.ah-map-edges .is-related')
  expect(await related.count()).toBeGreaterThan(0)
  expect(await related.evaluateAll(lines => lines.every(l => l.dataset.from === 'yourHouse' || l.dataset.to === 'yourHouse'))).toBe(true)
  await expect(related.first()).toHaveCSS('opacity', '1')
  await expect(page.locator('.ah-map-edges line:not(.is-related)').first()).toHaveCSS('opacity', '0.5')
  fs.mkdirSync(path.join(root, 'artifacts/arkham-polish'), { recursive: true })
  await page.screenshot({ path: path.join(root, 'artifacts/arkham-polish/story-book-desktop.png') })
  await page.mouse.move(0, 0)
  await expect(page.locator('.ah-map-scene')).not.toHaveClass(/has-focused-route/)
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(pages.nth(0)).toBeInViewport()
  await expect(pages.nth(1)).toBeInViewport()
  await expect(reference).toBeInViewport()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: path.join(root, 'artifacts/arkham-polish/story-book-mobile.png') })
})

for (const barrierReleased of [false, true]) test(`烈焰屏障${barrierReleased ? '解除后恢复普通' : '阻挡时显示红色'}路线`, async ({ page }) => {
  await mapFixture(page, 'theGathering', { barrierReleased })
  const edge = page.locator('.ah-map-edges line[data-to="parlor"], .ah-map-edges line[data-from="parlor"]')
  const destination = await edge.getAttribute('data-to') === 'parlor' ? 'marker-end' : 'marker-start'
  const opposite = destination === 'marker-end' ? 'marker-start' : 'marker-end'
  const marker = barrierReleased ? 'url(#ah-map-arrow)' : 'url(#ah-map-arrow-blocked)'
  await expect(edge).toHaveAttribute(destination, marker)
  await expect(edge).toHaveAttribute(opposite, 'url(#ah-map-arrow)')
  if (barrierReleased) await expect(edge).not.toHaveClass(/ah-map-entry-blocked/)
  else {
    await expect(edge).toHaveClass(/ah-map-entry-blocked/)
    await expect(edge).toHaveCSS('stroke', 'rgb(239, 100, 100)')
  }
  await page.locator('.ah-map-node[data-location-id="parlor"]').hover()
  await expect(edge).toHaveClass(/is-related/)
  await expect(edge).toHaveAttribute(destination, marker)
  if (!barrierReleased) await expect(edge).toHaveCSS('stroke', 'rgb(239, 100, 100)')
  await expect(page.locator('#ah-map-arrow-blocked path')).toHaveCSS('fill', 'rgb(239, 100, 100)')
})

test('单向地点仅在目标端显示箭头', async ({ page }) => {
  await mapFixture(page, 'theMidnightMasks', { oneWay: true })
  const edges = page.locator('.ah-map-edges line')
  expect(await edges.count()).toBeGreaterThan(0)
  for (const edge of await edges.all()) {
    await expect(edge).toHaveAttribute('data-direction', 'forward')
    expect(await edge.getAttribute('marker-start')).toBeNull()
    await expect(edge).toHaveAttribute('marker-end', 'url(#ah-map-arrow)')
    expect((await edge.getAttribute('data-from')) < (await edge.getAttribute('data-to'))).toBe(true)
  }
})

for (const scenarioId of ['theGathering', 'theMidnightMasks', 'theDevourerBelow']) {
  test(`P5 ${scenarioId} 使用关卡坐标与规则连接`, async ({ page }) => {
    const { manifest, scenario, submitted } = await mapFixture(page, scenarioId)
    const locations = manifest.locations
    await expect(page.locator('.ah-map-node')).toHaveCount(locations.length)
    const expectedEdges = new Set(locations.flatMap(loc => loc.connections.map(target => [loc.id, target].sort().join(':'))))
    await expect(page.locator('.ah-map-edges line')).toHaveCount(expectedEdges.size)
    for (const loc of locations) {
      const node = page.locator(`.ah-map-node[data-location-id="${loc.id}"]`)
      await expect(node).toBeVisible()
      const point = manifest.layout.locations[loc.id]
      const actual = await node.evaluate(el => ({ left: parseFloat(el.style.left), top: parseFloat(el.style.top) }))
      for (const other of locations) {
        const otherPoint = manifest.layout.locations[other.id]
        if (point.x < otherPoint.x) {
          const otherX = await page.locator(`.ah-map-node[data-location-id="${other.id}"]`).evaluate(el => parseFloat(el.style.left))
          expect(actual.left).toBeLessThan(otherX)
        }
      }
    }
    const firstLegal = scenario.locations[scenario.startLocation].connections[0]
    if (!firstLegal) {
      await expect(page.locator('.ah-map-node[data-adjacent="true"]')).toHaveCount(0)
      expect(submitted).toHaveLength(0)
      return
    }
    await expect(page.locator(`.ah-map-node[data-location-id="${firstLegal}"]`)).toHaveAttribute('data-adjacent', 'true')
    const illegal = locations.find(loc => loc.id !== scenario.startLocation && loc.id !== firstLegal)
    if (illegal) {
      await expect(page.locator(`.ah-map-node[data-location-id="${illegal.id}"]`)).toHaveAttribute('data-adjacent', 'false')
      expect(submitted).toHaveLength(0)
    }
    await page.locator(`.ah-map-node[data-location-id="${firstLegal}"]`).click()
    expect(submitted).toHaveLength(0)
    await page.locator(`[data-location-move="${firstLegal}"]`).click()
    expect(submitted).toHaveLength(1)
    expect(submitted[0].move).toMatchObject({ action: 'move', locationId: firstLegal })
  })
}

test('P5 密斯卡托尼克博物馆及后续剧本的网格布局可完整适配视口', async ({ page }) => {
  await mapFixture(page, 'theMiskatonicMuseum')
  await expect.poll(() => page.locator('.ah-map-node').evaluateAll((nodes) => {
    const viewport = document.querySelector('.ah-map-viewport').getBoundingClientRect()
    return nodes.every(node => {
      const rect = node.getBoundingClientRect()
      return rect.left >= viewport.left && rect.top >= viewport.top &&
        rect.right <= viewport.right && rect.bottom <= viewport.bottom
    })
  })).toBe(true)
})

test('P5 缩放、平移、本地拖动与重置均更新连线', async ({ page }) => {
  const fixture = await mapFixture(page, 'theMidnightMasks')
  await page.locator('.ah-map-viewport').press('e')
  const viewport = page.locator('.ah-map-viewport')
  const scene = page.locator('.ah-map-scene')
  await expect.poll(() => scene.evaluate(el => getComputedStyle(el).transform)).not.toBe('none')
  const original = await scene.evaluate(el => getComputedStyle(el).transform)
  await page.locator('.ah-map-viewport').press('+')
  await expect.poll(() => scene.evaluate(el => getComputedStyle(el).transform)).not.toBe(original)
  await page.locator('.ah-map-viewport').press('0')
  const fitted = await scene.evaluate(el => getComputedStyle(el).transform)
  const box = await viewport.boundingBox()
  await page.mouse.move(box.x + box.width - 25, box.y + box.height - 25)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width - 65, box.y + box.height - 50, { steps: 4 })
  await page.mouse.up()
  await expect.poll(() => scene.evaluate(el => getComputedStyle(el).transform)).not.toBe(fitted)
  const node = page.locator('.ah-map-node').first()
  const id = await node.getAttribute('data-location-id')
  const before = await node.evaluate(el => parseFloat(el.style.left))
  const handle = node.getByRole('button', { name: /调整/ })
  const handleBox = await handle.boundingBox()
  await page.mouse.move(handleBox.x + 8, handleBox.y + 8)
  await page.mouse.down()
  await page.mouse.move(handleBox.x + 38, handleBox.y + 8, { steps: 4 })
  await page.mouse.up()
  const moved = page.locator(`.ah-map-node[data-location-id="${id}"]`)
  await expect.poll(() => moved.evaluate(el => parseFloat(el.style.left))).toBeGreaterThan(before)
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)),
    `arkham-map:calm:${fixture.session.sessionId}:theMidnightMasks`)
  expect(saved.positions[id].x).toBeGreaterThan(before)
  const edge = page.locator(`.ah-map-edges line[data-from="${id}"], .ah-map-edges line[data-to="${id}"]`).first()
  await expect(edge).toHaveCount(1)
  const edgeX = await edge.getAttribute('x1')
  expect(Number(edgeX)).toBeGreaterThan(0)
  await page.locator('.ah-map-viewport').press('r')
  await expect.poll(() => moved.evaluate(el => parseFloat(el.style.left))).toBe(before)
  expect(fixture.submitted).toHaveLength(0)
})

test('P5 变体换图不改变坐标，缺少坐标时自动布局，目标选择受合法动作约束', async ({ page }) => {
  const { submitted } = await mapFixture(page, 'theMidnightMasks', { variant: true, noCoordinates: true, choice: true })
  const nodes = page.locator('.ah-map-node')
  await expect(nodes).toHaveCount(9)
  const positions = await nodes.evaluateAll(elements => elements.map(el => `${el.style.left}:${el.style.top}`))
  expect(new Set(positions).size).toBe(9)
  await expect(page.locator('.ah-map-node[data-location-id="southside"]')).toContainText('老马旅社')
  const chosen = page.locator('[data-choice-target="' + (await nodes.nth(1).getAttribute('data-location-id')) + '"]')
  await chosen.focus()
  await page.keyboard.press('Enter')
  await expect.poll(() => submitted.length).toBe(1)
  expect(submitted[0].move.action).toBe('choose')
})

test('P5 猎手路径只沿当前规则连接显示，窄屏地图可操作', async ({ page }) => {
  await mapFixture(page, 'theMidnightMasks', { hunter: true, attachment: true })
  await expect(page.locator('.ah-map-hunter-route')).not.toHaveCount(0)
  await page.locator('.ah-map-viewport').press('l')
  expect(await page.locator('.ah-map-hunter-route.is-visible').first().evaluate(el => Number(getComputedStyle(el).opacity))).toBeGreaterThan(0)
  await expect(page.locator('.ah-map-node[data-location-id="yourHouse"] .ah-loc-attached')).toContainText('1')
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.locator('.ah-map-controls')).toHaveCount(0)
  await page.locator('.ah-map-viewport').press('0')
  const viewport = await page.locator('.ah-map-viewport').boundingBox()
  const region = await page.getByRole('region', { name: '地点地图' }).boundingBox()
  expect(viewport.width).toBeLessThanOrEqual(region.width)
  expect(viewport.height).toBeGreaterThan(40)
  await page.locator('.ah-map-viewport').press('+')
  expect(Number(await page.locator('.ah-map-scene').getAttribute('data-map-scale'))).toBeGreaterThan(.3)
})

test('庞大敌人在地图上使用更大的图标', async ({ page }) => {
  await mapFixture(page, 'theMidnightMasks', { massive: true })
  const enemy = page.locator('.ah-location-entities .ah-enemy')
  await expect(enemy).toHaveClass(/is-massive/)
  await expect(enemy).toHaveCSS('width', '48px')
  await expect(enemy).toHaveCSS('height', '60px')
})

test('地图敌人按胜利点显示逐级渐变外发光', async ({ page }) => {
  await mapFixture(page, 'theMidnightMasks', { victoryPoints: [1, 2, 4] })
  const enemies = page.locator('.ah-location-entities .ah-enemy')
  await expect(enemies).toHaveCount(3)
  await expect(enemies.nth(0)).toHaveClass(/victory-1/)
  await expect(enemies.nth(1)).toHaveClass(/victory-2/)
  await expect(enemies.nth(2)).toHaveClass(/victory-3/)
  const glows = await enemies.evaluateAll(elements => elements.map(element => getComputedStyle(element).boxShadow))
  expect(new Set(glows).size).toBe(3)
  expect(glows.every(glow => glow.split('rgb').length >= 4)).toBe(true)
})

test('简洁地图默认收起连线，选中仅显示相关路线且不立即移动', async ({ page }) => {
  const fixture = await mapFixture(page, 'theMidnightMasks')
  await page.mouse.move(5, 5)
  await expect(page.locator('.ah-map-edges .is-visible')).toHaveCount(0)
  await expect(page.locator('.ah-status-drawer')).toBeHidden()
  await expect(page.locator('.ah-equipment-tray')).toHaveCount(0)
  const node = page.locator('.ah-map-node[data-location-id="yourHouse"]')
  await node.focus()
  await page.keyboard.press('Space')
  await expect(node).toHaveAttribute('aria-pressed', 'true')
  const edges = await page.locator('.ah-map-edges .is-visible').evaluateAll(elements => elements.map(el => [el.dataset.from, el.dataset.to]))
  expect(edges.length).toBeGreaterThan(0)
  expect(edges.every(edge => edge.includes('yourHouse'))).toBe(true)
  expect(fixture.submitted).toHaveLength(0)
  await page.keyboard.press('Escape')
  await expect(page.locator('.ah-map-edges .is-visible')).toHaveCount(0)
  await expect(page.getByRole('region', { name: '装备与威胁' })).toBeVisible()
  expect(fixture.submitted).toHaveLength(0)
})

test('P5 Edge 实际对局地图验收截图', async ({ page, request }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.route('**/api/start', async route => {
    const body = route.request().postDataJSON()
    await route.continue({ postData: JSON.stringify({ ...body,
      settings: { ...body.settings, legacyAutoStart: true, playerCount: 1, seed: 'p5-acceptance' } }) })
  })
  await page.goto('/index.html')
  await page.locator('.bg-card').filter({ hasText: '诡镇奇谈' }).click()
  const started = page.waitForResponse('**/api/start')
  await page.getByRole('button', { name: '开始新游戏' }).click()
  let session = (await (await started).json()).session
  for (let i = 0; session.state.scenario?.id !== 'theMidnightMasks'; i++) {
    expect(i).toBeLessThan(160)
    const moves = session.state.legalMoves
    const move = session.state.pendingChoice
      ? moves.find(item => ['done', 'skip', 'self'].includes(item.optionId)) || moves[0]
      : moves.find(item => item.action === 'endTurn')
    expect(move).toBeTruthy()
    const response = await request.post('/api/move', { data: { sessionId: session.sessionId,
      revision: session.state.revision, move: { ...move, revision: session.state.revision } } })
    expect(response.ok()).toBe(true)
    session = (await response.json()).session
  }
  for (let i = 0; session.state.pendingChoice; i++) {
    expect(i).toBeLessThan(20)
    const move = session.state.legalMoves.find(item => item.optionId === 'done') || session.state.legalMoves[0]
    const response = await request.post('/api/move', { data: { sessionId: session.sessionId,
      revision: session.state.revision, move: { ...move, revision: session.state.revision } } })
    expect(response.ok()).toBe(true)
    session = (await response.json()).session
  }
  await page.getByRole('button', { name: '刷新局势' }).click()
  await expect(page.locator('.ah-map-node')).toHaveCount(9)
  await expect(page.locator('.ah-map-edges line')).not.toHaveCount(0)
  await page.locator('.ah-map-viewport').press('0')
  await expect(page.locator('.ah-map-node .ah-table-art').first()).toHaveAttribute('data-image-state', 'displayable')
  await expect.poll(() => page.locator('.ah-map-node .ah-table-art img').first().evaluate(img => img.naturalWidth)).toBeGreaterThan(0)
  await expect.poll(() => page.locator('.ah-map-node .ah-table-art').evaluateAll(elements =>
    elements.filter(el => el.dataset.imageState !== 'displayable').length)).toBe(0)
  await expect.poll(() => page.locator('.ah-hand .ah-table-art').evaluateAll(elements =>
    elements.filter(el => el.dataset.imageState !== 'displayable').length)).toBe(0)
  const output = path.join(root, 'artifacts', 'arkham-calm-acceptance.png')
  fs.mkdirSync(path.dirname(output), { recursive: true })
  await page.evaluate(async () => {
    await Promise.all([...document.querySelectorAll('.ah-table-art img')].map(img => img.decode().catch(() => {})))
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  })
  await page.screenshot({ path: output, animations: 'disabled' })
  expect(fs.statSync(output).size).toBeGreaterThan(20_000)
  await page.locator('.ah-map-node[data-location-id="yourHouse"]').click()
  await expect(page.getByRole('button', { name: '查看地点详情' })).toBeVisible()
  await page.mouse.move(10, 10)
  await expect.poll(() => page.locator('.ah-map-node .ah-table-art').evaluateAll(elements =>
    elements.filter(el => el.dataset.imageState !== 'displayable').length)).toBe(0)
  await page.evaluate(async () => {
    await Promise.all([...document.querySelectorAll('.ah-table-art img')].map(img => img.decode().catch(() => {})))
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  })
  await page.screenshot({ path: path.join(root, 'artifacts', 'arkham-calm-routes.png'), animations: 'disabled' })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.locator('.ah-map-viewport').press('0')
  await page.evaluate(async () => {
    await Promise.all([...document.querySelectorAll('.ah-table-art img')].map(img => img.decode().catch(() => {})))
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  })
  await page.screenshot({ path: path.join(root, 'artifacts', 'arkham-calm-mobile.png'), animations: 'disabled' })
})
