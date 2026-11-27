// 09689 域外来客之巢 · 地点（withoutATrace）
// 敌人在此处失去冷漠由敌人关键词读点计算；其余地点能力由章节 behavior 结算。
import { hasTrait } from '../../_shared.js'

export default {
  code: '09689',
  scope: 'location',
  implemented: true,
  flags: { victory: 1, printedShroud: 5, printedClues: 2, },
  modifiers: [{
    target: 'loses:aloof',
    condition: { when: ({ source, entity }) => source.revealed && hasTrait(entity, 'Outsider') },
  }],
  abilities: [],
}
