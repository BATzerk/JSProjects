try {
  importScripts(
    "../game/engine.js",
    "../game/hints/core.js",
    "../game/hints/strategies-basic.js",
    "../game/hints/strategies-advanced.js",
    "../game/hints/difficulty.js",
    "../game/hints/registry.js",
  );
} catch (error) {
  self.postMessage({
    type: "startup-error",
    message: error instanceof Error
      ? `The completion tools could not start: ${error.message}`
      : "The completion tools could not start.",
  });
}

self.addEventListener("message", async (event) => {
  if (event.data?.type !== "complete") return;
  try {
    const boardIsFullyPainted = event.data.houses.every((row) => row.every((house) => house >= 0));
    const boardIsBlank = event.data.houses.every((row) => row.every((house) => house === -1));
    // A generated board can have a unique solution while still exceeding the
    // human-style techniques understood by the difficulty analyzer. Four
    // candidates was too small a sample to make an unconstrained blank board
    // reliably publishable, even though there is no painted geometry to block
    // completion. Give the analyzer more generated layouts to choose from when
    // the editor has complete freedom, and a smaller boost for partial drafts.
    const candidateMaximum = boardIsFullyPainted ? 1 : boardIsBlank ? 12 : 8;
    let lastResult = null;
    for (let candidate = 1; candidate <= candidateMaximum; candidate += 1) {
      const generated = self.StarsRemixEngine.completePuzzleFromHouses(event.data.houses, {
        title: event.data.title,
        seed: `${event.data.seed}-candidate-${candidate}`,
        maxAttempts: event.data.maxAttempts,
        onProgress(progress) {
          self.postMessage({ type: "generation-progress", progress: { ...progress, candidate, candidateMaximum } });
        },
      });
      self.postMessage({ type: "analysis-started", generated, candidate, candidateMaximum });
      const report = await self.StarsRemixHints.analyzeDifficulty(generated.puzzle, {
        onProgress(progress) {
          self.postMessage({ type: "difficulty-progress", progress: { ...progress, candidate, candidateMaximum } });
        },
        // Promise.resolve() only yields to the microtask queue. On difficult
        // boards that still leaves this worker continuously occupied long
        // enough for some browsers to terminate it. A timer yields to the
        // worker event loop so progress delivery and browser housekeeping can
        // run between expensive hint passes.
        yieldControl: () => new Promise((resolve) => setTimeout(resolve, 0)),
      });
      lastResult = { generated, report };
      if (report.solved && report.label !== "Incalculable") break;
      if (candidate < candidateMaximum) {
        self.postMessage({ type: "candidate-rejected", candidate, candidateMaximum });
      }
    }
    const { generated, report } = lastResult;
    self.postMessage({
      type: "completed",
      generated,
      difficulty: {
        solved: report.solved,
        label: report.label,
        score: report.score,
        bigTicketCount: report.bigTicketCount,
        logicalSteps: report.steps.length,
      },
    });
  } catch (error) {
    self.postMessage({
      type: "error",
      message: error instanceof Error ? error.message : "Unable to complete this board.",
    });
  }
});
