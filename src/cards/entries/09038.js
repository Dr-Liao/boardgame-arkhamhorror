// 09038 吉里什·卡达贾（Girish Kadakia）· 守卫者资产（4 级）· 盟友槽 · 生命 3 / 神智 3。
// 卡面：你所在地点其他调查员受到的伤害和/或恐惧，可以分配给吉里什·卡达贾。
//       [fast] 你所在地点的调查员执行的技能检定期间，横置吉里什·卡达贾：该调查员本次检定得到
//       技能值 +2。如果本次检定成功，治愈吉里什·卡达贾的 1 点伤害或恐惧。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 口径：
//   · 承伤：passive.assignHarmAtLocation（读点 harm-threat.js#assignHarm，同 05109）；
//   · +2：free 能力在检定期间用 api.addTestValue(2)，并留下一条 endOfTest 效果作为「本卡已为
//     这次检定加值」的标记（纯 JSON、随存档往返）；
//   · 成功后治愈：forced 能力在 skillTestSuccess 窗口读「本卡有针对本次检定的标记效果」，
//     治愈本卡 1 点伤害或恐惧（api.healAsset）。
const SOURCE = '09038'
const girishOf = inv => (inv.assets || []).find(card => card.code === SOURCE) || null
const boostedThisTest = (state, card) => (state.effects || []).some(effect => effect.sourceCode === SOURCE
  && effect.sourceInstanceId === card?.id && effect.duration === 'endOfTest')

export default {
  code: '09038',
  passive: { assignHarmAtLocation: true },
  abilities: [
    {
      kind: 'free',
      label: '横置：你所在地点调查员的本次检定 +2 技能值；成功则治愈本卡 1 点伤害/恐惧',
      cost: { exhaust: true },
      criteria: [({ state, inv }) => Boolean(state.skillTest)
        && state.investigators[state.skillTest.seat]?.location === inv.location],
      resolve: ({ state, inv, source, api }) => {
        api.addTestValue(2)
        api.addEffect({
          duration: 'endOfTest',
          sourceCode: SOURCE,
          sourceInstanceId: source?.id ?? null,
          controllerSeat: inv.seat,
          label: '吉里什·卡达贾：本次检定 +2 技能值',
        }, inv.seat)
        api.info('吉里什·卡达贾：本次检定 +2 技能值。')
        if (state.skillTest) state.skillTest.boostedByGirish = true
      },
    },
    {
      kind: 'forced',
      trigger: 'skillTestSuccess',
      silent: true,
      label: '被吉里什加值的检定成功后：治愈本卡 1 点伤害或恐惧',
      criteria: [({ state, inv }) => {
        const card = girishOf(inv)
        if (!card || !state.skillTest) return false
        return state.skillTest.boostedByGirish === true || boostedThisTest(state, card)
      }],
      resolve: ({ inv, api }) => {
        const card = girishOf(inv)
        if (!card) return
        if ((card.damage || 0) > 0) api.healAsset(card, { damage: 1 })
        else api.healAsset(card, { horror: 1, ownerSeat: inv.seat })
        api.info('吉里什·卡达贾：检定成功，治愈本卡 1 点伤害/恐惧。')
      },
    },
  ],
  modifiers: [],
}
