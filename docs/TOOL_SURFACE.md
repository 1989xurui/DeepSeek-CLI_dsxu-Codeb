# DSXU Tool Surface

This document defines the expected V20 public tool surface. It is a release document, not a second registry.

## Tool Owner Rule

All tools must enter:

- `src/tools.ts`
- `src/Tool.ts`
- `src/services/tools/*`
- owner-specific implementations under `src/tools/*`

No tool may create a second Query Loop, Permission Gate, MCP runtime, Agent orchestrator, or provider runtime.

## Core Tools

| Family | Examples | Owner requirement |
|---|---|---|
| File | Read, Edit, Write, MultiEdit, Glob, Grep | Must respect workspace and permission rules。 |
| Shell | Bash, PowerShell | Must pass shell permission classification。 |
| Planning | Todo, Plan, ExitPlanMode | Must project visible state, not execute hidden side effects。 |
| Agent/Task | Agent, TaskCreate, TaskStop, SendMessage, Team, Worktree | Must use mainline Agent/Task owners。 |
| MCP | List/read MCP resources, MCP tools, MCP auth | Must use `src/services/mcp/*` and Tool Gate。 |
| Browser/Remote | Browser provider, remote trigger, workflow | Must be adapter boundary with permission/evidence。 |
| Evidence | RunNativeTest, release gates, health audit | Must not become default arbitrary execution。 |

## Permission Metadata

Every side-effecting tool should expose:

- tool name and aliases
- input schema
- side effects
- workspace scope
- network scope
- permission requirement
- evidence emitted
- recovery behavior

V20 source-of-truth metadata lives on the existing `Tool` contract, not in a second registry:

- `runtimeMetadata.owner`
- `runtimeMetadata.sideEffects`
- `runtimeMetadata.permission`
- `runtimeMetadata.evidence`
- `runtimeMetadata.uiProjection`
- `summarizeToolDefinitionV20(tool, input)`

High-risk tools must make their owner visible through this contract before release signoff. Current V20 metadata coverage includes Bash, PowerShell, MCPTool, RunNativeTest, FileRead, FileEdit, FileWrite, NotebookEdit, Grep, Glob, ListMcpResources, ReadMcpResource, McpAuth, SkillTool, ConfigTool, TodoWrite, TaskCreate, TaskGet, TaskList, TaskUpdate, TaskOutput, TaskStop, Agent, SendMessage, TeamCreate, TeamDelete, EnterPlanMode, ExitPlanMode, EnterWorktree, ExitWorktree, CronCreate, CronList, CronDelete, RemoteTrigger, ToolSearch, AskUserQuestion, Brief, LSP, WebFetch, WebSearch, Workflow, CollectEvidence, SyntheticOutput, TestingPermission, and the disabled Tungsten recovery stub.

## V20 Regression Expectations

- No default allow for state-changing tools.
- No old lifecycle shim in command handlers.
- No built-in fallback pool registered as product path.
- No hidden MCP manager outside `src/services/mcp/*`.
- No local agent simulator outside mainline Agent/Task owner.
