export const DESCRIPTION =
  'Replace the contents of a specific cell in a Jupyter notebook.'
export const PROMPT = `Completely replaces the contents of a specific cell in a Jupyter notebook (.ipynb file) with new source. Jupyter notebooks are interactive documents that combine code, text, and visualizations, commonly used for data analysis and scientific computing. The notebook_path parameter must be an absolute path, not a relative path. The cell_number is 0-indexed. Use edit_mode=insert to add a new cell at the index specified by cell_number. Use edit_mode=delete to delete the cell at the index specified by cell_number.

DSXU weak-model discipline:
- When to use: edit a known notebook cell after reading enough notebook context to identify the exact cell number and intended replacement.
- When not to use: do not use NotebookEdit for plain source files, markdown files, broad notebook rewrites, local file reads, or code execution.
- Recovery after failure: if the cell number is wrong, the notebook path is relative, or the notebook structure changed, Read the notebook metadata/content again and retry once with the exact absolute path and cell number.
- Weak-model anti-pattern: do not invent cell numbers, do not rewrite unrelated cells, and do not claim notebook execution results unless a separate verification command actually ran.
- Verification / evidence: after editing, cite the notebook path, cell number, and verification command or explicit statement that notebook execution was not run.`


// V14 strict lifecycle shim: tools-NotebookEditTool-prompt
export function processToolsNotebookEditToolPromptStrictLifecycle(input) {
  void input
  const state = 'tools-NotebookEditTool-prompt-state'
  const lifecycle = 'tools-NotebookEditTool-prompt:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
  }
}

export function runToolsNotebookEditToolPromptStrict(input) {
  return processToolsNotebookEditToolPromptStrictLifecycle(input)
}
