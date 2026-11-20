import { ownSeat } from '../../engine/matcher.js'
import { entryData } from './_shared.js'

const CODE = '11043'
const FACES = ['+1', '0']
const availableFaces = state => [...new Set(state.chaosBag.filter(face => FACES.includes(face)))]
const sealedFaces = (state, source) => [...new Set((state.chaos?.sealed || [])
  .filter(item => item.source === source.id).map(item => item.token))]

export default {
  code: CODE,
  limitPerInvestigator: true,
  sealOnEnterChoice: FACES,
  abilities: [
    {
      kind: 'reaction', trigger: 'clueDiscovered', label: '发现此处最后 1 个线索后：再封印 1 个 +1 或 0',
      limit: { scope: 'perWindow', owner: 'instance' },
      criteria: [ownSeat(), ({ state, inv, context }) => context.lastClue && context.location === inv.location
        && availableFaces(state).length > 0],
      resolve: ({ state, inv, source, api }) => {
        const faces = availableFaces(state)
        const face = faces.length === 1 ? faces[0] : api.choice({
          kind: 'token', source: CODE, seat: inv.seat, prompt: '选择要封印的标记。',
          options: faces.map(token => ({ id: token, label: api.tokenLabel(token) })),
        })
        api.chaosTokens.seal(source.id, face, 1)
      },
    },
    {
      kind: 'reaction', trigger: 'enemyAttack', label: '横置、释放 1 个封印标记：取消攻击；受攻击者可移动到连接地点',
      cost: { exhaust: true },
      criteria: [({ state, inv, source, context }) => context.location === inv.location
        && !context.cancelled && !context.cannotCancel && !entryData(context.enemy?.code, 'enemyRule')?.attacksCannotBeCancelled
        && sealedFaces(state, source).length > 0],
      resolve: ({ state, inv, source, context, api }) => {
        const tokens = sealedFaces(state, source)
        const token = tokens.length === 1 ? tokens[0] : api.choice({
          kind: 'token', source: CODE, seat: inv.seat, prompt: '选择要释放的封印标记。',
          options: tokens.map(id => ({ id, label: api.tokenLabel(id) })),
        })
        if (!api.chaosTokens.release(source.id, token, 1)) return
        api.cancelCurrentAttack(context)
        const target = state.investigators[context.seat]
        const location = state.locations.find(item => item.id === target.location)
        const destinations = (location?.connections || []).filter(id => api.canMoveTo(target.seat, id))
        if (!destinations.length) return
        const destination = api.choice({
          kind: 'location', source: CODE, seat: target.seat, prompt: '是否移动到连接地点？',
          options: [{ id: 'skip', label: '不移动' }, ...destinations.map(id => ({ id, label: api.locationName(id) }))],
        })
        if (destination !== 'skip') api.moveInvestigator(target.seat, destination)
      },
    },
  ],
}
