import { IndexifyClient } from "../src";
import ExtractionGraph from "../src/ExtractionGraph";
import { IExtractionPolicy } from "../src/types";
import { isAxiosError } from "axios";

const fs = require("fs");

jest.setTimeout(30000);

function generateNanoId(length: number = 21): string {
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    result += characters[randomIndex];
  }
  return result;
}

async function setupExtractionGraph(
  client: IndexifyClient,
  extractionGraphName: string,
  extractor: string
): Promise<string[]> {
  const nanoid = generateNanoId(8);

  const graph = ExtractionGraph.fromYaml(`
  name: '${extractionGraphName}'
  extraction_policies:
   - extractor: '${extractor}'
     name: 'extractor.${nanoid}'
  `);
  const resp = await client.createExtractionGraph(graph);
  return resp.indexes;
}

test("createClient", async () => {
  const client = await IndexifyClient.createClient();
  expect(client.namespace).toBe("default");
});

test("createNamespace", async () => {
  const nanoid = generateNanoId(8);
  const namespaceName = `testnamespace.${nanoid}`;

  const client = await IndexifyClient.createNamespace({
    name: namespaceName,
    extractionGraphs: [],
  });

  expect(client.namespace).toBe(namespaceName);
  // test get namespaces
  const namespaces = await IndexifyClient.namespaces();
  expect(namespaces.filter((item) => item.name === namespaceName).length).toBe(
    1
  );
});

test("extractors", async () => {
  const client = await IndexifyClient.createClient();
  const extractors = await client.extractors();
  expect(extractors.length).toBeGreaterThanOrEqual(1);
});

test("addDocuments", async () => {
  const nanoid = generateNanoId(8);
  const client = await IndexifyClient.createNamespace({
    name: `test.adddocuments.${nanoid}`,
  });
  const extractionGraphName = "extractiongraph";
  await setupExtractionGraph(
    client,
    extractionGraphName,
    "tensorlake/minilm-l6"
  );

  // add single documents
  await client.addDocuments(extractionGraphName, {
    text: "This is a test",
    labels: {},
  });

  // add multiple documents
  await client.addDocuments(extractionGraphName, [
    { text: "This is a test1", labels: {} },
    { text: "This is a test2", labels: {} },
  ]);

  // add string
  await client.addDocuments(extractionGraphName, "This is a test string");

  // add multiple strings
  await client.addDocuments(extractionGraphName, [
    "This is a test string1",
    "This is a test string 2",
  ]);

  // add mixed
  await client.addDocuments(extractionGraphName, [
    "This is a mixed test 1",
    { text: "This is a mixed test 2", labels: {} },
  ]);

  const {contentList} = await client.getExtractedContent();
  expect(contentList.length).toBe(8);
});

test("searchIndex", async () => {
  const nanoid = generateNanoId(8);
  const client = await IndexifyClient.createNamespace({
    name: `testsearch.${nanoid}`,
  });

  // setup extraction policy with graph name
  const extractionGraphName = "extractiongraph";
  const indexes = await setupExtractionGraph(
    client,
    extractionGraphName,
    "tensorlake/minilm-l6"
  );

  expect(indexes.length).toBe(1);
  await client.addDocuments(extractionGraphName, [
    { text: "This is a test1", labels: { source: "test" } },
    { text: "This is a test2", labels: { source: "test" } },
  ]);

  await new Promise((r) => setTimeout(r, 10000));

  const searchResult = await client.searchIndex(indexes[0], "test", 3);
  expect(searchResult.length).toBe(2);
});

test("uploadFile", async () => {
  const nanoid = generateNanoId(8);
  const client = await IndexifyClient.createNamespace({
    name: `testuploadfile.${nanoid}`,
  });
  const extractionGraphName = "extractiongraph";
  await setupExtractionGraph(
    client,
    extractionGraphName,
    "tensorlake/minilm-l6"
  );

  await client
    .uploadFile(extractionGraphName, `${__dirname}/files/test.txt`)
    .catch((e) => {
      if (isAxiosError(e)) {
        console.log(e.response?.data);
      }
      throw e;
    });
});

test.only("getExtractedContent", async () => {
  const nanoid = generateNanoId(8);
  const client = await IndexifyClient.createNamespace({
    name: `testgetcontent.${nanoid}`,
  });

  const extractionGraphName = "extractiongraph";
  await setupExtractionGraph(
    client,
    extractionGraphName,
    "tensorlake/minilm-l6"
  );

  await client.addDocuments(extractionGraphName, [
    { text: "This is a test1", labels: { source: "test" } },
    { text: "This is a test2", labels: { source: "test" } },
  ]);

  let contentList;
  let resp = await client.getExtractedContent({
    parentId: "idontexist",
  });
  contentList = resp.contentList
  expect(contentList.length).toBe(0);

  resp = await client.getExtractedContent({
    labelsEq: "source:test",
    returnTotal:true
  });
  contentList = resp.contentList
  expect(contentList.length).toBe(2);
  expect(resp.total).toBe(2);
  expect(contentList[0].content_url).toContain("http://");

  resp = await client.getExtractedContent({
    labelsEq: "source:nothing",
  });
  contentList = resp.contentList
  expect(contentList.length).toBe(0);
});

test("getStructuredMetadata", async () => {
  const nanoid = generateNanoId(8);
  const client = await IndexifyClient.createNamespace({
    name: `testgetextractedmetadata.${nanoid}`,
  });

  const extractionGraphName = "extractiongraph";
  await setupExtractionGraph(
    client,
    extractionGraphName,
    "tensorlake/wikipedia"
  );

  const contentId = await client.uploadFile(
    extractionGraphName,
    `${__dirname}/files/steph_curry.html`
  );
  await new Promise((r) => setTimeout(r, 10000));
  const extractedMetadata = await client.getStructuredMetadata(contentId);
  expect(extractedMetadata.length).toBeGreaterThanOrEqual(1);
});

test("getSchemas", async () => {
  const nanoid = generateNanoId(8);
  const client = await IndexifyClient.createNamespace({
    name: `testgetcontent.${nanoid}`,
  });
  const extractionGraphName = "schematestgraph";
  await setupExtractionGraph(
    client,
    extractionGraphName,
    "tensorlake/wikipedia"
  );

  // upload html
  await client.uploadFile(
    extractionGraphName,
    `${__dirname}/files/steph_curry.html`
  );
  await new Promise((r) => setTimeout(r, 10000));

  const schemas = await client.getSchemas();
  expect(schemas.length).toBe(1);
  expect(schemas[0].extraction_graph_name).toBe(extractionGraphName);
  expect(Object.keys(schemas[0].columns).length).toBe(13);
});

test("downloadContent", async () => {
  const nanoid = generateNanoId(8);
  const client = await IndexifyClient.createNamespace({
    name: `testgetcontent.${nanoid}`,
  });

  const extractionGraphName = "extractiongraph";
  await setupExtractionGraph(
    client,
    extractionGraphName,
    "tensorlake/minilm-l6"
  );

  await client.addDocuments(extractionGraphName, [
    { text: "This is a download", labels: { source: "testdownload" } },
  ]);

  const { contentList } = await client.getExtractedContent({
    labelsEq: "source:testdownload",
  });
  expect(contentList.length).toBeGreaterThanOrEqual(1);

  const resData = await client.downloadContent<string>(contentList[0].id);
  expect(resData).toBe("This is a download");
});

test("getExtractionGraphs", async () => {
  const nanoid = generateNanoId(8);
  const client = await IndexifyClient.createNamespace({
    name: `testgetextractionpolicies.${nanoid}`,
  });

  // create extraction graph
  const extractionGraphName = "extractiongraph";
  await setupExtractionGraph(
    client,
    extractionGraphName,
    "tensorlake/minilm-l6"
  );

  expect(client.extractionGraphs.length).toBe(1);

  const extractionGraphs = await client.getExtractionGraphs();
  expect(extractionGraphs.length).toBe(1);
});

test("ingestRemoteFile", async () => {
  const nanoid = generateNanoId(8);
  const client = await IndexifyClient.createNamespace({
    name: `testingestremotefile.${nanoid}`,
  });

  await setupExtractionGraph(client, "extractiongraph", "tensorlake/minilm-l6");

  await client.ingestRemoteFile(
    "https://gif-search.diptanu-6d5.workers.dev/OlG-5EjOENZLvlxHcXXmT.gif",
    "image/gif",
    {},
    "extractiongraph",
    "5EjOENZLvlxHcXXmT"
  );
});

test("extract", async () => {
  // Test minilm feature extract
  const client = await IndexifyClient.createClient();
  const res = await client.extract({
    name: "tensorlake/minilm-l6",
    content: { bytes: "testing", content_type: "text/plain" },
  });

  expect(res.content.length).toBe(0);
  expect(res.features.length).toBe(1);

  // Test wiki content extraction
  const html = fs.readFileSync(__dirname + "/files/steph_curry.html", "utf8");
  const res2 = await client.extract({
    name: "tensorlake/wikipedia",
    content: { bytes: html, content_type: "text/plain" },
  });
  expect(res2.content.length).toBe(29);

  // Test eighth piece of content
  const content = res2.content[8];
  expect(String.fromCharCode(...content.bytes)).toBe(
    "NCAA  Davidson College  NBA  Golden State Warriors"
  );
  expect(content.features?.length).toBe(1);
  expect(content.features?.[0].feature_type).toBe("metadata");
  expect(content.content_type).toBe("text/plain");
  expect(content.features?.[0].data.headline).toBe("Records");
  expect(content.features?.[0].data.title).toBe("Stephen Curry");
});

test("extractionGraph from yaml", async () => {
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
  expect(graph.extraction_policies.length).toBe(2);
  expect(graph.id).toBe(undefined);
  expect(graph.name).toBe("nbakb");
});

test("generateHashFromString", async () => {
  const client = await IndexifyClient.createClient();
  expect(client.generateHashFromString("test")).toBe("9f86d081884c7d65");
});

test("generateUniqueHexId", async () => {
  const client = await IndexifyClient.createClient();
  expect(client.generateUniqueHexId()).toHaveLength(16);
});

test("getTasks", async () => {
  const nanoid = generateNanoId(8);
  const namespaceName = `testgettasks.${nanoid}`;
  const client = await IndexifyClient.createNamespace({name:namespaceName});
  const { tasks, total } = await client.getTasks({
    limit: 10,
    returnTotal: true,
  });
  expect(tasks.length).toBe(0)
  expect(total).toBe(0)
});

// test.only("MTLS", async () => {
//   const fs = require("fs")
//   const https = require("https")
//   const axios = require("axios")

//   const client = await IndexifyClient.createClient({
//     serviceUrl: "mtls url",
//     mtlsConfig:{
//       certPath: "tests/certs/client.crt",
//       keyPath: "tests/certs/client.key"
//     }
//   })
//   const content = await client.getContent()
// });
