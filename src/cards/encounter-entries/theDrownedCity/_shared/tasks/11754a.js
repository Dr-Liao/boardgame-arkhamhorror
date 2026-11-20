// 11754a 信仰之行 · 任务（Task）· 未完成面（弱点面）
// 归属：战役内跨关卡共用 · theDrownedCity/_shared/tasks（共享遭遇组 tasks，印刷 1 张）。
// 卡面（cards-data 11754a，原文见该卡 textZh）：
//   永久。使用(0征兆)。
//   [reaction]任意地点揭示[elder_sign]标记后：在信仰之行上放置1个征兆。
//   强制 - 游戏结束时，如果信仰之行上有超过1[per_investigator]个征兆：在剧本日志中，本任务下标记1点进度。
//
// 读点（声明即接线）：
//   · 「使用(0 征兆)」= 条目 uses/usesType（0 次同样写进条目，newPlayerAssetInstance 会初始化 uses=0）；
//   · 「任意地点揭示 elder_sign 标记后」= chaosTokenRevealed 窗口（tests.js），criteria 读 context.token === 'eldersign'，不限地点；
//   · 「放置 1 个征兆」= api.placeUse(source, 'signs', 1)（api-misc 的卡面计数器入口）。
//   · 两面同实体：flags.task.partnerCode 指向完成面 11754b；任务完成时战役层用 11754b
//     替换本卡，并把 isStrongInTheirFaith 写进剧本日志（参考 Helpers.hs#tasks / interludes.js#resolveTasks）。
//   · 每名调查员的任务进度只走 P7 原语 mechanics.progress（轨道 'tdcTask'，option = 任务 id），
//     不自造战役记录键；完成门限 5 点由战役层（TDC_TASK_COMPLETION_PROGRESS）判定。
//
// 近似 / 未接线（blocked read point）：
//   · 「游戏结束时……在剧本日志中本任务下标记 1 点进度」没有卡级窗口：引擎 finishScenario 只扫
//     手牌里的 traumaAtGameEndWhenInHand，不枚举在场的卡条目。因此本条目只把印刷判定声明为
//     flags.task.endOfGame；进度写入需由 Lead 在结局读点调用
//     api.mechanics.progress.change('tdcTask', seat, 1, '11754a:endOfGame') 结算。
//     8 张任务共用同一句模板（同句规则），不在单卡里各写一遍命令式逻辑。
const CODE = '11754a'

const TASK = Object.freeze({
  id: 'walkInFaith',
  side: 'incomplete',
  face: 'weakness',
  partnerCode: '11754b',
  completedCard: '11754b',
  completedRecord: 'isStrongInTheirFaith',
  progress: Object.freeze({ track: 'tdcTask', threshold: 5, amount: 1, receipt: '11754a:endOfGame' }),
  tally: Object.freeze({'token':'signs','initial':0,'on':['chaosTokenRevealed']}),
  endOfGame: Object.freeze({'kind':'usesMoreThanPerInvestigator','token':'signs','perInvestigator':1}),
})

export default {
  code: CODE,
  name: '信仰之行',
  scope: 'storyAsset',
  implemented: false,
  uses: 0,
  usesType: 'signs',
  flags: { permanent: true, traits: ['Task', 'Incomplete'], task: TASK },
  abilities: [{
    kind: 'reaction',
    trigger: 'chaosTokenRevealed',
    label: '放置 1 个征兆',
    criteria: ({ context }) => context?.token === 'eldersign',
    resolve: ({ inv, source, api }) => {
      api.placeUse(source, 'signs', 1)
      api.info('✨ ' + inv.name + ' 揭示 elder_sign：「信仰之行」放置 1 个征兆。')
    },
  }],
  note: 'approximation / blocked read point：① 征兆计数与放置已接线；'
    + '②「游戏结束时超过 1[per_investigator] 个征兆则标记 1 点进度」没有卡级窗口，'
    + '进度需由结局读点用 api.mechanics.progress.change(\'tdcTask\', seat, 1, \'11754a:endOfGame\') 结算；'
    + '失败分支（信仰崩塌 / lostTheirFaith）由战役层幕间处理，不在本卡重复实现。',
}
