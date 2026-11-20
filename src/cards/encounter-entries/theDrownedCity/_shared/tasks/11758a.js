import { ALL_CARDS } from '../../../_shared.js'

// 11758a 不伤害他人 · 任务（Task）· 未完成面（弱点面）
// 归属：战役内跨关卡共用 · theDrownedCity/_shared/tasks（共享遭遇组 tasks，印刷 1 张）。
// 卡面（cards-data 11758a，原文见该卡 textZh）：
//   永久。使用(5义务)。
//   [reaction]你治愈一位调查员或一张[[盟友]]支援的伤害/恐惧后：从不伤害他人上移除1个义务。
//   强制 - 游戏结束时，如果不伤害他人上没有义务：在剧本日志中，本任务下标记1点进度。
//
// 读点（声明即接线）：
//   · 「使用(5 义务)」= 条目 uses/usesType；
//   · 「你治愈一位调查员或一张盟友支援的伤害/恐惧后」= damageHealed / horrorHealed 窗口（harm-threat.js），criteria 读 context.seat === 自己且被治疗方是调查员（assetId == null）或盟友支援（按卡面特性判定）；
//   · 「移除 1 个义务」= cost { uses: 1 }。
//   · 两面同实体：flags.task.partnerCode 指向完成面 11758b；任务完成时战役层用 11758b
//     替换本卡，并把 sworeAnOathToProtectOthers 写进剧本日志（参考 Helpers.hs#tasks / interludes.js#resolveTasks）。
//   · 每名调查员的任务进度只走 P7 原语 mechanics.progress（轨道 'tdcTask'，option = 任务 id），
//     不自造战役记录键；完成门限 5 点由战役层（TDC_TASK_COMPLETION_PROGRESS）判定。
//
// 近似 / 未接线（blocked read point）：
//   · 「游戏结束时……在剧本日志中本任务下标记 1 点进度」没有卡级窗口：引擎 finishScenario 只扫
//     手牌里的 traumaAtGameEndWhenInHand，不枚举在场的卡条目。因此本条目只把印刷判定声明为
//     flags.task.endOfGame；进度写入需由 Lead 在结局读点调用
//     api.mechanics.progress.change('tdcTask', seat, 1, '11758a:endOfGame') 结算。
//     8 张任务共用同一句模板（同句规则），不在单卡里各写一遍命令式逻辑。

// 「盟友支援」判定：卡面特性里有 Ally（cards-data 的 traits）。
const isAllyAsset = (state, assetId) => (state.investigators || [])
  .flatMap(owner => owner.assets || [])
  .some(asset => asset.id === assetId
    && (ALL_CARDS[asset.code]?.traits || []).some(trait => String(trait).toLowerCase() === 'ally'))

const CODE = '11758a'

const TASK = Object.freeze({
  id: 'doNoHarm',
  side: 'incomplete',
  face: 'weakness',
  partnerCode: '11758b',
  completedCard: '11758b',
  completedRecord: 'sworeAnOathToProtectOthers',
  progress: Object.freeze({ track: 'tdcTask', threshold: 5, amount: 1, receipt: '11758a:endOfGame' }),
  tally: Object.freeze({'token':'obligations','initial':5,'on':['damageHealed','horrorHealed']}),
  endOfGame: Object.freeze({'kind':'usesAtMost','token':'obligations','amount':0}),
})

export default {
  code: CODE,
  name: '不伤害他人',
  scope: 'storyAsset',
  implemented: false,
  uses: 5,
  usesType: 'obligations',
  flags: { permanent: true, traits: ['Task', 'Incomplete'], task: TASK },
  abilities: [{
    kind: 'reaction',
    trigger: ['damageHealed', 'horrorHealed'],
    label: '移除 1 个义务',
    criteria: ({ state, inv, context }) => context?.seat === inv.seat
      && (context?.assetId == null || isAllyAsset(state, context.assetId)),
    cost: { uses: 1 },
    resolve: ({ inv, api }) => api.info('🩺 ' + inv.name + ' 治疗了同伴/盟友：「不伤害他人」移除 1 个义务。'),
  }],
  note: 'approximation / blocked read point：① 治疗反应已接线（damageHealed / horrorHealed + cost.uses，'
    + '盟友判定用 cards-data 的 Ally 特性）；②「游戏结束时本卡没有义务则标记 1 点进度」没有卡级窗口，'
    + '进度需由结局读点用 api.mechanics.progress.change(\'tdcTask\', seat, 1, \'11758a:endOfGame\') 结算。',
}
