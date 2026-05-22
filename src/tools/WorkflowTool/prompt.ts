export const DESCRIPTION =
  'Compile DSXU workflow markdown into a runtime plan and executable prompt'

export const PROMPT = `Use this tool when the user asks to run a named workflow or when a repeatable DSXU workflow clearly matches the task.

Workflows are markdown files discovered from DSXU config locations, primarily .dsxu/workflows with archived workflow directories as a compatibility source. The tool supports:
- action=list to discover available workflows.
- action=plan to compile the selected workflow into a structured runtime plan with argument status, allowed tools, and extracted steps.
- action=render to return the full executable workflow prompt.

WorkflowTool does not directly edit files or run shell commands. It compiles the route; the DSXU main loop executes the route with normal tools such as Read, Edit, Bash, Grep, MCP, and agents while respecting the workflow's allowed tools.

DSXU weak-model discipline:
- When to use: use Workflow for repeatable, policy-bound, or multi-phase DSXU procedures where a named workflow can constrain scope, tools, arguments, recovery, and verification.
- When not to use: do not use Workflow as a second runtime, a replacement for Read/Edit/Bash, or a way to bypass PlanMode, permissions, or normal tool evidence.
- Recovery after failure: if a workflow is missing, missing required arguments, or returns a compile error, report the exact missing field and either list available workflows or continue with a small explicit plan.
- Weak-model anti-pattern: do not invent workflow names, hidden steps, or successful execution. A rendered workflow prompt is a route contract; actual file changes and verification still need normal DSXU tools.
- Verification / evidence: after rendering or planning a workflow, execute the route with normal tools and report PASS only after the workflow's verification command or equivalent evidence succeeds.`

export const DSXU_WORKFLOW_TOOL_DISCIPLINE = `
DSXU weak-model discipline:
- When to use: use Workflow for repeatable, policy-bound, or multi-phase DSXU procedures where a named workflow can constrain scope, tools, arguments, recovery, and verification.
- When not to use: do not use Workflow as a second runtime, a replacement for Read/Edit/Bash, or a way to bypass PlanMode, permissions, or normal tool evidence.
- Recovery after failure: if a workflow is missing, missing required arguments, or returns a compile error, report the exact missing field and either list available workflows or continue with a small explicit plan.
- Weak-model anti-pattern: do not invent workflow names, hidden steps, or successful execution. A rendered workflow prompt is a route contract; actual file changes and verification still need normal DSXU tools.
- Verification / evidence: after rendering or planning a workflow, execute the route with normal tools and report PASS only after the workflow's verification command or equivalent evidence succeeds.`
