// 07300b 伊哈·恩斯雷雕塑（汨动遗物面）· 《达贡巢穴》剧情支援
//
// 印刷（中文）：
//   [fast]横置伊哈·恩斯雷雕塑：对你所在地点的一个[[类人]]敌人造成1点伤害。
//   [fast]横置伊哈·恩斯雷雕塑：从混乱袋中移除2个[curse]标记，并换为同等数量的[bless]标记。
// 印刷（英文）：
//   [fast] Exhaust Y'ha-nthlei Statue: Deal 1 damage to a [[Humanoid]] enemy at your location.
//   [fast] Exhaust Y'ha-nthlei Statue: Remove 2 [curse] tokens from the chaos bag and replace them
//     with an equal number of [bless] tokens.
//
// 引擎读点：
//   · 本面由 07300 的 [action]（花费蓝/白/红/黄钥匙 → api.flipAsset）翻到；翻面后能力枚举读
//     `registeredEntry(asset.code)` → 本文件（physical-faces.js#applyPhysicalFace 把实例 code 换成 07300b）。
//   · 两条都是 `cost:{exhaust}` 的 fast 能力；第二条用 `api.chaosTokens.replace(..., { exact: true })`：
//     印刷是「移除 2 个诅咒」，只有 1 个诅咒时不能把「移除 2 个」降级成「移除 1 个」。
import { hasTrait, payablePoolTokens } from '../../_shared.js'

const controlled = ({ inv, source }) => inv.assets.some(asset => asset.id === source.id)

export default {
  code: '07300b', scope: 'storyAsset', implemented: true,
  abilities: [{
    kind: 'free', actionKind: 'activate', label: '横置伊哈·恩斯雷雕塑：对本地类人敌人造成1点伤害',
    cost: { exhaust: true },
    criteria: controlled,
    target: { kind: 'enemy', query: ({ entity, canDamageEnemy }) => !entity.defeated && !entity.removedFromGame
      && hasTrait(entity, 'Humanoid') && canDamageEnemy(entity, '07300b') },
    resolve: ({ inv, target, api }) => api.damageEnemy(target.entity, 1, inv.seat, '07300b'),
  }, {
    kind: 'free', actionKind: 'activate', label: '横置伊哈·恩斯雷雕塑：将2个诅咒替换为祝福',
    cost: { exhaust: true },
    criteria: ({ state, inv, source }) => controlled({ inv, source })
      && payablePoolTokens(state, 'curse').length >= 2,
    resolve: ({ api }) => api.chaosTokens.replace('curse', 'bless', 2, { exact: true }),
  }],
}
