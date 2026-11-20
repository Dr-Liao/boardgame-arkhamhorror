import { ownSeat } from '../../engine/matcher.js'

const code = '11028'
const faces = ['eldersign', '+1']

export default {
  code, limitPerInvestigator: true, sealOnEnterChoice: faces,
  abilities: [
    {
      kind: 'reaction', trigger: 'defeatEnemy', label: '再次封印一个旧印或 +1 标记',
      limit: { scope: 'perWindow', owner: 'instance' },
      criteria: [ownSeat(), ({ state }) => faces.some(face => state.chaosBag.includes(face))],
      resolve: ({ state, inv, source, api }) => {
        const available = faces.filter(face => state.chaosBag.includes(face))
        const token = available.length === 1 ? available[0] : api.choice({
          kind: 'seal', source: code, seat: inv.seat, prompt: '选择要封印的混乱标记。',
          options: available.map(id => ({ id, label: api.tokenLabel(id) })),
        })
        if (available.includes(token)) api.chaosTokens.seal(source.id, token, 1)
      },
    },
    {
      kind: 'reaction', trigger: 'enemyAttack', label: '横置并释放一个封印：取消此攻击，重整你另一张支援',
      cost: { exhaust: true },
      criteria: ({ state, inv, source, context }) => inv.location === context.location
        && (state.chaos?.sealed || []).some(item => item.source === source?.id),
      resolve: ({ state, inv, source, context, api }) => {
        const sealed = [...new Set((state.chaos?.sealed || [])
          .filter(item => item.source === source.id).map(item => item.token))]
        const token = sealed.length === 1 ? sealed[0] : api.choice({
          kind: 'seal', source: code, seat: inv.seat, prompt: '选择要释放的混乱标记。',
          options: sealed.map(id => ({ id, label: api.tokenLabel(id) })),
        })
        if (!sealed.includes(token) || api.chaosTokens.release(source.id, token, 1) !== 1) return
        api.cancelCurrentAttack(context)
        const assets = (inv.assets || []).filter(asset => asset.id !== source.id && asset.exhausted)
        if (!assets.length || api.assetsCannotReady(inv)) return
        const id = assets.length === 1 ? assets[0].id : api.choice({
          kind: 'asset', source: code, seat: inv.seat, prompt: '选择要重整的另一张支援。',
          options: assets.map(asset => ({ id: asset.id, label: api.cardName(asset.code) })),
        })
        const asset = assets.find(item => item.id === id)
        if (asset) api.ready(asset)
      },
    },
  ],
}
