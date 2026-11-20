import test from 'node:test'
import assert from 'node:assert/strict'
import { buildAuthoredScenarioGuide } from '../tools/authored-scenario-guide.mjs'

const manifest = { id: 'signalStation', campaignId: 'nightRelay', resolutionIds: ['restored', 'lost'] }
const source = () => ({ id: manifest.id, campaignId: manifest.campaignId, locales: {
  zh: {
    intro: [{ id: 'arrive', text: '巡检队抵达山间信号站。' }],
    setup: [{ id: 'placeBeacon', text: '将信标放在控制室，留出两格检修通道。' }],
    specialRules: [{ id: 'sparePower', title: '备用供电', children: [
      { id: 'useCell', text: '检修时可以消耗一枚备用电池。' },
    ] }],
    resolutions: [{ id: 'restored', text: '信标恢复运转。' }, { id: 'lost', text: '巡检队安全撤离。' }],
  },
  en: {
    intro: [{ id: 'arrive', text: 'The inspection crew reaches a mountain relay.' }],
    setup: [{ id: 'placeBeacon', text: 'Place the beacon in the control room and leave two service spaces clear.' }],
    specialRules: [{ id: 'sparePower', title: 'Reserve power', children: [
      { id: 'useCell', text: 'You may spend a reserve cell while servicing the beacon.' },
    ] }],
    resolutions: [{ id: 'restored', text: 'The beacon is working again.' }, { id: 'lost', text: 'The crew evacuates safely.' }],
  },
} })

test('原创指南保留双语分支、段落标识和显示顺序', () => {
  const input = source()
  const guide = buildAuthoredScenarioGuide(manifest, input)
  assert.equal(guide.sourceKind, 'authored')
  assert.equal(guide.officialChinese, false)
  assert.deepEqual(guide.locales.zh.specialRules, input.locales.zh.specialRules)
  assert.deepEqual(guide.locales.en.resolutions.map(block => block.id), manifest.resolutionIds)
  assert.deepEqual(guide.locales.zh.story, [])
  assert.ok(!Object.hasOwn(input.locales.zh, 'story'))
})

test('指南缺少译文、结局、分支或展开正文时拒绝生成', () => {
  const withoutBranch = source()
  withoutBranch.locales.zh.specialRules[0].children[0].id = 'wrongBranch'
  assert.throws(() => buildAuthoredScenarioGuide(manifest, withoutBranch), /中英指南分支不一致/)
  const withoutResolution = source()
  for (const locale of Object.values(withoutResolution.locales)) locale.resolutions.pop()
  assert.throws(() => buildAuthoredScenarioGuide(manifest, withoutResolution), /缺少结局 lost/)
  const unresolved = source()
  unresolved.locales.en.setup[0].text = '@:old.guide.placeBeacon'
  assert.throws(() => buildAuthoredScenarioGuide(manifest, unresolved), /已展开/)
  const withoutLanguage = source()
  delete withoutLanguage.locales.zh
  assert.throws(() => buildAuthoredScenarioGuide(manifest, withoutLanguage), /zh 指南分节/)
  assert.throws(() => buildAuthoredScenarioGuide({ ...manifest, id: 'wrongScenario' }, source()), /标识不匹配/)
})
