// 九循环《铁杉谷盛宴》（FHV）P6 通用原语与包边界验收。
//
// 覆盖 P6 新增/复用的跨卡共通机制：
//   · Double 特质（11 张）：played 描述子声明 `cost: { action: 1 }`，引擎在 legalMoves /
//     validateMove / doPlay 三处同源校验并扣减额外行动；
//   · 玩家包边界：120 条记录全部 strict；可构筑 = 非基础弱点/非绑定依赖/非 Research；
//   · 基础弱点（10135–10138）只作随机基础弱点依赖，不进构筑池；
//   · 绑定/场外（deckLimit=0，11 张）只作依赖；Research（3 张）等待 P7 战役日志读点前不进池。
import test from 'node:test'
import assert from 'node:assert/strict'

import { fixture, move, settle } from './core-fixture.mjs'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { registerCardAbilities, registeredEntry, descriptorOfKind, playedActionCost } from '../src/engine/ability.js'
import { legalMoves, validateMove } from '../src/engine/engine.js'
import '../src/engine/engine.js'
import {
  canSelectInvestigator, getAvailability,
} from '../src/deck/availability.js'
import {
  EXPANDED_PLAYER_CARD_CODES,
} from '../src/deck/deckbuilding.js'
import { partitions } from '../content/campaigns/theFeastOfHemlockVale/shared.js'
import {
  FHV_PLAYER_BASIC_WEAKNESS_CODES, FHV_PLAYER_BUILDABLE_CODES, FHV_PLAYER_VERIFIED_CODES,
  fhvPlayerBuildable, fhvPlayerCardVerified,
} from '../src/cards/fhv-player-acceptance.js'

const PLAYER_CODES = [...partitions.fhvPlayer].sort()
const DOUBLE_CODES = PLAYER_CODES.filter(code => (ALL_CARDS[code]?.traits || []).includes('Double'))

test('P6 Double 特质 11 张全部以 played.cost.action=1 声明额外行动费用', () => {
  assert.equal(DOUBLE_CODES.length, 11, `Double 卡应为 11 张，实际 ${DOUBLE_CODES.length}`)
  for (const code of DOUBLE_CODES) {
    const entry = registeredEntry(code)
    assert.ok(entry, `${code} 必须注册条目`)
    assert.equal(playedActionCost(code), 1, `${code} 必须以 played.cost.action=1 声明额外行动`)
    const played = descriptorOfKind(code, 'played')
    assert.ok(played, `${code} 必须有 played 描述子`)
  }
})

test('P6 Double 额外行动三处同源：legalMoves 候选、validateMove 拦截、doPlay 扣减', () => {
  const code = DOUBLE_CODES.find(item => registeredEntry(item)) || '10027'
  // 夹具环境注册探针（真实条目已存在时直接复用，不覆盖）。
  if (!registeredEntry(code)) registerCardAbilities({ code, abilities: [{ kind: 'played', cost: { action: 1 }, label: '探针', resolve: ({ api }) => api.info('p6 double') }] })
  const state = fixture('01001')
  const inv = state.investigators[0]
  inv.hand = [code]
  inv.resources = 20
  inv.actionsLeft = 2
  state.legalMoves = legalMoves(state, 0)
  const option = state.legalMoves.find(row => row.action === 'play' && row.cardId === code)
  assert.ok(option, '有 2 点行动时应出现打出候选')
  move(state, option)
  settle(state)
  const after = state.investigators[0]
  assert.ok(after.discard.includes(code), '事件打出后进入弃牌堆')
  // 默认打出本身花 1 行动，Double 额外 1：2 → 0。
  assert.equal(after.actionsLeft, 0, 'Double 打出应消耗基础 + 额外共 2 行动')

  const blocked = fixture('01001')
  blocked.investigators[0].hand = [code]
  blocked.investigators[0].resources = 20
  blocked.investigators[0].actionsLeft = 1
  blocked.legalMoves = legalMoves(blocked, 0)
  assert.equal(blocked.legalMoves.some(row => row.action === 'play' && row.cardId === code), false,
    '只有 1 点行动时不得给出 Double 打出候选')
  const error = validateMove(blocked, 0, { action: 'play', cardId: code })
  assert.match(String(error), /行动/, `validateMove 应阻止：${error}`)
  assert.deepEqual(blocked.investigators[0].hand, [code], '非法打出不得改变手牌')
})

test('P6 玩家包边界：120 条 strict，可构筑 102 张，基础弱点/绑定依赖/Research 不进池', () => {
  assert.equal(PLAYER_CODES.length, 120)
  for (const code of PLAYER_CODES) {
    const availability = getAvailability(code)
    assert.equal(availability.availability, 'strict', `${code} 应 strict`)
    assert.equal(availability.selectable, false, `${code} 不得可选为调查员`)
  }
  const acceptanceBuildable = FHV_PLAYER_BUILDABLE_CODES.filter(code => fhvPlayerCardVerified(code))
  assert.equal(acceptanceBuildable.length, 102, `可构筑码表应为 102，实际 ${acceptanceBuildable.length}`)
  for (const code of acceptanceBuildable) {
    assert.equal(fhvPlayerBuildable(code), true)
    assert.equal(getAvailability(code).deckbuilding, true, `${code} 应可构筑`)
    assert.ok(EXPANDED_PLAYER_CARD_CODES.includes(code), `${code} 应进入开放玩家池`)
  }
  for (const code of FHV_PLAYER_BASIC_WEAKNESS_CODES) {
    assert.equal(ALL_CARDS[code].subtype, 'basicweakness')
    assert.equal(getAvailability(code).dependencyOnly, true, `${code} 基础弱点只作依赖`)
    assert.equal(getAvailability(code).deckbuilding, false, `${code} 不进构筑池`)
  }
  const dependencyOnly = PLAYER_CODES.filter(code => (ALL_CARDS[code].deckLimit ?? 2) === 0)
  assert.equal(dependencyOnly.length, 11)
  for (const code of dependencyOnly) {
    assert.equal(getAvailability(code).dependencyOnly, true, `${code} 绑定/场外依赖只作依赖`)
    assert.equal(getAvailability(code).deckbuilding, false, `${code} 不进构筑池`)
  }
  const researched = PLAYER_CODES.filter(code => /^Researched\./m.test(String(ALL_CARDS[code].text || '')))
  assert.equal(researched.length, 3)
  for (const code of researched) {
    assert.equal(getAvailability(code).deckbuilding, false, `${code} Research 卡在 P7 战役日志读点前不进构筑池`)
  }
  assert.equal(canSelectInvestigator(PLAYER_CODES[0]), false, '玩家卡不是调查员')
})
