import {
  loadEoteWorld, createHubGame, settleChoices, legalFor, decisionSeat, playMove, INVESTIGATOR_CODES,
} from "../../../../../tests/eote-p8-fixture.mjs"
const world = await loadEoteWorld()
const state = createHubGame(world, { seats: 2, seed: "probe3", investigatorCodes: INVESTIGATOR_CODES.slice(0,2) })
settleChoices(world, state)
console.log("ui0", state.uiState, "decisionSeat", decisionSeat(world, state))
let moves = legalFor(world, state, decisionSeat(world, state))
console.log("leader moves", JSON.stringify(moves.filter(m=>m.action==="hubSetLeader")))
const leader = moves.find(m => m.action === "hubSetLeader")
playMove(world, state, leader, 0)
console.log("after leader ui", state.uiState, "leadConfirmed", state.campaign?.leadConfirmed, "humanSeats", state.humanSeats)
moves = legalFor(world, state, 0)
console.log("now moves", moves.map(m=>m.action).join(","))
