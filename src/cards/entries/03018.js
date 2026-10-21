// 03018 即兴表演
// 卡面：萝拉·海耶斯牌库专用。
// 卡面：快速。只能在你回合期间打出。
// 卡面：切换你的角色。直到你的回合结束，你打出的下一张你所选角色的卡牌资源费用减少3点。抽取1张卡牌。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 03018 即兴表演：切换角色，本回合下一张该阵营的卡费用 -3，并抽 1 张。
// 旧条目的 `duringOwnTurn: true` 由 play-condition.js 翻译成「只能在自己的回合打出」，
// 迁移后必须显式写成 playCondition，否则会在别人回合也能打出。

import { ownTurn } from '../../engine/matcher.js'

export default {
  code: '03018',
  playCondition: [{ when: ownTurn(), message: '只能在自己的回合打出' }],
  abilities: [
    {
      kind: 'played', fast: true, label: '切换角色并抽 1 张（下一张该阵营卡 -3）',
      resolve: ({ inv, api }) => {
        const role = api.switchRole(inv.seat, '03018', '选择即兴表演要切换到的角色。')
        if (!role) return
        api.setRoleDiscount(inv.seat, role, 3)
        api.drawCardsLogged(inv.seat, 1)
        api.info(`${inv.name} 切换为${api.className(role)}；本回合下一张该阵营卡牌费用-3。`)
      },
    },
  ],
  modifiers: [

  ],
}
