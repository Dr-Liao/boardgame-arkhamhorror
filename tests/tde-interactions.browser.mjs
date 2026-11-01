// 《食梦者》（TDE）P9 交互 3–10 浏览器验收（桌面 1440×950 / 移动 390×844，每条交互 × 2 视口 = 16 例）。
//
// 口径（task-2 / docs/tde-interactions.md / 路线图 §7.1）：
//   · 用真实章节状态驱动真实 web/ 牌桌：spec 进程注册可启动外壳（tests/tde-browser-shell.mjs），
//     真实 src/engine 的 createGameState 建局 → viewState 投影 → page.route 拦截 /api/start 注入；
//     面板是生产模块 web/tde-ui.js 渲染的 [data-interaction="…"] 分区（挂载在 web/game-ui.js 的牌桌上），
//     按钮只提交 view.legalMoves 里的动作（/api/move 在 spec 进程用真实引擎 applyMove 结算）。
//   · 「自然」= 真实建局后开局即有的状态；「seed」= 用引擎公开原语/真实 state 字段补出来的状态。
//     每条用例的 seed 来源写在本文件 CASES[].seedSource 注释里，并写入 handoff
//     artifacts/migration/tde/p9-recon/browser-results.json（Lead 写文档/翻 verified 用）。
//
// 8 条交互与选章（自然/seed 见每条）：
//   3 swarmPanel        A2 寻觅卡达斯 —— 自然：真实 setupEnemies 的「一群乌尼斯」带 1 张蜂拥卡
//   4 infestationBag    B1 清醒噩梦   —— 自然空袋 + seed 7 枚（06078 剧情卡 flags 的真实袋内容）
//   5 alarmLevel        A3 月之暗面   —— 自然：每人警报 1/5；再加第二 AI 座位并提升到 3/5
//   6 hiddenHand        A4 神居之所   —— seed：真实 TDE 调查员 06005 + 其专属弱点 06017（引擎
//                                        hiddenEnemyInHand）+ A4 真实隐藏形态 06306（章节按规则关闭其入口）
//   7 veiledFlip        B3 无归之地   —— 自然掩藏地点；把所在地点线索清零后走真实 flipVeiled 行动
//   8 markerProgress    B3 无归之地   —— seed：reference 计数 3（章节 behavior 在桥梁进度时用同一原语写）
//   9 verticalStack     B2 万千骇形   —— seed：真实神秘阶梯 STAIRS_IDS + 引擎 linkVerticalChain
//                                        （B4 大网是 layout 静态坐标、无 verticalChain 面板，差异见 handoff 与
//                                        scenario spec 的 B4 截图）
//  10 dreamGateEpilogue A4 神居之所   —— seed：引擎 placeDreamGate（06015a 梦境之门）+ 真实战役 16 段矩阵
//                                        的已到达格；未到达格不得泄露
import { test, expect } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import {
  installTdeBrowserShell, loadTdeBrowserRuntime, buildChapterState, projectView,
  openInjectedTdeTable, captureEvidence, assertNoHorizontalOverflow, VIEWPORTS,
} from './tde-browser-shell.mjs'

const output = fileURLToPath(new URL('../../../artifacts/tde-migration/', import.meta.url))
mkdirSync(output, { recursive: true })

const shell = await installTdeBrowserShell()
const runtime = await loadTdeBrowserRuntime()
const chapterById = new Map(shell.chapters.map(chapter => [chapter.id, chapter]))

// 真实数据来源（不手写卡面文案/卡号清单）。
const { ALL_CARDS } = await import('../src/cards/cards-data.js')
const availability = await import('../src/deck/availability.js')
const kadathDefinition = await import('../content/campaigns/theDreamEaters/scenarios/aThousandShapesOfHorror/definition.js')
const godsDefinition = await import('../content/campaigns/theDreamEaters/scenarios/whereTheGodsDwell/definition.js')
const infestationStory = (await import('../src/cards/encounter-entries/theDreamEaters/wakingNightmare/06078.js')).default
const INFESTATION_TOKENS = [...infestationStory.flags.infestationBag.tokens]
// 06005 派翠丝·海瑟薇的专属依赖：06017「异次元监视者」是引擎 hiddenEnemyInHand（可攻击/躲避的敌人形态），
// 06016 是普通弱点。这里从真实单卡条目读 hiddenEnemyInHand 声明，不写死序号。
const signatureEntries = await Promise.all(
  availability.SIGNATURES_BY_INVESTIGATOR['06005']
    .map(code => import(`../src/cards/entries/${code}.js`).then(module => module.default)))
const HIDDEN_HAND_ENEMY = signatureEntries.find(entry => entry?.hiddenEnemyInHand === true)?.code
const NYARLATHOTEP_FORM = godsDefinition.NYARLATHOTEP_COPIES[0]

const CASES = [
  {
    id: 'swarmPanel',
    index: 3,
    label: '蜂拥',
    chapterId: 'theSearchForKadath',
    panel: 'swarm',
    // 自然：A2 真实 setupEnemies 生成「一群乌尼斯」，蜂拥卡由共享钩子在 afterDeckSetup 从遭遇牌库顶放置。
    prepare() {},
    seedSource: 'natural',
    async assert({ page, region, view }) {
      const swarm = view.scenarioInteractions.swarm[0]
      const section = region.locator('[data-interaction="swarm"]')
      await expect(section.getByRole('heading', { name: '蜂拥' })).toBeVisible()
      await expect(section).toContainText(`${swarm.name}：${swarm.count} 张蜂拥卡`)
      // 不可击败原因（蜂拥头领清空前不能被击败）来自真实规则读点 swarmBlockedReason。
      expect(swarm.blockedReason).toBeTruthy()
      await expect(section).toContainText(swarm.blockedReason)
      // 宿主敌人真实在牌桌上（引擎 state.enemies → 牌桌 .ah-enemy）。
      expect(await page.locator('.ah-enemy').count()).toBeGreaterThan(0)
    },
  },
  {
    id: 'infestationBag',
    index: 4,
    label: '蛛群滋生袋',
    chapterId: 'wakingNightmare',
    panel: 'tokenBag',
    prepare(runtime, state) {
      // seed 来源：B1 behavior.ensureInfestationBag 在滋生检定里用 api.tokenBag.create 建同一只袋，
      // 袋内容来自剧情卡 06078 的 flags.infestationBag（skull×1、tablet×4、cultist×2）。
      runtime.createTokenBag(state, 'infestation', INFESTATION_TOKENS)
      // 揭示 1 枚（api.tokenBag.reveal 同一原语；rng=0 固定取第一枚 skull）。
      runtime.revealTokenFromBag(state, 'infestation', { rng: () => 0 })
      // 蛛巢地点：markInfested 是 behavior 在 [cultist] 效果里写 infestedLocations 的同一写入口。
      runtime.markInfested(state, state.investigators[0].location)
      runtime.markInfested(state, state.locations[1].id)
    },
    seedSource: 'natural-empty-bag + seed tokens/reveal/infested（06078 flags + token-bag 原语）',
    async assert({ region, view }) {
      const bag = view.scenarioInteractions.tokenBag
      const entry = bag.bags.find(item => item.id === 'infestation')
      const section = region.locator('[data-interaction="tokenBag"]')
      await expect(section.getByRole('heading', { name: '滋生袋' })).toBeVisible()
      await expect(section).toContainText(`infestation 剩余 ${entry.count}`)
      await expect(section).toContainText(`已揭示 ${entry.revealed.join('、')}`)
      await expect(section).toContainText(`蛛巢地点 ${bag.infestedCount}`)
      expect(entry.count).toBe(INFESTATION_TOKENS.length - 1)
      expect(bag.infestedCount).toBe(2)
    },
  },
  {
    id: 'alarmLevel',
    index: 5,
    label: '警报等级',
    chapterId: 'darkSideOfTheMoon',
    panel: 'alarm',
    buildOptions: { seats: 2 },
    prepare(runtime, state) {
      // 自然：A3 被俘开场给每位调查员警报 1（behavior 用 api.counters.add）。再按座位提升 2 点，
      // seed 来源 = src/engine/counters.js 的 addCounter（behavior 同一原语）。
      runtime.addCounter(state, 1, 'alarmLevel', 2)
    },
    seedSource: 'natural seat0=1 + seed seat1=3（counters 原语，按座位）',
    async assert({ region, view }) {
      const alarm = view.scenarioInteractions.alarm
      const section = region.locator('[data-interaction="alarm"]')
      await expect(section.getByRole('heading', { name: '警报等级' })).toBeVisible()
      for (const seat of alarm.seats) {
        await expect(section).toContainText(`座位 ${seat.seat + 1}：${seat.value}/${alarm.max}`)
      }
      expect(alarm.seats.map(seat => seat.value)).toEqual([1, 3])
      expect(alarm.max).toBe(5)
    },
  },
  {
    id: 'hiddenHand',
    index: 6,
    label: '隐藏手牌',
    chapterId: 'whereTheGodsDwell',
    panel: 'hidden',
    buildOptions: { playerInvestigator: '06005' },
    prepare(runtime, state) {
      // seed 来源：A4「5 形态奈亚拉托提普抽到后秘密进手牌」与 06017 专属弱点都走 engine.placeHiddenCard
      // （src/engine/hidden-rules.js 的 api.hiddenCards.place 同一读点）。
      const inv = state.investigators[0]
      runtime.placeHiddenCard(state, inv, {
        code: HIDDEN_HAND_ENEMY, name: ALL_CARDS[HIDDEN_HAND_ENEMY]?.nameZh || HIDDEN_HAND_ENEMY, text: '',
      }, [])
      runtime.placeHiddenCard(state, inv, {
        code: NYARLATHOTEP_FORM, name: ALL_CARDS[NYARLATHOTEP_FORM]?.nameZh || NYARLATHOTEP_FORM, text: '',
      }, [])
    },
    seedSource: `seed hiddenCards：06005 专属弱点 ${HIDDEN_HAND_ENEMY} + A4 隐藏形态 ${NYARLATHOTEP_FORM}（hidden 原语）`,
    async assert({ region, view }) {
      const hidden = view.scenarioInteractions.hidden.seats.find(item => item.seat === 0)
      const section = region.locator('[data-interaction="hidden"]')
      await expect(section.getByRole('heading', { name: '隐藏手牌' })).toBeVisible()
      await expect(section).toContainText(`你有 ${hidden.count} 张（${hidden.codes.join('、')}）`)
      // 敌人形态在手牌时的攻击/躲避入口：真实 legalMoves 的 fightHidden/evadeHidden → 面板按钮。
      const entryButtons = section.locator('.ah-tde-actions button')
      await expect(entryButtons).toHaveCount(2)
      await expect(section.getByRole('button', { name: /攻击手牌中的/ })).toBeVisible()
      await expect(section.getByRole('button', { name: /躲避手牌中的/ })).toBeVisible()
      const hiddenMoves = view.legalMoves
        .filter(move => ['fightHidden', 'evadeHidden'].includes(move.action))
        .map(move => move.cardId)
      expect([...new Set(hiddenMoves)]).toEqual([HIDDEN_HAND_ENEMY])
      // A4 章节规则关闭 06306 的通用入口（只能经塔/议程揭示）→ 不可用入口不得画成按钮。
      await expect(section.getByRole('button', { name: /奈亚拉托提普/ })).toHaveCount(0)
    },
  },
  {
    id: 'veiledFlip',
    index: 7,
    label: '掩藏地点翻面',
    chapterId: 'pointOfNoReturn',
    panel: 'veiled',
    prepare(runtime, state) {
      // 自然：B3 辛之墓穴是 Veiled 地点且调查员在起点。引擎翻面条件是「该地点无线索」，
      // 真实玩法靠调查拿走线索；这里只清真实 state 字段 clues（非新造字段），不伪造翻面结果。
      const here = state.locations.find(location => location.id === state.investigators[0].location)
      here.clues = 0
    },
    seedSource: 'natural veiled 地点 + seed 所在地点 clues=0（引擎翻面门槛）',
    async assert({ page, region, view, state }) {
      const here = state.locations.find(location => location.id === state.investigators[0].location)
      const other = state.locations.find(location => location.veiled && location.id !== here.id)
      const storyCode = here.backCode || here.linkedCardCode || here.storyCode
      const section = region.locator('[data-interaction="veiled"]')
      await expect(section.getByRole('heading', { name: '掩藏地点' })).toBeVisible()
      await expect(section).toContainText(here.name)
      // 不可用原因：不在掩藏地点（真实观察投影的 here=false → tde.veiled.notHere）。
      if (other) await expect(section).toContainText('你不在这个地点')
      const flip = section.getByRole('button', { name: `翻开掩藏地点「${here.name}」` })
      await expect(flip).toBeVisible()
      const moved = page.waitForResponse(response => response.url().endsWith('/api/move')
        && response.request().postDataJSON()?.move?.action === 'flipVeiled')
      await flip.click()
      const payload = await (await moved).json()
      expect(payload.ok, payload.error).toBe(true)
      // 翻面后读背面故事卡：面板显示「背面 <code>」，且不能再翻。
      await expect(section).toContainText(`背面 ${storyCode}`)
      await expect(section.getByRole('button', { name: /翻开掩藏地点/ })).toHaveCount(0)
    },
  },
  {
    id: 'markerProgress',
    index: 8,
    label: '参考计数',
    chapterId: 'pointOfNoReturn',
    panel: 'markers',
    prepare(runtime, state) {
      // seed 来源：B3 behavior.preScenarioSetup 在「桥梁进度 StepsOfTheBridge ≥1」时用
      // api.markers.add('reference', …) 写同一 state.markerCounts 字段（src/engine/marker-count.js）。
      runtime.addMarker(state, 'reference', 3)
    },
    seedSource: 'seed reference=3（marker-count 原语，章节同一写入口）',
    async assert({ region, view }) {
      const marker = view.scenarioInteractions.markers.find(item => item.id === 'reference')
      const section = region.locator('[data-interaction="markers"]')
      await expect(section.getByRole('heading', { name: '参考计数' })).toBeVisible()
      await expect(section).toContainText(`reference：${marker.count}`)
      expect(marker.count).toBe(3)
    },
  },
  {
    id: 'verticalStack',
    index: 9,
    label: '纵向堆叠',
    chapterId: 'aThousandShapesOfHorror',
    panel: 'vertical',
    prepare(runtime, state) {
      // seed 来源：B2 的 6 张「神秘阶梯」真实地点 id 来自 definition.js 的 STAIRS_IDS；
      // 章节 behavior 在幕 1 背面用 api.verticalChain.link 建立纵向链（src/engine/vertical-chain.js），
      // 这里用同一引擎原语 + 引擎 placeLocation 把地点铺到牌桌上。
      // 说明：B4《编织宇宙》大网是 layout 静态坐标（theGreatWeb1–3 纵向一排），没有 verticalChain 状态面板，
      // 其纵向布局证据见 scenario spec 的 B4 实机截图。
      for (const id of kadathDefinition.STAIRS_IDS) runtime.placeLocation(state, id, [])
      runtime.linkVerticalChain(state, [...kadathDefinition.STAIRS_IDS])
    },
    seedSource: `seed B2 神秘阶梯 ${kadathDefinition.STAIRS_IDS.length} 层（placeLocation + linkVerticalChain 原语）`,
    async assert({ region, view }) {
      const chain = view.scenarioInteractions.vertical
      const section = region.locator('[data-interaction="vertical"]')
      await expect(section.getByRole('heading', { name: '纵向堆叠' })).toBeVisible()
      const items = section.locator('ol > li')
      await expect(items).toHaveCount(chain.length)
      expect(chain.map(item => item.index)).toEqual([0, 1, 2, 3, 4, 5])
      const dataVertical = await items.evaluateAll(nodes => nodes.map(node => node.dataset.vertical))
      expect(dataVertical).toEqual(['0', '1', '2', '3', '4', '5'])
      for (const item of chain) expect(item.name).toBeTruthy()
      await expect(items.first()).toContainText(chain[0].name)
    },
  },
  {
    id: 'dreamGateEpilogue',
    index: 10,
    label: '梦境之门与结局',
    chapterId: 'whereTheGodsDwell',
    panel: 'epilogue',
    prepare(runtime, state) {
      // seed 来源：梦境之门是真实卡 06015a/b 的绑定地点，由 src/engine/dream-gate.js 的 placeDreamGate 放置
      // （卢克的绑定地点，通用机制）；结局矩阵直接取真实战役 manifest.epilogueMatrix（16 段），
      // 已到达格写 campaign.epilogueResolved（P9.5 双线尾声结算用的真实字段）。
      runtime.placeDreamGate(state, '06015a', { ownerCode: state.investigators[0].code })
      const matrix = chapterById.get('whereTheGodsDwell').epilogueMatrix
      state.campaign.epilogueMatrix = structuredClone(matrix)
      state.campaign.epilogueResolved = { a: matrix.a[0].id, b: matrix.b[1].id }
    },
    seedSource: 'seed placeDreamGate(06015a) + 真实 TDE 16 段 epilogueMatrix 的已到达格',
    async assert({ page, region, view, state }) {
      const epilogue = view.scenarioInteractions.epilogue
      const section = region.locator('[data-interaction="epilogue"]')
      await expect(section.getByRole('heading', { name: '梦境之门与结局' })).toBeVisible()
      await expect(section).toContainText(`梦境之门：${epilogue.gates[0].name}`)
      expect(epilogue.status).toBe('reached')
      // 已到达时面板显示该格标题（没有标题才回退到「结局已到达」文案）。
      if (epilogue.title) await expect(section).toContainText(epilogue.title)
      else await expect(section).toContainText('结局已到达')
      // 未到达格不得泄露：矩阵里其他格子的标题 / 正文 key 不得出现在页面或投影里。
      const matrix = state.campaign.epilogueMatrix
      const reached = state.campaign.epilogueResolved
      const unreached = []
      for (const a of matrix.a) {
        for (const b of matrix.b) {
          if (a.id === reached.a && b.id === reached.b) continue
          const cell = matrix.entries[`${a.id}|${b.id}`] || {}
          if (cell.title) unreached.push(cell.title)
          if (cell.textKey) unreached.push(cell.textKey)
        }
      }
      expect(unreached.length).toBeGreaterThan(0)
      const bodyText = await page.locator('body').innerText()
      for (const secret of unreached) expect(bodyText).not.toContain(secret)
      expect(JSON.stringify(view.scenarioInteractions.epilogue)).not.toContain('secret')
    },
  },
]

for (const [viewport, width, height] of VIEWPORTS) {
  for (const interactionCase of CASES) {
    test(`P9 交互 ${interactionCase.index} ${interactionCase.id}（${interactionCase.label}）在${viewport}端真实章节面板可读、可操作、可截图`, async ({ page }, testInfo) => {
      testInfo.setTimeout(120_000)
      await page.setViewportSize({ width, height })
      const chapter = chapterById.get(interactionCase.chapterId)
      const state = buildChapterState(runtime, chapter, interactionCase.buildOptions)
      interactionCase.prepare(runtime, state)
      const view = projectView(runtime, state)
      const { errors } = await openInjectedTdeTable(page, runtime, state, { seats: interactionCase.buildOptions?.seats || 1 })
      const region = page.getByRole('region', { name: '场景交互' })
      await expect(region).toBeVisible()
      // 八类面板之一的真实分区必须出现（tde-ui.js 的 section[data-interaction]）。
      await expect(region.locator(`[data-interaction="${interactionCase.panel}"]`)).toBeVisible()
      await interactionCase.assert({ page, region, view, state })
      expect(errors).toEqual([])
      expect(await assertNoHorizontalOverflow(page)).toBe(true)
      const shot = `${output}p9-interaction-${interactionCase.id}-${viewport}.png`
      await captureEvidence(testInfo, page, shot)
      testInfo.annotations.push({ type: 'interaction', description: interactionCase.id })
      // 恰好一个 scenario annotation（真实章节 id；报告器按它汇总逐章/交互证据）。
      testInfo.annotations.push({ type: 'scenario', description: interactionCase.chapterId })
    })
  }
}

// 口径（2026-11-01）：隐藏手牌区块只在存在可攻击/躲避入口时渲染。
// 只有非敌人形态的隐私牌（06319「无眠之旅·谬论」是真实隐私遭遇牌，不带 hiddenEnemyInHand）时，
// 场景交互条不得再出现 hidden 分区或兜底提示；隐私牌本身仍留在手牌区、弃牌动作为普通行动按钮。
const NON_ENEMY_HIDDEN = '06319'

for (const [viewport, width, height] of VIEWPORTS) {
  test(`P9 交互 6 隐藏手牌：只有非敌人形态隐私牌时不渲染区块（${viewport}）`, async ({ page }, testInfo) => {
    testInfo.setTimeout(120_000)
    await page.setViewportSize({ width, height })
    // A2 自然带蜂拥面板 → 场景交互条本身可见；再 seed 一张非敌人形态的隐私牌。
    const chapter = chapterById.get('theSearchForKadath')
    const state = buildChapterState(runtime, chapter)
    runtime.placeHiddenCard(state, state.investigators[0], {
      code: NON_ENEMY_HIDDEN, name: ALL_CARDS[NON_ENEMY_HIDDEN]?.nameZh || NON_ENEMY_HIDDEN, text: '',
    }, [])
    const view = projectView(runtime, state)
    // 投影里仍有 hidden（数据在），只是界面因为没有战斗/躲避入口不渲染该分区。
    expect(view.scenarioInteractions.hidden).toBeTruthy()
    const { errors } = await openInjectedTdeTable(page, runtime, state)
    const region = page.getByRole('region', { name: '场景交互' })
    await expect(region).toBeVisible()
    await expect(region.locator('[data-interaction="hidden"]')).toHaveCount(0)
    await expect(region).not.toContainText('隐藏手牌')
    await expect(region).not.toContainText('手牌里没有可攻击或躲避的敌人形态')
    expect(errors).toEqual([])
    testInfo.annotations.push({ type: 'scenario', description: chapter.id })
  })
}
