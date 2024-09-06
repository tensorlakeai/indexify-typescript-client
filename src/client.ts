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
