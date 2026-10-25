// 05125 探访巫宅（Investigating the Witch House）
// 归属：关卡专用 · theSecretName（P8 w-witch）。卡面：目标 - 所有未击败调查员在沃尔特房间，团队花费 3×人数线索；背面换入凯夏的房间、移除其他地点、黑书归属、洗入 2 张古怪图形。
// 一卡一文件：规则只在这里维护；跨章共享规则在 content/campaigns/theCircleUndone/encounter-rules.js。
//
// 参考 InvestigatingTheWitchHouse.hs：`swapLocation lid keziahsRoom`（原地点上的 token 与卡牌
// 一并带到新地点）→ `removeLocation` 其余地点 → 黑书控制权 → 洗入古怪图形。
import { activeInvestigators, originalOf } from '../../_shared.js'

const GEOMETRY = '05142'
const WALTER = '05132'
const KEZIAH = '05133'

export default {
  code: '05125', scope: 'act', implemented: true,
  actRule: {
    onReveal(state, act, api) {
      const setAside = state.scenarioZones?.setAside || []
      const take = code => {
        const index = setAside.indexOf(code)
        if (index >= 0) setAside.splice(index, 1)
      }
      const walter = state.locations.find(location => String(originalOf(location)) === WALTER)
      const investigators = activeInvestigators(state)
      // 「原地点上的所有标记和卡牌现在都在新地点上」：先记录沃尔特房间上的线索/毁灭/
      // 地点附属卡/玩家地点附属，再放到换入的凯夏的房间。
      const walterClues = walter?.clues || 0
      const walterDoom = walter?.doom || 0
      const walterAttachments = [...(walter?.attachments || [])]
      const playerAttachments = (state.playerLocationAttachments || [])
        .filter(item => walter && item.location === walter.id)
      const removedIds = new Set(state.locations
        .filter(location => location !== walter)
        .map(location => location.id))
      const displacedEnemies = (state.enemies || []).filter(enemy => removedIds.has(enemy.location))
      const walterEnemies = (state.enemies || []).filter(enemy => walter && enemy.location === walter.id)
      // 换入凯夏的房间（引擎 place 会创建实例并处理符号连线）。
      take(KEZIAH)
      api.place?.('keziahsRoom')
      const keziah = state.locations.find(location => location.id === 'keziahsRoom')
      if (keziah) {
        keziah.revealed = true
        keziah.clues = walterClues
        keziah.maxClues = Math.max(keziah.maxClues || 0, walterClues)
        keziah.doom = walterDoom
        keziah.attachments = [...(keziah.attachments || []), ...walterAttachments]
      }
      for (const item of playerAttachments) item.location = 'keziahsRoom'
      // 被移除地点上的敌人按「地点离场」弃到遭遇弃牌堆（引擎 removeLocation 不处理敌人）。
      for (const enemy of displacedEnemies) {
        state.enemies = state.enemies.filter(candidate => candidate !== enemy)
        state.encounterDiscard.push(String(originalOf(enemy)))
      }
      // 沃尔特房间上的敌人随地点卡牌一起搬到凯夏的房间。
      for (const enemy of walterEnemies) api.moveEnemy?.(enemy, 'keziahsRoom')
      for (const inv of investigators) api.moveInvestigator?.(inv.seat, 'keziahsRoom')
      // 「将场上的其他所有地点从游戏中移除」：走引擎 removeLocation（处理地点附属/计数），
      // 沃尔特房间已被替换，手动移出（不进遭遇弃牌堆）。
      for (const location of [...state.locations]) {
        if (location.id === 'keziahsRoom') continue
        if (walter && location.id === walter.id) {
          state.locations = state.locations.filter(candidate => candidate !== walter)
          continue
        }
        if (typeof api.remove === 'function') api.remove(location.id)
        else state.locations = state.locations.filter(candidate => candidate !== location)
      }
      // 选择一位调查员控制放在一边的黑书。
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
      // 将放在一边的 2 张古怪图形洗入遭遇牌库。
      take(GEOMETRY)
      take(GEOMETRY)
      for (let index = 0; index < 2; index++) state.encounterDeck.push(GEOMETRY)
      api.shuffleEncounterDeck?.()
      api.info?.('🧩 2 张「古怪图形」洗入遭遇牌库。')
      return true
    },
  },
}
