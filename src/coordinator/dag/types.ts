/**
 * R5-12v2 mini-graph DAG — 类型定义
 */

export type NodeKind = 'planner' | 'executor' | 'critic' | 'verifier' | 'voter' | 'reducer' | 'custom';

export interface DagNode {
  id: string;
  kind: NodeKind;
  deps: string[];           // 前置节点 id
  config?: any;
  retryPolicy: { max: number; backoffMs: number };
  timeoutMs: number;
  onFailure: 'abort' | 'continue' | 'fallback';
}

export interface DagSpec {
  nodes: DagNode[];
  entry: string;   // 入口节点 id
  exit: string;    // 出口节点 id
}

export interface NodeResult {
  nodeId: string;
  status: 'success' | 'failed' | 'timeout' | 'skipped';
  output?: any;
  error?: string;
  durationMs: number;
  retries: number;
}

export interface DagRunResult {
  status: 'success' | 'partial' | 'failed';
  nodeResults: Record<string, NodeResult>;
  failedNodes: string[];
  durationMs: number;
}

export interface DagRunConfig {
  /** Mock node executor for G4 testing */
  mockNodeExecutor?: (node: DagNode, inputs: Record<string, any>) => Promise<any>;
}
