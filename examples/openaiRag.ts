
import { OpenAI } from "openai";
import wiki from "wikijs";
import { IndexifyClient, ExtractionGraph } from "getindexify";

// RAG example with OpenAI and indexify
(async () => {
  const client = await IndexifyClient.createClient();
  const graph = ExtractionGraph.fromYaml(`
  name: 'nbakb'
  extraction_policies:
    - extractor: 'tensorlake/chunk-extractor'
      name: 'chunker'
      input_params:
        chunk_size: 1000
        overlap: 100
    - extractor: 'tensorlake/minilm-l6'
      name: 'wikiembedding'
      content_source: 'chunker'
  `);
  await client.createExtractionGraph(graph);

  // Function to load wikipedia article from query
  async function loadWikipediaArticle(query: string) {
    const page = await wiki().page(query);
    const wikipediaContent = await page.rawContent();
    client.addDocuments("nbakb", wikipediaContent);
  }

  // Function to get context
  // This will search index
  async function getContext(
    question: string,
    index: string,
    topK: number = 3
  ): Promise<string> {
    const results = await client.searchIndex(index, question, topK);
    let context = "";
    results.forEach((result) => {
      context += `content id: ${result.content_id} \n\n passage: ${result.text}\n`;
    });
    return context;
  }

  // Create prompt from question and context
  function createPrompt(question: string, context: string): string {
    return `Answer the question, based on the context.\n question: ${question} \n context: ${context}`;
  }

  // Load wikipedia article
  await loadWikipediaArticle("kevin durant");

  // Setup OpenAI Client, Prompts and Context
  const clientOpenAI = new OpenAI();
  const question = "When and where did Kevin Durant win NBA championships?";
  const context = await getContext(
    question,
    "nbakb.wikiembedding.embedding"
  );
  const prompt = createPrompt(question, context);

  // Perform rag with prompt
  clientOpenAI.chat.completions
    .create({
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      model: "gpt-3.5-turbo",
    })
    .then((chatCompletion) => {
      console.log(chatCompletion.choices[0].message.content);
    })
    .catch((error) => {
      console.error(error);
    });
})();
