import axios, { AxiosInstance, AxiosResponse } from "axios";
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
} from "./types";
import { v4 as uuidv4 } from "uuid";
import CryptoJS from "crypto-js";
import ExtractionGraph from "./ExtractionGraph";

const DEFAULT_SERVICE_URL = "http://localhost:8900";

class IndexifyClient {
  public serviceUrl: string;
  private client: AxiosInstance;
  public namespace: string;
  public extractionGraphs: ExtractionGraph[];

  constructor(
    serviceUrl: string = DEFAULT_SERVICE_URL,
    namespace: string = "default",
    extractionGraphs: ExtractionGraph[],
    httpsAgent?: any
  ) {
    this.serviceUrl = serviceUrl;
    this.namespace = namespace;
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
      IndexifyClient.getHttpsAgent({ mtlsConfig })
    );
  }

  private async request(
    method: string,
    endpoint: string,
    options: any = {}
  ): Promise<AxiosResponse> {
    try {
      const response = await this.client.request({
        method,
        url: `${this.serviceUrl}/${endpoint}`,
        ...options,
      });
      return response;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error(`Error: ${error.message}`);
      }
      throw error;
    }
  }

  private baseContentToContentMetadata = (
    content: IBaseContentMetadata
  ): IContentMetadata => {
    let content_url: string;

    if (content.storage_url.startsWith("http")) {
      content_url = content.storage_url;
    } else {
      content_url = `${this.serviceUrl}/namespaces/${this.namespace}/content/${content.id}/download`;
    }

    return {
      ...content,
      content_url,
    };
  };

  static getHttpsAgent({
    mtlsConfig,
  }: {
    mtlsConfig?: IMtlsConfig;
  }): any | undefined {
    let httpsAgent = undefined;
    if (mtlsConfig !== undefined) {
      if (typeof window !== "undefined") {
        throw new Error(
          "mTLS support is not available in browser environments."
        );
      }
      const fs = require("fs");
      const { Agent } = require("https");
      httpsAgent = new Agent({
        cert: fs.readFileSync(mtlsConfig.certPath),
        key: fs.readFileSync(mtlsConfig.keyPath),
        ...(mtlsConfig.caPath && { ca: fs.readFileSync(mtlsConfig.caPath) }),
        rejectUnauthorized: true,
      });
    }

    return httpsAgent;
  }

  async get(endpoint: string): Promise<AxiosResponse> {
    return this.request("GET", endpoint);
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
        name: name,
        extraction_graphs: extractionGraphs ?? [],
        labels: labels ?? {},
      },
      { httpsAgent: IndexifyClient.getHttpsAgent({ mtlsConfig }) }
    );
    const client = await IndexifyClient.createClient({ namespace: name });

    return client;
  }

  async indexes(): Promise<IIndex[]> {
    const resp = await this.client.get("indexes");
    return resp.data.indexes;
  }

  async extractors(): Promise<Extractor[]> {
    const response = await this.client.get(`${this.serviceUrl}/extractors`);
    const extractorsData = response.data.extractors as IExtractor[];
    return extractorsData.map((data) => new Extractor(data));
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

    const contentTree = response.data;
    const contentList: IContentMetadata[] = [];

    for (const item of contentTree.content_tree_metadata) {
      if (item.extraction_graph_names.includes(graphName) && item.source === policyName) {
        const baseContent: IBaseContentMetadata = {
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
        };

        const contentMetadata = this.baseContentToContentMetadata(baseContent);
        contentList.push(contentMetadata);
      }
    }

    return { contentList };
  }

  async addDocuments(
    extractionGraphs: string | string[],
    documents: IDocument | string | (IDocument | string)[],
    docId?: string
  ): Promise<string[]> {
    let extractionGraphsArray: string[];
    if (typeof extractionGraphs === 'string') {
      extractionGraphsArray = [extractionGraphs];
    } else {
      extractionGraphsArray = extractionGraphs;
    }

    let documentsArray: IDocument[];
    if (documents instanceof Array) {
      documentsArray = documents.map(doc => {
        if (typeof doc === 'string') {
          return { text: doc, labels: {}, id: undefined };
        } else {
          return doc;
        }
      });
    } else if (typeof documents === 'string') {
      documentsArray = [{ text: documents, labels: {}, id: docId }];
    } else {
      documentsArray = [documents];
    }

    documentsArray.forEach(doc => {
      doc.labels['mime_type'] = 'text/plain';
    });

    const contentIds: string[] = [];

    for (const extractionGraph of extractionGraphsArray) {
      for (const document of documentsArray) {
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

        const contentId = response.data.content_id;
        contentIds.push(contentId);
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
  ): Promise<ITask[]> {
    const response = await this.client.get(
      `/extraction_graphs/${extractionGraph}/extraction_policies/${extractionPolicy}/tasks`,
    );

    return response.data.tasks;
  }

  async getSchemas(): Promise<ISchema[]> {
    const resp = await this.client.get("schemas");
    return resp.data.schemas;
  }

  async uploadFile(
    extractionGraphNames: string | string[],
    fileInput: string | Blob,
    labels: Record<string, any> = {},
    id?: string
  ): Promise<string> {
    function isBlob(input: any): input is Blob {
      return input instanceof Blob;
    }

    let contentId: any;

    const params = new URLSearchParams({});

    if (typeof window === "undefined") {
      if (typeof fileInput !== "string") {
        throw Error("Expected string");
      }

      const fs = require("fs");
      const FormData = require("form-data");
      const formData = new FormData();
      formData.append("labels", JSON.stringify(labels));
      formData.append("file", fs.createReadStream(fileInput as string));

      for (const extractionGraph of Array.isArray(extractionGraphNames) ? extractionGraphNames : [extractionGraphNames]) {
        const response = await this.client.post(
          `namespaces/${this.namespace}/extraction_graphs/${extractionGraph}/extract`,
          formData,
          {
            params
          }
        );
        const responseJson = response.data;
        contentId = responseJson.content_id;
      }

      if (contentId === undefined) {
        throw new Error("No content ID was retrieved from the extraction process");
      }

      return contentId;

    } else {
      if (!isBlob(fileInput)) {
        throw Error("Expected blob");
      }
      const formData = new FormData();
      formData.append("labels", JSON.stringify(labels));
      formData.append("file", fileInput);

      for (const extractionGraph of Array.isArray(extractionGraphNames) ? extractionGraphNames : [extractionGraphNames]) {
        const response = await this.client.post(
          `namespaces/${this.namespace}/extraction_graphs/${extractionGraph}/extract`,
          formData,
          {
            params
          }
        );
        const responseJson = response.data;
        contentId = responseJson.content_id;
      }

      if (contentId === undefined) {
        throw new Error("No content ID was retrieved from the extraction process");
      }

      return contentId;
    }
  }

  async getExtractionGraphs(): Promise<ExtractionGraph[]> {
  const response = await this.client.get(`/extraction_graphs`);
  const extractionGraphs = response.data.extraction_graphs ?? [];
  return extractionGraphs;
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

  async waitForExtraction(contentIds: string | string[]): Promise<void> {
    const ids = typeof contentIds === 'string' ? [contentIds] : contentIds;
    
    console.log("Waiting for extraction to complete for content id: ", ids.join(","));

    for (const contentId of ids) {
      try {
        const response = await this.client.get(
          `namespaces/${this.namespace}/content/${contentId}/wait`
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
    const resp = await this.client.post("ingest_remote_file", {
      url,
      mime_type,
      labels,
      extraction_graph_names: extractionGraphNamesArray,
      id,
    });
    return resp;
  }

  generateUniqueHexId(): string {
    return uuidv4().replace(/-/g, "").substring(0, 16);
  }

  generateHashFromString(inputString: string): string {
    const hash = CryptoJS.SHA256(inputString);
    return hash.toString(CryptoJS.enc.Hex).substring(0, 16);
  }

  async deleteDocuments(documentIds: string[]): Promise<void> {
    const req = { content_ids: documentIds };
    await this.client.delete(`namespaces/${this.namespace}/content`, {
      data: req,
      headers: { "Content-Type": "application/json" },
    });
  }

  async updateLabels(documentId: string, labels: Record<string, string>): Promise<void> {
    const req = { labels };
    await this.client.put(
      `namespaces/${this.namespace}/content/${documentId}/labels`,
      req,
      { headers: { "Content-Type": "application/json" } }
    );
  }

  async updateContent(documentId: string, path: string): Promise<void> {
    const fs = require("fs");
    const formData = new FormData();
    formData.append("file", fs.createReadStream(path));
    await this.client.put(
      `namespaces/${this.namespace}/content/${documentId}`,
      formData,
      { headers: { "Content-Type": "multipart/form-data" } }
    );
  }

  async listContent(
    extractionGraph: string,
    namespace?: string,
    params?:  {
      namespace: string;
      extractionGraph: string;
      source?: string;
      parentId?: string;
      labelsFilter?: string[];
      startId?: string;
      limit?: number;
      returnTotal?: boolean;
    }
  ): Promise<IContentMetadata[]> {
    let response;

    const defaultParams = {
      returnTotal: false,
      ...params
    };

    if (namespace) {
      response = await axios.get(
        `/namespaces/${namespace}/extraction_graphs/${extractionGraph}/content`, {
          params: defaultParams
        }
      );
    } else {
      response = await this.client.get(
        `extraction_graphs/${extractionGraph}/content`, {
          params: defaultParams
        }
      );
    }
    
    return response.data.content_list.map((item: IBaseContentMetadata) =>
      this.baseContentToContentMetadata(item)
    );
  }

  async sqlQuery(query: string): Promise<any> {
    const req = { query };
    const response = await this.client.post(
      `namespaces/${this.namespace}/sql_query`,
      req,
      { headers: { "Content-Type": "application/json" } }
    );
    return response.data.rows.map((row: any) => row.data);
  }

  async linkExtractionGraphs(
    sourceGraph: string,
    contentSource: string,
    linkedGraph: string
  ): Promise<void> {
    const req = {
      content_source: contentSource,
      linked_graph_name: linkedGraph,
    };

    await this.client.post(
      `namespaces/${this.namespace}/extraction_graphs/${sourceGraph}/links`,
      req,
      { headers: { "Content-Type": "application/json" } }
    );
  }
}

export default IndexifyClient;
