// 87056 时间扭曲
// 归属：关卡专用 · machinationsThroughTime（时间阴谋）
// 遭遇组：machinations_through_time
// 卡面：显现 - 叠加到当前密谋。
// 卡面：剧情卡牌上的能力不能触发。
// 卡面：[action]：如果你位于[[过去]]地点，可以进行一次[willpower](2)检定；如果位于[[现在]]地点，可以进行一次[agility](3)检定；如果位于[[未来]]地点，可以进行一次[combat](4)检定。如果你成功通过其中一项或更多检定，弃掉时间扭曲。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '87056',
  scope: 'treachery',
  // TODO: 按卡面实现（abilities / modifiers / 规则字段）。只通过 ctx.api 改状态。
}
