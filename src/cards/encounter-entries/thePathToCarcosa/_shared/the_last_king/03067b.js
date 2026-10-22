// 03067b 石丸春子
// 归属：战役共用 · thePathToCarcosa（卡尔克萨之路）
// 遭遇组：the_last_king
// 卡面：猎手。
// 卡面：强制 - 你通过攻击以外的效果对石丸春子造成伤害后：抽取遭遇牌库顶1张卡牌。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 追猎恐魔的转交已在 theLastKing behavior；石丸春子（03067b）：
// 强制 - 你通过攻击以外的效果对她造成伤害后，抽取遭遇牌库顶 1 张。

export default {
  code: '03067b', scope: 'enemy', implemented: true,
  name: '石丸春子',
  text: '猎手。强制 - 你通过攻击以外的效果对石丸春子造成伤害后：抽取遭遇牌库顶 1 张卡牌。',
  enemyScript: {
    onDamaged(state, enemy, api, seat) {
      // 攻击伤害来自攻击检定（source.enemyId 指向该敌人），不触发。
      if (state.skillTest?.source?.enemyId === enemy.id) return
      if (!Number.isInteger(seat)) return
      api.drawEncounter(seat)
    },
  },
}
