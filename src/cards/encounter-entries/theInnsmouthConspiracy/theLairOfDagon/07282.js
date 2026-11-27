// 07282 第三誓约（The Third Oath）· 幕 3 · 达贡密教巢穴 第七章
//
// 印刷（中文）：
//   每个[[嫌犯]]敌人得到+1[per_investigator]生命值，失去冷漠，并且不能与之谈判。
//   [fast] 花费蓝色、红色、白色或黄色钥匙：弃掉每张附属到你所在地点的[[屏障]]卡牌。
//   目标 - 在本场景上放置线索，以此破坏密教的仪式。如果本场景上有3[per_investigator]个线索，推进。
//
// 印刷（English）：
//   Each [[Suspect]] enemy gets +1 [per_investigator] health, loses aloof, and cannot be
//   parleyed with.
//   [fast] Spend the blue, red, white, or yellow key: Discard each [[Obstacle]] card attached
//   to your location.
//   Objective - Disrupt the Order's ritual by placing clues on this act. If there are
//   3 [per_investigator] clues on this act, advance.
//
// 印刷（中文·背面）：
//   在剧本日志中，记录密教的仪式被破坏。
//   - 如果达贡（深入沉睡）在场上，在剧本日志中，记录达贡仍沉睡。
//   - 如果达贡（苏醒狂怒）在场上或胜利区，在剧本日志中，记录达贡已苏醒。
//   （→结局1）
//
// 印刷（English·背面）：
//   In your Campaign Log, record that the Order's ritual was disrupted.
//   - If Dagon (Deep in Slumber) is in play, record in your Campaign Log that Dagon still
//     slumbers.
//   - If Dagon (Awakened and Enraged) is in play or in the victory display, record in your
//     Campaign Log that Dagon has awakened.
//   (→ Resolution 1)
//
// 模板位置（一卡一文件）：
//   src/cards/encounter-entries/theInnsmouthConspiracy/theLairOfDagon/07282.js
//
// 引擎读点：
//   · 正面嫌犯修正与 [fast] 清屏障由 dagonOathFront() 共享。
//   · 目标 = act-agenda.js#checkAct 读 `actRule.objective`；「本场景上的线索」= `state.actClues`，
//     写入口是 scenarioRuntime#placeCluesOnAct（07291 的行动 / 线索类效果共用；手持线索不计数）。
//   · 背面 = content entry-rules.actReveal → 本文件 actRule.onReveal（api 是 scenarioRuntime）：
//     setCampaignRecord（campaign/records.js 的 TIC 记录表含三个键）与 finish('resolution1')；
//     content/resolutions.js#theLairOfDagon 的 resolution1 已实现 XP/尾声与后续选择。
//   · 双面达贡卡号：沉睡面 07292a、苏醒面 07292b（cards-data linkedToCode），胜利区用 originalCode 比对。
//
// implemented: true

import { dagonOathFront, originalOf } from '../../_shared.js'

const DAGON_SLUMBERING = '07292a'
const DAGON_AWAKENED = '07292b'
const CLUES_PER_INVESTIGATOR = 3

const inPlay = (state, code) => state.enemies.some(enemy => !enemy.defeated && !enemy.removedFromGame
  && String(originalOf(enemy)) === code)

const inVictoryDisplay = (state, code) => (state.victoryDisplay || [])
  .some(card => String(originalOf(card)) === code)

export default {
  code: '07282', scope: 'act', implemented: true,
  ...dagonOathFront(),
  actRule: {
    objective(state) {
      return (state.actClues || 0) >= CLUES_PER_INVESTIGATOR * state.numInvestigators
    },
    onReveal(state, act, api) {
      api.setCampaignRecord('TheOrdersRitualWasDisrupted', true)
      if (inPlay(state, DAGON_SLUMBERING)) api.setCampaignRecord('DagonStillSlumbers', true)
      if (inPlay(state, DAGON_AWAKENED) || inVictoryDisplay(state, DAGON_AWAKENED)) {
        api.setCampaignRecord('DagonHasAwakened', true)
      }
      api.info?.('「第三誓约」背面：密教的仪式被破坏，进入结局 1。')
      api.finish('resolution1')
    },
  },
}
