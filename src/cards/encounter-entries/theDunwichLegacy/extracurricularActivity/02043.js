// 02043 死寂之夜
// 归属：关卡专用 · extracurricularActivity（敦威治遗产 · 课外活动）
// 遭遇组：extracurricular_activity
// 卡面：补给阶段期间检查手牌上限时，每位调查员的手牌上限减少3张。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 死寂之夜（02043）：整理阶段手牌上限 -3。

import { originalOf, moveExperimentToward } from '../../_shared.js'
import { nonPlayerEntryFor } from '../../_lookup.js'

export default { code: '02043', name: '死寂之夜', scope: 'agenda', text: '整理阶段你的手牌上限 -3。', agendaHandSizePenalty: 3,
  // 第 115 轮：密谋二的显现（放置宿舍、移动实验体或生成实验体）从课外活动的 behavior 迁来。
  agendaRule: {
    onReveal(state, agenda, api) {
      api.place('dormitories')
      const experiment = state.enemies.find(enemy => nonPlayerEntryFor(originalOf(enemy))?.enemyScript?.experiment)
      if (!experiment) { api.spawn('02058', 'scienceBuilding'); return }
      moveExperimentToward(state, experiment, 'dormitories')
    },
  } }
