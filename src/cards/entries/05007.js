// 05007 催眠疗法
// 卡面：卡洛琳·弗恩牌库专用
// 卡面：[action]横置催眠疗法：检定[intellect](2)。如果你检定成功，治愈你所在地点一位调查员1点恐惧。
//       然后，该调查员可以抽取1张卡牌。
// 卡面：[reaction]在你的其他卡牌效果治愈调查员的恐惧后，横置催眠疗法：该效果治愈额外1点恐惧。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 修复（task-22）：
//   · [reaction] 旧 criteria 没有区分「调查员」与「盟友支援」，治疗盟友恐惧也会触发、且把额外 1 点
//     治到调查员身上（卡面只对「治愈调查员的恐惧」生效）。现在 criteria 加 `context.assetId == null`，
//     只在治疗调查员时触发（healHorrorFrom 对支援目标会带 assetId）。
//   · [action] 旧实现「所在地点没有任何恐惧」时提前 return，既不询问目标也不让目标抽牌；卡面是治愈
//     1 点恐惧（0 点时无事发生）后该调查员可以抽 1 张，所以现在总是先在所在地点选一位调查员、能治则治，
//     再询问是否抽牌。
//
// 剩余近似（引擎原语，见 artifacts/tcu-fix/primitive-requests/fix-investigator.json）：
//   「该效果治愈额外 1 点」现在通过再开一次 api.healHorror 实现，会为同一次治疗开第二个 horrorHealed
//   窗口（卡洛琳的反应可能因此对同一次治疗结算两次）；需要引擎提供「在同一治疗里追加治疗量、不重开窗口」
//   的原语。

export default {
  code: '05007',
  abilities: [
    {
      kind: 'action',
      label: '催眠疗法：检定智力(2)，治愈 1 点恐惧并可抽 1 张',
      cost: { action: true, exhaust: true },
      resolve: ({ inv, api }) => api.test(inv.seat, 'intellect', 2, {
        source: { label: '催眠疗法', code: '05007', name: '催眠疗法' },
        resolve: result => {
          if (!result.success) return
          // 卡面允许选「你所在地点的一位调查员」（不要求对方有恐惧）；0 点时治疗无事发生。
          const targets = api.investigatorsAt(inv.location)
          if (!targets.length) return
          const answer = targets.length === 1 ? String(targets[0].seat) : api.choice({
            kind: 'target', source: '05007', seat: inv.seat,
            prompt: '选择要治愈恐惧的调查员。',
            options: targets.map(owner => ({
              id: String(owner.seat),
              label: `${owner.name}（${owner.horror || 0} 恐惧）`,
            })),
          })
          const target = targets.find(owner => String(owner.seat) === answer) || targets[0]
          if (!target) return
          if ((target.horror || 0) > 0) api.healHorror(target.seat, 1)
          const draw = api.choice({
            kind: 'reaction', source: '05007-draw', seat: target.seat, canSkip: true,
            prompt: `${target.name}：是否抽取 1 张卡牌？`,
            options: [{ id: 'skip', label: '不抽牌' }, { id: 'draw', label: '抽取 1 张' }],
          })
          if (draw === 'draw') api.drawCards(target.seat, 1)
        },
      }),
    },
    {
      kind: 'reaction',
      trigger: 'horrorHealed',
      label: '这次治疗额外治愈 1 点恐惧',
      cost: { exhaust: true },
      criteria: [({ inv, context }) => context?.cardSeat === inv.seat
        // 只对「治疗调查员的恐惧」生效：治疗盟友支援时 healHorrorFrom 会带 assetId。
        && context?.assetId == null
        && Number.isInteger(context?.healedSeat) && context.amount > 0],
      resolve: ({ api, context }) => {
        // R7 heal v3：向当前正开的 horrorHealed 窗口追加治疗（同一目标/汇点，不重开窗口；
        // 窗口外调用返回 0）。卡洛琳等「治愈恐惧后」反应因此对同一次治疗只结算一次。
        const healed = api.extendHealHorror(context.healedSeat, 1)
        api.info(`催眠疗法让这次治疗额外治愈了 ${healed} 点恐惧。`)
      },
    },
  ],
  modifiers: [],
}
