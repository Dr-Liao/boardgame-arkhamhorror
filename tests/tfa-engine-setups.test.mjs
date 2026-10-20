import test from 'node:test'
import assert from 'node:assert/strict'
import { registerContentBundle } from '../content/registered.js'
import { manifest as tfaCampaignPack } from '../content/packs/tfaCampaign/manifest.js'
import { manifest as campaignManifest } from '../content/campaigns/theForgottenAge/manifest.js'
import { chapters } from '../content/campaigns/theForgottenAge/shared.js'

// 十个章节在 M3 保持 development，引擎默认不装载。这里把每一章克隆成 playable，
// 用真实 createGameState 跑一遍布置，验证「每章都能单独跑通」这条完成判据。
const packId = 'tfaSetupHarnessPack'
const cases = []
for (const chapter of chapters) {
  const module = await import(`../content/campaigns/theForgottenAge/scenarios/${chapter.id}/index.js`)
  const campaignId = `tfaSetupHarness-${chapter.id}`
  const scenarioId = `tfaSetup-${chapter.id}`
  cases.push({ chapter, module, campaignId, scenarioId })
}

registerContentBundle({
  packs: [{ ...tfaCampaignPack, id: packId, status: 'playable' }],
  campaigns: cases.map(({ chapter, campaignId, scenarioId }) => ({
    ...campaignManifest,
    id: campaignId,
    name: `失落的时代（布置验证：${chapter.id}）`,
    status: 'playable',
    scenarioIds: [scenarioId],
    unlock: { [scenarioId]: [] },
    requiredPackIds: ['core', packId],
    flow: {
      start: scenarioId,
      nodes: {
        [scenarioId]: { type: 'scenario', scenarioId, next: 'end' },
        end: { type: 'end' },
      },
    },
  })),
  scenarios: cases.map(({ module, campaignId, scenarioId }) => ({
    scenario: { ...module.scenario, id: scenarioId },
    behavior: { ...module.behavior, id: scenarioId },
    manifest: {
      // 克隆成可启动关卡：去掉「仅图鉴」标记，其余照原样。
      ...Object.fromEntries(Object.entries(module.manifest)
        .filter(([key]) => !['catalogReferenceOnly', 'referenceCode'].includes(key))),
      id: scenarioId,
      campaignId,
      status: 'playable',
      // 测试用卡包与战役取代正式注册项，只隔离本章的布置；
      // 命运之线直接复用《夜之狂热》的阿卡姆地点（01125–01134），notz 依赖要保留。
      requiredPackIds: [...new Set([...module.manifest.requiredPackIds
        .map(id => (id === 'tfaCampaign' ? packId : id)), packId])],
      requiredEncounterGroupIds: [],
      behaviorIds: [scenarioId],
    },
  })),
})

const { createGameState, applyMove, legalMoves } = await import('../src/engine/engine.js')

function settle(state) {
  for (let guard = 0; state.pendingChoice; guard++) {
    assert.ok(guard < 600, `choice loop: ${state.pendingChoice?.kind}`)
    const pending = state.pendingChoice
    const optionId = pending.options.find(option => ['done', 'skip'].includes(option.id))?.id
      || pending.options[0].id
    applyMove(state, pending.seat, { action: 'choose', choiceId: pending.id, optionId })
  }
}

for (const { chapter, campaignId } of cases) {
  test(`M3 布置：${chapter.id} 能在真实引擎里独立开局`, () => {
    const state = createGameState({ campaignId, seed: `tfa-setup-${chapter.id}`, playerInvestigator: '01001' }, [{ seat: 0 }])
    settle(state)
    assert.equal(state.status, 'playing', chapter.id)
    assert.equal(state.scenario.id, `tfaSetup-${chapter.id}`)
    assert.ok(state.locations.length > 0, `${chapter.id} 没有放置地点`)
    assert.ok(state.investigators[0].location, `${chapter.id} 调查员没有起始地点`)
    assert.ok(state.encounterDeck.length > 0, `${chapter.id} 遭遇牌库为空`)
    assert.ok(state.acts.length > 0 && state.agendas.length > 0, chapter.id)
    assert.ok(state.chaosBag.length >= 12, `${chapter.id} 混乱袋未初始化`)
    assert.ok(legalMoves(state).length > 0, `${chapter.id} 没有合法行动`)
    // 存档往返：布置结果必须完全一致。
    const restored = JSON.parse(JSON.stringify(state))
    assert.deepEqual(restored.locations.map(location => location.id), state.locations.map(location => location.id))
    assert.deepEqual(restored.encounterDeck, state.encounterDeck)
    assert.deepEqual(restored.explorationDeck, state.explorationDeck)
  })
}
