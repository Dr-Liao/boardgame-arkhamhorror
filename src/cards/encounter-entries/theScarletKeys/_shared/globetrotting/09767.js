// 09767 超维认识（Paradimensional Understanding）· 弱点诡计 · globetrotting
// 卡面：显现 - 你必须（选择一项）：
//   · 立即变换你控制的一个[[动荡]]钥匙。
//   · 将你控制的每个[[稳定]]钥匙翻至[[动荡]]面。
// 读点：scope 'card' 的 weakness 描述子（weakness.js#resolveWeaknessBody 优先走带 resolve 的
//   weakness 描述子）；密钥读写走 ctx.api.tsk.keys；动荡面效果经 _lookup 找到对应面的 assetRule.keyShift。
// 近似：① 「立即变换」用 force 绕过每轮一次（显现强制）；② 第二项按「直接翻面」处理，不结算
//   shift ability（引擎的 face 变更本身不结算文字，效果由条目显式调用）。
import { entryByCode } from '../../../_lookup.js'

const CODE = '09767'

const keysOf = (api, seat) => api.tsk.keys.heldBy({ type: 'investigator', seat })
  .map(id => api.tsk.keys.get(id))
  .filter(Boolean)

export default {
  code: CODE,
  scope: 'card',
  implemented: true,
  flags: { weakness: true, madness: true, paradox: true },
  abilities: [{
    kind: 'weakness',
    weakness: { type: 'paradimensionalUnderstanding' },
    label: '超维认识：变换一个动荡钥匙，或把你控制的每个稳定钥匙翻至动荡面',
    resolve: ({ state, inv, api }) => {
      const keys = keysOf(api, inv.seat)
      if (!keys.length) {
        api.info?.('「超维认识」：你没有控制任何绯红密钥。')
        return false
      }
      const unstable = keys.filter(key => key.stable !== true)
      const stable = keys.filter(key => key.stable === true)
      const options = []
      if (unstable.length) options.push({ id: 'shift', label: '立即变换一个动荡钥匙' })
      if (stable.length) options.push({ id: 'flip', label: '把你控制的每个稳定钥匙翻至动荡面' })
      if (!options.length) return false
      const mode = options.length === 1 ? options[0].id : String(api.choice({
        kind: 'effect', source: CODE, seat: inv.seat,
        prompt: '「超维认识」：选择一项。', options,
      }))
      if (mode === 'shift') {
        const picked = unstable.length === 1 ? unstable[0] : unstable.find(key => key.id === String(api.choice({
          kind: 'effect', source: CODE, seat: inv.seat,
          prompt: '选择要变换的动荡钥匙。',
          options: unstable.map(key => ({ id: key.id, label: '绯红密钥 ' + key.id })),
        }))) || unstable[0]
        const face = picked.unstableFace
        entryByCode(String(face))?.assetRule?.keyShift?.resolve?.({ state, api, inv, keyId: picked.id })
        api.tsk.keys.shift(picked.id, { force: true })
        api.info?.('「超维认识」：变换了动荡钥匙 ' + picked.id + '。')
        return true
      }
      let flipped = 0
      for (const key of stable) {
        api.tsk.keys.shift(key.id, { force: true })
        flipped += 1
      }
      api.info?.('「超维认识」：' + flipped + ' 把稳定钥匙翻至动荡面。')
      return flipped > 0
    },
  }],
  note: 'approximation: 「立即变换」用 force 绕过每轮一次；第二项直接翻面不结算 shift ability；'
    + '动荡面效果通过 _lookup 取 assetRule.keyShift（与敌人强制变换同一读点）。',
}
