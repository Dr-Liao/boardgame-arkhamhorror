// 04206 昆扬之口
// 归属：战役共用 · theForgottenAge（失落的时代）
// 遭遇组：heart_of_the_elders
// 卡面：[action]：撤退。“我们搭帐篷吧，明天再解开这个谜团。”
// 卡面：[action]：检查你的补给品。如果你带有指南针，查看探索牌库顶的3张卡牌。按任意顺序将其中1张放在牌库底，其余2张放在牌库顶。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 第 116 轮：久远腹地（上）（失落时代第六章）的两个独家地点。
// 昆扬之口（04206）：撤退 / 检查补给 / 解开石柱三组场景行动。

export default {
  code: '04206', scope: 'location', flags: { mouthOfKnyan: true },
  locationRule: {
    actions({ state, location, moves, hooks }) {
      moves.push({ action: 'scenarioAction', rule: 'resignMouth', label: '⛺ 撤退：搭起帐篷，明天再解开石柱的谜团' })
      moves.push({ action: 'scenarioAction', rule: 'mouthCompass', label: '🧭 检查补给：用指南针查看探索牌库顶 3 张' })
      if (state.acts?.[state.actIndex]?.originalCode !== '04210') return
      const groupClues = state.investigators
        .filter(entry => !entry.defeated && !entry.resigned && entry.location === location.id)
        .reduce((sum, entry) => sum + (entry.clues || 0), 0)
      const need = state.numInvestigators
      const pillars = Number(state.scenarioFlags?.pillars || 0)
      const target = hooks?.pillarsToOpen ?? 3
      moves.push({
        action: 'scenarioAction', rule: 'solvePillar', scriptCard: 'act',
        label: `🗿 共同花费 ${need} 个线索，解开一根石柱（${pillars}/${target}）`,
        reason: groupClues >= need ? null : `需要共同花费 ${need} 个线索（当前 ${groupClues}）`,
      })
    },
  },
}
