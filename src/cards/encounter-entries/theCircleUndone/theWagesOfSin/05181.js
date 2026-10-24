// 05181 · 恶罪报应（theWagesOfSin）
// 惩罚：显现 - 将惩罚放置入场，放到你的威胁区域（behavior.resolveEncounter 的 05181 分支）。
// 强制 - 在任意一个地点有敌人被击败后：受到 1 点伤害（behavior.enemyDefeated 统一结算）。
// [action]：检定意志(3)。如果你检定成功，弃掉惩罚；如果你所在地点有处于横置状态的[[女巫]]敌人，
// 本次检定自动成功（威胁区行动数据在这里声明，由共享 encounterActions/performEncounterAction 展开）。
//
// 一卡一文件：规则实现分散在章节目录 behavior.js（跨卡顺序结算）；本条目声明威胁区行动与身份。
export default {
  code: '05181',
  scope: 'treachery',
  implemented: true,
  flags: { resolveRule: 'punishment' },
  threatAction: {
    rule: 'discardPunishment',
    skills: ['willpower'],
    difficulty: 3,
    actions: 1,
    label: '检定意志(3)弃掉「惩罚」（同地点有横置女巫时自动成功）',
    autoSuccessWhen: 'exhaustedWitchHere',
  },
}