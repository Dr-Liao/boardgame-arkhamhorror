// 05046 加弗瑞拉·米兹拉克（序章故事调查员）
// 卡面：[reaction]敌人攻击你后，即便该次攻击被取消：发现你所在地点的1个线索。(每轮仅限一次。)
// 卡面：[elder_sign]效果：+1。治愈1点伤害和1点恐惧。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 故事调查员（05046–05049）：只在序章的剧本调查员流程里使用，没有牌组、不进入选人/构筑/升级
// （读点：src/engine/story-investigators.js）。卡面能力与正式调查员走同一套描述子通道。

import { investigatorSign } from './_shared.js'

const sign = investigatorSign('05046')

export default {
  code: '05046',
  kind: 'investigator',
  investigator: { elderSign: { bonus: 1 } },
  elderSign: {
    id: '05046-eldersign',
    label: '旧印：+1，治愈 1 点伤害与 1 点恐惧',
    resolve: ({ inv, api }) => {
      if ((inv.damage || 0) > 0) api.healDamage(inv.seat, 1)
      if ((inv.horror || 0) > 0) api.healHorror(inv.seat, 1)
      api.info(`${inv.name} 的旧印治愈了 1 点伤害与 1 点恐惧。`)
      return { delta: Number(sign.bonus ?? 1) }
    },
  },
  abilities: [
    {
      kind: 'reaction',
      trigger: 'enemyAttacked',
      label: '敌人攻击你后：发现你所在地点的 1 个线索',
      limit: 'oncePerRound',
      // 卡面「敌人攻击你后，即便该次攻击被取消」：引擎的 enemyAttack 取消分支也会开
      // enemyAttacked 窗口（src/engine/enemies.js:140-146，context.cancelled=true），因此本条目
      // 无需读取 cancelled 即可在两种路径触发。无「取消」子句差异。
      // 「发现 1 个线索」需要地点上确实有线索：无可发现时该能力不能触发（参考实现
      // GavriellaMizrah.hs 的 ClueOnLocation 限制；触发后不改变状态的触发式能力不允许发动）。
      criteria: [({ inv, context, state }) => context?.seat === inv.seat && Boolean(context?.enemy)
        && (Number(state?.locations?.find(location => location.id === inv.location)?.clues) || 0) > 0],
      resolve: ({ inv, api }) => {
        api.discoverClue(inv.seat, 1)
        api.info(`${inv.name} 遭到攻击后发现了 1 个线索。`)
      },
    },
  ],
  modifiers: [],
}
