// 11756a 好钱 · 任务（Task）· 未完成面（弱点面）
// 归属：战役内跨关卡共用 · theDrownedCity/_shared/tasks（共享遭遇组 tasks，印刷 1 张）。
// 卡面（cards-data 11756a，原文见该卡 textZh）：
//   永久。
//   [reaction]你获得1个或更多资源时：将其中1个资源放在好钱上。
//   强制 - 游戏结束时，如果好钱上有5个或更多资源：在剧本日志中，本任务下标记1点进度。
//
// 读点（声明即接线）：
//   · 「使用(资源)」= 条目 uses/usesType（资源放在卡上，0 起始）；
//   · 「你获得 1 个或更多资源时放 1 个到本卡」——引擎没有「获得资源后」窗口（resource-bank.js 的 gainResource 不开窗），故本条未接线。
//   · 两面同实体：flags.task.partnerCode 指向完成面 11756b；任务完成时战役层用 11756b
//     替换本卡，并把 madeBank 写进剧本日志（参考 Helpers.hs#tasks / interludes.js#resolveTasks）。
//   · 每名调查员的任务进度只走 P7 原语 mechanics.progress（轨道 'tdcTask'，option = 任务 id），
//     不自造战役记录键；完成门限 5 点由战役层（TDC_TASK_COMPLETION_PROGRESS）判定。
//
// 近似 / 未接线（blocked read point）：
//   · 「游戏结束时……在剧本日志中本任务下标记 1 点进度」没有卡级窗口：引擎 finishScenario 只扫
//     手牌里的 traumaAtGameEndWhenInHand，不枚举在场的卡条目。因此本条目只把印刷判定声明为
//     flags.task.endOfGame；进度写入需由 Lead 在结局读点调用
//     api.mechanics.progress.change('tdcTask', seat, 1, '11756a:endOfGame') 结算。
//     8 张任务共用同一句模板（同句规则），不在单卡里各写一遍命令式逻辑。
const CODE = '11756a'

const TASK = Object.freeze({
  id: 'goodMoney',
  side: 'incomplete',
  face: 'weakness',
  partnerCode: '11756b',
  completedCard: '11756b',
  completedRecord: 'madeBank',
  progress: Object.freeze({ track: 'tdcTask', threshold: 5, amount: 1, receipt: '11756a:endOfGame' }),
  tally: Object.freeze({'token':'resources','initial':0,'on':['gainResources']}),
  endOfGame: Object.freeze({'kind':'usesAtLeast','token':'resources','amount':5}),
})

export default {
  code: CODE,
  name: '好钱',
  scope: 'storyAsset',
  implemented: false,
  uses: 0,
  usesType: 'resources',
  flags: { permanent: true, traits: ['Task', 'Incomplete'], task: TASK },
  abilities: [],
  note: 'approximation / blocked read point：①「获得资源时移 1 个到本卡」没有窗口（gainResource 不开反应窗口），'
    + '也没有「把资源放到支援上」的原语（resource-bank 只服务调查员能力声明的寄存支援）；'
    + '②「游戏结束时本卡 >= 5 资源则标记 1 点进度」同样没有卡级窗口。'
    + '本条目只登记 flags.task.tally / flags.task.endOfGame 数据，两项都待原语（资源获得窗口 + 结局读点）后接线。',
}
