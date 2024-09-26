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
  constructor(message: string, public statusCode?: number, public response?: any) {
    super(message);
    this.name = "IndexifyError";
  }
}

class IndexifyClient {
  private axiosInstance: AxiosInstance;

  private constructor(
    private readonly serviceUrl: string = DEFAULT_SERVICE_URL,
    private readonly _namespace: string = "default",
    config?: AxiosRequestConfig
  ) {
    this.axiosInstance = axios.create({
      baseURL: `${serviceUrl}/namespaces/${_namespace}`,
      ...config,
    });
  }

  static async namespaces({
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

  public get namespace(): string {
    return this._namespace;
  }

  static createClient({
    serviceUrl = DEFAULT_SERVICE_URL,
    namespace = "default",
    config,
  }: {
    serviceUrl?: string;
    namespace?: string;
    config?: AxiosRequestConfig;
  } = {}): IndexifyClient {
    return new IndexifyClient(serviceUrl, namespace, config);
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
    try {
      const response = await this.axiosInstance.get<ComputeGraphsList>('compute_graphs');
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        this.handleAxiosError(error);
      }
      throw new IndexifyError("Failed to fetch compute graphs");
    }
  }

  async createComputeGraph(computeGraphCreate: ComputeGraphCreateType): Promise<void> {
    try {
      const formData = new FormData();
      formData.append('compute_graph', JSON.stringify(computeGraphCreate.compute_graph));
      formData.append('code', new Blob([computeGraphCreate.code], { type: 'text/plain' }), 'code.py');

      await this.axiosInstance.post('compute_graphs', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
    } catch (error) {
      if (axios.isAxiosError(error)) {
        this.handleAxiosError(error);
      }
      throw new IndexifyError(`Failed to create compute graph: ${computeGraphCreate.compute_graph.name}`);
    }
  }

  async getComputeGraph(computeGraph: string): Promise<ComputeGraph> {
    try {
      const response = await this.axiosInstance.get<ComputeGraph>(`compute_graphs/${computeGraph}`);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        this.handleAxiosError(error);
      }
      throw new IndexifyError(`Failed to fetch compute graph: ${computeGraph}`);
    }
  }

  async getGraphInvocations(computeGraph: string): Promise<GraphInvocations> {
    try {
      const response = await this.axiosInstance.get<GraphInvocations>(`compute_graphs/${computeGraph}/invocations`);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        this.handleAxiosError(error);
      }
      throw new IndexifyError(`Failed to fetch graph invocations for: ${computeGraph}`);
    }
  }

  async getInvocationResult(computeGraph: string, invocationId: string): Promise<InvocationResult> {
    try {
      const response = await this.axiosInstance.get<InvocationResult>(`compute_graphs/${computeGraph}/invocations/${invocationId}/outputs`);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        this.handleAxiosError(error);
      }
      throw new IndexifyError(`Failed to fetch invocation result: ${invocationId}`);
    }
  }

  async deleteInvocation(computeGraph: string, invocationId: string): Promise<void> {
    try {
      await this.axiosInstance.delete(`compute_graphs/${computeGraph}/invocations/${invocationId}`);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        this.handleAxiosError(error);
      }
      throw new IndexifyError(`Failed to delete invocation: ${invocationId}`);
    }
  }

  async invokeWithFile(computeGraph: string, file: File, metadata?: Record<string, any>): Promise<string> {
    try {
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
    } catch (error) {
      if (axios.isAxiosError(error)) {
        this.handleAxiosError(error);
      }
      throw new IndexifyError(`Failed to invoke compute graph with file: ${computeGraph}`);
    }
  }

  async invokeWithObject(computeGraph: string, object: any): Promise<string> {
    try {
      const response = await this.axiosInstance.post<{ invocation_id: string }>(
        `compute_graphs/${computeGraph}/invoke_object`,
        object
      );
      return response.data.invocation_id;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        this.handleAxiosError(error);
      }
      throw new IndexifyError(`Failed to invoke compute graph with object: ${computeGraph}`);
    }
  }

  async listTasks(computeGraph: string, invocationId: string): Promise<Tasks> {
    try {
      const response = await this.axiosInstance.get<Tasks>(`compute_graphs/${computeGraph}/invocations/${invocationId}/tasks`);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        this.handleAxiosError(error);
      }
      throw new IndexifyError(`Failed to list tasks for invocation: ${invocationId}`);
    }
  }

  async deleteComputeGraph(name: string): Promise<void> {
    try {
      await this.axiosInstance.delete(`compute_graphs/${name}`);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        this.handleAxiosError(error);
      }
      throw new IndexifyError(`Failed to delete compute graph: ${name}`);
    }
  }

  generateUniqueHexId(): string {
    return uuidv4().replace(/-/g, "").substring(0, 16);
  }

  generateHashFromString(inputString: string): string {
    return CryptoJS.SHA256(inputString).toString(CryptoJS.enc.Hex).substring(0, 16);
  }
}

export const namespaces = async ({
  serviceUrl = DEFAULT_SERVICE_URL,
  config,
}: {
  serviceUrl?: string;
  config?: AxiosRequestConfig;
} = {}): Promise<Namespace[]> => {
  try {
    const response = await axios.get<NamespaceList>(`${serviceUrl}/namespaces`, config);
    return response.data.namespaces;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new IndexifyError(error.message, error.response?.status, error.response?.data);
    }
    throw new IndexifyError("Failed to list namespaces");
  }
};

export const createNamespace = async (
  name: string, 
  serviceUrl: string = DEFAULT_SERVICE_URL, 
  config?: AxiosRequestConfig
): Promise<void> => {
  try {
    await axios.post<CreateNamespace>(
      `${serviceUrl}/namespaces`,
      { name },
      config
    );
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new IndexifyError(error.message, error.response?.status, error.response?.data);
    }
    throw new IndexifyError(`Failed to create namespace: ${name}`);
  }
};

export { IndexifyClient };
export default IndexifyClient;