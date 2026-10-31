// 01161 饥饿的食尸鬼（Ravenous Ghoul）· 核心包共享遭遇组 ghouls
// 卡面：Prey - Lowest remaining health.（猎物：剩余生命最低的调查员）
// 一卡一文件：印刷文本的 Prey 用条目规则映射到引擎 PREY_RANK 的 `lowestHealth` key；
// 数值/关键词由 definition 的印刷数据提供。
export default {
  code: '01161',
  scope: 'enemy',
  implemented: true,
  enemyRule: { prey: 'lowestHealth' },
}
