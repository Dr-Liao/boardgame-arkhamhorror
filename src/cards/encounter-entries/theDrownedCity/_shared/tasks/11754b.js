// 11754b 信仰之行 · 任务（Task）· 完成面
// 归属：战役内跨关卡共用 · theDrownedCity/_shared/tasks（共享遭遇组 tasks，印刷 1 张）。
// 卡面（cards-data 11754b，原文见该卡 textZh）：
//   永久。除非本任务已完成，否则其以弱点面朝上进场。
//   你得到+1[willpower]。
//   [reaction]任意地点揭示[elder_sign]标记后：治愈该地点一位调查员的1点恐惧。
//
// 读点（声明即接线）：
//   · 「你得到 +1 意志」= modifiers 的 { target: 'skill:willpower', amount: 1 }；
//   · 「任意地点揭示 elder_sign 标记后：治愈该地点一位调查员的 1 点恐惧」= chaosTokenRevealed 窗口 + api.healHorror（多目标时 api.choice 选人）。
//   · 两面同实体：flags.task.partnerCode 指向未完成面 11754a；战役层在任务完成时用本卡替换它，
//     并把 isStrongInTheirFaith 写进剧本日志（「除非本任务已完成，否则其以弱点面朝上进场」由战役层发哪一面决定）。
const CODE = '11754b'

const TASK = Object.freeze({
  id: 'walkInFaith',
  side: 'completed',
  face: 'completed',
  partnerCode: '11754a',
  replaces: '11754a',
  completedRecord: 'isStrongInTheirFaith',
  progress: Object.freeze({ track: 'tdcTask', threshold: 5 }),
})

export default {
  code: CODE,
  name: '信仰之行',
  scope: 'storyAsset',
  implemented: true,
  flags: { permanent: true, traits: ['Task', 'Completed'], task: TASK },
  modifiers: [{ target: 'skill:willpower', amount: 1 }],
  abilities: [{
    kind: 'reaction',
    trigger: 'chaosTokenRevealed',
    label: '治愈该地点一位调查员的 1 点恐惧',
    criteria: ({ state, context }) => context?.token === 'eldersign'
      && (state.investigators || []).some(other => !other.defeated && !other.resigned
        && other.location === context?.location),
    resolve: ({ state, inv, context, api }) => {
      const here = (state.investigators || []).filter(other => !other.defeated && !other.resigned
        && other.location === context?.location)
      if (!here.length) return
      const seat = here.length === 1 ? here[0].seat : Number(api.choice({
        kind: 'investigator', source: CODE, seat: inv.seat,
        prompt: '「信仰之行」：选择该地点受到 1 点恐惧治疗的调查员。',
        options: here.map(other => ({ id: String(other.seat), label: other.name })),
      }))
      const target = here.find(other => other.seat === seat) || here[0]
      api.healHorror(target.seat, 1)
      api.info('✨ ' + target.name + ' 治疗了 1 点恐惧（「信仰之行」）。')
    },
  }],
  note: '近似：elder_sign 揭示窗口由 chaosTokenRevealed 提供（不限地点，与印刷一致）；目标不只一位时由卡牌控制者选人。',
}
