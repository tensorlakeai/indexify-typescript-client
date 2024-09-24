import axios, { AxiosInstance, AxiosRequestConfig, AxiosError } from "axios";
import { v4 as uuidv4 } from "uuid";
import CryptoJS from "crypto-js";
import {
  Namespace,
  ComputeGraph,
  CreateNamespace,
  IndexifyAPIError,
  InvocationResult,
  Tasks,
  ComputeGraphCreateType,
  ComputeGraphsList,
  GraphInvocations,
  NamespaceList
} from "./types";

const DEFAULT_SERVICE_URL = "http://localhost:8900";

class IndexifyError extends Error {
  constructor(public message: string, public statusCode?: number, public response?: any) {
    super(message);
    this.name = "IndexifyError";
  }
}

class IndexifySuccess {
  constructor(public message: string, public data?: any) {}
}

export class IndexifyClient {
  private axiosInstance: AxiosInstance;

  private constructor(
    private readonly serviceUrl: string,
    private readonly _namespace: string,
    config?: AxiosRequestConfig
  ) {
    this.axiosInstance = axios.create({
      baseURL: `${serviceUrl}/namespaces/${_namespace}`,
      ...config,
    });

    this.axiosInstance.interceptors.response.use(
      response => response,
      (error: AxiosError<IndexifyAPIError>) => this.handleAxiosError(error)
    );
  }

  static async createClient({
    serviceUrl = DEFAULT_SERVICE_URL,
    namespace = "default",
    config,
  }: {
    serviceUrl?: string;
    namespace?: string;
    config?: AxiosRequestConfig;
  } = {}): Promise<IndexifyClient> {
    const client = new IndexifyClient(serviceUrl, namespace, config);
    await client.validateConnection();
    return client;
  }

  private async validateConnection(): Promise<void> {
    try {
      await this.axiosInstance.get("");
    } catch (error) {
      throw new IndexifyError("Failed to establish connection with the server");
    }
  }

  get namespace(): string {
    return this._namespace;
  }

  private handleAxiosError(error: AxiosError<IndexifyAPIError>): never {
    if (error.response) {
      const { status, data } = error.response;
      throw new IndexifyError(data.message || "Unknown API error", status, data);
    } else if (error.request) {
      throw new IndexifyError("No response received from the server");
    } else {
      throw new IndexifyError(`Error setting up the request: ${error.message}`);
    }
  }

  async listComputeGraphs(): Promise<ComputeGraphsList> {
    const response = await this.axiosInstance.get<ComputeGraphsList>('compute_graphs');
    return response.data;
  }

  async createComputeGraph(computeGraphCreate: ComputeGraphCreateType): Promise<IndexifySuccess> {
    try {
      const formData = new FormData();
      formData.append('compute_graph', JSON.stringify(computeGraphCreate.compute_graph));
      formData.append('code', new Blob([computeGraphCreate.code], { type: 'text/plain' }), 'code.py');

      const response = await this.axiosInstance.post('compute_graphs', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      return new IndexifySuccess(`Compute graph '${computeGraphCreate.compute_graph.name}' created successfully`, response.data);
    } catch (error) {
      if (error instanceof IndexifyError) {
        throw error;
      }
      throw new IndexifyError(`Failed to create compute graph: ${(error as Error).message}`);
    }
  }

  async getComputeGraph(computeGraph: string): Promise<ComputeGraph> {
    const response = await this.axiosInstance.get<ComputeGraph>(`compute_graphs/${computeGraph}`);
    return response.data;
  }

  async getGraphInvocations(computeGraph: string): Promise<GraphInvocations> {
    const response = await this.axiosInstance.get<GraphInvocations>(`compute_graphs/${computeGraph}/invocations`);
    return response.data;
  }

  async getInvocationResult(computeGraph: string, invocationId: string): Promise<InvocationResult> {
    const response = await this.axiosInstance.get<InvocationResult>(`compute_graphs/${computeGraph}/invocations/${invocationId}/outputs`);
    return response.data;
  }

  async deleteInvocation(computeGraph: string, invocationId: string): Promise<IndexifySuccess> {
    try {
      await this.axiosInstance.delete(`compute_graphs/${computeGraph}/invocations/${invocationId}`);
      return new IndexifySuccess(`Invocation '${invocationId}' for compute graph '${computeGraph}' deleted successfully`);
    } catch (error) {
      if (error instanceof IndexifyError) {
        throw error;
      }
      throw new IndexifyError(`Failed to delete invocation: ${(error as Error).message}`);
    }
  }

  async invokeWithFile(computeGraph: string, file: File, metadata?: Record<string, any>): Promise<string> {
    const formData = new FormData();
    formData.append('file', file);
    
    if (metadata) {
      formData.append('metadata', JSON.stringify(metadata));
    }

    const response = await this.axiosInstance.post<{ invocation_id: string }>(
      `compute_graphs/${computeGraph}/invoke_file`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );

    return response.data.invocation_id;
  }

  async invokeWithObject(computeGraph: string, object: any): Promise<string> {
    const response = await this.axiosInstance.post<{ invocation_id: string }>(
      `compute_graphs/${computeGraph}/invoke_object`,
      object
    );
    return response.data.invocation_id;
  }

  async listTasks(computeGraph: string, invocationId: string): Promise<Tasks> {
    const response = await this.axiosInstance.get<Tasks>(`compute_graphs/${computeGraph}/invocations/${invocationId}/tasks`);
    return response.data;
  }

  async deleteComputeGraph(name: string): Promise<IndexifySuccess> {
    try {
      await this.axiosInstance.delete(`compute_graphs/${name}`);
      return new IndexifySuccess(`Compute graph '${name}' deleted successfully`);
    } catch (error) {
      if (error instanceof IndexifyError) {
        throw error;
      }
      throw new IndexifyError(`Failed to delete compute graph: ${(error as Error).message}`);
    }
  }

  generateUniqueHexId(): string {
    return uuidv4().replace(/-/g, "").substring(0, 16);
  }

  generateHashFromString(inputString: string): string {
    return CryptoJS.SHA256(inputString).toString(CryptoJS.enc.Hex).substring(0, 16);
  }

  static async listNamespaces({
    serviceUrl = DEFAULT_SERVICE_URL,
    config,
  }: {
    serviceUrl?: string;
    config?: AxiosRequestConfig;
  } = {}): Promise<Namespace[]> {
    try {
      const response = await axios.get<NamespaceList>(`${serviceUrl}/namespaces`, config);
      return response.data.namespaces;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new IndexifyError(error.message, error.response?.status, error.response?.data);
      }
      throw new IndexifyError("Failed to list namespaces");
    }
  }

  static async createNamespace(
    name: string, 
    serviceUrl: string = DEFAULT_SERVICE_URL, 
    config?: AxiosRequestConfig
  ): Promise<IndexifySuccess> {
    try {
      await axios.post<CreateNamespace>(
        `${serviceUrl}/namespaces`,
        { name },
        config
      );
      return new IndexifySuccess(`Namespace '${name}' created successfully`);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new IndexifyError(error.message, error.response?.status, error.response?.data);
      }
      throw new IndexifyError(`Failed to create namespace: ${name}`);
    }
  }
}

export default IndexifyClient;