// 06290 穿越冰封荒土（Journey Through the Cold Wastes，幕 1）
// 正面：无卡面文本（目标为团队花费 2×人数线索，写在 definition 的 act objective）。
// 背面（The Monastery）：Reveal the Monastery of Leng.
//       Spawn the set-aside High Priest Not to Be Described enemy in the Monastery of Leng.
//
// 行为位置：本文件 actRule.onReveal（章节 behavior.actReveal 调用，在幕指针后移之前）。
const MONASTERY = '06297'
const HIGH_PRIEST = '06311'
const originalOf = card => card?.originalCode || card?.code

export default {
  code: '06290',
  scope: 'act',
  implemented: true,
  actRule: {
    onReveal(state, act, api) {
      const monastery = (state?.locations || []).find(location => String(originalOf(location)) === MONASTERY)
      if (!monastery) {
        api.info?.('「穿越冰封荒土」：冷原隐修院不在场上，跳过揭示与生成。')
        return true
      }
      api.reveal?.(monastery.id)
      api.takeFromSetAside?.(HIGH_PRIEST)
      const enemy = api.spawn?.(HIGH_PRIEST, monastery.id)
      api.info?.(enemy
        ? `👹 「冷原隐修院」揭示：不可描述的高阶祭司在「${monastery.name}」现身（${enemy.location === monastery.id ? '已生成' : '生成失败'}）。`
        : '👹 「冷原隐修院」揭示：不可描述的高阶祭司生成失败（放回遭遇弃牌堆）。')
      return true
    },
  },
}
