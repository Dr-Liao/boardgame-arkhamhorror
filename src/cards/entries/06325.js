// 06325 真理之眼
// 卡面：如果本次技能检定为诡计卡牌的技能检定，且检定成功，将该诡计卡牌加入胜利区，附属真理之眼到该卡牌上。
//       真理之眼附属在该卡牌上时，真理之眼的技能图标会投入到该卡牌的同名卡牌上的每次技能检定。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 真理之眼投入的 4 个万能图标来自卡面数据。成功通过诡计检定后，
// skill.afterTest 将实体诡计收入胜利区，并把本张技能牌附属其上；同名图标由引擎读取附件。

export default {
  code: '06325',
  abilities: [
    {
      kind: 'commit',
      label: '真理之眼（投入：4 个万能图标）',
      skill: {
        afterTest: ({ source, result, api }) => {
          if (result?.success) api.captureTreacheryWithSkill(source, { icons: true })
        },
      },
    },
  ],
  modifiers: [],
}
