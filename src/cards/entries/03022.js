// 03022 “放着我来！”
// 卡面：快速。另一位调查员抽取了一张非险境遭遇卡牌后，结算该卡牌效果前打出。
// 卡面：改为视为你抽取了该遭遇卡牌。结算该卡牌的显现效果时，你得到每项技能+2。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 03022 我来处理：另一名调查员抽到遭遇卡时，接手结算并在其检定 +2。

export default {
  code: '03022',
  abilities: [
    {
      kind: 'played', fast: true, trigger: 'encounterDrawn',
      criteria: { otherInvestigator: true, nonPerilOnly: true },
      label: '我来处理',
      resolve: ({ inv, api }) => {
        if (!api.redirectEncounter(inv.seat)) return
        api.info(`${inv.name} 接手结算这张遭遇卡，并在其技能检定中获得 +2。`)
      },
    },
  ],
  modifiers: [

  ],
}
