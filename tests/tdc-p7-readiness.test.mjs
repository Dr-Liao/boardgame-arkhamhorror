import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { contentRegistry } from '../content/registered.js'
import { buildAuthoredScenarioGuide } from '../tools/authored-scenario-guide.mjs'
import { inspectChapter, inspectFlow } from '../tools/tdc-p7-readiness.mjs'

const campaignId = 'relayPractice'
const chapter = { id: 'inspectBeacon', code: 'fixture-reference' }
const manifest = { id: chapter.id, campaignId, referenceCode: chapter.code, status: 'development', resolutionIds: ['restored'] }
const sourcePath = `content/scenario-guide-sources/${chapter.id}.json`
const outputPath = `web/scenario-guides/${chapter.id}.json`
const input = {
  id: chapter.id, campaignId,
  locales: {
    zh: {
      intro: [{ id: 'arrival', text: '巡检小队来到信标旁。' }],
      setup: [{ id: 'lamp', text: '把指示灯放在检修台上。' }],
      resolutions: [{ id: 'restored', text: '远端收到了信号。' }],
    },
    en: {
      intro: [{ id: 'arrival', text: 'The inspection team reaches the beacon.' }],
      setup: [{ id: 'lamp', text: 'Place the indicator lamp on the workbench.' }],
      resolutions: [{ id: 'restored', text: 'The remote station receives the signal.' }],
    },
  },
}
const readFrom = files => path => files[path] ?? null

test('P7 战役内容包登记现有卡表范围与遭遇组，保持目录内容状态', () => {
  const scope = JSON.parse(readFileSync(new URL('../audit/tdc-scope.json', import.meta.url)))
  const codes = [...scope.partitions.shared, ...scope.partitions.scenarios, ...scope.partitions.references]
  const pack = contentRegistry.getPack('tdcCampaign')
  const groups = new Set(codes.map(code => scope.cards[code].group.replace(/_([a-z0-9])/g, (_, character) => character.toUpperCase())))
  assert.deepEqual(pack.cards.map(card => card.code).sort(), codes.sort())
  assert.deepEqual(pack.encounterGroupIds, [...groups].sort())
  // P7 内容批次：战役内容包从纯目录升为 development（战役层 handler 已接线），
  // 但卡牌仍是目录身份，不开放构筑。
  assert.equal(pack.status, 'playable')
  assert.ok(pack.cards.every(card => card.cataloged && !card.rulesImplemented && !card.deckbuilding))
  assert.deepEqual(pack.behaviorIds, ['tdcPrologue', 'tdcInterludes', 'tdcEpilogue'])
})

test('P7 章节清点排除目录占位及错误的战役或提示卡身份', () => {
  const cases = [
    [null, 'unregistered'],
    [{ ...manifest, catalogReferenceOnly: true, status: 'catalog-only' }, 'catalog-only'],
    [{ ...manifest, campaignId: 'otherCampaign' }, 'identity-mismatch'],
    [{ ...manifest, referenceCode: 'wrong-reference' }, 'identity-mismatch'],
  ]
  for (const [value, definition] of cases) {
    assert.deepEqual(inspectChapter(chapter, campaignId, value, () => assert.fail('未登记章节不读取指南')),
      { definition, guideStatus: 'unregistered', guide: null })
  }
})

test('P7 指南必须来自有效双语源且与生成物一致', () => {
  const generated = JSON.stringify(buildAuthoredScenarioGuide(manifest, input), null, 2) + '\n'
  const cases = [
    [{ [outputPath]: JSON.stringify({ ...input, locales: { zh: {}, en: {} } }) }, 'missing-source'],
    [{ [sourcePath]: '{invalid' }, 'invalid-source'],
    [{ [sourcePath]: JSON.stringify({ ...input, locales: { zh: {}, en: {} } }) }, 'invalid-source'],
    [{ [sourcePath]: JSON.stringify(input) }, 'missing-output'],
    [{ [sourcePath]: JSON.stringify(input), [outputPath]: generated.trim() }, 'stale-output'],
    [{ [sourcePath]: JSON.stringify(input), [outputPath]: generated }, 'ready'],
  ]
  for (const [files, guideStatus] of cases) {
    assert.deepEqual(inspectChapter(chapter, campaignId, manifest, readFrom(files)),
      { definition: 'registered', guideStatus, guide: guideStatus === 'ready' ? outputPath : null })
  }
})

test('P7 战役图沿选择和条件出口遍历，单独列出断开的章节和不可达终点', () => {
  const chapters = ['inspectBeacon', 'reachWorkshop', 'isolatedStation']
  const flow = { start: 'start', nodes: {
    start: { type: 'choice', options: [{ next: 'inspection' }, { next: 'dispatch' }] },
    inspection: { type: 'scenario', scenarioId: chapters[0], next: 'start' },
    dispatch: { type: 'stepReturn', next: 'start', rules: [{ next: 'workshop' }] },
    workshop: { type: 'scenario', scenarioId: chapters[1], next: 'start' },
    isolated: { type: 'scenario', scenarioId: chapters[2], next: 'end' },
    end: { type: 'end' },
  } }
  assert.deepEqual(inspectFlow({ flow }, chapters), {
    explicit: true, terminalReachable: false, reachableChapters: chapters.slice(0, 2), missingChapters: chapters.slice(2),
  })
  flow.nodes.workshop.next = 'isolated'
  assert.deepEqual(inspectFlow({ flow }, chapters), {
    explicit: true, terminalReachable: true, reachableChapters: chapters, missingChapters: [],
  })
  assert.deepEqual(inspectFlow({ scenarioIds: chapters }, chapters), {
    explicit: false, terminalReachable: false, reachableChapters: [], missingChapters: chapters,
  })
})
