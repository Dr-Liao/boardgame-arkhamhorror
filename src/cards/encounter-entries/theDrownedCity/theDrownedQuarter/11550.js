// 11550 · 淹没城区（theDrownedQuarter）单卡条目。
// 归属：关卡专用 · theDrownedCity/theDrownedQuarter（P7 淹没城区，参考卡 11536）。
// 规则文本与卡表一致见 src/cards/cards-data.js；逐卡行为读点见 note 与章节 behavior.js。
// P2 原语接口：文物（Artifact）由被击败持有者按地图最近幸存调查员移交（transferOnControllerDefeat
// = 'nearest'，见 docs/campaign/theDrownedCity/primitives.md）；该声明落在真实文物条目上，
// 供 tests/tdc-primitives.test.mjs 的移交读点使用（夹具不再重复注册同一卡号）。
//
// 受控剧情资产的行动走 executeDescriptor。章节按检定来源应用投入图标倍率，
// 并通过 drownedQuarterFlipRelic 结算成功时的故事面与胜利区。
const test = { skill: 'intellect', difficulty: 8 }

export default {
  code: '11550',
  scope: 'storyAsset',
  implemented: true,
  controlledAsset: true,
  transferOnControllerDefeat: 'nearest',
  flags: { test, storyCode: '11550b', glyph: { letter: 'rune_y', meaning: '知识' } },
  abilities: [
    {
      kind: 'action',
      label: '检定智力(8)（投入卡牌技能图标翻倍）：成功翻面结算（符文 Y「知识」+ 胜利区）',
      resolve: ({ inv, source, api }) => {
        api.test(inv.seat, test.skill, test.difficulty, {
          source: { label: '黑曜石遗物', name: api.cardName('11550'), code: '11550' },
          resolve: result => {
            if (!result?.success) return
            api.scenario.resolveScenarioEvent('drownedQuarterFlipRelic', { seat: inv.seat, assetId: source.id })
          },
        })
      },
    },
  ],
  note: '普通离场时移出游戏。智力(8) 检定投入的图标翻倍，成功后翻开故事面、记录符文 Y「知识」，并将该实体加入胜利区。',
}
