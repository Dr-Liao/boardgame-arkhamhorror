// 11754a 信仰之行 · 任务（Task）· 未完成面（弱点面）
// 归属：战役内跨关卡共用 · theDrownedCity/_shared/tasks（共享遭遇组 tasks，印刷 1 张）。
// 卡面（cards-data 11754a，原文见该卡 textZh）：
//   永久。使用(0征兆)。
//   [reaction]任意地点揭示[elder_sign]标记后：在信仰之行上放置1个征兆。
//   强制 - 游戏结束时，如果信仰之行上有超过1[per_investigator]个征兆：在剧本日志中，本任务下标记1点进度。
//
// 读点（声明即接线）：
//   · 「使用(0 征兆)」= 条目 uses/usesType（0 次同样写进条目，newPlayerAssetInstance 会初始化 uses=0）；
//   · 「任意地点揭示 elder_sign 标记后」= chaosTokenRevealed 窗口，criteria 读 context.token === 'eldersign'，不限地点；
//   · 「放置 1 个征兆」= api.placeUse(source, 'signs', 1)（卡面计数器入口）；
//   · 「游戏结束时…标记 1 点进度」= 引擎卡级 gameEnds 窗口（hub.endCampaign 派发；第三轮落地）。
//     条目声明 forced/trigger:gameEnds，resolve 判定「征兆数 > 1×人数」后 api.mechanics.progress.change 写入 +1；
//     receipt = 'taskEnd-walkInFaith'，重复收尾自动去重。
//   · 两面同实体：flags.task.partnerCode 指向完成面 11754b；完成门限 5 点由战役层 interludes.resolveTasks 判定。
const CODE = '11754a'

const TASK = Object.freeze({
  id: 'walkInFaith',
  side: 'incomplete',
  face: 'weakness',
  partnerCode: '11754b',
  completedCard: '11754b',
  completedRecord: 'isStrongInTheirFaith',
  progress: Object.freeze({ track: 'tdcTask', threshold: 5, amount: 1, receipt: 'taskEnd-walkInFaith' }),
  tally: Object.freeze({ token: 'signs', initial: 0, on: ['chaosTokenRevealed'] }),
  endOfGame: Object.freeze({ kind: 'usesMoreThanPerInvestigator', token: 'signs', perInvestigator: 1, settle: 'gameEnds' }),
})

const investigatorCount = state => Number(state.numInvestigators)
  || (state.investigators || []).filter(other => !other.defeated && !other.resigned).length

export default {
  code: CODE,
  name: '信仰之行',
  scope: 'storyAsset',
  implemented: true,
  uses: 0,
  usesType: 'signs',
  flags: { permanent: true, traits: ['Task', 'Incomplete'], task: TASK },
  abilities: [{
    kind: 'reaction',
    trigger: 'chaosTokenRevealed',
    label: '放置 1 个征兆',
    criteria: ({ context }) => context?.token === 'eldersign',
    resolve: ({ inv, source, api }) => {
      const signs = Number(api.placeUse(source, 'signs', 1)) || 0
      api.info('✨ ' + inv.name + ' 揭示 elder_sign：「信仰之行」放置 1 个征兆（当前 ' + signs + '）。')
    },
  }, {
    kind: 'forced',
    trigger: 'gameEnds',
    label: '游戏结束：征兆超过 1×人数则本任务进度 +1',
    criteria: ({ state, source }) => Number(source?.uses) > (Number(TASK.endOfGame.perInvestigator) || 1) * investigatorCount(state),
    resolve: ({ inv, api }) => {
      const next = api.mechanics?.progress?.change(TASK.progress.track, inv.seat, TASK.progress.amount, TASK.progress.receipt)
      if (next === false) return
      api.info('🏅 「信仰之行」：游戏结束时征兆超过 1×人数，本任务进度 +1。')
    },
  }],
  note: '① 征兆计数/放置走条目 uses + api.placeUse（chaosTokenRevealed 窗口，任意地点）；'
    + '②「游戏结束时…标记 1 点进度」走引擎卡级 gameEnds 窗口：forced/trigger:gameEnds，resolve 判定'
    + '「征兆 > 1×人数」后用 api.mechanics.progress.change 写入 +1；receipt=taskEnd-walkInFaith，重复收尾去重。无近似项。',
}
