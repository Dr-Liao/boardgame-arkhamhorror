// 06134 禁闭之地（theSearchForKadath）· 地点（禁闭 / 废土，线索0，帷幕6）
// 卡面：[action]：检定[combat](1)。如果成功，检定[agility](2)。如果成功，检定[willpower](3)。
//       如果成功，将本卡牌翻面。如果上述任何检定失败，受到1点伤害。
//
// 一卡一文件：地点条目声明 [action]；章节 behavior 的 actions/performAction 读取并接线。
// 三次连续检定失败即中止并受伤；全部成功由 api.flipLocation 翻面（behavior.locationFlipped 结算 06134b）。
const FLIPPED_FLAG = 'storyRead:forbiddenLands'

function alreadyFlipped(state, location) {
  return apiFlag(state, FLIPPED_FLAG) === true || Boolean(location?.storyRead)
}

// 只读 scenarioFlags（不写状态；写入由 behavior.locationFlipped 统一完成）。
function apiFlag(state, key) {
  return state?.scenarioFlags?.[key] ?? null
}

export default {
  code: '06134', scope: 'location', implemented: true,
  locationRule: {
    actions({ moves, state, inv, location }) {
      if (inv.location !== location.id) return
      if (alreadyFlipped(state, location)) return
      moves.push({
        action: 'scenarioAction', rule: 'forbiddenLandsRitual', actions: 1,
        label: '🏜️ 禁闭之地：检定战斗(1)→敏捷(2)→意志(3)；全部成功则翻面，任一次失败受 1 点伤害',
      })
    },
    performAction(state, inv, move, api) {
      if (move.rule !== 'forbiddenLandsRitual') return false
      const location = (state.locations || []).find(item => item.id === inv.location)
      if (!location || alreadyFlipped(state, location)) return true
      const steps = [
        { skill: 'combat', difficulty: 1 },
        { skill: 'agility', difficulty: 2 },
        { skill: 'willpower', difficulty: 3 },
      ]
      const runStep = index => {
        if (index >= steps.length) {
          api.flipLocation?.(location.id, inv.seat)
          return
        }
        const step = steps[index]
        api.test?.(inv.seat, step.skill, step.difficulty, result => {
          if (!result.success) {
            api.damage?.(inv.seat, 1)
            api.info?.(`🏜️ 禁闭之地：${step.skill} 检定失败，受到 1 点伤害。`)
            return
          }
          runStep(index + 1)
        })
      }
      runStep(0)
      return true
    },
  },
}
