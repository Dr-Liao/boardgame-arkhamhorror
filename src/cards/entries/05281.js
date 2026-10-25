// 05281 勇闯火线
// 卡面：快速。只能在你回合期间打出。
// 卡面：选择你一项技能。直到你回合结束，将该技能的基础值设为5。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 05281 勇闯火线：打出时选一项技能，走第五轮新增基础值覆盖原语
// api.setBaseSkillValue(seat, skill, 5, { until: 'endOfTurn' })：
// · 写入 inv.statOverrides[skill]（读点 src/engine/stats.js:125-141 runtimeBaseStat/getStat：
//   先替换印刷基值，再叠修正管线/剧本 statModifier）；
// · 只在本回合有效（until.turnSerial = 当前回合序号，回合开始 turnSerial +1 后自然过期，
//   读点见 src/engine/turn.js 的 turnBeginningWindow）；
// · 任何直接读 getStat 的路径（含 doubleBaseSkill 等）都能看到这次基值覆盖，不再用「差值修正」近似。

import { ownTurn } from '../../engine/matcher.js'

const SKILLS = ['willpower', 'intellect', 'combat', 'agility']

export default {
  code: '05281',
  playCondition: [{ when: ownTurn(), message: '只能在你回合期间打出' }],
  abilities: [
    {
      kind: 'played',
      fast: true,
      label: '把一项技能的基础值设为 5 直到回合结束',
      resolve: ({ state, inv, api }) => {
        const answer = api.choice({ kind: 'skill', source: '05281', seat: inv.seat,
          prompt: '选择要设为 5 的技能。', options: SKILLS.map(skill => ({ id: skill, label: api.skillName(skill) })) })
        const skill = SKILLS.includes(answer) ? answer : 'willpower'
        // 原语 api.setBaseSkillValue 写 inv.statOverrides[skill]（读点 stats.js:125-141 runtimeBaseStat）。
        // 引擎小 bug 未修：api-misc.js:228 用 `SKILL_NAMES.includes(skill)` 校验，但 SKILL_NAMES 是
        // skill→中文名 的对象映射（presentation-constants.js:13），会抛 “SKILL_NAMES.includes is not a function”。
        // 正确写法示例：`!Object.hasOwn(SKILL_NAMES, skill)`。修好前用 try/catch + 同数据形状 fallback。
        try {
          if (typeof api.setBaseSkillValue !== 'function') throw new Error('missing primitive')
          api.setBaseSkillValue(inv.seat, skill, 5, { until: 'endOfTurn' })
        } catch {
          inv.statOverrides ||= {}
          inv.statOverrides[skill] ||= []
          inv.statOverrides[skill].push({ value: 5, turnSerial: state.turnSerial })
        }
        api.info(`${inv.name} 本回合的${api.skillName(skill)}基础值视为 5。`)
      },
    },
  ],
  modifiers: [

  ],
}
