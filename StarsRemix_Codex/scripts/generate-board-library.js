import { cpus } from "node:os";
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import { readLibraryWithHandmade, writeLibrary } from "./board-library-files.js";

const difficultyOrder = ["Easy", "Moderate", "Hard", "Very Hard", "Expert"];
if (isMainThread) {
  await buildLibrary();
} else {
  await generateCandidates();
}

async function buildLibrary() {
  const requestedCount = readCountArgument();
  const existing = await readLibraryWithHandmade();
  const boards = [...existing.boards];
  const counts = countByDifficulty(boards);
  const outstanding = () => difficultyOrder.some((label) => counts[label] < requestedCount);

  if (!outstanding()) {
    console.log(`Library already has at least ${requestedCount} boards in every difficulty.`);
    return;
  }

  const workerCount = Math.max(1, Math.min(4, cpus().length));
  const workers = [];
  let attempts = 0;
  let shuttingDown = false;
  let messageQueue = Promise.resolve();

  console.log(`Generating up to ${requestedCount} boards per difficulty with ${workerCount} workers.`);
  printCounts(counts, requestedCount);

  await new Promise((resolvePromise, rejectPromise) => {
    async function handleMessage(message) {
      if (message.type === "attempt") {
        attempts += message.count;
        if (attempts % 40 === 0) console.log(`${attempts} candidates checked…`);
        return;
      }
      if (message.type !== "candidate" || shuttingDown) return;

      const { candidate } = message;
      const label = candidate.difficulty.label;
      if (!difficultyOrder.includes(label) || counts[label] >= requestedCount) return;

      const ordinal = counts[label] + 1;
      candidate.puzzle.id = makeLibraryId(label, ordinal, candidate.seed);
      candidate.puzzle.title = `${label} ${String(ordinal).padStart(2, "0")}`;
      delete candidate.seed;
      boards.push(candidate);
      counts[label] += 1;
      await writeLibrary({ version: 1, boards });
      console.log(`Saved ${candidate.puzzle.title} (${boards.length} total boards).`);
      printCounts(counts, requestedCount);

      if (!outstanding()) {
        shuttingDown = true;
        await Promise.all(workers.map((activeWorker) => activeWorker.terminate()));
        resolvePromise();
      }
    }

    for (let index = 0; index < workerCount; index += 1) {
      const worker = new Worker(new URL(import.meta.url), {
        workerData: { workerIndex: index, workerCount },
      });
      workers.push(worker);

      worker.on("message", (message) => {
        messageQueue = messageQueue.then(() => handleMessage(message)).catch(rejectPromise);
      });
      worker.on("error", rejectPromise);
      worker.on("exit", (code) => {
        if (!shuttingDown && code !== 0) rejectPromise(new Error(`Generator worker exited with code ${code}.`));
      });
    }
  });

  await writeLibrary({ version: 1, boards });
  console.log(`Done. Saved ${boards.length} calculable boards after checking ${attempts} candidates.`);
}

async function generateCandidates() {
  await import("../src/game/engine.js");
  await import("../src/game/hints/core.js");
  await import("../src/game/hints/strategies-basic.js");
  await import("../src/game/hints/strategies-advanced.js");
  await import("../src/game/hints/difficulty.js");
  await import("../src/game/hints/registry.js");

  let batchAttempts = 0;
  for (let index = workerData.workerIndex; ; index += workerData.workerCount) {
    const seed = `library-9-${index}`;
    try {
      const generated = globalThis.StarsRemixEngine.generatePuzzle({
        size: 9,
        seed,
        maxAttempts: 2_000,
      });
      const report = await globalThis.StarsRemixHints.analyzeDifficulty(generated.puzzle);
      if (!report.solved || report.label === "Incalculable") continue;

      parentPort.postMessage({
        type: "candidate",
        candidate: {
          seed,
          puzzle: generated.puzzle,
          solution: generated.solution,
          difficulty: {
            label: report.label,
            score: report.score,
            bigTicketCount: report.bigTicketCount,
            logicalSteps: report.steps.length,
          },
        },
      });
    } catch {
      // Generation failures are expected and are simply discarded.
    } finally {
      batchAttempts += 1;
      if (batchAttempts >= 10) {
        parentPort.postMessage({ type: "attempt", count: batchAttempts });
        batchAttempts = 0;
      }
    }
  }
}

function readCountArgument() {
  const countFlag = process.argv.find((argument) => argument.startsWith("--count="));
  const count = Number(countFlag?.split("=")[1] ?? 20);
  if (!Number.isInteger(count) || count < 1) throw new Error("--count must be a positive integer.");
  return count;
}

function countByDifficulty(boards) {
  return Object.fromEntries(difficultyOrder.map((label) => [
    label,
    boards.filter((board) => board.difficulty?.label === label).length,
  ]));
}

function makeLibraryId(label, ordinal, seed) {
  return `library-${label.toLowerCase().replaceAll(" ", "-")}-${String(ordinal).padStart(3, "0")}-${seed.replace("library-9-", "")}`;
}

function printCounts(counts, target) {
  console.log(difficultyOrder.map((label) => `${label}: ${counts[label]}/${target}`).join(" · "));
}
