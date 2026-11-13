// 09654b 暗红骑士（The Claret Knight · Her Sworn Champion / 她的誓约勇士）· 剧情支援 · dogs_of_war
//
// 归属：关卡专用 · theScarletKeys/dogsOfWar（P7）。同一张物理卡的另一面是 09654a（敌人「结社头目」）。
// 卡面（中）：[fast] 横置暗红骑士：将你资源池的最多 3 资源移动到暗红骑士。
//   [fast] 横置暗红骑士：将暗红骑士的最多 3 资源移动到你的资源池；或移动到你控制的一个支援，
//   作为充能、子弹、补给或秘密。
//
// 读点（章节 behavior 提供的两个快速剧本行动 `knightToAsset` / `knightFromAsset`）：
//   · 资源记在实例的 `resources` 上（引擎的支援资源容器：`card-model.md` §万象无终补全写明
//     `asset.resources` 独立保存卡上资源）；
//   · 横置/重整沿用实例的 `exhausted`；
//   · 「由所有调查员控制」→ definition 的 `controlledByAll: true`（引擎没有多控制者，按剧情支援放
//     `state.storyAssets`，见 behavior.putKnightAssetInPlay）。
export default {
  code: '09654b',
  name: '暗红骑士',
  scope: 'storyAsset',
  implemented: true,
  assetRule: {
    resourceShuttle: { max: 3, usesTypes: ['charge', 'ammo', 'supply', 'secret'], exhausts: true },
    controlledByAll: true,
    noSlot: true,
  },
  note: 'approximation: 暗红骑士是「由所有调查员控制、不占槽位」的剧情支援，引擎只在 `state.storyAssets` 里'
    + '放剧情支援实例；两个 [fast] 资源搬运由章节的快速剧本行动接线（同 09654b 的 primitive request）。',
}
