// 05286a 黑暗知识(版本一)（与 05286b 安妮特·梅森同卡两面）
// 卡面规则：目标「全队线索」由 definition objective 声明；背面效果由本条目 actRule 驱动
// （behavior.actReveal 只读 actRuleFor(code)，按数据分派）。
export default {
  code: '05286a',
  scope: 'act',
  implemented: true,
  actRule: {
    advance: {
      // 背面：生成安妮特·梅森（BOSS_BY_ACT 数据表），并把幕上的裂口保留到下一张幕。
      spawnBossFromAct: true,
    },
  },
}