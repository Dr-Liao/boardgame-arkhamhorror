// 05287 坟墓彼端（目标：击败安妮特·梅森，由 definition objective 声明）
// 背面：进入结局 1。数据化后 behavior.actReveal 按 actRule.advance.resolution 分派。
export default {
  code: '05287',
  scope: 'act',
  implemented: true,
  actRule: {
    advance: { resolution: 'r1' },
  },
}