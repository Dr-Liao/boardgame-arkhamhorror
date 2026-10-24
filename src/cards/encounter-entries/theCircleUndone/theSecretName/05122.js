// 05122 魔宠（The Familiar）
// 归属：关卡专用 · theSecretName（P8 w-witch）。卡面：每个非弱点敌人 +2 生命；反应同上。背面 - 按幕放置那赫卜、洗入 2 张鬼影骤现、找出布朗·詹金。
// 一卡一文件：规则只在这里维护；跨章共享规则在 content/campaigns/theCircleUndone/encounter-rules.js。
import { ALL_CARDS, activeInvestigators, originalOf } from '../../_shared.js'

export default {
  code: '05122', scope: 'agenda', implemented: true,
  agendaRule: {
    onReveal(state, agenda, api) {
      const step = (state.actIndex ?? 0) + 1
      const setAside = state.scenarioZones?.setAside || []
      const take = code => {
        const index = setAside.indexOf(code)
        if (index >= 0) setAside.splice(index, 1)
      }
      let nahab = state.enemies.find(enemy => String(originalOf(enemy)) === '05149')
      if (step === 3) {
        if (nahab) nahab.doom = (nahab.doom || 0) + 1
      } else {
        const targetId = step === 1 ? 'walterGilmansRoom' : 'keziahsRoom'
        const target = state.locations.find(location => location.id === targetId)
          || state.locations.find(location => location.id === 'moldyHalls')
        if (nahab) api.moveEnemy?.(nahab, target?.id || nahab.location)
        else {
          take('05149')
          nahab = api.spawn?.('05149', target?.id) || null
        }
        if (nahab && target) api.info?.(`🌑 那赫卜生成在「${target.name}」。`)
      }
      take('05144')
      take('05144')
      state.encounterDeck.push('05144', '05144')
      api.shuffleEncounterDeck?.()
      api.info?.('👻 2 张「鬼影骤现」洗入遭遇牌库。')
      const nahabLocation = nahab?.location
        || state.locations.find(location => String(originalOf(location)) === '05132')?.id
        || state.locations[0]?.id
      const jenkin = state.enemies.find(enemy => String(originalOf(enemy)) === '05148')
      if (jenkin) api.moveEnemy?.(jenkin, nahabLocation)
      else {
        take('05148')
        api.spawn?.('05148', nahabLocation)
      }
      return true
    },
  },
}
