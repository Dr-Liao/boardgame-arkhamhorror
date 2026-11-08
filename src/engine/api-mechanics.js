import { createEnemyZoneApi } from './enemy-zones.js'
import { mechanicState } from './mechanic-state.js'
import * as pool from './chaos-token-pool.js'
import * as water from './flood.js'
import * as keys from './scenario-keys.js'
import * as vehicles from './vehicles.js'
import * as graph from './map-graph.js'
import * as barriers from './edge-barriers.js'
import * as origins from './commit-origins.js'
import * as records from '../campaign/record-sets.js'
import { setTokenTreatment } from './chaos-token-effects.js'
import { moveUses, spendSharedUses } from './use-transfer.js'
import { makeTurnPromise } from './turn-promises.js'
import { createMechanicChoices } from './mechanic-choices.js'
import { createEoteInteractions } from './eote-interactions.js'
import { createScenarioDeckApi } from './scenario-decks.js'
import * as grid from './grid-map.js'
// 七循环 P2：通用原语域。载入本文件即证明各模块存在；具体语义见 docs/edgeOfTheEarth/primitives.md。
import * as frost from './frost.js'
import * as shelter from './eote-shelter.js'
import * as camp from './eote-camp.js'
import * as facilities from './eote-facilities.js'
import * as climb from './eote-climb.js'
import * as city from './eote-city.js'
import * as tekeli from './eote-tekeli.js'
import * as deckTop from './eote-deck-top.js'
import * as roundDistance from './eote-round-distance.js'
import * as disciplines from './eote-disciplines.js'
import * as levels from './vertical-chain.js'
import { drawFromScenarioDeck, returnToScenarioDeckBottom, scenarioDeckSize, shuffleTopIntoInvestigatorDeck } from './scenario-decks.js'
import { clearCrossSeatGrant, crossSeatData, grantCrossSeat } from './play-channels.js'
import * as eotePartners from '../campaign/eote-partners.js'
import * as eoteSeals from '../campaign/eote-seals.js'
import * as eoteMemorials from '../campaign/eote-memorials.js'
import * as eoteSupplies from '../campaign/eote-supplies.js'

// Composition only. Writes remain in the reusable domain primitives.
export function createMechanicsApi(state, deps = {}) {
  const changed = result => { deps.sealedChanged?.(); return result }
  function eoteInteractionGroups(state, deps) {
  // keys 会和既有 key 交互函数重名，扁平层不展开（只在 interactions.eote.keys 提供）。
  const { keys, ...groups } = createEoteInteractions(state, deps)
  return groups
}

  const deck = createScenarioDeckApi(state, deps)
  return {
    // 七循环 P4：EotE 待决选择事务。`eote` 命名空间完整暴露（keys 等与既有交互同名者只在此处）；
    // 其余不冲突的分组在顶层再给一次，供内容层简写调用。
    interactions: { ...createMechanicChoices(state, deps), ...eoteInteractionGroups(state, deps), eote: createEoteInteractions(state, deps) },
    scenarioDecks: deck,
    enemyZones:deps.enemyZones||createEnemyZoneApi(state,{mechanicState}),
    barriers: {
      count: (a, b) => barriers.barrierCount(state, a, b),
      edges: id => barriers.barrierEdges(state, id),
      set: (a, b, count, options) => barriers.setBarrierCount(state, a, b, count, options),
      change: (a, b, amount, options) => barriers.changeBarrierCount(state, a, b, amount, options),
      canPlace: (a, b) => barriers.canPlaceBarrier(state, a, b),
      removeConnected(seat, id, count = 1) {
        const edges = barriers.barrierEdges(state, id).filter(edge => edge.count >= count)
        if (!edges.length) return false
        const index = edges.length === 1 ? 0 : Number(deps.choice({ kind: 'effect', seat, source: id,
          prompt: '选择要清除路障的通道。', options: edges.map((edge, index) => ({ id: String(index),
            label: `${state.locations.find(loc => loc.id === edge.a)?.name} — ${state.locations.find(loc => loc.id === edge.b)?.name}` })) }))
        const edge = edges[index]
        return edge ? barriers.changeBarrierCount(state, edge.a, edge.b, -count) !== false : false
      },
      moveConnected(seat, id) {
        const neighbors = state.locations.find(loc => loc.id === id)?.connections || []
        const eligible = barriers.barrierEdges(state, id).filter(edge => neighbors.some(to => ![edge.a, edge.b].includes(to) && barriers.canPlaceBarrier(state, id, to)))
        if (!eligible.length) return false
        const index = eligible.length === 1 ? 0 : Number(deps.choice({ kind: 'effect', seat, source: id, prompt: '选择移走路障的通道。',
          options: eligible.map((edge, i) => ({ id: String(i), label: edge.a === id ? edge.b : edge.a })) }))
        const edge = eligible[index]
        if (!edge) return false
        const destinations = neighbors.filter(to => ![edge.a, edge.b].includes(to) && barriers.canPlaceBarrier(state, id, to))
        const to = destinations.length === 1 ? destinations[0] : deps.choice({ kind: 'effect', seat, source: id, prompt: '选择放置路障的通道。',
          options: destinations.map(id => ({ id, label: state.locations.find(loc => loc.id === id)?.name || id })) })
        if (!destinations.includes(to) || !barriers.barrierCount(state, edge.a, edge.b)) return false
        barriers.changeBarrierCount(state, edge.a, edge.b, -1)
        barriers.changeBarrierCount(state, id, to, 1)
        return true
      },
    },
    promise: (seat, source, event) => makeTurnPromise(state, seat, source, event),
    useTokens: {
      move: (from, to, type, count) => moveUses(state, from, to, type, count),
      spend: (seat, id, type, count, providers) => spendSharedUses(state, seat, id, type, count, providers),
    },
    chaosTokens: {
      count: token => pool.poolTokenCount(state, token), room: token => pool.poolTokenRoom(state, token),
      add: (token, count, options) => pool.addPoolTokens(state, token, count, options),
      candidates: (token, options) => pool.payablePoolTokens(state, token, options),
      pay: (token, count, options) => changed(pool.payPoolTokens(state, token, count, options)),
      replace: (from, to, count, options) => pool.replacePoolTokens(state, from, to, count, options),
      seal: (source, token, count, options) => pool.sealPoolTokens(state, source, token, count, options),
      release: (source, token, count, options) => changed(pool.releasePoolTokens(state, source, token, count, options)),
      revealSealed: (source, token) => pool.revealSealedToken(state, source, token),
      inspect: count => pool.inspectChaosTokens(state, count), treat: spec => setTokenTreatment(state, spec),
      scheduleReplacement: (from, to) => pool.schedulePoolReplacement(state, from, to),
    },
    water: {
      setRevealPolicy: policy => water.setRevealFloodPolicy(state, policy),
      lock: id => water.lockFloodLevel(state, id),
      level: id => water.floodLevel(state, id), effectiveLevel: (seat, options) => water.effectiveFloodLevel(state, seat, options),
      canChange: (id, amount) => water.canChangeFloodLevel(state, id, amount),
      set: (id, level, options) => water.setFloodLevel(state, id, level, { ...options, onChange: deps.floodChanged }),
      change: (id, amount, options) => water.changeFloodLevel(state, id, amount, { ...options, onChange: deps.floodChanged }),
      beginAirTurn: (seat, options) => water.beginAirTurn(state, seat, options), endAirTurn: seat => water.endAirTurn(state, seat, deps.directDamage),
    },
    keys: {
      linkAsset: (color, assetId) => keys.linkKeyAsset(state, color, assetId),
      heldAtLocation: id => keys.keysHeldAtLocation(state, id),
      heldByGroup: () => keys.keysHeldByGroup(state),
      initialize: specs => keys.initializeKeys(state, specs), at: (target, options) => keys.keysAt(state, target, options),
      transfer: (color, from, to, options) => keys.transferKey(state, color, from, to, options),
      claim: (seat, color) => keys.claimKey(state, seat, color), spend: (seat, color, to) => keys.spendKey(state, seat, color, to),
      placeRandom: to => keys.placeRandomUnrevealedKey(state, to),
      onExit: (target, location, seat) => keys.keysOnExit(state, target, location, seat), give: (from, to, colors) => keys.giveKeys(state, from, to, colors),
    },
    vehicles: {
      register: (id, spec) => vehicles.registerVehicle(state, id, spec), of: seat => vehicles.vehicleOf(state, seat),
      passengers: id => vehicles.vehiclePassengers(state, id), record: id => vehicles.vehicleRecord(state, id),
      accessError: (seat, id, entering) => vehicles.vehicleAccessError(state, seat, id, entering),
      enter: (seat, id, options) => vehicles.enterVehicle(state, seat, id, options), leave: (seat, id, options) => vehicles.leaveVehicle(state, seat, id, options),
      setDriver: (id, seat) => vehicles.setVehicleDriver(state, id, seat),
      running: (id, running) => vehicles.setVehicleRunning(state, id, running),
      // 07210 蜿蜒长路：「该载具不能离开本地点，直到下一轮结束」的写入口（读点在 moveVehicle）。
      lockUntil: (id, round) => vehicles.lockVehicleUntilRound(state, id, round),
      move: (id, destination) => vehicles.moveVehicle(state, id, destination, deps), remove: id => vehicles.removeVehicle(state, id),
    },
    map: {
      configure: options => grid.configureGrid(state, options),
      position: id => grid.gridPosition(state, id),
      locations: query => grid.gridLocations(state, query),
      place: (id, x, y, options) => grid.placeGridLocation(state, id, x, y, deps, options),
      connect: (a, b, options) => grid.connectGridPair(state, a, b, options),
      expand: (id, template, deckId) => grid.expandGridFrom(state, id, template, deckId, { ...deps, deck }),
      paths: (from, to, canEnter) => graph.shortestPaths(state.locations, from, to, canEnter),
      distance: (from, to) => graph.roadDistance(state.locations, from, to), neighbors: (cells, cell) => graph.orthogonalNeighbors(cells, cell),
      initializeRoad: spec => graph.initializeRoad(state, spec), extendRoad: (from, count) => graph.extendRoad(state, from, count, deps.placeLocation),
    },
    recordSets: {
      values: key => records.recordSetValues(state.campaign, key), add: (key, value) => records.recordSetAdd(state.campaign, key, value),
      remove: (key, value) => records.recordSetRemove(state.campaign, key, value), claimReward: id => records.claimRecordReward(state.campaign, id),
    },
    commitOrigins: {
      beneath: (seat, host) => origins.beneathCards(state, seat, host), store: (seat, host, code, options) => origins.storeBeneath(state, seat, host, code, options),
      take: (seat, host, code, to) => origins.takeBeneath(state, seat, host, code, to), commit: (seat, spec) => origins.commitFromOrigin(state, seat, spec, deps.commit),
      withdraw: (seat, index) => origins.withdrawCommitment(state, seat, index),
    },
    // ── 七循环《地球边缘》P2 通用原语 ────────────────────────────────────────
    frost: {
      limit: frost.FROST_POOL_LIMIT,
      count: () => frost.frostPoolCount(state), room: () => frost.frostPoolRoom(state),
      add: (count, options) => frost.addFrost(state, count, options), pay: (count, options) => frost.payFrost(state, count, options),
      extraReveal: token => frost.extraRevealForFrost(token), autoFail: drawn => frost.shouldAutoFailForFrost(drawn),
    },
    shelter: {
      of: id => shelter.locationShelter(state, id), camp: () => shelter.campShelter(state),
    },
    camp: {
      location: () => camp.campLocationId(state), set: id => camp.setCampLocation(state, id),
      revealed: () => camp.revealedLocations(state), recordRevealed: id => camp.recordRevealedLocation(state, id),
      inheritRevealed: ids => camp.inheritRevealedLocations(state, ids),
    },
    facilities: {
      initialize: spec => facilities.initializeFacilities(state, spec),
      state: id => facilities.facilityState(state, id), activate: (id, options) => facilities.activateFacility(state, id, options),
      destroy: id => facilities.destroyFacility(state, id),
      tower: id => facilities.towerState(state, id), towerHealth: id => facilities.towerHealth(state, id),
      damageTower: spec => facilities.damageTower(state, spec), collapsedTowers: () => facilities.collapsedTowers(state),
      towerSeals: () => facilities.towerSeals(state), placeTowerSeal: spec => facilities.placeTowerSeal(state, spec),
      removeTowerSeal: spec => facilities.removeTowerSeal(state, spec),
    },
    climb: {
      destinationError: (fromId, toId) => climb.climbDestinationError(state, fromId, toId),
      ascend: (seat, toId) => climb.ascend(state, state.investigators?.[seat], toId),
      descend: (seat, toId) => climb.descend(state, state.investigators?.[seat], toId),
      state: () => climb.climbState(state), fallDamage: (from, to) => climb.fallDamage(state, from, to),
      cluesLostOnMove: (seat, options) => climb.cluesLostOnMove(state, state.investigators?.[seat], options),
      dropExpeditionAssets: (seat, options) => climb.dropExpeditionAssets(state, state.investigators?.[seat], options),
    },
    city: {
      initialize: (spec, options) => city.initializeCity(state, spec, options),
      cityscapes: () => city.cityscapes(state),
      visibleOnRow: (index, options) => city.visibleOnRow(state, index, options),
      visibleOnColumn: (index, options) => city.visibleOnColumn(state, index, options),
      keyOnLocation: id => city.keyOnLocation(state, id), placeKey: spec => city.placeKey(state, spec),
      takeKey: spec => city.takeKey(state, spec), moveKey: spec => city.moveKey(state, spec), swapKeys: spec => city.swapKeys(state, spec),
    },
    tekeli: {
      initialize: spec => tekeli.initializeTekeliDeck(state, spec),
      size: () => tekeli.tekeliDeckSize(state), shuffleIn: (seat, count, options) => tekeli.tekeliShuffleIn(state, seat, count, options),
      draw: () => tekeli.tekeliDraw(state), return: (code, options) => tekeli.tekeliReturn(state, code, options),
    },
    hiddenDecks: {
      shuffleTopIntoInvestigatorDeck: spec => shuffleTopIntoInvestigatorDeck(state, spec),
      draw: (deckId, count) => drawFromScenarioDeck(state, deckId, count),
      returnToBottom: (deckId, codes) => returnToScenarioDeckBottom(state, deckId, codes),
      size: deckId => scenarioDeckSize(state, deckId),
    },
    levels: {
      of: id => levels.locationLevel(state, id), set: (id, level) => levels.setLocationLevel(state.locations?.find(loc => loc.id === id), level),
      ordered: target => levels.levelsOrdered(target), neighbors: id => levels.levelNeighbors(state, id),
    },
    deckTop: {
      reveal: (seat, options) => deckTop.revealDeckTop(state, seat, options), card: seat => deckTop.deckTopCard(state, seat),
      clear: seat => deckTop.clearDeckTop(state, seat), markPlayed: seat => deckTop.markDeckTopPlayed(state, seat),
      discountUsed: (seat, round) => deckTop.deckTopDiscountUsed(state, seat, round),
      play: (seat, options) => deckTop.playDeckTop(state, seat, options), weaknessDraw: seat => deckTop.deckTopWeaknessDraw(state, seat),
    },
    roundDistance: {
      startLocation: seat => roundDistance.roundStartLocation(state, seat),
      noteStartLocation: (seat, locationId) => roundDistance.noteRoundStartLocation(state, seat, locationId),
      distance: seat => roundDistance.travelDistance(state, seat),
      reward: (seat, options) => roundDistance.roundDistanceReward(state, seat, options),
    },
    disciplines: {
      initialize: spec => disciplines.initializeDisciplines(state, spec), face: code => disciplines.disciplineFace(state, code),
      faceCode: code => disciplines.disciplineFaceCode(state, code), flip: (code, options) => disciplines.flipDiscipline(state, code, options),
      burden: code => disciplines.disciplineBurden(state, code), bonds: code => disciplines.bondsOfDiscipline(state, code),
      select: options => disciplines.selectDisciplines(state, options),
    },
    crossSeat: {
      data: () => crossSeatData(state),
      grant: (seat, spec) => grantCrossSeat(state, seat, spec),
      clear: seat => clearCrossSeatGrant(state, seat),
    },
    eoteCampaign: {
      partners: {
        initialize: spec => eotePartners.initializePartners(state, spec), state: code => eotePartners.partnerState(state, code),
        withStatus: status => eotePartners.partnersWithStatus(state, status), remaining: () => eotePartners.remainingPartners(state),
        adjustHarm: (code, harm) => eotePartners.adjustPartnerHarm(state, code, harm),
        setStatus: (code, status) => eotePartners.setPartnerStatus(state, code, status),
        alive: code => eotePartners.isPartnerAlive(state, code), resoluteForm: code => eotePartners.resoluteFormOf(state, code),
        chooseMissing: (shelterValue, random) => eotePartners.chooseMissingPartners(state, shelterValue, random),
      },
      seals: {
        initialize: spec => eoteSeals.initializeSeals(state, spec), state: kind => eoteSeals.sealState(state, kind),
        of: predicate => eoteSeals.sealsOf(state, predicate), placed: () => eoteSeals.placedSeals(state),
        activated: () => eoteSeals.activatedSeals(state), held: seat => eoteSeals.heldSeals(state, seat),
        at: locationId => eoteSeals.sealsAt(state, locationId), placeDormant: (kind, locationId) => eoteSeals.placeDormantSeal(state, kind, locationId),
        recover: (kind, options) => eoteSeals.recoverSeal(state, kind, options), activate: kind => eoteSeals.activateSeal(state, kind),
        deactivate: kind => eoteSeals.deactivateSeal(state, kind), place: (kind, options) => eoteSeals.placeSeal(state, kind, options),
        unplace: kind => eoteSeals.unplaceSeal(state, kind),
      },
      memorials: {
        initialize: spec => eoteMemorials.initializeMemorials(state, spec), for: code => eoteMemorials.memorialFor(state, code),
        crossedOut: () => eoteMemorials.crossedOutMemorials(state), claimed: () => eoteMemorials.claimedMemorials(state),
        claim: code => eoteMemorials.claimMemorial(state, code), claimAll: () => eoteMemorials.claimAllAtInterlude(state),
      },
      supplies: {
        initialize: spec => eoteSupplies.initializeSupplies(state, spec), items: () => eoteSupplies.supplyItems(state),
        carrier: code => eoteSupplies.supplyCarrier(state, code), carried: seat => eoteSupplies.carriedSupplies(state, seat),
        assign: (code, seat) => eoteSupplies.assignSupply(state, code, seat), release: code => eoteSupplies.releaseSupply(state, code),
        drop: (code, locationId) => eoteSupplies.dropSupplyAt(state, code, locationId), recover: code => eoteSupplies.recoverSupply(state, code),
        recovered: () => eoteSupplies.recoveredSupplies(state), missing: () => eoteSupplies.missingSupplies(state),
        dropped: () => eoteSupplies.droppedSupplies(state),
      },
    },
  }
}
