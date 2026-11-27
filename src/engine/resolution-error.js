export class ChoicePause extends Error {
  constructor(choice) {
    super('等待规则选择')
    this.choice = choice
  }
}

export class ResolutionCheckpoint extends Error {
  constructor(seat, move) {
    super('规则事务检查点')
    this.seat = seat
    this.move = move
  }
}

export class SkillTestInterrupted extends Error {
  constructor(seat) {
    super('检定者已退场')
    this.seat = seat
  }
}

// 内容层的「可选询问」辅助函数只应吞掉普通业务错误；ChoicePause / ResolutionCheckpoint
// 是引擎用异常表达的控制流，必须原样重抛，否则待决选择会被静默默认或让事务游标失配
// （2026-11-13 P0：sanguineShadows/dogsOfWar/onThinIce/shadesOfSuffering/congressOfTheKeys）。
export function isPendingChoice(error) {
  return error instanceof ChoicePause || error instanceof ResolutionCheckpoint || error instanceof SkillTestInterrupted
}
