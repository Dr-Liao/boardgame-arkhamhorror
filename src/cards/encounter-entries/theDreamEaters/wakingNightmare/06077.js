// 06077 私人病房（Private Room）
// 归属：关卡专用 · theDreamEaters/wakingNightmare（P8-1 w-p8-a）。
// 卡面：[action]：谈判。检定意志(2)。若你成功，检定智识(2)。若你成功，位于本地点的调查员
//   可以作为一个团队花费 1×人数线索，把放在一边的「伦道夫·卡特」的控制权交给位于本地点的 1 位调查员。
// 读点：locationRule.actions / performAction 由章节 behavior.actions / performAction 分派。
// 谈判链按两次连续检定实现；线索支付走 api.payClues（团队支付），剧情资产控制走 api.giveAsset。
import { activeInvestigators } from '../../_shared.js'

const CODE = '06077'
const RANDOLPH = '06079'

export default {
  code: CODE,
  scope: 'location',
  implemented: true,
  locationRule: {
    actions({ moves, state, inv, location }) {
      if (!inv || inv.location !== location.id) return
      moves.push({
        action: 'scenarioAction',
        rule: 'privateRoomParley',
        actions: 1,
        label: '🚪 私人病房：[action] 谈判：意志(2) → 智识(2) → 团队支付线索取得伦道夫·卡特',
      })
    },
    performAction(state, inv, move, api) {
      if (!move || move.rule !== 'privateRoomParley') return false
      api.test?.(inv.seat, 'willpower', 2, first => {
        if (!first.success) return
        api.test?.(inv.seat, 'intellect', 2, second => {
          if (!second.success) return
          const required = Math.max(1, Number(state.numInvestigators) || 1)
          const here = activeInvestigators(state).filter(entry => entry.location === inv.location)
          const answer = api.choice?.({
            kind: 'story', source: CODE, seat: inv.seat,
            prompt: `是否由本地点的调查员团队支付 ${required} 个线索，把「伦道夫·卡特」交给其中一位调查员？`,
            options: [
              { id: 'pay', label: `支付 ${required} 个线索` },
              { id: 'skip', label: '不支付' },
            ],
          })
          if (answer !== 'pay') return
          api.payClues?.(required, inv.location)
          const holderAnswer = api.choice?.({
            kind: 'investigator', source: CODE, seat: inv.seat,
            prompt: '选择取得「伦道夫·卡特」控制权的调查员。',
            options: here.map(entry => ({ id: String(entry.seat), label: entry.name })),
          })
          const holder = here.find(entry => String(entry.seat) === String(holderAnswer)) || here[0]
          if (!holder) return
          api.takeFromSetAside?.(RANDOLPH)
          api.giveAsset?.(holder.seat, RANDOLPH)
          api.info?.(`🚪 私人病房：${holder.name} 获得了「伦道夫·卡特」的控制权。`)
        })
      })
      return true
    },
  },
}
