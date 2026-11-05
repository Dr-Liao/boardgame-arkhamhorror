// 07300 伊哈·恩斯雷雕塑（Y'ha-nthlei Statue，神秘遗物面）· 《达贡巢穴》剧情支援
//
// 印刷（中文）：
//   [free]横置伊哈·恩斯雷雕塑并在混乱袋中加入2个[curse]标记：对你所在地点的一个[[类人]]敌人造成1点伤害。
//   [action]花费蓝色、白色、红色或黄色钥匙：重整伊哈·恩斯雷雕塑并将其翻至另一面。
// 印刷（英文）：
//   [fast] Exhaust Y'ha-nthlei Statue and add 2 [curse] tokens to the chaos bag: Deal 1 damage to a
//     [[Humanoid]] enemy at your location.
//   [action] Spend the blue, white, red, or yellow key: Ready Y'ha-nthlei Statue and flip it to its other side.
//
// 引擎读点：
//   · 第一条 = `cost:{exhaust}` + `additionalTokenCost`（2 个诅咒进混乱袋）+ 目标敌人 + api.damageEnemy。
//   · 第二条 = `kind:'action'` + `additionalKeyCost:{ colors:['blue','white','red','yellow'] }`
//     （key-cost.js：只列调查员自己控制的四色钥匙，支付时 transferKey → 'reference'，即「花费」），
//     resolve 里 `api.ready(asset)` + `api.flipAsset(asset, '07300b')`（引擎普通物理面入口
//     physical-faces.js#applyPhysicalFace：同一个实例 id / 横置状态 / 控制者，只替换印刷面）。
//     翻到 07300b 后能力枚举读 `registeredEntry(asset.code)` → 07300b.js 的两条 [fast] 能力。
//   · 修复前只实现了第一条，且没有 07300b 可达路径（审计 H11：「声明即接线」反例）。
import { hasTrait } from '../../_shared.js'

const controlled = ({ inv, source }) => inv.assets.some(asset => asset.id === source.id)

export default {
  code: '07300', scope: 'storyAsset', implemented: true,
  abilities: [{
    // [fast] 横置并加入 2 个诅咒：对本地类人敌人造成 1 点伤害。
    kind: 'free', actionKind: 'activate', label: '横置并加入2个诅咒：对本地类人敌人造成1点伤害',
    cost: { exhaust: true },
    additionalTokenCost: { token: 'curse', operation: 'add', count: 2 },
    criteria: controlled,
    target: { kind: 'enemy', query: ({ entity, canDamageEnemy }) => !entity.defeated && !entity.removedFromGame
      && hasTrait(entity, 'Humanoid') && canDamageEnemy(entity, '07300') },
    resolve: ({ inv, target, api }) => api.damageEnemy(target.entity, 1, inv.seat, '07300'),
  }, {
    // [action] 花费蓝色/白色/红色/黄色钥匙：重整雕塑并翻至另一面。
    kind: 'action', actionKind: 'activate', label: '花费蓝色、白色、红色或黄色钥匙：重整雕塑并翻至另一面',
    additionalKeyCost: { colors: ['blue', 'white', 'red', 'yellow'] },
    criteria: controlled,
    resolve: ({ inv, source, api }) => {
      const asset = inv.assets.find(item => item.id === source.id)
      if (!asset) return false
      api.ready(asset)
      api.flipAsset(asset, '07300b')
      api.info?.(`🗿 花费钥匙：重整「${asset.name || '伊哈·恩斯雷雕塑'}」并翻至另一面（汨动遗物面）。`)
      return true
    },
  }],
}
