// 10517 地下野兽 · 敌人（writtenInRock）
// 卡面：猎手。群体。地下野兽得到 +3[per_investigator] 生命。
// 如果地下野兽准备中且与矿车同处，矿车不能移动。
// [action] 花费 1[per_investigator] 条线索：横置地下野兽。它本轮不能重整。（胜利 2。）
// 数值由 definition.encounterDefinitions 取印刷数据；+生命/阻挡/横置行动在
// behavior.enemyStatModifier / mineCartBlocked / actions+performAction。
export default {
  code: '10517',
  scope: 'enemy',
  implemented: true,
  flags: {
    subterraneanBeast: true,
    elite: true,
    hunter: true,
    massive: true,
    victory: 2,
    healthPerInvestigatorBonus: 3,
    blocksMineCartWhenReady: true,
    exhaustAction: { cluesPerInvestigator: 1, cannotReadyThisRound: true },
    setAside: true,
  },
  note: '近似：卡表把群体/猎手写在卡文而非字段；definition 用印刷文补 massive/hunter 标记。',
}
