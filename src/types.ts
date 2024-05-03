export interface INamespace {
  name: string;
  extraction_policies: IExtractionPolicy[];
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
  parent_id?: string;
  namespace: string;
  name: string;
  mime_type: string;
  labels: Record<string, string>;
  storage_url: string;
  created_at: number;
  source: string;
  size: number;
}
export interface IContentMetadata extends IBaseContentMetadata {
  content_url: string;
}

export interface IExtractedMetadata {
  id: string;
  content_id: string;
  metadata: object[];
  extractor_name: string;
}

export interface IExtractionPolicy {
  id?: string;
  extractor: string;
  name: string;
  labels_eq?: string;
  input_params?: Record<string, string | number>;
  content_source?: string;
}

export interface ITask {
  content_metadata: IContentMetadata;
  extractor: string;
  extraction_policy: string;
  extraction_policy_id: string;
  id: string;
  input_params: Record<string, string>;
  outcome: string;
  output_index_table_mapping: {
    embedding: string;
  };
  repository: string;
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
  features: IFeature[]
  content: IContentResp[]
}

export interface ISearchIndexResponse {
  content_id: string;
  text: string;
  confidence_score: number;
  labels: Record<string, string>;
}

export interface IAddExtractorPolicyResponse {
  index_names: string[];
}

export interface IMtlsConfig {
  certPath: string;
  keyPath: string;
  caPath?: string; // Optional, only if using a custom CA
}

