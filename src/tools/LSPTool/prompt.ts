export const LSP_TOOL_NAME = 'LSP' as const

export const DESCRIPTION = `Interact with Language Server Protocol (LSP) servers to get code intelligence features.

Supported operations:
- goToDefinition: Find where a symbol is defined
- findReferences: Find all references to a symbol
- hover: Get hover information (documentation, type info) for a symbol
- documentSymbol: Get all symbols (functions, classes, variables) in a document
- workspaceSymbol: Search for symbols across the entire workspace
- goToImplementation: Find implementations of an interface or abstract method
- prepareCallHierarchy: Get call hierarchy item at a position (functions/methods)
- incomingCalls: Find all functions/methods that call the function at a position
- outgoingCalls: Find all functions/methods called by the function at a position

All operations require:
- filePath: The file to operate on
- line: The line number (1-based, as shown in editors)
- character: The character offset (1-based, as shown in editors)

Note: LSP servers must be configured for the file type. If no server is available, an error will be returned.

DSXU weak-model discipline:
- When to use: use LSP for symbol-aware questions such as definitions, references, hover/type info, document symbols, workspace symbols, diagnostics, implementations, and call hierarchy.
- When not to use: do not use LSP for raw text search, file discovery, broad repository scans, or edits. Use Grep/Glob/Read/Edit for those.
- Recovery after failure: if no server is available or a symbol lookup fails, fall back to Grep/Glob/Read and explicitly say the evidence is source-inspection fallback.
- Weak-model anti-pattern: do not hallucinate line numbers, definitions, or diagnostics from a failed LSP response. Verify with source text before reporting.
- Verification / evidence: cite LSP operation, file path, line/character, and follow with Read when you need exact code text for an edit or user-facing claim.`

export const DSXU_LSP_TOOL_DISCIPLINE = `
DSXU weak-model discipline:
- When to use: use LSP for symbol-aware questions such as definitions, references, hover/type info, document symbols, workspace symbols, diagnostics, implementations, and call hierarchy.
- When not to use: do not use LSP for raw text search, file discovery, broad repository scans, or edits. Use Grep/Glob/Read/Edit for those.
- Recovery after failure: if no server is available or a symbol lookup fails, fall back to Grep/Glob/Read and explicitly say the evidence is source-inspection fallback.
- Weak-model anti-pattern: do not hallucinate line numbers, definitions, or diagnostics from a failed LSP response. Verify with source text before reporting.
- Verification / evidence: cite LSP operation, file path, line/character, and follow with Read when you need exact code text for an edit or user-facing claim.`

export const PROMPT = `${DESCRIPTION}

${DSXU_LSP_TOOL_DISCIPLINE}`
