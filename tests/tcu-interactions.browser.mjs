// 万象无终（TCU）第 4 步 P5 浏览器验收：交互面板在真实浏览器里的排版与提交。
//
// 覆盖路线图 §6 的统一要求：桌面 1440×900、移动 390×844 各至少一条路径；
// 可选/不可用（带原因）/空候选/提交动作都按服务端下发的 legalMoves 说话。
//
// 证据口径（如实说明）：战役仍是 catalog-only，序章与章节内容属 P8，所以这里**不是**从大厅进入
// 剧情的实机路径；它验证的是「真实模块 + 真实样式表 + 引擎产出的会话状态」下的面板行为：
//   · 面板模块是浏览器实际加载的 /mods/arkhamhorror/tcu-ui.js；
//   · 会话状态由引擎（fixture + 塔罗/幽灵/裂口/记忆原语）现场产出，不是手写 JSON；
//   · 提交的动作对象与 legalMoves 逐字对应，点选/键盘都走同一条 submit 回调。
// 实机路径在 P8 接通序章后补跑，并登记在 audit/tcu-migration.json 的 remaining 里。

import { test, expect } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { fixture } from './core-fixture.mjs'
import { buildTarotDeck, tarotChoiceOption, tarotInfo, drawTarot } from '../src/engine/tarot.js'
import { setExtraEncounterDeck } from '../src/engine/alt-decks.js'
import { addBreach, setLocationFlag } from '../src/engine/location-state.js'
import { markHunted, markTakenByWatcher, recordMemento } from '../src/campaign/mementos.js'
import { campaignProjection } from '../src/cards/campaign-view.js'
import { manifest as tcuManifest } from '../content/campaigns/theCircleUndone/manifest.js'

const output = fileURLToPath(new URL('../../../artifacts/tcu-migration/', import.meta.url))
mkdirSync(output, { recursive: true })

const STORY = ['05046', '05047', '05048', '05049']
const STORY_NAMES = ['加弗瑞拉·米兹拉克', '杰罗姆·戴维斯', '瓦伦蒂诺·里瓦斯', '佩妮·怀特']
// 05046–05049 的真实印刷身份。observation 对 storyInvestigator 只放行这些公开卡面字段，
// 面板据此画卡面/职业/四维/生命理智；这里按投影形状构造，避免测试再维护一份假数据。
const STORY_IDENTITY = {
  '05046': { klass: 'neutral', classLabel: '中立', subtitle: '私人警卫', stats: { willpower: 3, intellect: 2, combat: 4, agility: 1 }, health: 8, sanity: 4 },
  '05047': { klass: 'neutral', classLabel: '中立', subtitle: '约瑟夫的秘书', stats: { willpower: 2, intellect: 4, combat: 1, agility: 3 }, health: 4, sanity: 8 },
  '05048': { klass: 'neutral', classLabel: '中立', subtitle: '富有的慈善家', stats: { willpower: 1, intellect: 3, combat: 2, agility: 4 }, health: 5, sanity: 7 },
  '05049': { klass: 'neutral', classLabel: '中立', subtitle: '约瑟夫的管家', stats: { willpower: 4, intellect: 1, combat: 3, agility: 2 }, health: 7, sanity: 5 },
}
const STORY_VITALS = ['生命 8 · 理智 4', '生命 4 · 理智 8', '生命 5 · 理智 7', '生命 7 · 理智 5']

// 用真实引擎产出四个面板要的会话状态（与 tests/tcu-interactions.test.mjs 同一套构造）。
function buildPayload() {
  // 塔罗：22 张建堆后抽 1 张历史 + 3 张候选，候选全是逆位。
  const tarotState = fixture('01001', 1)
  buildTarotDeck(tarotState, { shuffle: list => [...list] })
  drawTarot(tarotState, { count: 1, orientation: 'upright' })
  const candidates = drawTarot(tarotState, { count: 3, orientation: 'reverse' }).map(tarotChoiceOption)
  const tarotChoice = {
    id: 'q1-0', kind: 'pickTarot', seat: 0, source: { kind: 'tarot', mode: 'choose', count: 3 },
    prompt: '选择一张要结算的塔罗牌（共 3 张）。', options: candidates,
  }
  const tarot = {
    sessionId: 'preview-tarot',
    state: {
      ...tarotState, pendingChoice: tarotChoice, tarot: tarotInfo(tarotState),
      legalMoves: candidates.map(option => ({ action: 'choose', choiceId: 'q1-0', optionId: String(option.id), label: option.label })),
    },
  }
  // 序章选人：4 位候选，只有 3 个动作（第 4 位用来验「置灰并说明原因」）。
  const storyState = fixture('01001', 1)
  const storyChoice = {
    id: 'q2-0', kind: 'storyInvestigator', seat: 0,
    source: { kind: 'storyInvestigator', remaining: [...STORY], seatCount: 1 },
    prompt: '选择你本次冒险使用的故事调查员。',
    options: STORY.map((code, index) => ({
      id: code, label: STORY_NAMES[index], name: STORY_NAMES[index], ...STORY_IDENTITY[code],
    })),
  }
  const story = {
    sessionId: 'preview-story',
    state: {
      ...storyState, pendingChoice: storyChoice,
      legalMoves: STORY.slice(0, 3).map((code, index) => ({ action: 'choose', choiceId: 'q2-0', optionId: code, label: STORY_NAMES[index] })),
    },
  }
  // 闹鬼：3 条印刷能力里 2 条有合法目标，最后一条置灰（无合法目标会被跳过）。
  const hauntedState = fixture('01001', 1)
  const hauntedLocation = hauntedState.locations.find(item => item.id === hauntedState.investigators[0].location)
  const hauntedChoice = {
    id: 'q3-0', kind: 'haunted', seat: 0,
    source: { kind: 'haunted', locationId: hauntedLocation.id, times: 1, order: true },
    prompt: '选择下一条要结算的闹鬼能力。',
    options: [
      { id: `${hauntedLocation.id}#0`, label: '闹鬼 - 受到 1 点恐惧。', text: '闹鬼 - 受到 1 点恐惧。', abilityIndex: 0 },
      { id: `${hauntedLocation.id}#1`, label: '闹鬼 - 你必须失去 1 次行动或失去 2 点资源。', text: '闹鬼 - 你必须失去 1 次行动或失去 2 点资源。', abilityIndex: 1 },
      { id: `${hauntedLocation.id}#2`, label: '闹鬼 - 弃掉 1 张手牌。', text: '闹鬼 - 弃掉 1 张手牌。', abilityIndex: 2 },
    ],
  }
  const haunted = {
    sessionId: 'preview-haunted',
    state: {
      ...hauntedState, pendingChoice: hauntedChoice,
      legalMoves: hauntedChoice.options.slice(0, 2).map(option => ({ action: 'choose', choiceId: 'q3-0', optionId: option.id, label: option.label })),
    },
  }
  // 战役面板：幽灵牌堆、塔罗、裂口、火盆、看守人、遗留记忆都用原语写进真实状态。
  const campaignState = fixture('01001', 1)
  const location = campaignState.locations.find(item => item.id === campaignState.investigators[0].location)
  setExtraEncounterDeck(campaignState, 'spectral', ['01004', '01005'], { shuffle: list => [...list] })
  buildTarotDeck(campaignState, { shuffle: list => [...list] })
  drawTarot(campaignState, { count: 1, orientation: 'reverse' })
  addBreach(campaignState, location.id, 2)
  setLocationFlag(campaignState, location.id, 'brazier', true)
  recordMemento(campaignState, 'mesmerizingFlute')
  recordMemento(campaignState, 'bloodyTreeCarvings')
  markHunted(campaignState, 0)
  markTakenByWatcher(campaignState, '05046')
  const campaign = {
    ...campaignState, ...campaignProjection(campaignState),
    campaign: { ...campaignState.campaign, mementoLabels: tcuManifest.mementoLabels },
  }
  return { tarot, story, haunted, campaign, locationId: location.id }
}

// 页面内的验收脚本。Playwright 会把这个函数的源码序列化进页面，所以不能引用外部变量。
async function harness(payload) {
  const createH = () => (tag, props, ...children) => {
    const el = document.createElement(tag)
    for (const [key, value] of Object.entries(props || {})) {
      if (value == null || value === false || key === 'key') continue
      if (key === 'className') el.className = value
      else if (key === 'style' && typeof value === 'object') Object.assign(el.style, value)
      else if (/^on[a-z]+$/.test(key) && typeof value === 'function') el[key.toLowerCase()] = value
      else if (key === 'disabled') el.disabled = !!value
      else el.setAttribute(key, value === true ? '' : String(value))
    }
    const add = child => {
      if (child == null || child === false) return
      if (Array.isArray(child)) { child.forEach(add); return }
      el.append(child instanceof Node ? child : document.createTextNode(String(child)))
    }
    children.forEach(add)
    return el
  }
  const h = createH()
  // 卡面放大走真实卡牌模块（与游戏内同一个 Alt 悬停交互），用于验证「可以 alt 的卡面」。
  const { installCardZoom } = await import('/mods/arkhamhorror/card-zoom.js')
  installCardZoom(h)
  const mod = await import('/mods/arkhamhorror/tcu-ui.js')
  const submitted = []
  const onSubmit = move => { submitted.push({ action: move.action, choiceId: move.choiceId, optionId: String(move.optionId) }) }
  window.__tcuSubmitted = submitted
  const inspected = []
  window.__tcuInspected = inspected
  const inspectCard = code => { inspected.push(String(code)) }
  const host = document.createElement('main')
  host.id = 'tcu-harness'
  host.className = 'ah-table ah-calm ah-theme'
  // 截图只保留面板：把大厅启动页的内容清掉（面板本身在真实页面里也是覆盖层）。
  document.body.replaceChildren(host)
  const section = (id, node) => {
    const wrap = document.createElement('section')
    wrap.className = 'ah-harness-section'
    wrap.id = id
    wrap.append(node)
    host.append(wrap)
    return wrap
  }
  const tarotModel = mod.tarotPickerModel(payload.tarot)
  section('pane-tarot', mod.renderTarotPicker(h, tarotModel, { onSubmit }))
  section('pane-story', mod.renderStoryInvestigatorPicker(h, mod.storyInvestigatorPickerModel(payload.story), { onSubmit, inspectCard }))
  section('pane-haunted', mod.renderHauntedChoice(h, mod.hauntedChoiceModel(payload.haunted), { onSubmit }))
  const campaignModel = mod.tcuCampaignModel(payload.campaign)
  section('pane-campaign', mod.renderTcuCampaignPanel(h, campaignModel))
  // 地点徽标：用牌桌自己的徽标 class（与 game-ui 同一份结构）。
  const badgeHost = document.createElement('div')
  badgeHost.className = 'ah-loc-badges'
  for (const badge of mod.locationTcuBadges(payload.campaign, payload.locationId)) {
    const el = document.createElement('button')
    el.type = 'button'
    el.className = 'ah-loc-badge ah-loc-' + badge.kind
    el.dataset.mapInfo = badge.kind
    el.textContent = badge.label + (badge.value == null ? '' : ' ' + badge.value)
    el.title = badge.title
    badgeHost.append(el)
  }
  section('pane-badges', badgeHost)
  // 阵法多技能：与服务端 skillTest 同形。
  const skill = mod.multiSkillTestInfo({ skillTest: { skill: ['willpower', 'intellect', 'combat', 'agility'], printedValue: 20, value: 20, difficulty: 20, actionKind: 'circle' } })
  const skillHost = document.createElement('div')
  skillHost.className = 'ah-test-preview is-multi-skill'
  skillHost.textContent = skill.label + ' ' + skill.base + ' / 难度 ' + skill.difficulty
  section('pane-skill', skillHost)
  return {
    tarot: {
      candidates: tarotModel.candidates.length,
      selectable: tarotModel.selectable,
      remaining: tarotModel.remaining,
      historyChips: document.querySelectorAll('#pane-tarot .ah-tarot-chip').length,
      buttons: [...document.querySelectorAll('#pane-tarot .ah-tcu-option')].map(button => ({
        optionId: button.dataset.optionId, disabled: button.disabled, text: button.textContent.trim(),
      })),
    },
    story: {
      candidates: document.querySelectorAll('#pane-story .ah-tcu-option').length,
      disabled: [...document.querySelectorAll('#pane-story .ah-tcu-option')].filter(button => button.disabled).length,
      names: [...document.querySelectorAll('#pane-story .ah-story-face strong')].map(node => node.textContent),
      classes: [...document.querySelectorAll('#pane-story .ah-story-class')].map(node => node.textContent),
      stats: document.querySelectorAll('#pane-story .ah-story-stat').length,
      vitals: [...document.querySelectorAll('#pane-story .ah-story-vitals')].map(node => node.textContent),
      arts: [...document.querySelectorAll('#pane-story .ah-story-art .ah-table-art')].map(node => node.dataset.artCode),
      details: [...document.querySelectorAll('#pane-story [data-story-detail]')].map(node => node.dataset.storyDetail),
    },
    haunted: {
      rows: document.querySelectorAll('#pane-haunted .ah-haunted-row').length,
      disabled: [...document.querySelectorAll('#pane-haunted .ah-tcu-option')].filter(button => button.disabled).length,
      order: [...document.querySelectorAll('#pane-haunted .ah-haunted-index')].map(node => node.textContent),
      options: [...document.querySelectorAll('#pane-haunted .ah-tcu-option')].map(node => node.dataset.optionId),
      location: document.querySelector('#pane-haunted h2').textContent,
    },
    campaign: {
      rows: document.querySelectorAll('#pane-campaign .ah-campaign-tcu > ul > li').length,
      watcher: document.querySelector('#pane-campaign .ah-tcu-watcher')?.textContent || '',
      mementos: [...document.querySelectorAll('#pane-campaign [data-memento]')].map(node => node.dataset.memento),
      badgeKinds: [...document.querySelectorAll('#pane-badges .ah-loc-badge')].map(node => node.dataset.mapInfo),
    },
    overflow: {
      host: host.scrollWidth - host.clientWidth,
      widest: Math.max(0, ...[...document.querySelectorAll('.ah-tcu-panel, .ah-campaign-tcu')]
        .map(node => node.scrollWidth - node.clientWidth)),
    },
    skill: skillHost.textContent,
  }
}

for (const [label, width, height] of [['desktop', 1440, 950], ['mobile', 390, 844]]) {
  test(`P5 万象无终交互面板在${label}端可读、可点、可键盘操作`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    await page.goto('/index.html')
    // 真实样式表（含 tcu-panels.css 的 @import），与游戏内是同一份。
    await page.addStyleTag({ url: '/mods/arkhamhorror/style.css' })
    await page.addStyleTag({ content: `
      body { margin: 0; background: #0c1411; }
      #tcu-harness { padding: 16px; background: #0c1411; }
      #tcu-harness .ah-harness-section { margin: 0 0 18px; }
      #tcu-harness .ah-choice { position: static; inset: auto; transform: none; width: 100%; max-width: 100%; max-height: none; }
      #tcu-harness .ah-campaign-tcu { padding: 10px 12px; border: 1px solid var(--ah-edge, rgba(209,182,125,.27)); border-radius: 10px; }
    ` })
    const result = await page.evaluate(harness, buildPayload())

    // 塔罗：3 张候选、牌库 18 张、1 张已抽历史；每张都写着编号与逆位。
    expect(result.tarot.candidates).toBe(3)
    expect(result.tarot.remaining).toBe(18)
    expect(result.tarot.historyChips).toBe(1)
    expect(result.tarot.selectable).toBe(3)
    expect(result.tarot.buttons.every(button => button.disabled === false)).toBe(true)
    expect(result.tarot.buttons.some(button => button.text.includes('逆位'))).toBe(true)
    // 序章选人：4 位候选、1 位因缺少动作置灰。
    expect(result.story.candidates).toBe(4)
    expect(result.story.disabled).toBe(1)
    expect(result.story.names).toEqual(STORY_NAMES)
    // 卡面身份与卡图：职业、副标题、四维、生命/理智都来自服务端选项投影；
    // 每位候选都画真实卡面（可 Alt 放大），并有独立「详情」按钮（点卡=选择，点详情=档案）。
    expect(result.story.classes).toEqual(['中立', '中立', '中立', '中立'])
    expect(result.story.stats).toBe(16)
    expect(result.story.vitals).toEqual(STORY_VITALS)
    expect(result.story.arts).toEqual(STORY)
    expect(result.story.details).toEqual(STORY)
    // 闹鬼：3 条能力按 1/2/3 排序，最后一条没有合法目标。
    expect(result.haunted.rows).toBe(3)
    expect(result.haunted.disabled).toBe(1)
    expect(result.haunted.order).toEqual(['1', '2', '3'])
    expect(result.haunted.location.length).toBeGreaterThan(0)
    // 战役面板：幽灵牌堆、塔罗牌组、裂口、火盆四行 + 看守人 + 遗留记忆。
    expect(result.campaign.rows).toBe(4)
    expect(result.campaign.watcher).toContain('在追捕')
    expect(result.campaign.mementos).toEqual(['mesmerizingFlute', 'bloodyTreeCarvings'])
    expect(result.campaign.badgeKinds).toEqual(['breach', 'brazier'])
    expect(result.skill).toContain('意志+智识+战斗+敏捷')
    // 没有横向溢出（1px 容差）。
    expect(result.overflow.host).toBeLessThanOrEqual(1)
    expect(result.overflow.widest).toBeLessThanOrEqual(1)

    // 点选：塔罗第一张、序章第二位、闹鬼第二条，都走同一条 submit 回调。
    const tarotIds = result.tarot.buttons.map(button => button.optionId)
    await page.locator('#pane-tarot .ah-tcu-option').first().click()
    await page.locator('#pane-story .ah-tcu-option').nth(1).click()
    await page.locator('#pane-haunted .ah-tcu-option').nth(1).click()
    // 键盘：聚焦第三张塔罗牌按 Enter。
    await page.locator('#pane-tarot .ah-tcu-option').nth(2).focus()
    await page.keyboard.press('Enter')
    const submitted = await page.evaluate(() => window.__tcuSubmitted)
    expect(submitted).toEqual([
      { action: 'choose', choiceId: 'q1-0', optionId: tarotIds[0] },
      { action: 'choose', choiceId: 'q2-0', optionId: '05047' },
      { action: 'choose', choiceId: 'q3-0', optionId: result.haunted.options[1] },
      { action: 'choose', choiceId: 'q1-0', optionId: tarotIds[2] },
    ])
    // 「详情」按钮只看档案、不提交选择：点完之后卡号按候选顺序进入 inspectCard 回调。
    const submittedBeforeDetail = submitted.length
    await page.locator('#pane-story [data-story-detail]').first().click()
    expect(await page.evaluate(() => window.__tcuInspected)).toEqual(['05046'])
    expect(await page.evaluate(() => window.__tcuSubmitted.length)).toBe(submittedBeforeDetail)

    // 卡面「可以 Alt」：按住 Alt 悬停第一张卡 → 放大卡图 + 规则文字；松开即收起。
    const zoom = page.locator('.ah-card-zoom')
    await expect(zoom).toHaveCount(0)
    await page.locator('#pane-story .ah-story-art .ah-table-art').first().hover()
    await page.keyboard.down('Alt')
    await expect(zoom).toBeVisible()
    await expect(zoom).toHaveAttribute('data-zoom-for', '05046')
    await expect(zoom.locator('h3')).toHaveText(STORY_NAMES[0])
    await expect(zoom.locator('.ah-card-zoom-rules')).not.toBeEmpty()
    await page.keyboard.up('Alt')
    await expect(zoom).toHaveCount(0)

    // 置灰的选项点不动：第 4 位故事调查员没有动作，点击不产生提交。
    const before = submitted.length
    await page.locator('#pane-story .ah-tcu-option').nth(3).click({ force: true }).catch(() => {})
    expect(await page.evaluate(() => window.__tcuSubmitted.length)).toBe(before)

    const shot = `${output}p5-interactions-${label}.png`
    await page.screenshot({ path: shot, fullPage: true, animations: 'disabled' })
    // 截图路径经 annotation 交给 tools/playwright-tcu-reporter.mjs（账本由 runner 生成）。
    test.info().annotations.push({ type: 'screenshot', description: shot })
    expect(await page.evaluate(() => document.body.scrollWidth <= document.body.clientWidth + 1)).toBe(true)
  })
}
