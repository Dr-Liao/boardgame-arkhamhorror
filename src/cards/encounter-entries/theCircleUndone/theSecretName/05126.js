// 05126 巫宅之外（Beyond the Witch House）
// 归属：关卡专用 · theSecretName（P8 w-witch）。卡面：目标 - 巫宅遗址的调查员团队花费 5×人数线索；背面放置献祭场所、那赫卜（毁灭）、布朗·詹金。
// 一卡一文件：规则只在这里维护；跨章共享规则在 content/campaigns/theCircleUndone/encounter-rules.js。
import { ALL_CARDS, activeInvestigators, originalOf } from '../../_shared.js'

export default {
  code: '05126', scope: 'act', implemented: true,
  actRule: {
    onReveal(state, act, api) {
      const setAside = state.scenarioZones?.setAside || []
      const take = code => {
        const index = setAside.indexOf(code)
        if (index >= 0) setAside.splice(index, 1)
      }
      take('05141')
      api.place?.('siteOfTheSacrifice')
      const site = state.locations.find(location => location.id === 'siteOfTheSacrifice')
      if (!site) return true
      let nahab = state.enemies.find(enemy => String(originalOf(enemy)) === '05149')
      if (nahab) api.moveEnemy?.(nahab, site.id)
      else {
        take('05149')
        nahab = api.spawn?.('05149', site.id) || null
      }
      const agenda = state.agendas?.[state.agendaIndex]
      if (nahab) {
        if ((state.agendaIndex ?? 0) === 3) {
          const carried = agenda?.doom || 0
          if (agenda) agenda.doom = 0
          nahab.doom = (nahab.doom || 0) + carried
          api.info?.(`🌑 密谋 4a 上的 ${carried} 个毁灭标记移动到那赫卜身上。`)
        } else {
          nahab.doom = (nahab.doom || 0) + 2
          api.info?.('🌑 那赫卜被放在献祭场所，并获得 2 个毁灭标记。')
        }
      }
      let jenkin = state.enemies.find(enemy => String(originalOf(enemy)) === '05148')
      const nahabLocation = nahab?.location || site.id
      if (jenkin) api.moveEnemy?.(jenkin, nahabLocation)
      else {
        take('05148')
        api.spawn?.('05148', nahabLocation)
      }
      api.info?.('🐀 布朗·詹金被找出，放在那赫卜所在地点。')
      return true
    },
  },
}
