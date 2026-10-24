// 05144 鬼影骤现（Ghostly Presence）
// 归属：关卡专用 · theSecretName（P8 w-witch）。卡面：显现 - 那赫卜在场：重整、结算猎手、攻击她所在地点每位调查员；在献祭场所再放 1 毁灭。否则找出她生成在你地点。
// 一卡一文件：规则只在这里维护；跨章共享规则在 content/campaigns/theCircleUndone/encounter-rules.js。
import { ALL_CARDS, activeInvestigators, originalOf } from '../../_shared.js'

export default {
  code: '05144', scope: 'treachery', implemented: true,
  encounterResolve(state, inv, card, api) {
    const nahab = state.enemies.find(enemy => String(originalOf(enemy)) === '05149')
    if (!nahab) {
      const list = state.scenarioZones?.setAside || []
      const index = list.indexOf('05149')
      if (index >= 0) list.splice(index, 1)
      api.spawn?.('05149', inv.location)
      api.info?.('👻 「鬼影骤现」：那赫卜在调查员所在地点浮现。')
      return false
    }
    nahab.exhausted = false
    // 卡面「结算她的猎手关键词」：实际向最近调查员移动一步（引擎 hunterStep 只计算不移动）。
    if (nahab.hunter) {
      let best = null
      for (const inv of activeInvestigators(state)) {
        const next = api.stepToward?.(nahab.location, inv.location)
        if (!next || next === nahab.location) continue
        if (!best) best = next
      }
      if (best) api.moveEnemy?.(nahab, best)
    }
    for (const other of activeInvestigators(state).filter(entry => entry.location === nahab.location)) {
      api.attack?.(nahab, other)
    }
    if (nahab.location === 'siteOfTheSacrifice') {
      nahab.doom = (nahab.doom || 0) + 1
      api.info?.('👻 那赫卜位于献祭场所：再获得 1 个毁灭标记。')
    }
    return false
  },
}
