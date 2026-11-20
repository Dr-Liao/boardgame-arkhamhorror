import { ownTurn } from '../../engine/matcher.js'
import { enemyIsBody } from '../../engine/enemy-parts.js'

const code = '11058'
const alreadyAttached = (state, location) => (state.playerLocationAttachments || [])
  .some(card => card.code === code && card.location === location)
const evadable = (state, enemy) => Boolean(enemy && state.enemies.includes(enemy)
  && !enemyIsBody(enemy) && !enemy.enemyLocation && enemy.evade != null)

export default {
  code, keepOnPlay: true,
  assetRule: { ownerLocationAttachmentAbility: true },
  playCondition: [ownTurn(), ({ state, inv }) => !alreadyAttached(state, inv.location)],
  abilities: [
    {
      kind: 'played', fast: true, label: '附属到所在地点；每个地点限 1 张',
      resolve: ({ state, inv, api }) => {
        if (alreadyAttached(state, inv.location) || !api.attachToLocation(inv.location, { code, ownerSeat: inv.seat })) {
          api.putIntoDiscard(inv.seat, code)
        }
      },
    },
    {
      kind: 'reaction', trigger: ['enemyMoved', 'enemySpawn'], range: 'anywhere',
      label: '敌人进入或离开所附属地点后：返回手牌来躲避该敌人或移动到所附属地点',
      criteria: ({ state, inv, source, context, helpers }) => source?.ownerSeat === inv.seat
        && state.playerLocationAttachments?.includes(source)
        && (source.location === context.from || source.location === (context.to || context.location))
        && ((!helpers.capabilityBlocked('evade') && evadable(state, context.enemy))
          || (inv.location !== source.location && helpers.canMoveTo(inv.seat, source.location))),
      resolve: ({ state, inv, source, context, api }) => {
        const options = []
        if (!api.capabilityBlocked(inv.seat, 'evade') && evadable(state, context.enemy)) options.push({ id: 'evade', label: `躲避「${context.enemy.name}」` })
        if (inv.location !== source.location && api.canMoveTo(inv.seat, source.location)) {
          options.push({ id: 'move', label: `移动到「${api.locName(source.location)}」` })
        }
        if (!options.length) return
        const id = options.length === 1 ? options[0].id : api.choice({
          kind: 'effect', source: code, seat: inv.seat, options, prompt: '选择返回手牌后立即执行的效果。',
        })
        if (!options.some(item => item.id === id) || !api.movePlayerAttachment(source, 'hand')) return
        if (id === 'move') api.moveInvestigator(inv.seat, source.location)
        else api.evade(inv.seat, {
          enemyId: context.enemy.id, sourceCode: code, ignoreEngagement: true, ignoreDistance: true,
        })
      },
    },
  ],
}
