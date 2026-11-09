// 05122 魔宠（The Familiar）
// 归属：关卡专用 · theSecretName（P8 w-witch）。卡面：每个非弱点敌人 +2 生命；反应同上。背面 - 按幕放置那赫卜、洗入 2 张鬼影骤现、找出布朗·詹金。
// 一卡一文件：规则只在这里维护；跨章共享规则在 content/campaigns/theCircleUndone/encounter-rules.js。
//
// 参考 TheFamiliar.hs：那赫卜用 set-aside/场外取（IncludeOutOfPlayEnemy），布朗·詹金用
// findUniqueCard（可来自任意区域：牌库/弃牌堆/set aside）。反应由 behavior.enemyDefeated 结算。
import { ALL_CARDS, originalOf } from '../../_shared.js'

const findInEncounter = (api, predicate) => {
  const discard = api.encounterDiscardCards?.() || []
  for (let index = discard.length - 1; index >= 0; index--) {
    if (!predicate(discard[index])) continue
    api.takeEncounterDiscard?.(discard[index])
    return discard[index]
  }
  const deck = api.encounterDeckCards?.() || []
  for (let index = deck.length - 1; index >= 0; index--) {
    if (!predicate(deck[index])) continue
    api.takeEncounterDeckCard?.(deck[index])
    return deck[index]
  }
  return null
}
const findAnywhere = (api, code) => {
  const wanted = String(code)
  if (api.takeFromSetAside?.(wanted)) return wanted
  return findInEncounter(api, candidate => String(candidate) === wanted)
}
const inPlay = (state, code) => state.enemies.find(enemy => String(originalOf(enemy)) === code) || null

export default {
  code: '05122', scope: 'agenda', implemented: true,
  agendaRule: {
    onReveal(state, agenda, api) {
      const step = (state.actIndex ?? 0) + 1
      let nahab = inPlay(state, '05149')
      if (step === 3) {
        if (nahab) api.doomOn?.(nahab, 1)
      } else {
        const targetId = step === 1 ? 'walterGilmansRoom' : 'keziahsRoom'
        const target = state.locations.find(location => location.id === targetId)
          || state.locations.find(location => location.id === 'moldyHalls')
        if (nahab) api.moveEnemy?.(nahab, target?.id || nahab.location)
        else {
          // 「生成放在一边的那赫卜」；若她已被击败进遭遇弃牌堆，也从场外取出重新放置。
          const found = findAnywhere(api, '05149')
          if (found && target?.id) nahab = api.spawn?.(found, target.id) || null
        }
        if (nahab && target) api.info?.(`🌑 那赫卜生成在「${target.name}」。`)
      }
      api.takeFromSetAside?.('05144')
      api.takeFromSetAside?.('05144')
      // 2 张「鬼影骤现」洗入遭遇牌库：append + shuffle 走同一原语。
      api.shuffleIntoEncounterDeck?.(['05144', '05144'])
      api.info?.('👻 2 张「鬼影骤现」洗入遭遇牌库。')
      const nahabLocation = nahab?.location
        || state.locations.find(location => String(originalOf(location)) === '05132')?.id
        || state.locations[0]?.id
      const jenkin = inPlay(state, '05148')
      if (jenkin) api.moveEnemy?.(jenkin, nahabLocation)
      else {
        // 「找出布朗·詹金（即便不在场）」：牌库/弃牌堆/set aside 中找，找到才生成。
        const found = findAnywhere(api, '05148')
        if (found && nahabLocation) api.spawn?.(found, nahabLocation)
      }
      return true
    },
  },
}
