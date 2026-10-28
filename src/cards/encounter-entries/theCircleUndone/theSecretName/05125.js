// 05125 探访巫宅（Investigating the Witch House）
// 归属：关卡专用 · theSecretName（P8 w-witch）。卡面：目标 - 所有未击败调查员在沃尔特房间，团队花费 3×人数线索；背面换入凯夏的房间、移除其他地点、黑书归属、洗入 2 张古怪图形。
// 一卡一文件：规则只在这里维护；跨章共享规则在 content/campaigns/theCircleUndone/encounter-rules.js。
//
// 参考 InvestigatingTheWitchHouse.hs：`swapLocation lid keziahsRoom`（原地点上的 token 与卡牌
// 一并带到新地点）→ `removeLocation` 其余地点 → 黑书控制权 → 洗入古怪图形。
// 地点数组 / 地点实例 / 地点附属的写入全部收口在引擎地点原语：api.swapLocation /
// api.removeLocationFromGame（实现见 src/engine/location-swap.js）；「放一边」与遭遇牌库
// 分别走 api.takeFromSetAside / api.shuffleIntoEncounterDeck。
import { activeInvestigators } from '../../_shared.js'

const GEOMETRY = '05142'
const BLACK_BOOK = '05150'

export default {
  code: '05125', scope: 'act', implemented: true,
  actRule: {
    onReveal(state, act, api) {
      const investigators = activeInvestigators(state)
      // 「用放在一边的凯夏的房间替换沃尔特·吉尔曼的房间」：原地点上的线索/毁灭/地点附属/
      // 玩家地点附属随地点卡搬到新地点；旧地点上的敌人与调查员一并迁移（保留 token 与卡牌）。
      // 卡面结算时凯夏的房间直接以揭示面入场（迁移前实现同样是把 revealed 置 true）。
      api.swapLocation('walterGilmansRoom', 'keziahsRoom', { reveal: 'revealed' })
      // 「将场上的其他所有地点从游戏中移除」：地点离场时其上的敌人进遭遇弃牌堆（原语统一处理）。
      for (const location of [...state.locations]) {
        if (location.id === 'keziahsRoom') continue
        api.removeLocationFromGame(location.id)
      }
      // 选择一位调查员控制放在一边的黑书。
      api.takeFromSetAside(BLACK_BOOK)
      const chosen = investigators.length === 1 ? investigators[0] : investigators.find(inv =>
        String(inv.seat) === String(api.choose({
          kind: 'investigator', source: '05125', seat: state.campaign?.leadSeat ?? 0,
          prompt: '选择一位调查员控制放在一边的黑书支援。',
          options: investigators.map(inv => ({ id: String(inv.seat), label: inv.name })),
        }))) || investigators[0]
      if (chosen) {
        api.giveAsset(chosen.seat, BLACK_BOOK)
        api.setScenarioFlag('blackBookSeat', chosen.seat)
        api.info(`📖 ${chosen.name} 控制了「黑书」。`)
      }
      // 将放在一边的 2 张古怪图形洗入遭遇牌库。
      api.takeFromSetAside(GEOMETRY)
      api.takeFromSetAside(GEOMETRY)
      api.shuffleIntoEncounterDeck([GEOMETRY, GEOMETRY])
      api.info('🧩 2 张「古怪图形」洗入遭遇牌库。')
      return true
    },
  },
}
