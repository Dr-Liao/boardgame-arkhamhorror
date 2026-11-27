// 09080 召来的仆从（Summoned Servitor）· 秘术师定制支援。
import { customizationChoiceValues, customizationOptionFullyChecked } from '../../engine/tsk-customizable.js'

const CODE = '09080'
const CUSTOM_CHECKS = Object.freeze([
  { name: 'Armored Carapace', checks: 1, text: 'Summoned Servitor gains a health value of 3. It can be assigned damage dealt to any investigator at its location.' },
  { name: 'Claws that Catch', checks: 1, text: 'Add this action: "- Fight. You fight any enemy at this location with a base [combat] of 4. Ignore the aloof and retaliate keywords for this attack."' },
  { name: 'Jaws that Snatch', checks: 1, text: 'Add this action: "- Evade. You attempt to evade any enemy at this location with a base [agility] of 4. Ignore the alert keyword for this evasion attempt."' },
  { name: 'Eyes of Flame', checks: 1, text: 'Add this action: "- Investigate. You investigate this location with a base [intellect] of 4."' },
  { name: 'Wings of Night', checks: 1, text: 'After Summoned Servitor moves from your location to a connecting location, you may move to that location, as well.' },
  { name: 'Dominance', checks: 2, text: 'Summoned Servitor no longer takes up an (circle one): arcane / ally slot.' },
  { name: 'Dreaming Call', checks: 3, text: "Instead of discarding another asset you control in order to play Summoned Servitor, you may return that asset to its owner's hand." },
  { name: 'Dæmonic Influence', checks: 5, text: 'Summoned Servitor can take 2 different actions instead of 1 during each of your turns.' },
])

const checked = (state, inv, source, index) =>
  customizationOptionFullyChecked(state, source?.ownerSeat ?? inv.seat, CODE, index)
const locationOf = (inv, source) => source?.location ?? inv.location
const maximumActions = (state, inv, source) => checked(state, inv, source, 7) ? 2 : 1

function canTakeAction(state, inv, source, kind) {
  if (!source || !locationOf(inv, source) || state.phase !== 'investigation'
    || state.currentSeat !== inv.seat || inv.turnEnded) return false
  const used = source.ownTurnActions
  return !used || used.turn !== state.turnSerial
    || (used.kinds.length < maximumActions(state, inv, source) && !used.kinds.includes(kind))
}

function enemiesAtServitor(state, inv, source, kind) {
  const here = locationOf(inv, source)
  return state.enemies.filter(enemy => enemy.location === here && !enemy.defeated && !enemy.removedFromGame
    && !enemy.hasParts && (kind !== 'evade' || enemy.evade != null))
}

function takeEnemyAction({ state, inv, source, api }, kind, perform) {
  const candidates = enemiesAtServitor(state, inv, source, kind)
  if (!candidates.length) return false
  const id = candidates.length === 1 ? candidates[0].id : api.choice({
    kind: 'enemy', source: CODE, seat: inv.seat,
    prompt: kind === 'fight' ? '选择召来的仆从所在地点要攻击的敌人。' : '选择召来的仆从所在地点要躲避的敌人。',
    options: candidates.map(enemy => ({ id: enemy.id, label: enemy.name || api.cardName(enemy.code), cardCode: enemy.originalCode || enemy.code })),
  })
  if (!candidates.some(enemy => enemy.id === id)
    || !api.useControlledAssetAction(source, kind, maximumActions(state, inv, source))) return false
  return api.withInvestigatorAtLocation(inv.seat, locationOf(inv, source), () => perform(api, inv.seat, id))
}

export default {
  code: CODE,
  customizationOptions: CUSTOM_CHECKS,
  customizationChoices: { kind: 'slot', base: 0, options: { 5: 1 } },
  customizationEffects: {
    slots(_checks, state, seat) {
      const [removed] = customizationChoiceValues(state, seat, CODE)
      return removed ? ['Ally', 'Arcane'].filter(slot => slot.toLowerCase() !== removed) : null
    },
  },
  discardPlayCost: {
    zones: ['play'],
    anyControlled: true,
    allowReturn: ({ state, inv }) => checked(state, inv, null, 6),
  },
  abilities: [
    {
      kind: 'entersPlay',
      label: '召来的仆从在你的地点入场',
      resolve: ({ state, inv, source, api }) => {
        if (!inv.location) return api.discardAsset(inv.seat, source)
        api.moveControlledAsset(source, inv.location)
        if (checked(state, inv, source, 0)) {
          api.configureControlledAsset(source, { health: 3, soakDamageAtLocation: true })
        }
      },
    },
    {
      kind: 'free',
      label: '移动召来的仆从到一个已揭示的连接地点',
      criteria: ({ state, inv, source }) => canTakeAction(state, inv, source, 'move'),
      target: {
        kind: 'location', range: 'anywhere',
        query: ({ state, inv, source, candidate }) => {
          const here = state.locations.find(location => location.id === locationOf(inv, source))
          return Boolean(candidate.entity.revealed && here?.connections?.includes(candidate.id))
        },
      },
      resolve: ({ state, inv, source, target, api }) => {
        if (!target || !api.useControlledAssetAction(source, 'move', maximumActions(state, inv, source))) return false
        const origin = locationOf(inv, source)
        const destination = target.id
        if (!api.moveControlledAsset(source, destination)) return false
        if (checked(state, inv, source, 4) && inv.location === origin && api.canMoveTo(inv.seat, destination)) {
          const answer = api.choice({
            kind: 'reaction', source: CODE, seat: inv.seat, canSkip: true,
            prompt: '黑翼如夜：是否也移动到该地点？',
            options: [{ id: 'move', label: '一起移动' }, { id: 'skip', label: '留在原地' }],
          })
          if (answer === 'move') api.moveInvestigator(inv.seat, destination)
        }
        return true
      },
    },
    {
      kind: 'free',
      label: '利爪如钩：以基础战斗值 4 攻击此地点的任意敌人（忽略冷漠/反击）',
      criteria: ({ state, inv, source }) => checked(state, inv, source, 1) && canTakeAction(state, inv, source, 'fight')
        && enemiesAtServitor(state, inv, source, 'fight').length > 0,
      resolve: ctx => takeEnemyAction(ctx, 'fight', (api, seat, id) => api.fight(seat, id, {
        baseValue: 4, noSpend: true, ignoreAloof: true, ignoreRetaliate: true, sourceCode: CODE,
      })),
    },
    {
      kind: 'free',
      label: '巨口如网：以基础敏捷值 4 躲避此地点的任意敌人（忽略警戒）',
      criteria: ({ state, inv, source }) => checked(state, inv, source, 2) && canTakeAction(state, inv, source, 'evade')
        && enemiesAtServitor(state, inv, source, 'evade').length > 0,
      resolve: ctx => takeEnemyAction(ctx, 'evade', (api, seat, id) => api.evade(seat, {
        enemyId: id, baseValue: 4, ignoreEngagement: true, ignoreAlert: true, sourceCode: CODE,
      })),
    },
    {
      kind: 'free',
      label: '亮眼如火：以基础智识值 4 调查此地点',
      criteria: ({ state, inv, source }) => checked(state, inv, source, 3)
        && canTakeAction(state, inv, source, 'investigate'),
      resolve: ({ state, inv, source, api }) => {
        if (!api.useControlledAssetAction(source, 'investigate', maximumActions(state, inv, source))) return false
        const locationId = locationOf(inv, source)
        return api.withInvestigatorAtLocation(inv.seat, locationId, () => api.investigate(inv.seat, { locationId, baseValue: 4 }))
      },
    },
  ],
}
