(function (global) {
  function createGameState({ puzzle, solution, board, difficultyReport = null }) {
    return {
      puzzle,
      solution,
      progress: { board },
      analysis: { difficultyReport },
    };
  }

  function replaceGame(_state, { puzzle, solution, board }) {
    return createGameState({ puzzle, solution, board });
  }

  function updateBoard(state, board) {
    if (state.progress.board === board) return state;
    return { ...state, progress: { ...state.progress, board } };
  }

  function setDifficultyReport(state, difficultyReport) {
    if (state.analysis.difficultyReport === difficultyReport) return state;
    return { ...state, analysis: { ...state.analysis, difficultyReport } };
  }

  global.StarsRemixState = {
    createGameState,
    replaceGame,
    updateBoard,
    setDifficultyReport,
  };
})(globalThis);
