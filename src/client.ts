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
  IExtractionPolicy,
  IExtractedMetadata,
} from "./types";
import { v4 as uuidv4 } from "uuid";
import CryptoJS from "crypto-js";
import ExtractionGraph from "./ExtractionGraph";

const DEFAULT_SERVICE_URL = "http://localhost:8900"; // Set your default service URL

class IndexifyClient {
  public serviceUrl: string;
  private client: AxiosInstance;
  public namespace: string;
  public extractionGraphs: ExtractionGraph[];

  constructor(
    serviceUrl: string = DEFAULT_SERVICE_URL,
    namespace: string = "default",
    // optional mtls config
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
    const response = await axios.get(`${serviceUrl}/namespaces/${namespace}`, {
      httpsAgent: IndexifyClient.getHttpsAgent({ mtlsConfig }),
    });

    return new IndexifyClient(
      serviceUrl,
      namespace,
      response.data.namespace.extraction_graphs.map(
        (graph: { extraction_policies: any[] }) => ({
          ...graph,
          extraction_policies: graph.extraction_policies.map(
            (policy: { filters_eq: any }) => ({
              ...policy,
              labels_eq: policy.filters_eq, // Transform filters_eq to labels_eq
            })
          ),
        })
      ),
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
      // if content is ingested with remote url use storage url
      content_url = content.storage_url;
    } else {
      // use streaming api for content url
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
    include_content: boolean = true
  ): Promise<ISearchIndexResponse[]> {
    const resp = await this.client.post("search", {
      index: name,
      query,
      k: topK,
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

    // update this.extractor_bindings
    await this.getExtractionGraphs();

    return resp.data;
  }

  async getExtractedContent({
    parentId,
    source,
    labelsEq,
    startId,
    limit,
  }: {
    parentId?: string;
    source?: string;
    labelsEq?: string;
    startId?: string;
    limit?: number;
  } = {}): Promise<IContentMetadata[]> {
    const resp = await this.client.get("content", {
      params: {
        parent_id: parentId,
        labels_eq: labelsEq,
        source,
        start_id: startId,
        limit,
      },
    });
    return resp.data.content_list.map((content: IBaseContentMetadata) => {
      return this.baseContentToContentMetadata(content);
    });
  }

  async addDocuments(
    extractionGraphNames: string | string[],
    documents:
      | IDocument
      | string
      | IDocument[]
      | string[]
      | (IDocument | string)[]
  ) {
    function isIDocument(obj: any): obj is IDocument {
      return (
        obj && typeof obj.text === "string" && typeof obj.labels === "object"
      );
    }

    let newDocuments: IDocument[] = [];

    if (typeof documents === "string") {
      newDocuments.push({ text: documents as string, labels: {} });
    } else if (isIDocument(documents)) {
      newDocuments.push(documents);
    } else if (Array.isArray(documents)) {
      newDocuments = [
        ...newDocuments,
        ...(documents.map((item) => {
          if (isIDocument(item)) {
            return item;
          } else if (typeof item === "string") {
            return { text: item, labels: {} };
          } else {
            throw Error(
              "Invalid Type: Array items must be string or IDocument"
            );
          }
        }) as IDocument[]),
      ];
    } else {
      throw Error(
        "Invalid type for documents. Expected Document, str, or list of these."
      );
    }

    const extractionGraphNamesArray = Array.isArray(extractionGraphNames)
      ? extractionGraphNames
      : [extractionGraphNames];

    await this.client.post("add_texts", {
      documents: newDocuments,
      extraction_graph_names: extractionGraphNamesArray,
    });
  }

  async getContentMetadata(id: string): Promise<IContentMetadata> {
    const resp = await this.client.get(`content/${id}`);
    return this.baseContentToContentMetadata(resp.data.content_metadata);
  }

  async getStructuredMetadata(id: string): Promise<IExtractedMetadata[]> {
    const resp = await this.client.get(`content/${id}/metadata`);
    return resp.data.metadata;
  }

  async getContentTree(id: string): Promise<IContentMetadata[]> {
    const resp = await this.client.get(`content/${id}/content-tree`);
    return resp.data.content_tree_metadata;
  }

  async downloadContent<T>(id: string): Promise<T> {
    try {
      const response = await this.client.get(`content/${id}/download`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to download content ${id}: ${error}`);
    }
  }

  async getTasks({
    contentId,
    extractionPolicyId,
    startId,
    limit,
  }: {
    contentId?: string;
    extractionPolicyId?: string;
    startId?: string;
    limit?: number;
  }): Promise<ITask[]> {
    const resp = await this.client.get("tasks", {
      params: {
        content_id: contentId,
        extraction_policy: extractionPolicyId,
        start_id: startId,
        limit,
      },
    });
    return resp.data.tasks;
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

    const extractionGraphNamesArray = Array.isArray(extractionGraphNames)
      ? extractionGraphNames
      : [extractionGraphNames];

    const params = new URLSearchParams({
      extraction_graph_names: extractionGraphNamesArray.join(","),
      ...(id ? { id: id } : {}),
    });

    if (typeof window === "undefined") {
      // node
      if (typeof fileInput !== "string") {
        throw Error("Expected string");
      }

      const fs = require("fs");

      // Create form
      const FormData = require("form-data");
      const formData = new FormData();
      formData.append("labels", JSON.stringify(labels));
      formData.append("file", fs.createReadStream(fileInput as string)); //stream

      // Upload File
      const res = await this.client.post("upload_file", formData, {
        params,
      });
      return res.data.content_id;
    } else {
      // browser
      if (!isBlob(fileInput)) {
        throw Error("Expected blob");
      }
      // Create form
      const formData = new FormData();
      formData.append("labels", JSON.stringify(labels));
      formData.append("file", fileInput);

      // Upload File
      const res = await this.client.post("/upload_file", formData, {
        params,
      });
      return res.data.content_id;
    }
  }

  async getExtractionGraphs(): Promise<ExtractionGraph[]> {
    const resp = await this.client.get("");
    const extractionGraphs = resp.data.namespace?.extraction_graphs ?? [];
    this.extractionGraphs = extractionGraphs;
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
}

export default IndexifyClient;
