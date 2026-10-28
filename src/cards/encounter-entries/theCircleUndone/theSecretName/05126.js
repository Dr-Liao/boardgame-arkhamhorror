// 05126 巫宅之外（Beyond the Witch House）
// 归属：关卡专用 · theSecretName（P8 w-witch）。卡面：目标 - 巫宅遗址的调查员团队花费 5×人数线索；背面放置献祭场所、那赫卜（毁灭）、布朗·詹金。
// 一卡一文件：规则只在这里维护；跨章共享规则在 content/campaigns/theCircleUndone/encounter-rules.js。
import { originalOf } from '../../_shared.js'

export default {
  code: '05126', scope: 'act', implemented: true,
  actRule: {
    onReveal(state, act, api) {
      const setAside = state.scenarioZones?.setAside || []
      const take = code => {
        const index = setAside.indexOf(code)
        if (index >= 0) setAside.splice(index, 1)
        return index >= 0
      }
      take('05141')
      api.place?.('siteOfTheSacrifice')
      const site = state.locations.find(location => location.id === 'siteOfTheSacrifice')
      if (!site) return true
      const findInEncounter = code => {
        const wanted = String(code)
        const discardIndex = state.encounterDiscard.findIndex(candidate => String(candidate) === wanted)
        if (discardIndex >= 0) return state.encounterDiscard.splice(discardIndex, 1)[0]
        const deckIndex = state.encounterDeck.findIndex(candidate => String(candidate) === wanted)
        if (deckIndex >= 0) return state.encounterDeck.splice(deckIndex, 1)[0]
        return null
      }
      // 「找出那赫卜（即便不在场）」：优先站在场上的 instance，其次 set aside/场外区域。
      let nahab = state.enemies.find(enemy => String(originalOf(enemy)) === '05149')
      if (nahab) api.moveEnemy?.(nahab, site.id)
      else {
        let found = null
        if (take('05149')) found = '05149'
        else found = findInEncounter('05149')
        nahab = found ? api.spawn?.(found, site.id) || null : null
      }
      const agenda = state.agendas?.[state.agendaIndex]
      if (nahab) {
        if ((state.agendaIndex ?? 0) === 3) {
          // 幕 4a 上的真实毁灭记在 state.doom（当前议程）；议程实例 .doom 只用于「下一张议程」的预付。
          const carried = (Number(state.doom) || 0) + (Number(agenda?.doom) || 0)
          api.removeDoom?.(Number(state.doom) || 0)
          if (agenda) api.clearDoomOnCard?.(agenda)
          api.doomOn?.(nahab, carried)
          api.info?.(`🌑 密谋 4a 上的 ${carried} 个毁灭标记移动到那赫卜身上。`)
        } else {
          api.doomOn?.(nahab, 2)
          api.info?.('🌑 那赫卜被放在献祭场所，并获得 2 个毁灭标记。')
        }
      }
      let jenkin = state.enemies.find(enemy => String(originalOf(enemy)) === '05148')
      const nahabLocation = nahab?.location || site.id
      if (jenkin) api.moveEnemy?.(jenkin, nahabLocation)
      else {
        // 「找出布朗·詹金（即便不在场）」：牌库/弃牌堆/set aside 中找，找到才生成。
        let found = null
        if (take('05148')) found = '05148'
        else found = findInEncounter('05148')
        if (found) api.spawn?.(found, nahabLocation)
      }
      api.info?.('🐀 布朗·詹金被找出，放在那赫卜所在地点。')
      return true
    },
  },
}
