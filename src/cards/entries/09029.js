// 09029 还剩一枪（One in the Chamber）· 守卫者事件 · 1 费 · 快速。
// 卡面：快速。当花费你控制的[[枪械]]支援上最后子弹的攻击或效果结束时打出。
//       在该支援上增加 1 子弹。本轮你下次使用该支援攻击得到 +3 技能值。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 口径：
//   · 快速：played + fast（快速事件统一通道）；
//   · 「刚花掉最后一发子弹的[[枪械]]」= 你控制且弹药已归零的[[枪械]]支援（候选收敛），补弹走
//     api.addUses(asset, 1)（uses/usesType 是唯一读点）；
//   · 「本轮下次攻击 +3 技能值」= endOfRound 持续效果的 skill:combat +3（效果修正走 statPipeline）。
// approximation：+3 按「本轮结束前」生效、且不限定该支援的下一次攻击（缺单次攻击加值的消费读点），
//   见 note 与 artifacts/migration/tsk/primitive-requests/09029.json。
export default {
  code: '09029',
  note: 'approximation: 「下一次使用该支援的攻击 +3」实现为本轮结束前的 +3[combat]（缺单次攻击加值的消费读点）',
  abilities: [
    {
      kind: 'played',
      fast: true,
      label: '快速：给打空弹药的[[枪械]]补 1 发；本轮攻击 +3 技能值',
      resolve: ({ inv, api }) => {
        const firearms = (inv.assets || []).filter(card => (api.cardTraits(card.code) || [])
          .some(trait => String(trait).toLowerCase() === 'firearm'))
        if (!firearms.length) {
          api.info('还剩一枪：你没有[[枪械]]支援。')
          return
        }
        const empty = firearms.filter(card => card.uses != null && (card.uses || 0) <= 0)
        const candidates = empty.length ? empty : firearms
        const assetId = candidates.length === 1 ? candidates[0].id : api.choice({
          kind: 'asset', source: '09029', seat: inv.seat,
          prompt: '还剩一枪：选择刚花掉最后一发子弹的[[枪械]]支援。',
          options: candidates.map(card => ({ id: card.id, label: `${api.cardName(card.code)}（${card.uses || 0} 发）` })),
        })
        const firearm = candidates.find(card => card.id === assetId) || candidates[0]
        api.addUses(firearm, 1)
        api.addEffect({
          duration: 'endOfRound',
          sourceCode: '09029',
          sourceInstanceId: firearm.id,
          controllerSeat: inv.seat,
          label: '还剩一枪：本轮攻击 +3 技能值',
          modifiers: [{ target: 'skill:combat', amount: 3 }],
        }, inv.seat)
        api.info(`还剩一枪：给「${api.cardName(firearm.code)}」补 1 发子弹，本轮攻击 +3 技能值。`)
      },
    },
  ],
  modifiers: [],
}
