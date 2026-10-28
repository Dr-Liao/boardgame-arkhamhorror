// 05144 鬼影骤现（Ghostly Presence）
// 归属：关卡专用 · theSecretName（P8 w-witch）。卡面：显现 - 那赫卜在场：重整、结算猎手、攻击她所在地点每位调查员；在献祭场所再放 1 毁灭。否则找出她生成在你地点。
// 一卡一文件：规则只在这里维护；跨章共享规则在 content/campaigns/theCircleUndone/encounter-rules.js。
//
// 参考 GhostlyPresence.hs：在场 → readyThis + push HunterMove（引擎完整猎手解算）+ 由主持逐个
// 选择攻击同地点调查员；不在场 → findEncounterCard（遭遇牌库 + 遭遇弃牌堆）找到才生成。
import { activeInvestigators, originalOf } from '../../_shared.js'

const findInEncounter = (state, wanted) => {
  const target = String(wanted)
  const discardIndex = state.encounterDiscard.findIndex(code => String(code) === target)
  if (discardIndex >= 0) return state.encounterDiscard.splice(discardIndex, 1)[0]
  const deckIndex = state.encounterDeck.findIndex(code => String(code) === target)
  if (deckIndex >= 0) return state.encounterDeck.splice(deckIndex, 1)[0]
  return null
}

export default {
  code: '05144', scope: 'treachery', implemented: true,
  encounterResolve(state, inv, card, api) {
    const nahab = state.enemies.find(enemy => String(originalOf(enemy)) === '05149')
    if (!nahab) {
      // 「查找遭遇牌库和遭遇弃牌堆，找出那赫卜并将其生成在你所在地点」：找到才生成。
      // （那赫卜常规放在 set aside，不在遭遇牌库；此时整段无效果，符合参考实现。）
      const found = findInEncounter(state, '05149')
      if (found) {
        api.spawn?.(found, inv.location)
        api.info?.('👻 「鬼影骤现」：那赫卜在调查员所在地点浮现。')
      } else {
        api.info?.('👻 「鬼影骤现」：遭遇牌库与弃牌堆中没有那赫卜。')
      }
      return false
    }
    nahab.exhausted = false
    // 卡面「结算她的猎手关键词」：用引擎已有的单步解算 api.hunterStep（含 Prey/等距/barricade），
    // 由内容层执行移动；immobile（act3 不能离开献祭场所）与「已在调查员地点」时不移动。
    const alreadyHere = activeInvestigators(state).some(entry => entry.location === nahab.location)
    if (nahab.hunter && !nahab.immobile && !alreadyHere) {
      const target = api.hunterStep?.(nahab, {})
      if (target && target !== nahab.location) api.moveEnemy?.(nahab, target)
    }
    // 「她攻击自己所在地点的每位调查员」：参考由主持逐个选择顺序。
    const targets = activeInvestigators(state).filter(entry => entry.location === nahab.location)
    const lead = state.investigators[state.campaign?.leadSeat ?? 0]
    const remaining = [...targets]
    while (remaining.length) {
      let picked = remaining[0]
      if (remaining.length > 1) {
        const answer = api.choose({
          kind: 'target', source: '05144', seat: lead?.seat ?? 0,
          prompt: '鬼影骤现：选择下一个被那赫卜攻击的调查员。',
          options: remaining.map(entry => ({ id: String(entry.seat), label: entry.name })),
        })
        picked = remaining.find(entry => String(entry.seat) === String(answer)) || remaining[0]
      }
      remaining.splice(remaining.indexOf(picked), 1)
      api.attack?.(nahab, picked)
    }
    if (nahab.location === 'siteOfTheSacrifice') {
      nahab.doom = (nahab.doom || 0) + 1
      api.info?.('👻 那赫卜位于献祭场所：再获得 1 个毁灭标记。')
    }
    return false
  },
}
