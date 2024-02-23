import {
  BaseRetriever,
  type BaseRetrieverInput,
} from "@langchain/core/retrievers";
import type { CallbackManagerForRetrieverRun } from "@langchain/core/callbacks/manager";
import { Document } from "@langchain/core/documents";
import IndexifyClient from "../../../src/client";

export interface IndexifyRetrieverInput extends BaseRetrieverInput {
  client: IndexifyClient;
}

interface IParams {
  name: string;
  topK: number;
}

export class IndexifyRetriever extends BaseRetriever {
  lc_namespace = ["langchain", "retrievers"];
  private client: IndexifyClient;
  private params: IParams;

  constructor(
    client: IndexifyClient,
    params: IParams,
    fields?: IndexifyRetrieverInput
  ) {
    super(fields);
    this.client = client;
    this.params = params;
  }

  async _getRelevantDocuments(
    query: string,
    runManager?: CallbackManagerForRetrieverRun
  ): Promise<Document[]> {
    // Pass `runManager?.getChild()` when invoking internal runnables to enable tracing
    // const additionalDocs = await someOtherRunnable.invoke(params, runManager?.getChild());
    const docs = await this.client.searchIndex(
      this.params.name,
      query,
      this.params.topK
    );
    return docs.map((item) => {
      return new Document({ pageContent: item.text, metadata: item.labels });
    });
  }
}
