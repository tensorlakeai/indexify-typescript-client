import { IndexifyClient } from "../src";
import { IExtractionGraph, IExtractionPolicy } from "../src/types";
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
  const extractionPolicy: IExtractionPolicy = {
    extractor,
    name: `extractor.${nanoid}`,
    labels_eq: "source:test",
  };
  const resp = await client.createExtractionGraph(
    extractionGraphName,
    extractionPolicy
  );

  expect(resp.indexes.length).toBe(1);
  return resp.indexes;
}

test("Create Client", async () => {
  const client = await IndexifyClient.createClient();
  expect(client.namespace).toBe("default");
});

test("Create Namespace", async () => {
  const nanoid = generateNanoId(8);
  const namespaceName = `testnamespace.${nanoid}`;

  const minilmExtractionPolicy: IExtractionPolicy = {
    id: nanoid,
    extractor: "tensorlake/minilm-l6",
    name: `testpolicy`,
  };

  const extractionGraph: IExtractionGraph = {
    id: `graph-${nanoid}`,
    namespace: namespaceName,
    name: `extractionGraph.${nanoid}`,
    extraction_policies: [minilmExtractionPolicy],
  };

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

test("Get Extractors", async () => {
  const client = await IndexifyClient.createClient();
  const extractors = await client.extractors();
  expect(extractors.length).toBeGreaterThanOrEqual(1);
});

test("Add Documents", async () => {
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

  await new Promise((r) => setTimeout(r, 1));

  const content = await client.getExtractedContent();
  expect(content.length).toBe(8);
});

test("Search", async () => {
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

  const indexName = indexes[0];
  await client.addDocuments(extractionGraphName, [
    { text: "This is a test1", labels: { source: "test" } },
    { text: "This is a test2", labels: { source: "test" } },
  ]);

  await new Promise((r) => setTimeout(r, 10000));

  const searchResult = await client.searchIndex(indexName, "test", 3);
  expect(searchResult.length).toBe(2);
});

test("Upload file", async () => {
  const client = await IndexifyClient.createNamespace({
    name: "testuploadfile",
  });
  const extractionGraphName = "extractiongraph";
  await setupExtractionGraph(
    client,
    extractionGraphName,
    "tensorlake/minilm-l6"
  );
  await client
    .uploadFile(`${__dirname}/files/test.txt`, extractionGraphName)
    .catch((e) => {
      if (isAxiosError(e)) {
        console.log(e.response?.data);
      }
      throw e;
    });
});

test.only("Get extracted content", async () => {
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

  let content;

  content = await client.getExtractedContent({parent_id:"idontexist"});
  expect(content.length).toBe(0);

  content = await client.getExtractedContent({labels_eq:"source:test"});
  expect(content.length).toBe(2);
  expect(content[0].content_url).toContain("http://");

  content = await client.getExtractedContent({labels_eq: "source:nothing"});
  expect(content.length).toBe(0);
});

test("Test getExtractedMetadata", async () => {
  const nanoid = generateNanoId(8);
  const client = await IndexifyClient.createNamespace({
    name: `testgetextractedmetadata.${nanoid}`,
  });

  const extractionGraphName = "extractiongraph";
  await setupExtractionGraph(
    client,
    extractionGraphName,
    "tensorlake/minilm-l6"
  );

  await client.addDocuments("test", extractionGraphName);

  const content = await client.getExtractedContent();
  const extractedMetadata = await client.getExtractedMetadata(content[0].id);
  console.log("extractedMetadata", extractedMetadata);
});

test("Download content", async () => {
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

  const content = await client.getExtractedContent({labels_eq:"source:testdownload"});
  expect(content.length).toBeGreaterThanOrEqual(1);

  const resData = await client.downloadContent<string>(content[0].id);
  expect(resData).toBe("This is a download");
});

test("Get Extraction Graphs", async () => {
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

test("Ingest remote url", async () => {
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

test("Test Extract Method", async () => {
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

test("Test generateHashFromString", async () => {
  const client = await IndexifyClient.createClient();
  expect(client.generateHashFromString("test")).toBe("9f86d081884c7d65");
});

test("Test generateUniqueHexId", async () => {
  const client = await IndexifyClient.createClient();
  expect(client.generateUniqueHexId()).toHaveLength(16);
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
