export interface ComputeFn {
  name: string;
  fn_name: string;
  description: string;
}

export interface DynamicRouter {
  name: string;
  source_fn: string;
  description: string;
  target_fns: string[];
}

export type Node = 
  | { dynamic_router: DynamicRouter }
  | { compute_fn: ComputeFn };

export interface ComputeGraph {
  name: string;
  namespace: string;
  description: string;
  start_node: Node;
  edges: Record<string, Node[]>;
  created_at?: number;
}

export interface ComputeGraphCreateType {
  compute_graph: ComputeGraph;
  code: string; // This will be a file in the actual request
}

export interface ComputeGraphsList {
  compute_graphs: ComputeGraph[];
  cursor?: string | null;
}

export interface CreateNamespace {
  name: string;
}

export interface DataObject {
  id: string;
  payload: any;
  payload_size: number;
  payload_sha_256: string;
}

export interface GraphInvocations {
  invocations: DataObject[];
  cursor?: string | null;
}

export interface IndexifyAPIError {
  status_code: number; // Assuming StatusCode is a number
  message: string;
}

export interface InvocationResult {
  outputs: Record<string, DataObject[]>;
  cursor?: string | null;
}

export interface Namespace {
  name: string;
  created_at: number;
}

export interface NamespaceList {
  namespaces: Namespace[];
}

export type TaskOutcome = "Unknown" | "Success" | "Failure";

export interface Task {
  id: string;
  status: TaskOutcome;
  created_at: number;
  updated_at: number;
}

export interface Tasks {
  tasks: Task[];
  cursor?: string | null;
}

// Additional types that were used in the IndexifyClient but not explicitly defined in the OpenAPI spec

export interface IMtlsConfig {
  certPath: string;
  keyPath: string;
  caPath?: string;
}

export interface IDocument {
  text: string;
  labels: Record<string, string>;
  id?: string;
}

export interface IContentMetadata {
  id: string;
  parent_id?: string;
  ingested_content_id: string;
  namespace: string;
  name: string;
  mime_type: string;
  labels: Record<string, string>;
  storage_url: string;
  content_url: string;
  created_at: number;
  source: string;
  size: number;
  hash: string;
  extraction_graph_names: string[];
}
