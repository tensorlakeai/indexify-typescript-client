import ExtractionGraph from "./ExtractionGraph";

interface IBase {
  id: string;
  namespace: string;
}

interface IMetadata extends IBase {
  name: string;
  labels: Record<string, string>;
  created_at: number;
}

export interface INamespace {
  name: string;
  extraction_graphs: ExtractionGraph[];
}

export interface IEmbeddingSchema {
  distance: string;
  dim: number;
}

export interface IExtractorSchema {
  outputs: Record<string, IEmbeddingSchema | Record<string, any>>;
}

export interface IExtractor {
  name: string;
  input_mime_types: string[];
  description: string;
  input_params: Record<string, any>;
  outputs: IExtractorSchema;
}

export interface ISchema extends IBase {
  extraction_graph_name: string;
  columns: Record<
    string,
    {
      type: string;
      comment?: string;
    }
  >;
}

export interface IIndex {
  name: string;
  schema: Record<string, string | number | boolean>;
}

export interface IBaseContentMetadata extends IMetadata {
  parent_id: string;
  ingested_content_id: string;
  mime_type: string;
  storage_url: string;
  source: string;
  size: number;
  hash: string;
  extraction_graph_names: string[];
}

export interface IContentMetadata extends IBaseContentMetadata {
  content_url: string;
}

export interface IExtractedMetadata extends IBase {
  content_id: string;
  metadata: Record<string, any>;
  extractor_name: string;
}

export interface IExtractionPolicy {
  id?: string;
  extractor: string;
  name: string;
  labels_eq?: string;
  input_params?: Record<string, string | number>;
  content_source?: string;
  graph_name?: string;
}

export interface ITaskContentMetadata extends IMetadata {
  parent_id: string;
  root_content_id: string;
  content_type: string;
  storage_url: string;
  source: string;
  size_bytes: number;
  tombstoned: boolean;
  hash: string;
  extraction_policy_ids: Record<string, number>;
}

export enum TaskStatus {
  Unknown = 0,
  Failure = 1,
  Success = 2,
}

export interface ITask extends IBase {
  extractor: string;
  extraction_policy_id: string;
  output_index_table_mapping: Record<string, string>;
  content_metadata: ITaskContentMetadata;
  input_params: Record<string, any>;
  outcome: TaskStatus;
  index_tables: string[];
}

export interface IDocument {
  text: string;
  labels: Record<string, string>;
  id?: string;
}

export interface IFeature {
  feature_type: "embedding" | "metadata" | "unknown";
  name: string;
  data: Record<string, any>;
}

export interface IContent {
  content_type: string;
  bytes: string | number[];
  features?: IFeature[];
  labels?: Record<string, string>;
}

export interface IContentResp extends Omit<IContent, 'bytes'> {
  bytes: number[];
}

export interface IExtractResponse {
  features: IFeature[];
  content: IContentResp[];
}

export interface ISearchIndexResponse {
  content_id: string;
  text: string;
  confidence_score: number;
  labels: Record<string, string>;
  content_metadata: IContentMetadata;
  root_content_metadata?: IContentMetadata;
}

export interface IAddExtractorGraphResponse {
  indexes: string[];
}

export interface IMtlsConfig {
  certPath: string;
  keyPath: string;
  caPath?: string; // Optional, only if using a custom CA
}

export interface StateChange extends IBase {
  change_type: string;
  created_at: number;
  processed_at: number;
  refcnt_object_id: string | null;
}

export interface ExtractionPolicyStatus {
  pending: number;
  success: number;
  failure: number;
}

export interface ExtractionGraphAnalytics {
  task_analytics: {
    [policyName: string]: ExtractionPolicyStatus;
  };
}
