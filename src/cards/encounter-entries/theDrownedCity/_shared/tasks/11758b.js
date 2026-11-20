import { ALL_CARDS } from '../../../_shared.js'

// 11758b 不伤害他人 · 任务（Task）· 完成面
// 归属：战役内跨关卡共用 · theDrownedCity/_shared/tasks（共享遭遇组 tasks，印刷 1 张）。
// 卡面（cards-data 11758b，原文见该卡 textZh）：
//   永久。除非本任务已完成，否则其以弱点面朝上进场。
//   你得到+1[agility]。
//   [reaction]你治愈一位调查员或一张[[盟友]]支援的伤害/恐惧后，横置不伤害他人：获得1个资源。
//
// 读点（声明即接线）：
//   · 「你得到 +1 敏捷」= modifiers 的 { target: 'skill:agility', amount: 1 }；
//   · 「治愈一位调查员或盟友支援的伤害/恐惧后，横置本卡：获得 1 资源」= damageHealed / horrorHealed 窗口 + cost { exhaust: true } + api.gainResources。
//   · 两面同实体：flags.task.partnerCode 指向未完成面 11758a；战役层在任务完成时用本卡替换它，
//     并把 sworeAnOathToProtectOthers 写进剧本日志（「除非本任务已完成，否则其以弱点面朝上进场」由战役层发哪一面决定）。

// 「盟友支援」判定：卡面特性里有 Ally（cards-data 的 traits）。
const isAllyAsset = (state, assetId) => (state.investigators || [])
  .flatMap(owner => owner.assets || [])
  .some(asset => asset.id === assetId
    && (ALL_CARDS[asset.code]?.traits || []).some(trait => String(trait).toLowerCase() === 'ally'))

const CODE = '11758b'

const TASK = Object.freeze({
  id: 'doNoHarm',
  side: 'completed',
  face: 'completed',
  partnerCode: '11758a',
  replaces: '11758a',
  completedRecord: 'sworeAnOathToProtectOthers',
  progress: Object.freeze({ track: 'tdcTask', threshold: 5 }),
})

export default {
  code: CODE,
  name: '不伤害他人',
  scope: 'storyAsset',
  implemented: true,
  flags: { permanent: true, traits: ['Task', 'Completed'], task: TASK },
  modifiers: [{ target: 'skill:agility', amount: 1 }],
  abilities: [{
    kind: 'reaction',
    trigger: ['damageHealed', 'horrorHealed'],
    label: '横置：获得 1 资源',
    criteria: ({ state, inv, context }) => context?.seat === inv.seat
      && (context?.assetId == null || isAllyAsset(state, context.assetId)),
    cost: { exhaust: true },
    resolve: ({ inv, api }) => {
      api.gainResources(inv.seat, 1)
      api.info('💰 ' + inv.name + ' 治疗了同伴/盟友：「不伤害他人」获得 1 资源。')
    },
  }],
  note: '治疗反应与敏捷修正都已接线（damageHealed / horrorHealed + exhaust 费用 + gainResources）；无近似项。',
}
