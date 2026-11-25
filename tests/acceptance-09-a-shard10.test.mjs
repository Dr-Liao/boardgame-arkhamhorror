// 09-a-10（TSK · tskc 09737–09770b）补证/缺陷复现测试。
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

import paradigm from '../src/cards/encounter-entries/theScarletKeys/_shared/agents_of_the_outside/09737.js'
import splintered from '../src/cards/encounter-entries/theScarletKeys/_shared/spatial_anomaly/09741.js'
import beyond from '../src/cards/encounter-entries/theScarletKeys/_shared/spatial_anomaly/09742.js'
import warped from '../src/cards/encounter-entries/theScarletKeys/_shared/spatial_anomaly/09743.js'
import touch from '../src/cards/encounter-entries/theScarletKeys/_shared/spreading_corruption/09744.js'
import matter from '../src/cards/encounter-entries/theScarletKeys/_shared/agents_of_the_outside/09738.js'
import emissary from '../src/cards/encounter-entries/theScarletKeys/_shared/agents_of_yuggoth/09739.js'
import compulsion from '../src/cards/encounter-entries/theScarletKeys/_shared/spreading_corruption/09745.js'
import distorted from '../src/cards/encounter-entries/theScarletKeys/_shared/spreading_corruption/09746.js'

const walk = (root) => {
  const out = []
  const step = d => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = d + '/' + e.name
      if (e.isDirectory()) step(p); else if (p.endsWith('.js')) out.push(p)
    }
  }
  step(root)
  return out
}
const contentText = () => walk('content/campaigns/theScarletKeys').map(f => fs.readFileSync(f, 'utf8')).join('\n')
  + fs.readdirSync('src/engine').filter(f => f.endsWith('.js')).map(f => fs.readFileSync('src/engine/' + f, 'utf8')).join('\n')

test('验收 09737/09741/09742/09743/09744 域外使徒/空间异常：真实显现与强制能力结算', () => {
  // 09737：回合结束 → 牌库顶非弱点成为空洞；空洞≥3 时攻击。
  assert.equal(paradigm.code, '09737')
  const ability = paradigm.abilities[0]
  assert.equal(ability.trigger, 'turnEnded')
  const calls = []
  const inv = { seat: 0, location: 'loc', deck: ['01020'], defeated: false, resigned: false }
  const enemy = { id: 'e1', code: '09737', location: 'loc' }
  const state = { enemies: [enemy], investigators: [inv] }
  const api = {
    info: () => {}, cardName: code => code,
    takeDeckCard: (seat, code) => calls.push(['takeDeckCard', seat, code]),
    mechanics: { tsk: { hollow: { isHollowed: () => false, hollow: card => calls.push(['hollow', card.code]), count: () => 3 } } },
    scenario: { attack: (source, target) => calls.push(['attack', source.code, target.seat]) },
  }
  assert.equal(ability.criteria({ state, source: enemy, context: { seat: 0, location: 'loc' } }), true)
  ability.resolve({ state, source: enemy, context: { seat: 0 }, api })
  assert.deepEqual(calls[0], ['takeDeckCard', 0, '01020'], '09737 牌库顶实体取出')
  assert.equal(calls.some(call => call[0] === 'hollow'), true, '09737 成为空洞')
  assert.equal(calls.some(call => call[0] === 'attack' && call[2] === 0), true, '09737 3+ 空洞时攻击')

  // 09741/09742：附属到地点 + 检定；失败按 Hex 数量扣血/恐惧。
  for (const entry of [splintered, beyond]) {
    const state2 = { investigators: [{ seat: 0, location: 'loc2' }], locations: [{ id: 'loc2', attachments: [] }] }
    const calls2 = []
    const api2 = {
      info: () => {}, locationName: () => 'loc2',
      attachToLocation: (id, spec) => { state2.locations[0].attachments.push({ ...spec, id: 'a1' }); calls2.push(['attach', id]) },
      test: (seat, skill, difficulty, cb) => { calls2.push(['test', seat, skill, difficulty]); cb({ success: false }) },
      damage: (seat, amount) => calls2.push(['damage', seat, amount]),
      horror: (seat, amount) => calls2.push(['horror', seat, amount]),
      detachLocationAttachment: () => calls2.push(['detach']),
    }
    const result = entry.encounterResolve(state2, state2.investigators[0], { code: entry.code }, api2)
    assert.deepEqual(result, { placed: true }, `${entry.code} 已作为地点附属入场`)
    assert.ok(calls2.some(call => call[0] === 'attach'), `${entry.code} 附属到地点`)
    assert.ok(calls2.some(call => call[0] === 'test'), `${entry.code} 显现检定`)
  }
  assert.equal(typeof warped.encounterResolve, 'function', '09743 显现结算入口')
  assert.equal(typeof touch.encounterResolve, 'function', '09744 显现结算入口')
  for (const entry of [warped, touch]) assert.match(String(entry.note || ''), /无缺读点|已接线/, `${entry.code} 无未读点声明`)
})

test('验收 09738/09739/09745/09746 缺陷复现：声明读点缺失（primitive requests 未交付）', () => {
  const notes = [matter, emissary, compulsion, distorted].map(entry => String(entry.note || ''))
  assert.match(notes[0], /primitive-requests\/09738\.json/, '09738 缺附属卡对宿主敌人的数值/关键词修正读点')
  assert.match(notes[1], /primitive-requests\/09739\.json|concealedAmountOf/, '09739 共享组敌人 Concealed 入场结算缺 content 入口')
  assert.match(notes[2], /primitive-requests\/09745\.json/, '09745 行动前置限制读点缺失')
  assert.match(notes[3], /primitive-requests\/09746\.json/, '09746 连续同类行动限制读点缺失')
  // 当前引擎/内容层没有对应读点键。
  const text = contentText()
  for (const key of ['enemy.attachments 的数值', 'actionRestriction']) {
    assert.equal(text.includes(key), false, `${key} 无读点`)
  }
})

test('验收 09747a/09747b/09747c/09748a/09748b/09749a/09749b/09750/09751/09762/09764/09765/09768a/09759 失败卡清单：note 显式披露未实现子句（不冒充等价）', () => {
  const root = 'src/cards/encounter-entries/theScarletKeys'
  const files = walk(root)
  const read = code => fs.readFileSync(files.find(f => f.endsWith('/' + code + '.js')), 'utf8')
  const cases = [
    ['09747a', /primitive-requests\/09747a\.json/],
    ['09747b', /暂不生效/],
    ['09747c', /暂不生效/],
    ['09748a', /primitive-requests\/09748a\.json/],
    ['09748b', /私人查看只记旗标/],
    ['09749a', /primitive-requests\/09749a\.json/],
    ['09749b', /重排近似/],
    ['09750', /重排近似/],
    ['09751', /primitive-requests\/09751\.json/],
    ['09762', /primitive-requests\/09762\.json/],
    ['09764', /primitive-requests\/09764\.json/],
    ['09765', /primitive-requests\/09765\.json/],
    ['09768a', /primitive-requests\/09768a\.json/],
  ]
  for (const [code, pattern] of cases) assert.match(read(code), pattern, `${code} note 披露未实现/近似子句`)
  // 09759：full-scan 保留为 unverified（伤害分配到支援的击败分支未验证）。
  assert.match(fs.readFileSync('docs/campaign/theScarletKeys/full-scan.md', 'utf8'), /09759/, '09759 保留为未完全验证')
})
