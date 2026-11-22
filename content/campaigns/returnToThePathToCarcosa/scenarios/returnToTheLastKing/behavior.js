// 重返最后的王者 · 章节行为。
//
// 基础章节的宾客会谈、翻面、混乱标记与结局记录直接复用基础 behavior；这里只覆盖：
//   1. 布置：冒险参考卡下使用八张「令人作呕的现实」（基础五 + 52023b + 52024b ×2）、
//      52025/52027 放在一边、基础敌人 03081 移出游戏；
//   2. 52026 宴会宾客：从遭遇牌库打出时放到线索最多的旁人所在地点（卡片类型是支援）；
//   3. 52022「宁缺毋迟」背面「贵宾」：密谋 1 推进时生成 52025 并把 52027 洗入遭遇牌库。
import { behavior as baseBehavior } from '../../../thePathToCarcosa/scenarios/theLastKing/behavior.js'
import { BYSTANDERS, SICKENING_REALITY_CARDS, REMOVED_ENEMY_CODE } from './definition.js'
import { returnToIntroduction } from '../../story.js'

const original = card => card?.originalCode || card?.code

function shuffleWith(state, items, api) {
  return api?.shuffle ? api.shuffle(items) : [...items].sort()
}

export const behavior = {
  ...baseBehavior,
  id: 'returnToTheLastKing',
  introduction: returnToIntroduction('theLastKing'),

  setupPlan(state) {
    return {
      locations: ['foyer', 'courtyard', 'livingRoom', 'ballroom', 'diningRoom', 'gallery'],
      setAside: ['52025', '52027'],
      removed: [REMOVED_ENEMY_CODE],
    }
  },

  setupLocations(state, events, api) {
    const destinations = api.shuffle(
      ['courtyard', 'livingRoom', 'ballroom', 'diningRoom', 'gallery'],
      () => api.randomValue(state),
    )
    const guests = api.shuffle([...BYSTANDERS], () => api.randomValue(state))
    state.scenarioFlags = {
      interviewed: [],
      toughCrowd: [],
      ballroomReaction: null,
      livingRoomReaction: null,
      guestPlacements: guests.map((code, index) => ({ code, location: destinations[index] })),
      dianneSpawned: false,
      shockingDisplayShuffled: false,
    }
    state.scenarioZones ||= {}
    // 冒险参考卡下的「令人作呕的现实」：基础五张 + 重返三张（52024b 两张）。
    state.scenarioZones.sickeningReality = [...SICKENING_REALITY_CARDS]
    state.scenarioZones.setAside = ['52025', '52027']
    state.scenarioZones.removed = [REMOVED_ENEMY_CODE]
    return this.setupPlan(state).locations
  },

  setupEnemies(state) {
    state.storyAssets = state.scenarioFlags.guestPlacements.map(({ code, location }) => ({
      ...structuredClone(state.scenario.storyAssets[code]),
      id: `last-king-guest-${code}`,
      code,
      location,
      controllerSeat: null,
      clues: state.numInvestigators + 1,
      exhausted: false,
    }))
  },

  // 52026 宴会宾客（支援卡从遭遇牌库打出）：放到线索最多的旁人所在地点。
  drawStoryAsset(state, inv, code, api) {
    if (code !== '52026') return baseBehavior.drawStoryAsset?.(state, inv, code, api)
    const withClues = (state.storyAssets || []).filter(asset => (asset.clues || 0) > 0)
    if (!withClues.length) {
      api.info?.('场上没有带线索的旁人，宴会宾客没有去处，被弃掉。')
      return true
    }
    const most = Math.max(...withClues.map(asset => asset.clues || 0))
    const target = withClues.find(asset => (asset.clues || 0) === most)
    api.spawnStoryAsset?.('52026', target.location)
    api.info?.(`宴会宾客出现在「${target.name || target.code}」所在地点。`)
    return true
  },

  // 52022 背面「贵宾」：密谋 1 推进时生成 52025，并把 52027 洗入遭遇牌库（连同弃牌堆）。
  agendaLeftPlay(state, agenda, api) {
    if (original(agenda) !== '52022') return
    const withClues = (state.storyAssets || []).filter(asset => (asset.clues || 0) > 0)
    if (withClues.length) {
      const fewest = Math.min(...withClues.map(asset => asset.clues || 0))
      const target = withClues.find(asset => (asset.clues || 0) === fewest)
      const spawned = api.spawnStoryAsset?.('52025', target.location)
      if (spawned) {
        state.scenarioFlags.dianneSpawned = true
        api.info?.(`黛安娜·迪瓦恩在「${target.name || target.code}」所在地点现身。`)
      }
    }
    const discard = state.encounterDiscard || []
    state.encounterDiscard = []
    const additions = [...discard, '52027']
    state.encounterDeck = shuffleWith(state, [...(state.encounterDeck || []), ...additions], api)
    state.scenarioFlags.shockingDisplayShuffled = true
    api.info?.('「令人震惊的一幕」与遭遇弃牌堆被洗入遭遇牌库。')
  },

  // 52023：谈判行动后朝该调查员移动一次（engine: dispatch.afterParley）。
  afterParley(state, inv, enemy, api) {
    if (original(enemy) !== '52023') return
    if (enemy.location === inv.location) return
    api.moveEnemyToward?.(enemy, inv.location)
    api.info?.('黛安娜·迪瓦恩朝刚刚谈判的调查员移动了一次。')
  },

  // 52025：位于黛安娜所在地点的调查员不能发现或取得线索。
  canDiscoverClues(state, inv, location) {
    const blocked = (state.storyAssets || []).some(asset => original(asset) === '52025'
      && asset.location === location?.id)
    if (blocked) return false
    return baseBehavior.canDiscoverClues?.(state, inv, location) ?? true
  },

  // 52026：位于宴会宾客所在地点的调查员不能与[[旁人]]支援谈判。
  parleyBlocked(state, inv, entity) {
    const blocked = (state.storyAssets || []).some(asset => original(asset) === '52026'
      && asset.location === inv.location)
    if (blocked) return true
    return baseBehavior.parleyBlocked?.(state, inv, entity) || false
  },

  // 52026 的「花费 2 资源：谈判。将宴会宾客移动到一个连接地点」。
  actions(state, inv) {
    const moves = baseBehavior.actions?.(state, inv) || []
    for (const asset of state.storyAssets || []) {
      if (original(asset) !== '52026' || asset.location !== inv.location) continue
      moves.push({
        action: 'scenarioAction', rule: 'movePartyGuest', assetId: asset.id,
        label: '谈判：花费 2 资源，将宴会宾客移动到一个连接地点',
        reason: (inv.resources || 0) < 2 ? '需要 2 资源' : null,
      })
    }
    return moves
  },

  performAction(state, inv, move, api) {
    if (move.rule === 'movePartyGuest') {
      const asset = (state.storyAssets || []).find(item => item.id === move.assetId)
      const location = state.locations.find(item => item.id === inv.location)
      const targets = (location?.connections || []).filter(id => state.locations.some(item => item.id === id))
      if (!asset || (inv.resources || 0) < 2 || !targets.length) throw new Error('宴会宾客的谈判行动当前不可用')
      inv.resources -= 2
      const choice = targets.length === 1 ? targets[0] : api.choose({
        kind: 'location', seat: inv.seat, source: '52026',
        prompt: '将宴会宾客移动到哪个连接地点？',
        options: targets.map(id => ({ id, label: state.locations.find(item => item.id === id)?.name || id })),
      })
      const destination = targets.includes(choice) ? choice : targets[0]
      asset.location = destination
      api.info?.(`宴会宾客被移动到「${state.locations.find(item => item.id === destination)?.name || destination}」。`)
      return
    }
    baseBehavior.performAction(state, inv, move, api)
  },

  // 52025：敌军阶段开始时移动到线索最少的[[旁人]]支援所在地点。
  enemyPhaseStart(state, api) {
    baseBehavior.enemyPhaseStart?.(state, api)
    const dianne = (state.storyAssets || []).find(asset => original(asset) === '52025')
    if (!dianne) return
    const candidates = (state.storyAssets || []).filter(asset => asset !== dianne
      && (asset.clues || 0) > 0)
    if (!candidates.length) return
    const fewest = Math.min(...candidates.map(asset => asset.clues || 0))
    const target = candidates.find(asset => (asset.clues || 0) === fewest)
    if (target && target.location !== dianne.location) {
      dianne.location = target.location
      api.info?.('黛安娜·迪瓦恩移动到线索最少的旁人所在地点。')
    }
  },

  // 52023：基础生命值 +3 × 调查员数（卡面「+3[per_investigator] 生命值」）。
  enemyStatModifier(state, enemy, stat, inv) {
    const base = baseBehavior.enemyStatModifier?.(state, enemy, stat, inv) || 0
    if (stat === 'health' && original(enemy) === '52023') {
      return base + 3 * Number(state.numInvestigators || 1)
    }
    return base
  },
}
