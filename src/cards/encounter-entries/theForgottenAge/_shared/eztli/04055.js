// 04055 暗起波澜
// 归属：战役共用 · theForgottenAge（失落的时代）
// 遭遇组：eztli
// 卡面：*本密谋得到+1[per_investigator]毁灭阀值。
// 卡面：强制 - 在本密谋推进时：不要从场上任何地点移除毁灭标记。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

import { takeFromSetAsideInEntry, spawnHarbingerAtDoomInEntry } from '../../../_shared.js'

export default {
  code: '04055', scope: 'agenda',
  // 卡面「强制 - 在本密谋推进时：不要从场上任何地点移除毁灭标记。」（引擎 advanceAgenda 读点）
  doomKeptOnAgendaAdvance: 'locations',
  agendaRule: { onReveal(state, agenda, api) { spawnHarbingerAtDoomInEntry(state, api) } },
  // 第 120 轮：时间倒流沿用同一张卡但文案/结局不同，用按剧本的变体（章节读点带 scenarioId）。
  agendaRuleByScenario: {
    turnBackTime: {
      onReveal(state, agenda, api) {
        takeFromSetAsideInEntry(state, '04062')
        const candidates = [...state.locations].sort((left, right) => (right.doom || 0) - (left.doom || 0))
        const target = candidates[0]?.id
        if (!target) return
        const enemy = api.spawn('04062', target)
        if (!enemy) return
        enemy.damageTaken = Number(state.scenarioFlags?.harbingerDamage || 0)
        api.setEnemyResources?.(enemy, 0)
        api.info?.(`🐍 瓦卢西亚的预示者在「${enemy.location}」苏醒。`)
      },
    },
  },
}
