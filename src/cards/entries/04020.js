// 04020 值得信赖
// 卡面：快速。只能在你回合期间打出。
// 卡面：附属到你控制的一个[[道具]]支援。
// 卡面：结算附属的支援上的触发能力时，你得到每项技能+1。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

import { ownTurn } from '../../engine/matcher.js'

export default {
  code: '04020',
  playCondition: [{ when: ownTurn(), message: '只能在你回合期间打出' }],
  attachTo: {"kind":"asset","trait":"item"},
  fast: true,
  passive: {"hostAbilitySkillBonus":1},
  attachedSkillBonus: 1,
  abilities: [

  ],
  modifiers: [

  ],
}
