import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";
import Extractor from "./extractor";
import {
  IContentMetadata,
  IExtractor,
  IIndex,
  INamespace,
  ITask,
  IAddExtractorGraphResponse,
  IDocument,
  ISearchIndexResponse,
  IBaseContentMetadata,
  ISchema,
  IMtlsConfig,
  IContent,
  IExtractResponse,
  IExtractedMetadata,
  ExtractionGraphAnalytics,
} from "./types";
import { v4 as uuidv4 } from "uuid";
import CryptoJS from "crypto-js";
import ExtractionGraph from "./ExtractionGraph";

const DEFAULT_SERVICE_URL = "http://localhost:8900";

class IndexifyClient {
  private client: AxiosInstance;
  private extractionGraphs: ExtractionGraph[];

  constructor(
    public serviceUrl: string = DEFAULT_SERVICE_URL,
    public namespace: string = "default",
    extractionGraphs: ExtractionGraph[],
    httpsAgent?: any
  ) {
    this.extractionGraphs = extractionGraphs;
    this.client = axios.create({
      baseURL: `${serviceUrl}/namespaces/${namespace}`,
      httpsAgent,
    });
  }

  static async createClient({
    serviceUrl = DEFAULT_SERVICE_URL,
    namespace = "default",
    mtlsConfig,
  }: {
    serviceUrl?: string;
    namespace?: string;
    mtlsConfig?: IMtlsConfig;
  } = {}): Promise<IndexifyClient> {
    return new IndexifyClient(
      serviceUrl,
      namespace,
      [],
      IndexifyClient.getHttpsAgent({ mtlsConfig })
    );
  }

  private async request(
    method: string,
    endpoint: string,
    options: any = {}
  ): Promise<AxiosResponse> {
    try {
      return await this.client.request({
        method,
        url: `${this.serviceUrl}/${endpoint}`,
        ...options,
      });
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error(`Error: ${error.message}`);
      }
      throw error;
    }
  }

  private baseContentToContentMetadata(
    content: IBaseContentMetadata
  ): IContentMetadata {
    const content_url = content.storage_url.startsWith("http")
      ? content.storage_url
      : `${this.serviceUrl}/namespaces/${this.namespace}/content/${content.id}/download`;
    return { ...content, content_url };
  }

  static getHttpsAgent({ mtlsConfig }: { mtlsConfig?: IMtlsConfig }): any | undefined {
    if (!mtlsConfig) return undefined;
    if (typeof window !== "undefined") {
      throw new Error("mTLS support is not available in browser environments.");
    }
    const fs = require("fs");
    const { Agent } = require("https");
    return new Agent({
      cert: fs.readFileSync(mtlsConfig.certPath),
      key: fs.readFileSync(mtlsConfig.keyPath),
      ...(mtlsConfig.caPath && { ca: fs.readFileSync(mtlsConfig.caPath) }),
      rejectUnauthorized: true,
    });
  }

  async get(endpoint: string): Promise<AxiosResponse> {
    return this.request("GET", endpoint);
  }

  async post(endpoint: string, data?: any): Promise<AxiosResponse> {
    return this.request("POST", endpoint, { data });
  }

  async delete(endpoint: string, headers?: Record<string, string>): Promise<AxiosResponse> {
    return this.request("DELETE", endpoint, { headers });
  }

  async put(endpoint: string, data: any, config?: AxiosRequestConfig): Promise<AxiosResponse> {
    return this.request("PUT", endpoint, { ...config, data });
  }

  static async namespaces({
    serviceUrl = DEFAULT_SERVICE_URL,
    mtlsConfig,
  }: {
    serviceUrl?: string;
    mtlsConfig?: IMtlsConfig;
  } = {}): Promise<INamespace[]> {
    const response = await axios.get(`${serviceUrl}/namespaces`, {
      httpsAgent: IndexifyClient.getHttpsAgent({ mtlsConfig }),
    });
    return response.data.namespaces;
  }

  static async createNamespace({
    name,
    extractionGraphs,
    labels,
    mtlsConfig,
  }: {
    name: string;
    extractionGraphs?: ExtractionGraph[];
    labels?: Record<string, string>;
    mtlsConfig?: IMtlsConfig;
  }) {
    await axios.post(
      `${DEFAULT_SERVICE_URL}/namespaces`,
      {
        name,
        extraction_graphs: extractionGraphs ?? [],
        labels: labels ?? {},
      },
      { httpsAgent: IndexifyClient.getHttpsAgent({ mtlsConfig }) }
    );
    return IndexifyClient.createClient({ namespace: name });
  }

  async indexes(): Promise<IIndex[]> {
    const resp = await this.client.get("indexes");
    return resp.data.indexes;
  }

  async extractors(): Promise<Extractor[]> {
    const response = await this.client.get(`${this.serviceUrl}/extractors`);
    return (response.data.extractors as IExtractor[]).map((data) => new Extractor(data));
  }

  async searchIndex(
    name: string,
    query: string,
    topK: number,
    filters?: string[],
    include_content: boolean = true
  ): Promise<ISearchIndexResponse[]> {
    const resp = await this.client.post(`/indexes/${name}/search`, {
      query,
      k: topK,
      ...(filters !== undefined && { filters }),
      include_content,
    });
    return resp.data["results"];
  }

  async createExtractionGraph(
    extractionGraph: ExtractionGraph
  ): Promise<IAddExtractorGraphResponse> {
    const data = {
      name: extractionGraph.name,
      extraction_policies: extractionGraph.extraction_policies,
    };
    const resp = await this.client.post("extraction_graphs", data);
    await this.getExtractionGraphs();
    return resp.data;
  }

  async getExtractedContent({
    contentId,
    graphName,
    policyName,
    blocking = false
  }: {
    contentId: string;
    graphName: string;
    policyName: string;
    blocking?: boolean;
  }): Promise<{ contentList: IContentMetadata[]; total?: number }> {
    if (blocking) {
      await this.waitForExtraction(contentId);
    }

    const response = await this.client.get(
      `/extraction_graphs/${graphName}/extraction_policies/${policyName}/content/${contentId}`,
    );

    const contentList: IContentMetadata[] = response.data.content_tree_metadata
      .filter((item: any) => item.extraction_graph_names.includes(graphName) && item.source === policyName)
      .map((item: any) => this.baseContentToContentMetadata({
        id: item.id,
        parent_id: item.parent_id,
        ingested_content_id: contentId,
        namespace: item.namespace,
        name: item.name,
        mime_type: item.mime_type,
        labels: item.labels,
        storage_url: item.storage_url,
        created_at: item.created_at,
        source: item.source,
        size: item.size,
        hash: item.hash,
        extraction_graph_names: item.extraction_graph_names,
      }));

    return { contentList };
  }

  async getExtractionPolicyContent({
    contentId,
    graphName,
    policyName,
  }: {
    contentId: string;
    graphName: string;
    policyName: string;
  }): Promise<IContentMetadata[]> {
    const response = await this.client.get(
      `extraction_graphs/${graphName}/content/${contentId}/extraction_policies/${policyName}`,
    );

    return response.data.content_tree_metadata
      .filter((item: IContentMetadata) => 
        item.extraction_graph_names.includes(graphName) && item.source === policyName
      )
      .map((item: IContentMetadata) => ({
        id: item.id,
        parent_id: item.parent_id,
        ingested_content_id: contentId,
        namespace: item.namespace,
        name: item.name,
        mime_type: item.mime_type,
        labels: item.labels,
        storage_url: item.storage_url,
        created_at: item.created_at,
        source: item.source,
        size: item.size,
        hash: item.hash,
        extraction_graph_names: item.extraction_graph_names,
      }));
  }

  async addDocuments(
    extractionGraphs: string | string[],
    documents: IDocument | string | (IDocument | string)[],
    docId?: string
  ): Promise<string[]> {
    const extractionGraphsArray = Array.isArray(extractionGraphs) ? extractionGraphs : [extractionGraphs];
    const documentsArray = Array.isArray(documents) ? documents : [documents];

    const processedDocuments = documentsArray.map(doc => {
      const processedDoc = typeof doc === 'string' ? { text: doc, labels: {}, id: docId } : doc;
      processedDoc.labels['mime_type'] = 'text/plain';
      return processedDoc;
    });

    const contentIds: string[] = [];

    for (const extractionGraph of extractionGraphsArray) {
      for (const document of processedDocuments) {
        const formData = new FormData();
        formData.append('file', new Blob([document.text], { type: 'text/plain' }), 'document.txt');
        formData.append('labels', JSON.stringify(document.labels));

        const response = await this.client.post(
          `namespaces/${this.namespace}/extraction_graphs/${extractionGraph}/extract`,
          formData,
          {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
          }
        );

        contentIds.push(response.data.content_id);
      }
    }

    return contentIds;
  }

  async getContentMetadata(id: string): Promise<IContentMetadata> {
    const resp = await this.client.get(`content/${id}/metadata`);
    return this.baseContentToContentMetadata(resp.data.content_metadata);
  }

  async getStructuredMetadata(id: string): Promise<IExtractedMetadata[]> {
    const resp = await this.client.get(`content/${id}/metadata`);
    return resp.data.metadata;
  }

  async downloadContent<T>(id: string): Promise<T> {
    try {
      const response = await this.client.get(`content/${id}/download`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to download content ${id}: ${error}`);
    }
  }

  async getTasks(
    extractionGraph: string,
    extractionPolicy: string,
    params?: {
      namespace: string;
      extractionGraph: string;
      extractionPolicy: string;
      contentId?: string;
      outcome?: string;
      startId?: string;
      limit?: number;
      returnTotal?: boolean;
    }
  ): Promise<{ tasks: ITask[], totalTasks?: number }> {
    const defaultParams = {
      namespace: this.namespace,
      extraction_graph: extractionGraph,
      extraction_policy: extractionPolicy,
      return_total: false,
    };

    const mergedParams = {
      ...defaultParams,
      ...params,
      namespace: params?.namespace || this.namespace,
      extraction_graph: params?.extractionGraph || extractionGraph,
      extraction_policy: params?.extractionPolicy || extractionPolicy,
      content_id: params?.contentId,
      start_id: params?.startId,
    };

    const response = await this.client.get(
      `/extraction_graphs/${mergedParams.extraction_graph}/extraction_policies/${mergedParams.extraction_policy}/tasks`,
      { params: mergedParams }
    );

    return {
      tasks: response.data.tasks,
      totalTasks: mergedParams.return_total ? response.data.total : undefined
    };
  }

  async getSchemas(): Promise<ISchema[]> {
    const resp = await this.client.get("schemas");
    return resp.data.schemas;
  }

  async uploadFile(
    extractionGraphNames: string | string[],
    fileInput: string | Blob,
    labels: Record<string, any> = {},
    newContentId?: string
  ): Promise<string> {
    const isNodeEnv = typeof window === "undefined";
    const extractionGraphNamesArray = Array.isArray(extractionGraphNames) ? extractionGraphNames : [extractionGraphNames];
    
    let contentId: string | undefined;

    for (const extractionGraph of extractionGraphNamesArray) {
      let formData: any;
      
      if (isNodeEnv) {
        if (typeof fileInput !== "string") {
          throw Error("Expected string for file path in Node environment");
        }
        const fs = require("fs");
        const FormData = require("form-data");
        formData = new FormData();
        formData.append("labels", JSON.stringify(labels));
        formData.append("file", fs.createReadStream(fileInput));
      } else {
        if (!(fileInput instanceof Blob)) {
          throw Error("Expected Blob in browser environment");
        }
        formData = new FormData();
        formData.append("labels", JSON.stringify(labels));
        formData.append("file", fileInput);
      }

      const response = await this.client.post(
        `/extraction_graphs/${extractionGraph}/extract`,
        formData,
        {
          params: { id: newContentId },
          headers: { 
            "Content-Type": "multipart/form-data",
            "accept": "*/*"
          }
        }
      );

      contentId = response.data.content_id || newContentId;

      if (contentId) {
        return contentId;
      }

    }

    throw new Error("No content ID was retrieved from the extraction process");
  }

  async getExtractionGraphs(): Promise<ExtractionGraph[]> {
    const response = await this.client.get(`/extraction_graphs`);
    return response.data.extraction_graphs ?? [];
  }

  async extract({
    name,
    input_params,
    content: { content_type, bytes, features = [], labels = {} },
  }: {
    name: string;
    input_params?: Record<string, string | number>;
    content: IContent;
  }): Promise<IExtractResponse> {
    const resp = await this.client.post(
      `${DEFAULT_SERVICE_URL}/extractors/extract`,
      {
        name,
        content: {
          content_type,
          bytes,
          features,
          labels,
        },
        input_params: JSON.stringify(input_params),
      }
    );

    return resp.data;
  }

  async getExtractionGraphAnalytics({
    namespace,
    extractionGraph,
  }: {
    namespace: string;
    extractionGraph: string;
  }): Promise<ExtractionGraphAnalytics> {
    const response = await this.client.get(
      `/extraction_graphs/${extractionGraph}/analytics`
    );

    return response.data;
  }

  async waitForExtraction(contentIds: string | string[]): Promise<void> {
    const ids = Array.isArray(contentIds) ? contentIds : [contentIds];
    
    console.log("Waiting for extraction to complete for content id: ", ids.join(","));

    for (const contentId of ids) {
      try {
        const response = await this.client.get(
          `/content/${contentId}/wait`
        );
        
        console.log("Extraction completed for content id: ", contentId);
        if (response.status >= 400) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
      } catch (error) {
        console.error(`Error waiting for extraction of content id ${contentId}:`, error);
        throw error;
      }
    }
  }

  async ingestRemoteFile(
    url: string,
    mime_type: string,
    labels: Record<string, string>,
    extractionGraphNames: string | string[],
    id?: string
  ): Promise<AxiosResponse> {
    const extractionGraphNamesArray = Array.isArray(extractionGraphNames)
      ? extractionGraphNames
      : [extractionGraphNames];
    return this.client.post("ingest_remote_file", {
      url,
      mime_type,
      labels,
      extraction_graph_names: extractionGraphNamesArray,
      id,
    });
  }

  generateUniqueHexId(): string {
    return uuidv4().replace(/-/g, "").substring(0, 16);
  }

  generateHashFromString(inputString: string): string {
    return CryptoJS.SHA256(inputString).toString(CryptoJS.enc.Hex).substring(0, 16);
  }

  async deleteContent(namespace: string, contentId: string): Promise<void> {
    await this.delete(`namespaces/${namespace}/content/${contentId}`, {
      "Content-Type": "application/json"
    });
  }

  async updateLabels(documentId: string, labels: Record<string, string>): Promise<void> {
    await this.client.put(
      `namespaces/${this.namespace}/content/${documentId}/labels`,
      { labels },
      { headers: { "Content-Type": "application/json" } }
    );
  }

  async updateContent(documentId: string, path: string): Promise<void> {
    const fs = require("fs");
    const formData = new FormData();
    formData.append("file", fs.createReadStream(path));
    await this.put(
      `namespaces/${this.namespace}/content/${documentId}`,
      formData,
      { headers: { "Content-Type": "multipart/form-data" } }
    );
  }

  async listContent(
    extractionGraph: string,
    namespace?: string,
    params?: {
      namespace: string;
      extractionGraph: string;
      source?: string;
      ingestedContentId?: string;
      parentId?: string;
      labelsFilter?: string[];
      startId?: string;
      limit?: number;
      returnTotal?: boolean;
    }
  ): Promise<{ contentList: IContentMetadata[]; total?: number }> {
    const defaultParams = {
      namespace: namespace || this.namespace,
      extraction_graph: extractionGraph,
      return_total: false,
    };

    const mergedParams = {
      ...defaultParams,
      ...params,
      namespace: params?.namespace || namespace || this.namespace,
      extraction_graph: params?.extractionGraph || extractionGraph,
      labels_filter: params?.labelsFilter,
      ingested_content_id: params?.ingestedContentId,
      parent_id: params?.parentId,
      start_id: params?.startId,
    };

    const response = await this.client.get(
      `extraction_graphs/${mergedParams.extraction_graph}/content`, 
      { params: mergedParams }
    );
    
    const contentList = response.data.content_list.map((item: IBaseContentMetadata) =>
      this.baseContentToContentMetadata(item)
    );

    return { 
      contentList, 
      total: mergedParams.return_total ? response.data.total : undefined 
    };
  }

  async sqlQuery(query: string): Promise<any> {
    const response = await this.client.post(
      `namespaces/${this.namespace}/sql_query`,
      { query },
      { headers: { "Content-Type": "application/json" } }
    );
    return response.data.rows.map((row: any) => row.data);
  }

  async linkExtractionGraphs(
    sourceGraph: string,
    contentSource: string,
    linkedGraph: string
  ): Promise<void> {
    await this.client.post(
      `namespaces/${this.namespace}/extraction_graphs/${sourceGraph}/links`,
      {
        content_source: contentSource,
        linked_graph_name: linkedGraph,
      },
      { headers: { "Content-Type": "application/json" } }
    );
  }
}

export default IndexifyClient;
