// 批次 2 支线测试共用夹具（不是测试文件：只被 tests/side-story-*.test.mjs import）。
//
// 提供两件事：
//   1. driveHub：从大厅（campaignHub）走到 inScenario 的标准动作序列；
//   2. hostFixtureFor：原创宿主主战役夹具——开场关 → 关间 choice（eachInvestigatorXp + spendExperience）
//      → 生产支线关卡（克隆为宿主战役的一章）→ 原定下一章（hostReturn）。用于验证
//      「插入支线 → 扣 XP → 支线记录/奖励写回宿主 → 返回原定下一章」语义，不依赖共享引擎的
//      sideStories/hubStartSideStory 生产入口。
import { bindScenarioIdentities } from '../content/identities.js'
import { scenarioManifest } from '../content/scenario-manifest.js'
import { move, settle } from './core-fixture.mjs'

export const players = [{ seat: 0, role: 'human' }]

export function driveHub(state, { investigator = '01001' } = {}) {
  move(state, { action: 'hubGoSetup' })
  move(state, { action: 'hubSelectInvestigator', code: investigator })
  settle(state)
  for (const action of ['hubAutoDeck', 'hubConfirmDeck', 'hubDoneSeat', 'hubBeginScenario']) {
    move(state, { action })
    settle(state)
  }
}

function simpleScenario(id, name) {
  const data = {
    id, name, startLocation: 'bench', resignAnywhere: true,
    setup: '将调查员放在工作台。', setupNote: '从工作台开始。',
    locations: { bench: { id: 'bench', name: '工作台', shroud: 0, cluesPerInvestigator: 0, connections: [] } },
    acts: [{ id: 'measure', stage: '1a', name: '测量', objective: { type: 'manual' } }],
    agendas: [{ id: 'timer', stage: '1a', name: '计时', doomThreshold: 9 }],
    encounterDeck: [], enemies: {}, treacheries: {}, storyAssets: {},
    mechanics: { noEncounterDeck: true }, resolutions: { r1: '校验结束。' },
  }
  const identities = { locations: { bench: { originalCode: '01113' } } }
  bindScenarioIdentities(data, identities)
  return { data, identities }
}

/**
 * 宿主主战役夹具：
 *   opening(scenario) → between(choice: 插入支线 or 继续) → 支线关卡(scenario) → hostReturn(scenario) → end
 * 其中 between 的支线选项声明 when.eachInvestigatorXp 与 effects.spendExperience（与生产共享原语同一口径）。
 */
export function hostFixtureFor({ campaignManifest, chapter, scenario, sideScenarioId, cost, hostCampaignId = 'sideStoryHostFixture' }) {
  const sideManifest = scenarioManifest(scenario, chapter.identities, {
    campaignId: hostCampaignId, status: 'playable',
    layout: chapter.layout,
    requiredPackIds: [...campaignManifest.requiredPackIds],
    requiredEncounterGroupIds: [...chapter.manifest.requiredEncounterGroupIds],
    setAsideAliases: [...chapter.SET_ASIDE_ALIASES],
    recordReads: [], recordWrites: [], behaviorIds: [chapter.behavior.id],
  })
  sideManifest.referenceCode = chapter.scenario.referenceCode
  const opening = simpleScenario('hostOpening', '宿主开场')
  const openingEntry = {
    scenario: opening.data,
    behavior: { id: 'hostOpening', setupLocations: () => ['bench'],
      allResigned: (_, { finish }) => finish('r1'), resolution: () => ({ award: false }) },
    manifest: scenarioManifest(opening.data, opening.identities, {
      campaignId: hostCampaignId, status: 'playable',
      layout: { locations: { bench: { x: 0, y: 0 } }, edges: [] },
      behaviorIds: ['hostOpening'], requiredPackIds: [...campaignManifest.requiredPackIds],
      requiredEncounterGroupIds: [],
    }),
  }
  const ret = simpleScenario('hostReturn', '宿主收尾')
  const returnEntry = {
    scenario: ret.data,
    behavior: { id: 'hostReturn', setupLocations: () => ['bench'],
      allResigned: (_, { finish }) => finish('r1'),
      resolution: () => ({ award: false, effects: [{ record: { hostReturned: true } }] }) },
    manifest: scenarioManifest(ret.data, ret.identities, {
      campaignId: hostCampaignId, status: 'playable',
      layout: { locations: { bench: { x: 0, y: 0 } }, edges: [] },
      behaviorIds: ['hostReturn'], requiredPackIds: [...campaignManifest.requiredPackIds],
      requiredEncounterGroupIds: [], recordWrites: ['hostReturned'],
    }),
  }
  const campaign = {
    schemaVersion: campaignManifest.schemaVersion, id: hostCampaignId, name: '宿主战役',
    contentVersion: '1.0.0', minRulesVersion: 'n6.0', status: 'playable',
    requiredPackIds: [...campaignManifest.requiredPackIds],
    opening: { experience: 0 },
    scenarioIds: ['hostOpening', sideScenarioId, 'hostReturn'],
    unlock: { hostOpening: [], [sideScenarioId]: ['hostOpening'], hostReturn: [sideScenarioId] },
    chaosBags: { standard: [...campaignManifest.chaosBags.standard] },
    recordSchema: { ...campaignManifest.recordSchema, hostReturned: 'boolean' },
    recordLabels: {},
    interludeHandlerId: 'hostInterlude',
    resolutionIds: ['survived'],
    flow: {
      start: 'opening',
      nodes: {
        opening: { type: 'scenario', scenarioId: 'hostOpening', next: 'between' },
        between: { type: 'choice', options: [
          { id: 'sideStory', label: `插入支线：${campaignManifest.name}（每人 ${cost} XP）`,
            when: { eachInvestigatorXp: cost }, effects: [{ type: 'spendExperience', amount: cost }], next: 'sideStory' },
          { id: 'continue', label: '继续主线', next: 'return' },
        ] },
        sideStory: { type: 'scenario', scenarioId: sideScenarioId, next: 'return' },
        return: { type: 'scenario', scenarioId: 'hostReturn', next: 'end' },
        end: { type: 'end' },
      },
    },
  }
  return { campaign, scenarios: [openingEntry, { scenario, behavior: chapter.behavior, manifest: sideManifest }, returnEntry] }
}


