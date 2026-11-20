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
//   · 「你治愈一位调查员或一张盟友支援的伤害/恐惧后」= damageHealed / horrorHealed 窗口，criteria 读
//     context.seat === 自己且被治疗方是调查员（assetId == null）或盟友支援（cards-data 的 Ally 特性）；
//   · 「移除 1 个义务」= cost { uses: 1 }；
//   · 「游戏结束时…标记 1 点进度」= 引擎卡级 gameEnds 窗口（hub.endCampaign 派发）：forced/trigger:gameEnds，
//     resolve 判定「义务归零」后 api.mechanics.progress.change 写入 +1；receipt='taskEnd-doNoHarm'，重复收尾去重。
//   · 两面同实体：flags.task.partnerCode 指向完成面 11758b；完成门限 5 点由战役层 interludes.resolveTasks 判定。

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
  progress: Object.freeze({ track: 'tdcTask', threshold: 5, amount: 1, receipt: 'taskEnd-doNoHarm' }),
  tally: Object.freeze({ token: 'obligations', initial: 5, on: ['damageHealed', 'horrorHealed'] }),
  endOfGame: Object.freeze({ kind: 'usesAtMost', token: 'obligations', amount: 0, settle: 'gameEnds' }),
})

export default {
  code: CODE,
  name: '不伤害他人',
  scope: 'storyAsset',
  implemented: true,
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
    resolve: ({ inv, source, api }) => api.info('🩺 ' + inv.name + ' 治疗了同伴/盟友：「不伤害他人」移除 1 个义务（剩余 ' + (Number(source?.uses) || 0) + '）。'),
  }, {
    kind: 'forced',
    trigger: 'gameEnds',
    label: '游戏结束：义务归零则本任务进度 +1',
    criteria: () => true,
    resolve: ({ inv, source, api }) => {
      if ((Number(source?.uses) || 0) !== 0) return false
      const next = api.mechanics?.progress?.change(TASK.progress.track, inv.seat, TASK.progress.amount, TASK.progress.receipt)
      if (next === false) return
      api.info('🏅 「不伤害他人」：游戏结束时义务已全部移除，本任务进度 +1。')
    },
  }],
  note: '① 治疗反应走 damageHealed / horrorHealed + cost.uses，盟友判定用 cards-data 的 Ally 特性；'
    + '②「游戏结束时没有义务则标记 1 点进度」走引擎卡级 gameEnds 窗口：resolve 判定后 api.mechanics.progress.change '
    + '写入 +1；receipt=taskEnd-doNoHarm，重复收尾去重。无近似项。',
}
