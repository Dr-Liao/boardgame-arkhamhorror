// 05125 探访巫宅（Investigating the Witch House）
// 归属：关卡专用 · theSecretName（P8 w-witch）。卡面：目标 - 所有未击败调查员在沃尔特房间，团队花费 3×人数线索；背面换入凯夏的房间、移除其他地点、黑书归属、洗入 2 张古怪图形。
// 一卡一文件：规则只在这里维护；跨章共享规则在 content/campaigns/theCircleUndone/encounter-rules.js。
import { ALL_CARDS, activeInvestigators, originalOf } from '../../_shared.js'

export default {
  code: '05125', scope: 'act', implemented: true,
  actRule: {
    onReveal(state, act, api) {
      const setAside = state.scenarioZones?.setAside || []
      const take = code => {
        const index = setAside.indexOf(code)
        if (index >= 0) setAside.splice(index, 1)
      }
      const walter = state.locations.find(location => String(originalOf(location)) === '05132')
      const investigators = activeInvestigators(state)
      // 「原地点上的标记和卡牌视为在新地点」：先记录被移除地点上的敌人与标记。
      const removedIds = new Set(state.locations.map(location => location.id))
      const displacedEnemies = (state.enemies || []).filter(enemy => removedIds.has(enemy.location))
      const clues = walter?.clues || 0
      const doom = walter?.doom || 0
      state.locations = state.locations.filter(location => false)
      take('05133')
      api.place?.('keziahsRoom')
      const keziah = state.locations.find(location => location.id === 'keziahsRoom')
      if (keziah) {
        keziah.revealed = true
        keziah.clues = clues
        keziah.maxClues = Math.max(keziah.maxClues || 0, clues)
        keziah.doom = doom
      }
      for (const inv of investigators) api.moveInvestigator?.(inv.seat, 'keziahsRoom')
      // 被移除地点上的敌人（含与调查员交战的敌人）一起移到凯夏的房间。
      for (const enemy of displacedEnemies) {
        api.moveEnemy?.(enemy, 'keziahsRoom')
        api.info?.(`👹 「${enemy.name}」随被移除的地点一并移到「凯夏的房间」。`)
      }
      // 选择一位调查员控制黑书。
      take('05150')
      const chosen = investigators.length === 1 ? investigators[0] : investigators.find(inv =>
        String(inv.seat) === String(api.choose?.({
          kind: 'investigator', source: '05125', seat: state.campaign?.leadSeat ?? 0,
          prompt: '选择一位调查员控制放在一边的黑书支援。',
          options: investigators.map(inv => ({ id: String(inv.seat), label: inv.name })),
        }))) || investigators[0]
      if (chosen) {
        api.giveAsset?.(chosen.seat, '05150')
        state.scenarioFlags ||= {}
        state.scenarioFlags.blackBookSeat = chosen.seat
        api.info?.(`📖 ${chosen.name} 控制了「黑书」。`)
      }
      take('05142')
      take('05142')
      for (let index = 0; index < 2; index++) state.encounterDeck.push('05142')
      api.shuffleEncounterDeck?.()
      api.info?.('🧩 2 张「古怪图形」洗入遭遇牌库。')
      return true
    },
  },
}
