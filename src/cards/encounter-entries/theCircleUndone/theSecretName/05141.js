// 05141 献祭场所（Site of the Sacrifice）
// 归属：关卡专用 · theSecretName（P8 w-witch）。卡面：[action] 本地调查员团队花费 1×人数线索移除那赫卜 1 毁灭（不引发趁乱攻击）；强制 - 轮末补线索到 3×人数；闹鬼写 definition。
// 一卡一文件：规则只在这里维护；跨章共享规则在 content/campaigns/theCircleUndone/encounter-rules.js。
import { ALL_CARDS, activeInvestigators, originalOf } from '../../_shared.js'

export default {
  code: '05141', scope: 'location', implemented: true,
  locationRule: {
    actions({ moves, state, inv, location }) {
      if (inv.location !== location.id) return
      const nahab = state.enemies.find(enemy => String(originalOf(enemy)) === '05149')
      if (!nahab || (nahab.doom || 0) <= 0) return
      const required = state.numInvestigators
      const available = activeInvestigators(state).filter(entry => entry.location === location.id)
        .reduce((sum, entry) => sum + (entry.clues || 0), 0)
      if (available < required) return
      moves.push({ action: 'scenarioAction', rule: 'removeNahabDoom', label: `🩸 团队花费 ${required} 个线索移除那赫卜的 1 个毁灭标记` })
    },
    performAction(state, inv, move, api) {
      if (move.rule !== 'removeNahabDoom') return false
      api.payClues?.(state.numInvestigators, inv.location)
      const nahab = state.enemies.find(enemy => String(originalOf(enemy)) === '05149')
      if (nahab) nahab.doom = Math.max(0, (nahab.doom || 0) - 1)
      api.info?.('🩸 献祭场所：移除那赫卜上的 1 个毁灭标记。')
      return true
    },
    // 引擎直接读取：强制 - 轮末把本地点的线索补到 3×人数。
    onRoundEnd(state, location, api) {
      const target = 3 * state.numInvestigators
      if ((location.clues || 0) >= target) return
      location.clues = target
      api?.info?.(`🩸 献祭场所：线索补充到 ${target}。`)
    },
  },
}
