// 11756a 好钱 · 任务（Task）· 未完成面（弱点面）
// 归属：战役内跨关卡共用 · theDrownedCity/_shared/tasks（共享遭遇组 tasks，印刷 1 张）。
// 卡面（cards-data 11756a，原文见该卡 textZh）：
//   永久。
//   [reaction]你获得1个或更多资源时：将其中1个资源放在好钱上。
//   强制 - 游戏结束时，如果好钱上有5个或更多资源：在剧本日志中，本任务下标记1点进度。
//
// 读点（声明即接线，第三轮引擎落地）：
//   · 「你获得 1 个或更多资源时」= resourcesGained 窗口（src/engine/resource-bank.js#gainResource 是
//     所有资源获得的唯一入口，入账后经 engine.js 的 onResourcesGained → reactionWindow 派发 { seat, amount }）。
//     诚实登记：印刷是 [reaction]（可选），但引擎的 resourcesGained 窗口在事务内只允许 **forced** 条目安全消费
//     （可选 reaction 会触发 resolution 事务的「未消费选择恢复凭据」，见 engine-needs §4）；
//     因此条目改为 forced（获得 1+ 资源时自动放 1 个到本卡），可选性差异写入 note/approximation。
//   · 「将其中 1 个资源放在好钱上」= 从资源池移 1 个（api.spendResources）再 api.placeResourceOnCard(source, 1)
//     （卡级 resources 计数，总数守恒）；卡上资源用 api.resourcesOnCard(source) 读。
//     注意：abilityApi 把 placeResourceOnCard/resourcesOnCard **扁平**暴露（api.misc 为 undefined），
//     条目按扁平调用，并兼容 api.misc.* 回退。
//   · 「游戏结束时…标记 1 点进度」= 引擎卡级 gameEnds 窗口（hub.endCampaign 派发）：forced/trigger:gameEnds，
//     resolve 判定「卡上资源 ≥5」后 api.mechanics.progress.change 写入 +1；receipt='taskEnd-goodMoney'，重复收尾去重。
//   · 两面同实体：flags.task.partnerCode 指向完成面 11756b；完成门限 5 点由战役层 interludes.resolveTasks 判定。
const CODE = '11756a'

const TASK = Object.freeze({
  id: 'goodMoney',
  side: 'incomplete',
  face: 'weakness',
  partnerCode: '11756b',
  completedCard: '11756b',
  completedRecord: 'madeBank',
  progress: Object.freeze({ track: 'tdcTask', threshold: 5, amount: 1, receipt: 'taskEnd-goodMoney' }),
  tally: Object.freeze({ token: 'resources', initial: 0, on: ['resourcesGained'] }),
  endOfGame: Object.freeze({ kind: 'usesAtLeast', token: 'resources', amount: 5, settle: 'gameEnds' }),
})

const resourcesOnCard = (source, api) => Number(
  api.resourcesOnCard?.(source) ?? api.misc?.resourcesOnCard?.(source) ?? source?.resources ?? 0) || 0
const placeResourceOnCard = (source, api) => Number(
  api.placeResourceOnCard?.(source, 1) ?? api.misc?.placeResourceOnCard?.(source, 1) ?? source?.resources ?? 0) || 0

export default {
  code: CODE,
  name: '好钱',
  scope: 'storyAsset',
  implemented: true,
  uses: 0,
  usesType: 'resources',
  flags: { permanent: true, traits: ['Task', 'Incomplete'], task: TASK },
  abilities: [{
    kind: 'forced',
    trigger: 'resourcesGained',
    label: '获得资源后：将其中 1 个资源放在好钱上',
    criteria: ({ context }) => (Number(context?.amount) || 0) >= 1,
    resolve: ({ inv, source, api }) => {
      if ((inv.resources || 0) > 0) api.spendResources?.(inv.seat, 1)
      const total = placeResourceOnCard(source, api)
      api.info('💰 ' + inv.name + ' 获得资源：将其中 1 个放在「好钱」上（当前 ' + total + '）。')
    },
  }, {
    kind: 'forced',
    trigger: 'gameEnds',
    label: '游戏结束：卡上资源 ≥5 则本任务进度 +1',
    criteria: () => true,
    resolve: ({ inv, source, api }) => {
      if (resourcesOnCard(source, api) < (Number(TASK.endOfGame.amount) || 5)) return false
      const next = api.mechanics?.progress?.change(TASK.progress.track, inv.seat, TASK.progress.amount, TASK.progress.receipt)
      if (next === false) return
      api.info('🏅 「好钱」：游戏结束时卡上有 5 个或更多资源，本任务进度 +1。')
    },
  }],
  note: '①「获得 1 个或更多资源后」走 resourcesGained 窗口（resource-bank 唯一入口派发）；'
    + '「将其中 1 个放在本卡上」= api.spendResources(1) + api.placeResourceOnCard(source, 1)（总数守恒；'
    + 'abilityApi 扁平暴露这两个写点，api.misc.* 仅作回退），卡上资源用 api.resourcesOnCard 读；'
    + '②「游戏结束时卡上 ≥5 资源则标记 1 点进度」走引擎卡级 gameEnds 窗口：'
    + 'resolve 判定后 api.mechanics.progress.change 写入 +1；receipt=taskEnd-goodMoney，重复收尾去重。'
    + '近似：印刷是 [reaction]（可选，获得资源时可以选择不放），引擎 resourcesGained 事务窗口目前只允许 '
    + 'forced 安全消费（可选 reaction 会触发事务选择账限制），因此本条写成 forced 自动放置；'
    + '可选性差异是本卡唯一近似。',
}
