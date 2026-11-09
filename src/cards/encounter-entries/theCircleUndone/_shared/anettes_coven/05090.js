// 05090 女巫集会学徒
// 归属：战役共用 · theCircleUndone；遭遇组：anettes_coven
// 卡面：显现 - 弃掉遭遇牌库顶 2 张卡牌。如果本效果导致遭遇牌库的卡牌耗尽，
//   抽取遭遇弃牌堆最顶部的[[巫术]]卡牌（英文 trait = Hex）。
//
// 引擎没有「敌人显现」的通用窗口：抽到敌人时引擎先 spawnEnemy，再派发 behavior.enemySpawned，
// 因此显现效果写在 enemyScript.onSpawn 里。为区分「抽到」与「被剧本效果生成」，
// 共享 encounterDrawn 钩子会把最近一次抽到的卡号写进 scenarioFlags.lastEncounterDrawn，
// 这里只在卡号匹配时结算显现（效果生成不再误触发）。
//
// 「由本效果导致牌库耗尽」按弃牌前后判断：只有弃牌前有牌、弃完为 0 才算耗尽；
// 弃顶 2 张不是「一直弃到某张」，牌库中途为空时不会把刚弃掉的牌洗回来。
//
// 双牌堆路由：《恶罪报应》有两套遭遇牌库（基础 + 幽灵）。本卡从哪堆抽到，就弃哪堆、从哪堆
// 的弃牌堆取巫术卡（来源由该章 encounterDeckFor 写在 scenarioFlags.lastEncounterDeck）。
// 其它章节只有基础牌库，走 state.encounterDeck / encounterDiscard。

import { ALL_CARDS } from '../../../_shared.js'

const INITIATE = '05090'

// 双牌堆：由场景标记 lastEncounterDeck 决定本卡属于基础还是幽灵遭遇牌堆（读点来自章节）。
function encounterDeckId(state) {
  if (state.scenarioFlags?.lastEncounterDeck === 'spectral' && state.extraEncounterDecks?.spectral) return 'spectral'
  return 'encounter'
}

export default {
  code: INITIATE,
  scope: 'enemy',
  implemented: true,
  enemyScript: {
    onSpawn(state, enemy, api) {
      if (String(enemy.originalCode || enemy.code) !== INITIATE) return
      const last = api.scenarioFlag?.('lastEncounterDrawn') ?? state.scenarioFlags?.lastEncounterDrawn
      const drawnNow = Boolean(last && String(last.code) === INITIATE)
      if (drawnNow) api.setScenarioFlag?.('lastEncounterDrawn', null)
      // 兼容旧存档/直接生成路径：没有抽牌记录时，只有与抽牌者关联的实例才按「抽到」处理。
      const wasDrawn = drawnNow || (!last && enemy.drawnBySeat != null)
      if (!wasDrawn) {
        api.info?.('女巫集会学徒由剧本效果生成：不结算显现（弃牌库顶）。')
        return
      }
      const deckId = encounterDeckId(state)
      const spectral = deckId === 'spectral'
      const deckSize = spectral
        ? (api.extraDeckInfo?.('spectral')?.deck || 0)
        : (api.encounterDeckCards?.() || state.encounterDeck || []).length
      const startedWithCards = deckSize > 0
      // 弃顶 2 张（收口到 api；牌库中途为空即停，不洗回）。
      const discarded = spectral
        ? (api.discardExtra?.('spectral', 2) || [])
        : (api.discardEncounterTop?.(2, { reshuffle: false }) || [])
      const labels = discarded.map(code => ALL_CARDS[code]?.nameZh || code).join('、') || '无'
      api.info?.(`女巫集会学徒：弃掉遭遇牌库顶 ${discarded.length} 张卡牌（${labels}）。`)
      // 只有「本效果把牌库从有牌弃到 0」才触发后续抽取；牌库本来就是 0 或中途为空不算。
      const remaining = spectral
        ? (api.extraDeckInfo?.('spectral')?.deck || 0)
        : (api.encounterDeckCards?.() || state.encounterDeck || []).length
      if (!startedWithCards || remaining > 0 || discarded.length === 0) return
      // 遭遇牌库耗尽：取本牌堆弃牌堆最顶部的巫术（Hex）卡牌并抽取（放回牌库顶再走抽牌管线）。
      const discardPile = spectral
        ? (api.extraDeckInfo?.('spectral')?.discard || [])
        : (api.encounterDiscardCards?.() || state.encounterDiscard || [])
      for (let index = discardPile.length - 1; index >= 0; index--) {
        const code = discardPile[index]
        const card = ALL_CARDS[code]
        if (!card || !(card.traits || []).some(trait => String(trait).toLowerCase() === 'hex')) continue
        if (spectral) {
          api.takeExtraDiscard?.('spectral', code)
          api.addExtra?.('spectral', [code], { top: true })
        } else {
          api.takeEncounterDiscard?.(code)
          api.putOnEncounterDeck?.(code, { top: true })
        }
        const seat = enemy.drawnBySeat != null ? enemy.drawnBySeat : (state.campaign?.leadSeat ?? 0)
        api.info?.(`遭遇牌库耗尽：抽取遭遇弃牌堆顶的巫术卡牌「${card.nameZh || card.name}」。`)
        if (spectral) api.drawExtra?.(seat, 'spectral')
        else api.drawEncounter?.(seat)
        return
      }
      api.info?.('遭遇弃牌堆里没有巫术卡牌。')
    },
  },
}
