// 09561 技高一筹（Outsmarted）· treachery
//
// 归属：关卡专用 · theScarletKeys/sanguineShadows（P7）。
// 卡面：
//   显现 - 检定[智力](4)。如果你检定失败，你必须决定（选择一项）：
//   - 在当前密谋上放置 1 个毁灭标记。本效果能导致密谋推进。
//   - 最近的[[结社]]敌人攻击你。
//
// 结算走 chapter behavior：`treacheryRule.resolveKind` → outsmarted
// （检定 4；失败时按 choice 在「放毁灭」与「最近的[[结社]]敌人攻击你」之间二选一）。
export default {
  code: '09561',
  scope: 'treachery',
  implemented: true,
  treacheryRule: { resolveKind: 'outsmarted' },
}
