// 09680a 影穑（The Shade Reaper · Harvester of Woe · [[Stable]] 稳定面）· 绯红密钥 · shades_of_suffering
//
// 归属：关卡专用 · theScarletKeys/shadesOfSuffering（P7）。同一张物理卡的另一面是 09680b（[[Unstable]] 面）。
// 卡面：
//   变换 - 选择你所在地点的一个非[[精英]]敌人。你可以将该敌人移动到一个连接地点。
//   你可以强制该敌人攻击其所在地点的另一个敌人，原本的恐惧造成伤害。将本钥匙翻至[[动荡]]面。
//
// 读点：
//   · 密钥实体由 `api.mechanics.tsk.keys`（src/engine/tsk-scarlet-keys.js）以
//     `{ id: '09680', stableFace: '09680a', unstableFace: '09680b' }` 注册，翻面走 `keys.shift`；
//   · 本条目只声明当前面的 Shift 数据 `assetRule.shift`；章节 behavior 的 `shiftShadeReaper()` 是唯一
//     结算点（先结算效果，再按稳定面/动荡面的翻面规则翻面）；
//   · 充能记在场景旗标 `scenarioFlags.shadeReaperCharges`（密钥原语没有计数器，
//     见 primitive-requests/extend-scarlet-key-charges.json）。
export default {
  code: '09680a',
  name: '影穑',
  scope: 'storyAsset',
  implemented: true,
  assetRule: {
    shift: {
      kind: 'moveAndClash',
      stableSide: true,
      flipOnShift: 'always',
      excludeTraits: ['Elite'],
    },
  },
  note: 'approximation: 「恐惧造成伤害」用敌人印刷 horror 值对另一个敌人调用 api.damageEnemy；'
    + '移动是可选步骤（先问是否移动、再问是否攻击同地点的另一个敌人）。',
}
