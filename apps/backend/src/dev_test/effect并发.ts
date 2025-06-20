import { Effect } from "effect"

const task = Effect.gen(function* () {
  yield* Effect.log("start")
  yield* Effect.sleep("1 seconds")
  yield* Effect.log("end")
})

const program = Effect.gen(function* () {
  const mutex = yield* Effect.makeSemaphore(3)

  // Wrap the task to require one permit, forcing sequential execution
  const semTask = mutex
    .withPermits(1)(task)

  // Run 3 tasks concurrently, but they execute sequentially
  // due to the one-permit semaphore
  yield* Effect.all([semTask, semTask, semTask], {
    concurrency: "unbounded"
  })
})

Effect.runFork(program)
