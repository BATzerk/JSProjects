(function (global) {
  const LEGACY_FORMAT = "stars-remix-board";
  const MAX_INPUT_LENGTH = 100_000;

  function serializeSnapshot(snapshot) {
    return getFormat("SR2").encode(snapshot);
  }

  function deserializeSnapshot(text) {
    if (typeof text !== "string" || text.length > MAX_INPUT_LENGTH) {
      throw new Error("That board file is too large or invalid.");
    }
    const trimmed = text.trimStart();
    if (trimmed.startsWith("{")) return deserializeLegacyBoard(text);
    const prefix = trimmed.split(".", 1)[0];
    return getFormat(prefix).decode(text);
  }

  // Compatibility aliases for callers that have not moved to snapshots yet.
  function serializeBoard({ puzzle, board, solution, difficultyReport }) {
    return serializeSnapshot(global.StarsRemixSnapshots.create({
      puzzle,
      board,
      solution,
      difficultyLabel: difficultyReport?.label ?? "Unrated",
    }));
  }

  function deserializeBoard(text) {
    const snapshot = deserializeSnapshot(text);
    return {
      puzzle: snapshot.puzzle,
      board: snapshot.progress.board,
      solution: snapshot.solution,
      difficultyReport: null,
      difficultyLabel: snapshot.difficulty.label,
    };
  }

  function getFormat(prefix) {
    const format = global.StarsRemixSerializationFormats?.[prefix];
    if (!format) throw new Error("That is not a supported Stars Remix board file.");
    return format;
  }

  function deserializeLegacyBoard(text) {
    let saved;
    try { saved = JSON.parse(text); }
    catch { throw new Error("That file is not valid JSON."); }
    if (!saved || saved.format !== LEGACY_FORMAT || saved.version !== 1) {
      throw new Error("That is not a supported Stars Remix board file.");
    }
    const difficultyLabel = saved.difficulty?.status === "unrated"
      ? "Unrated"
      : saved.difficulty?.report?.label;
    return global.StarsRemixSnapshots.create({
      puzzle: saved.puzzle,
      board: saved.board,
      solution: saved.solution,
      difficultyLabel,
    });
  }

  global.StarsRemixSerialization = {
    serializeSnapshot,
    deserializeSnapshot,
    serializeBoard,
    deserializeBoard,
  };
})(globalThis);
