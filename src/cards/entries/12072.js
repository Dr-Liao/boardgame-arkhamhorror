// 12072 阿列克谢·萨布罗夫（Aleksey Saburov · Always on the Mend）
// 卡面：[reaction]在你的回合开始时：治愈阿列克谢·萨布罗夫的 1 点伤害或 1 点恐惧。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点：
//   · 「你的回合开始时」= turnBegins 窗口（turn-flow.js；context.seat 是开始回合的调查员）；
//   · 治愈支援自己的伤害/恐惧 = api.healAsset（healDamageFrom/healHorrorFrom 的统一入口，
//     与 06118/05001 同一读点）；「伤害或恐惧」二选一走 api.choice。

const CODE = '12072'

export default {
  code: CODE,
  abilities: [
    {
      kind: 'reaction',
      trigger: 'turnBegins',
      // 回合开始窗口会被 triggerReaction/reactionWindow 各开一次；每回合只结算一次。
      limit: 'oncePerTurn',
      label: '回合开始：治愈阿列克谢的 1 点伤害或 1 点恐惧',
      criteria: [({ inv, source, context }) => context?.seat === inv.seat && Boolean(source)
        && ((source.damage || 0) > 0 || (source.horror || 0) > 0)],
      resolve: ({ source, inv, api }) => {
        if (!source) return
        const options = []
        if ((source.damage || 0) > 0) options.push({ id: 'damage', label: '治愈 1 点伤害' })
        if ((source.horror || 0) > 0) options.push({ id: 'horror', label: '治愈 1 点恐惧' })
        if (!options.length) return
        const answer = options.length === 1 ? options[0].id : api.choice({
          kind: 'heal', source: CODE, seat: inv.seat,
          prompt: '治愈「阿列克谢·萨布罗夫」的 1 点伤害或 1 点恐惧。',
          options,
        })
        if (answer === 'damage') api.healAsset(source, { damage: 1 })
        else api.healAsset(source, { horror: 1 })
        api.info(`🩹 「阿列克谢·萨布罗夫」：治愈 1 点${answer === 'damage' ? '伤害' : '恐惧'}。`)
      },
    },
  ],
  modifiers: [],
}
