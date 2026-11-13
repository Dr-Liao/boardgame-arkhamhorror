// 《绯红密钥》（The Scarlet Keys）· 序章后的检查点说明（P7）。
//
// **本循环不写检查点节点**，理由（有据可查，不是省略）：
//   · 参考实现 `Arkham/Campaigns/TheScarletKeys/CampaignSteps.hs` 只有 10 个 `ScenarioStep`
//     （09501/09520/…/09694），`Campaigns/TheScarletKeys.hs#nextStep` 里除 `PrologueStep` /
//     `EpilogueStep` / `ScenarioStep` 之外**只有** `InterludeStep`（1 与 14–55），没有任何
//     `CheckpointStep` 分支；
//   · 《地球边缘》的检查点承担「分段休息 / 跳段」职责；《绯红密钥》的对应职责由
//     ①世界地图启程循环（时间推进与世界地图节点解锁）、②17 段幕间（含升级窗口）、
//     ③状况报告 α–ω 的阈值插入共同承担，因此没有可镜像的 CheckpointStep；
//   · 升级窗口只出现在 `type: 'interlude'` 节点（引擎 `campaign.upgradesAllowed = node.type === 'interlude'`），
//     世界地图节点（`map`）与状况报告/密档节点都不开升级窗——这正是参考实现「只在幕间升级」的口径。
//
// 保留一个显式空表，让 `flow.js` 与验收账本能机械断言「本循环没有检查点节点」，
// 而不是靠「文件不存在」来表达。
export const CHECKPOINT_HANDLER_ID = 'scarletKeysCheckpoints'
export const CHECKPOINT_NODES = Object.freeze({})
export const CHECKPOINT_IDS = Object.freeze([])

/** 参考实现是否存在检查点步骤（false = 本循环没有），供 flow 测试与账本断言。 */
export const HAS_CHECKPOINT_STEPS = false

export function checkpointOmission () {
  return Object.freeze({
    hasCheckpoints: HAS_CHECKPOINT_STEPS,
    replacedBy: Object.freeze(['worldMap', 'interlude', 'statusReport']),
    reference: 'Campaigns/TheScarletKeys.hs#nextStep（只有 PrologueStep / ScenarioStep / InterludeStep / EpilogueStep）',
  })
}
