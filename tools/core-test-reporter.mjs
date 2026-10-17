// Machine-readable passed assertions, including the source location reported by
// node:test. The acceptance ledger never infers a pass from a source-code mention.
export default async function* report(events) {
  for await (const { type, data } of events) {
    if (type === 'test:pass' || type === 'test:fail') {
      yield JSON.stringify({ type, name: data.name, file: data.file, line: data.line,
        skipped: !!data.skip, todo: !!data.todo }) + '\n'
    }
  }
}
