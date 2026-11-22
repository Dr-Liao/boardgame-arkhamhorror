// 50037 乌默尔多斯的饥饿（Umôrdhoth's Hunger）· 诡计 · return_to_the_devourer_below · ×2
// 归属：关卡专用 · returnToTheDevourerBelow（重返地底噬魔 · Return to The Devourer Below）
// 卡面：显现 - 每位调查员必须从手中随机弃掉 1 张卡牌。没有手牌的调查员阵亡。
//   治愈在场每个敌人 1 点伤害。
// 读点：treachery-tokens.js#resolveTreacheryBody → 场景数据 entryRevelation（definition.js 的
//   treacheryDefinition 已置 true）+ 条目 encounterResolve（一卡一文件；条目本身不再声明 entryRevelation）。
//   顺序按印刷：先各自随机弃 1 张 → 弃牌后手中没有牌的人阵亡 → 每个在场敌人治愈 1 点伤害。
//   返回 { placed: false }：结算完进遭遇弃牌堆（本卡不留在场上）。
export default {
  code: '50037',
  scope: 'treachery',
  implemented: true,
  encounterResolve(state, inv, card, api) {
    void card
    void inv
    const investigators = (state.investigators || [])
      .filter(other => other && !other.defeated && !other.resigned)
    for (const other of investigators) {
      if (!(other.hand || []).length) continue
      api.discardRandom(other.seat, 1)
    }
    const killed = []
    for (const other of investigators) {
      if ((other.hand || []).length) continue
      api.defeat(other, 'killed')
      killed.push(other.name)
    }
    if (killed.length) api.info(`乌默尔多斯的饥饿：${killed.join('、')} 手中没有卡牌，阵亡。`)
    let healed = 0
    for (const enemy of state.enemies || []) {
      if (enemy.defeated || enemy.removedFromGame) continue
      if (!(Number(enemy.damageTaken) > 0)) continue
      if (api.healEnemy(enemy, 1) > 0) healed += 1
    }
    api.info(`乌默尔多斯的饥饿：每位调查员随机弃 1 张手牌；${healed} 个在场敌人各治愈 1 点伤害。`)
    return { placed: false }
  },
}
