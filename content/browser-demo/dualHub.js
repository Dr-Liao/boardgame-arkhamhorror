// 浏览器验收专用的「双线演示」战役（默认不注册）。
//
// 为什么需要它：P5 的开局模式面板只有在**声明 parts 的战役**里才会出现；真实《食梦者》
// 要等 P8 注册章节后才可启动。为了让面板/座位分线有可点的浏览器入口，这里复用核心
// 《聚会》的两份关卡做一份演示战役，仅在 `ARKHAM_BROWSER_DEMO=dualHub` 时由
// content/registered.js 注册（playwright.tde-ui.config.mjs 的 webServer 会设置该环境变量）。
//
// 它不进入玩家可见的正式内容：不设该环境变量时，这个模块不会被调用。
import { manifest as core } from '../campaigns/nightOfTheZealot/manifest.js'
import * as gathering from '../campaigns/nightOfTheZealot/scenarios/theGathering/index.js'
import * as masks from '../campaigns/nightOfTheZealot/scenarios/theMidnightMasks/index.js'
import { dualPartFlow } from '../../src/campaign/part-flow.js'

export const DEMO_CAMPAIGN_ID = 'dualHubDemo'

const SCENARIOS = [
  { id: 'demoA1', part: 'A' },
  { id: 'demoB1', part: 'B' },
]

export function dualHubDemoBundle() {
  // A 线用第一幕、B 线用第二幕：出发准备分屏要能显示两线不同的关卡名与插图。
  const SOURCES = { A: gathering, B: masks }
  const scenarios = SCENARIOS.map(({ id, part }) => {
    const source = SOURCES[part]
    return {
      manifest: { ...source.manifest, id, campaignId: DEMO_CAMPAIGN_ID, behaviorIds: [id] },
      scenario: { ...source.scenario, id, behaviorId: id },
      behavior: {
        ...source.behavior,
        id,
        ...(part === 'A' ? {
          afterChaosBagSetup(state, events) {
            source.behavior.afterChaosBagSetup?.(state, events)
            seedDemoInteractions(state)
          },
        } : {}),
      },
    }
  })
  const parts = {
    A: { name: '梦寻', chapters: [{ scenarioId: 'demoA1' }] },
    B: { name: '梦网', chapters: [{ scenarioId: 'demoB1' }] },
  }
  const campaign = {
    ...core,
    id: DEMO_CAMPAIGN_ID,
    name: '双线演示（浏览器验收）',
    nameEn: 'Dual-Line Demo',
    status: 'playable',
    // P5 只验证机制闭环：这份演示战役显式打开双线开闸；真实 TDE 在 P9.5 验收后才置 open。
    dualLineGate: 'open',
    scenarioIds: SCENARIOS.map(item => item.id),
    unlock: Object.fromEntries(SCENARIOS.map(item => [item.id, []])),
    parts,
    modes: ['singleA', 'singleB', 'pick', 'parallel'],
    flow: dualPartFlow(parts),
  }
  return { campaigns: [campaign], scenarios }
}

function seedDemoInteractions(state) {
  const here = (state.locations || []).find(location => location.id === state.investigators?.[0]?.location) || state.locations?.[0]
  if (here) {
    here.veiled = true
    here.clues = 0
    here.revealed = true
    here.backCode = 'demo-story'
    here.dreamGate = true
    here.verticalIndex = 0
  }
  const other = (state.locations || []).find(location => location && location !== here)
  if (other) other.verticalIndex = 1
  state.tokenBags = { infestation: { tokens: ['skull', 'tablet', 'tablet', 'cultist', 'cultist'], revealed: [] } }
  state.infestedLocations = []
  state.investigatorCounters = { alarmLevel: { seats: [1], max: 5 } }
  state.markerCounts = { reference: 3 }
  const host = state.enemies?.[0] || {
    id: 'demo-swarm-host', name: '蜂拥头领', code: '01116', health: 2, fight: 2, evade: 2,
    damage: 1, horror: 1, location: here?.id || null, engaged: [], traits: [],
  }
  host.swarmCards = [
    { id: 'swarm1', code: 'secret-a', source: 'swarming', defeated: false },
    { id: 'swarm2', code: 'secret-b', source: 'swarming', defeated: false },
  ]
  if (!state.enemies?.includes(host)) (state.enemies ||= []).push(host)
  const inv = state.investigators?.[0]
  if (inv) inv.hiddenCards = ['hidden-demo']
  state.campaign.epilogueMatrix = {
    a: [{ id: 'a1', title: 'A' }],
    b: [{ id: 'b1', title: 'B' }, { id: 'b2', title: 'B2' }],
    entries: {
      'a1|b1': { title: '已到达的结局', textKey: 'reached' },
      'a1|b2': { title: '不应出现', textKey: 'secret-ending' },
    },
  }
  state.campaign.epilogueResolved = { a: 'a1', b: 'b1' }
}

export function registerDualHubDemo(registerContentBundle) {
  registerContentBundle(dualHubDemoBundle())
}
