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
  description: string;
  input_params: { [key: string]: any };
  outputs: IExtractorSchema;
}

export interface IIndex {
  name: string;
  schema: Record<string, string | number>;
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
