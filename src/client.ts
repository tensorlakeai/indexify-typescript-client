import axios, { AxiosInstance, AxiosResponse } from "axios";
import Extractor from "./extractor";
import {
  IContentMetadata,
  IExtractor,
  IExtractionPolicy,
  IIndex,
  INamespace,
  ITask,
  IAddExtractorPolicyResponse,
  IDocument,
  ISearchIndexResponse,
  IBaseContentMetadata,
  IExtractedMetadata,
} from "./types";

const DEFAULT_SERVICE_URL = "http://localhost:8900"; // Set your default service URL

class IndexifyClient {
  public serviceUrl: string;
  private client: AxiosInstance;
  public namespace: string;
  public extractionPolicies: IExtractionPolicy[];

  constructor(
    serviceUrl: string = DEFAULT_SERVICE_URL,
    namespace: string = "default",
    extractionPolicies: IExtractionPolicy[]
  ) {
    this.serviceUrl = serviceUrl;
    this.namespace = namespace;
    this.extractionPolicies = extractionPolicies;
    this.client = axios.create({
      baseURL: `${serviceUrl}/namespaces/${namespace}`,
    });
  }

  static async createClient({
    serviceUrl = DEFAULT_SERVICE_URL,
    namespace = "default",
  }: {
    serviceUrl?: string;
    namespace?: string;
  } = {}): Promise<IndexifyClient> {
    const response = await axios.get(`${serviceUrl}/namespaces/${namespace}`);
    return new IndexifyClient(
      serviceUrl,
      namespace,
      response.data.namespace.extraction_policies.map(
        (item: {
          name: string;
          extractor: string;
          filters_eq: string;
          input_params: Record<string, string | number>;
          content_source: string;
        }) => {
          // abstraction for filters_eq
          return {
            name: item.name,
            extractor: item.extractor,
            labels_eq: item.filters_eq,
            input_params: item.input_params,
            content_source: item.content_source,
          };
        }
      ) as IExtractionPolicy[]
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
    return {
      ...content,
      content_url: `${this.serviceUrl}/namespaces/${this.namespace}/content/${content.id}/download`,
    };
  };

  async get(endpoint: string): Promise<AxiosResponse> {
    return this.request("GET", endpoint);
  }

  static async namespaces(): Promise<INamespace[]> {
    const response = await axios.get(`${DEFAULT_SERVICE_URL}/namespaces`);
    return response.data.namespaces;
  }

  static async createNamespace(
    namespace: string,
    extraction_policies?: IExtractionPolicy[],
    labels?: Record<string, string>
  ) {
    await axios.post(`${DEFAULT_SERVICE_URL}/namespaces`, {
      name: namespace,
      extraction_policies: extraction_policies ?? [],
      labels: labels ?? {},
    });
    const client = await IndexifyClient.createClient({ namespace });
    return client;
  }

  async indexes(): Promise<IIndex[]> {
    const resp = await this.client.get("indexes");
    return resp.data.indexes;
  }

  async extractors(): Promise<Extractor[]> {
    const response = await axios.get(`${DEFAULT_SERVICE_URL}/extractors`);
    const extractorsData = response.data.extractors as IExtractor[];
    return extractorsData.map((data) => new Extractor(data));
  }

  async searchIndex(
    name: string,
    query: string,
    topK: number
  ): Promise<ISearchIndexResponse[]> {
    const resp = await this.client.post("search", {
      index: name,
      query,
      k: topK,
    });
    return resp.data["results"];
  }

  async addExtractionPolicy(
    extractionPolicy: IExtractionPolicy
  ): Promise<IAddExtractorPolicyResponse> {
    const resp = await this.client.post("extraction_policies", {
      extractor: extractionPolicy.extractor,
      name: extractionPolicy.name,
      input_params: extractionPolicy.input_params,
      filters_eq: extractionPolicy.labels_eq,
      content_source: extractionPolicy.content_source ?? "ingestion",
    });

    // update this.extractor_bindings
    await this.getExtractionPolicies();

    return resp.data;
  }

  async getContent(
    parent_id?: string,
    labels_eq?: string
  ): Promise<IContentMetadata[]> {
    const resp = await this.client.get("content", {
      params: { parent_id, labels_eq },
    });
    return resp.data.content_list.map((content: IBaseContentMetadata) => {
      return this.baseContentToContentMetadata(content);
    });
  }

  async addDocuments(
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

    await this.client.post("add_texts", { documents: newDocuments });
  }

  async getContentById(id: string): Promise<IContentMetadata> {
    const resp = await this.client.get(`content/${id}`);
    return this.baseContentToContentMetadata(resp.data.content_metadata);
  }

  async getExtractedMetadata(id: string): Promise<IExtractedMetadata[]> {
    const resp = await this.client.get(`content/${id}/metadata`);
    return resp.data.metadata
  }

  async downloadContent<T>(id: string): Promise<T> {
    const url = `${this.serviceUrl}/namespaces/${this.namespace}/content/${id}/download`;
    try {
      const response = await axios.get<T>(url);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to download content ${url}: ${error}`);
    }
  }

  async getTasks(extraction_policy?: string): Promise<ITask[]> {
    const resp = await this.client.get("tasks", {
      params: { extraction_policy },
    });
    return resp.data.tasks;
  }

  async uploadFile(fileInput: string | Blob): Promise<any> {
    function isBlob(input: any): input is Blob {
      return input instanceof Blob;
    }

    if (typeof window === "undefined") {
      // node
      if (typeof fileInput !== "string") {
        throw Error("Expected string");
      }
      const FormData = require("form-data");
      const fs = require("fs");
      const formData = new FormData();
      formData.append("file", fs.createReadStream(fileInput as string));
      await this.client.post("upload_file", formData, {
        headers: {
          ...formData.getHeaders(),
        },
      });
    } else {
      // browser
      if (!isBlob(fileInput)) {
        throw Error("Expected blob");
      }
      const formData = new FormData();
      formData.append("file", fileInput);
      await this.client.post("/upload_file", formData);
    }
  }

  async getExtractionPolicies(): Promise<IExtractionPolicy[]> {
    const resp = await this.client.get("");
    const policies = resp.data.namespace?.extraction_policies ?? [];
    this.extractionPolicies = policies;
    return policies;
  }
}

export default IndexifyClient;
