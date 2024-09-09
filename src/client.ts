import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";
import {
  IContentMetadata,
  Namespace as INamespace,
  Task as ITask,
  IDocument,
  IMtlsConfig,
  ComputeGraph,
  CreateNamespace,
  GraphInvocations,
  InvocationResult,
  Task,
} from "./types";
import { v4 as uuidv4 } from "uuid";
import CryptoJS from "crypto-js";

const DEFAULT_SERVICE_URL = "http://localhost:8900";

class IndexifyClient {
  private client: AxiosInstance;

  constructor(
    public serviceUrl: string = DEFAULT_SERVICE_URL,
    public namespace: string = "default",
    httpsAgent?: any
  ) {
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
      return await this.client.request({
        method,
        url: endpoint,
        ...options,
      });
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error(`Error: ${error.message}`);
      }
      throw error;
    }
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

  async delete(endpoint: string): Promise<AxiosResponse> {
    return this.request("DELETE", endpoint);
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
    mtlsConfig,
  }: {
    name: string;
    mtlsConfig?: IMtlsConfig;
  }): Promise<IndexifyClient> {
    await axios.post(
      `${DEFAULT_SERVICE_URL}/namespaces`,
      { name } as CreateNamespace,
      { httpsAgent: IndexifyClient.getHttpsAgent({ mtlsConfig }) }
    );
    return IndexifyClient.createClient({ namespace: name });
  }

  async computeGraphs(): Promise<ComputeGraph[]> {
    const resp = await this.client.get("compute_graphs");
    return resp.data.compute_graphs;
  }

  async createComputeGraph(computeGraph: ComputeGraph, code: string): Promise<void> {
    const formData = new FormData();
    formData.append('compute_graph', JSON.stringify(computeGraph));
    formData.append('code', new Blob([code], { type: 'text/plain' }), 'code.py');

    await this.client.post("compute_graphs", formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  }

  async getComputeGraph(computeGraph: string): Promise<ComputeGraph> {
    const resp = await this.client.get(`compute_graphs/${computeGraph}`);
    return resp.data;
  }

  async getGraphInvocations(computeGraph: string): Promise<GraphInvocations> {
    const resp = await this.client.get(`compute_graphs/${computeGraph}/invocations`);
    return resp.data;
  }

  async getInvocationResult(computeGraph: string, invocationId: string): Promise<InvocationResult> {
    const resp = await this.client.get(`compute_graphs/${computeGraph}/invocations/${invocationId}`);
    return resp.data;
  }

  async deleteInvocation(computeGraph: string, invocationId: string): Promise<void> {
    await this.client.delete(`compute_graphs/${computeGraph}/invocations/${invocationId}`);
  }

  async invokeWithFile(computeGraph: string, file: Blob | string, metadata?: Record<string, any>): Promise<string> {
    const formData = new FormData();
    
    if (typeof file === 'string') {
      // Assume it's a file path in Node.js environment
      const fs = require('fs');
      formData.append('file', fs.createReadStream(file));
    } else {
      formData.append('file', file);
    }
    
    if (metadata) {
      formData.append('metadata', JSON.stringify(metadata));
    }

    const resp = await this.client.post(`compute_graphs/${computeGraph}/invoke_file`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });

    return resp.data.invocation_id;
  }

  async invokeWithObject(computeGraph: string, object: any): Promise<string> {
    const resp = await this.client.post(`compute_graphs/${computeGraph}/invoke_object`, object);
    return resp.data.invocation_id;
  }

  async listTasks(computeGraph: string): Promise<Task[]> {
    const resp = await this.client.get(`compute_graphs/${computeGraph}/tasks`);
    return resp.data.tasks;
  }

  async deleteComputeGraph(name: string): Promise<void> {
    await this.client.delete(`compute_graphs/${name}`);
  }

  generateUniqueHexId(): string {
    return uuidv4().replace(/-/g, "").substring(0, 16);
  }

  generateHashFromString(inputString: string): string {
    return CryptoJS.SHA256(inputString).toString(CryptoJS.enc.Hex).substring(0, 16);
  }
}

export default IndexifyClient;
