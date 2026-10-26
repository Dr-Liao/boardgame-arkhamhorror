// 关卡切换时调查员「非牌组区」的清理回归。
//
// 背景（2026-10-26 玩家报告）：黛安娜·史丹利在「最后的王者」开局后，牌桌「下方」栏平白多出
// 两张上一关压在身下的牌。根因是一次关卡开始时 prepareInvestigator 重建了手牌/牌组/弃牌/
// 场上支援，却漏掉了调查员自带的 beneath（压牌）与 attachments（附属在调查员身上的牌）：
// 这两块是上一关的场面，牌本身仍留在战役牌组记录里，本关按记录重建牌组后同一张卡会同时出现
// 在「下方/附属区」和牌库里，看起来就像凭空多出来的第二份。
//
// 这个用例走真实建局（卡尔克萨之路）→ 谢幕 → 手动进入下一关，确认清理发生且卡没有丢。

import test from 'node:test'
import assert from 'node:assert/strict'

import { createGameState, startScenario } from '../src/engine/engine.js'
import { settle } from './core-fixture.mjs'

// 一名调查员所有「持有中的牌」出现在哪些区：手牌、牌库、弃牌、压牌、场上支援/威胁、
// 附属在调查员身上的牌、隐藏卡。同一张唯一卡在这里只能出现一次。
const heldCodes = inv => [
  ...(inv.hand || []),
  ...(inv.deck || []),
  ...(inv.discard || []),
  ...(inv.beneath || []),
  ...(inv.assets || []).map(asset => asset.code),
  ...(inv.threat || []).map(card => card.code),
  ...(inv.attachments || []).map(card => card.code),
  ...(inv.hiddenCards || []),
]

test('进入新关卡会清空上一关的压牌与调查员附属，牌库重建不会多出一份', () => {
  const state = createGameState(
    {
      campaignId: 'thePathToCarcosa', playerInvestigator: '05004', seed: 'scenario-reset-beneath',
      seatInvestigators: ['05004', '01001'],
    },
    [{ seat: 0, role: 'human' }, { seat: 1 }],
  )
  settle(state)
  assert.equal(state.scenario.id, 'curtainCall', '战役首关是谢幕')

  // 上一关（谢幕）里黛安娜用取消卡触发过反应：两张牌压在她底下。
  // 05014 黑暗洞察是她的专属卡（牌库唯一一张），最容易暴露「下方 + 牌库各一份」。
  const diana = state.investigators[0]
  diana.beneath = ['05014', '01065']
  // 附属在调查员身上的牌（例如「附属到同地点任意调查员」的事件）同样是上一关的场面。
  diana.attachments = [{ id: 'attach-probe', code: '05021', ownerSeat: 0 }]
  assert.equal(heldCodes(diana).filter(code => code === '05014').length, 2,
    '构造出问题状态：同一张专属卡同时压在下方并在牌库里')

  // 同一类跨关残留的其它代表：每场游戏一次/按轮次的记账、没花掉的临时代价、临时属性、
  // 上一关结束时的「已结束回合」标记（不清会让新关卡第一回合直接不能行动）。
  Object.assign(diana, {
    gameFlags: { fortuneOrFate: true },
    usedAbilities: { 'bag:0:1:investigation': true },
    weaknessCounters: { impendingDoom: 2 },
    playDiscount: 2,
    carcosaPlayDiscount: 1,
    extraActionNextTurn: true,
    turnEnded: true,
    ritaIgnoreLimitRound: 1,
    shuffleWeaknessAfterResolution: '05015',
    // 读点靠轮次/回合比较、但字段名不带后缀的散标记
    fieldwork: { round: 1, phase: 'investigation', amount: 2 },
    infighting: { round: 1, phase: 'enemy' },
    narrowEscape: { amount: 1, round: 1, turnSeat: 0 },
    jakeFree: { round: 1, used: true },
    ritaEvadeUses: 1,
    pendingActionLoss: { 1: 1 },
    hiddenMoves: { turnSerial: 0, maximum: 1 },
    spellOnlyActions: 2,
  })
  // 全局层面的关内临时区与记账（与「下方」同一类：一关之内有效）。
  state.playerLocationAttachments = [{ code: '03198', location: 'foyer', ownerSeat: 0 }]
  state.setAside = ['01088']
  state.removedFromGame = ['01234']
  state.extraLocationDecks = { cosmos: { deck: ['cellar'], discard: [] } }
  state.hauntedGrants = [{ locationId: 'foyer', ability: { id: 'haunted-probe' } }]
  state.actReminders = [{ code: '03140', actIndex: 0 }]
  state.agendaFace = 'back'
  state.lastFailedTest = { seat: 0, skill: 'willpower' }
  state.abilityLimits = {
    'descRound|seat:0:desc|round:1': { used: 1, round: 1, phase: 'investigation', turn: 0 },
    'descCampaign|seat:0:desc|campaign': { used: 1 },
  }

  startScenario(state, 1, [])
  assert.equal(state.scenario.id, 'theLastKing', '第二关是最后的王者')

  const after = state.investigators[0]
  assert.deepEqual(after.beneath, [], '上一关压在黛安娜底下的牌不带进新关卡')
  assert.deepEqual(after.attachments, [], '上一关附属在调查员身上的牌不带进新关卡')
  for (const field of ['gameFlags', 'usedAbilities', 'weaknessCounters', 'playDiscount',
    'carcosaPlayDiscount', 'extraActionNextTurn', 'turnEnded', 'ritaIgnoreLimitRound',
    'shuffleWeaknessAfterResolution', 'fieldwork', 'infighting', 'narrowEscape', 'jakeFree',
    'ritaEvadeUses', 'pendingActionLoss', 'hiddenMoves', 'spellOnlyActions']) {
    assert.equal(after[field], undefined, `调查员的跨关临时字段应清空：${field}`)
  }
  // 全局关内临时区/记账同样不能跨关。
  assert.deepEqual(state.playerLocationAttachments, [], '上一关附属在地点上的玩家卡应清空')
  assert.deepEqual(state.setAside, [], '「放到一边」区应逐关清空')
  assert.deepEqual(state.removedFromGame, [], '「移出游戏」区应逐关清空')
  assert.deepEqual(state.extraLocationDecks, {}, '备用地点牌堆应逐关重建')
  assert.deepEqual(state.hauntedGrants ?? [], [], '闹鬼地点的临时授权应清空')
  assert.equal(state.actReminders?.length ?? 0, 0, '幕旁提醒不应跨关残留')
  assert.equal(state.agendaFace, undefined, '议程翻面展示状态不应跨关残留')
  assert.equal(state.lastFailedTest, undefined, '上一关的失败检定重试上下文应清空')
  // 上限记账：按轮/阶段/局的作用域清空；战役级（|campaign）必须保留。
  assert.deepEqual(Object.keys(state.abilityLimits || {}), ['descCampaign|seat:0:desc|campaign'],
    '只保留战役级上限记账')
  // 牌面/战役身份不能被清理误伤。
  assert.equal(after.code, '05004')
  assert.equal(after.name, '黛安娜·史丹利')
  assert.ok(after.campaignId, '战役身份仍在')

  // 卡不能丢：它们仍在战役牌组记录里，由本关重建的牌组/起始手牌承接。
  const record = state.campaign.investigators[after.seat]
  assert.ok(record.deck.includes('05014'), '专属卡仍留在战役牌组记录里')
  assert.equal(heldCodes(after).filter(code => code === '05014').length, 1,
    '黑暗洞察在新关卡只存在一份（下方不再残留副本）')
})
