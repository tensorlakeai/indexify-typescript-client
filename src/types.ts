export interface INamespace {
  name: string;
  extraction_graphs: IExtractionGraph[];
}

export interface IEmbeddingSchema {
  distance: string;
  dim: number;
}

export interface IExtractorSchema {
  outputs: { [key: string]: IEmbeddingSchema | { [key: string]: any } };
}

export interface IExtractor {
  name: string;
  input_mime_types: string[];
  description: string;
  input_params: { [key: string]: any };
  outputs: IExtractorSchema;
}

export interface ISchema {
  columns: Record<string, string | number | boolean>;
  content_source: string;
  namespace: string;
}
export interface IIndex {
  name: string;
  schema: Record<string, string | number | boolean>;
}

export interface IBaseContentMetadata {
  id: string;
  parent_id: string;
  root_content_id: string;
  namespace: string;
  name: string;
  mime_type: string;
  labels: Record<string, string>;
  storage_url: string;
  created_at: number;
  source: string;
  size: number;
  hash: string;
  extraction_graph_names: string[];
}

export interface IContentMetadata extends IBaseContentMetadata {
  content_url: string;
}

export interface IExtractedMetadata {
  id: string;
  content_id: string;
  metadata: { [key: string]: any };
  extractor_name: string;
}

export interface IExtractionGraph {
  id: string;
  name: string;
  namespace: string;
  extraction_policies: IExtractionPolicy[];
}

export interface IExtractionPolicy {
  id?: string;
  extractor: string;
  name: string;
  labels_eq?: string;
  input_params?: Record<string, string | number>;
  content_source?: string;
  graph_name: string;
}

export interface ITaskContentMetadata {
  id: string;
  parent_id: string;
  root_content_id: string;
  namespace: string;
  name: string;
  content_type: string;
  labels: Record<string, string>;
  storage_url: string;
  created_at: number;
  source: string;
  size_bytes: number;
  tombstoned: boolean;
  hash: string;
  extraction_policy_ids: Record<string, number>;
}

export interface ITask {
  id: string;
  extractor: string;
  extraction_policy_id: string;
  output_index_table_mapping: Record<string, string>;
  namespace: string;
  content_metadata: ITaskContentMetadata;
  input_params: { [key: string]: any };
  outcome: string;
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
  data: { [key: string]: any };
}

export interface IContent {
  content_type: string;
  bytes: string | number[];
  features?: IFeature[];
  labels?: Record<string, string>;
}

export interface IContentResp {
  content_type: string;
  bytes: number[];
  features?: IFeature[];
  labels?: Record<string, string>;
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
