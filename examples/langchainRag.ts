import { ChatOpenAI } from "@langchain/openai";
import {
  RunnableSequence,
  RunnablePassthrough,
} from "@langchain/core/runnables";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { ExtractionGraph, IndexifyClient } from "getindexify";
import { IndexifyRetriever } from "@getindexify/langchain";
import { formatDocumentsAsString } from "langchain/util/document";

(async () => {
  // setup client
  const graph = ExtractionGraph.fromYaml(`
  name: 'knowledgebase'
  extraction_policies:
    - extractor: 'tensorlake/minilm-l6'
      name: 'minilml6'
  `);
  const client = await IndexifyClient.createNamespace({
    name: "testlangchain",
    extractionGraphs: [graph],
  });

  // add documents
  await client.addDocuments("knowledgebase", "Lucas is from Los Angeles, California");

  await new Promise((r) => setTimeout(r, 5000));

  // setup retriever
  const retriever = new IndexifyRetriever(client, {
    name: "minilml6.embedding",
    topK: 9,
  });

  // initialize langchain
  const model = new ChatOpenAI({});

  const prompt =
    PromptTemplate.fromTemplate(`Answer the question based only on the following context:
  {context}
  
  Question: {question}`);

  const chain = RunnableSequence.from([
    {
      context: retriever.pipe(formatDocumentsAsString),
      question: new RunnablePassthrough(),
    },
    prompt,
    model,
    new StringOutputParser(),
  ]);

  const question = "Where is Lucas From?";
  console.log(`Question: ${question}`);
  const result = await chain.invoke(question);
  console.log(result);
})();
