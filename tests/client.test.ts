import { IndexifyClient } from "../src";
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

test("Create Client", async () => {
  const client = await IndexifyClient.createClient();
  expect(client.namespace).toBe("default");
});

test("Create Namespace", async () => {
  const nanoid = generateNanoId(8);
  const namespaceName = `testnamespace.${nanoid}`;
  const client = await IndexifyClient.createNamespace({
    namespace: namespaceName,
    extraction_policies: [
      {
        id: nanoid,
        extractor: "tensorlake/minilm-l6",
        name: `testpolicy`,
      },
    ],
  }).catch((e) => {
    if (isAxiosError(e)) {
      console.log(e.response?.data);
    }
    console.log("error creating namespace");
    throw e;
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
    namespace: `test.adddocuments.${nanoid}`,
  });

  // add single documents
  await client.addDocuments({ text: "This is a test", labels: {} });

  // add multiple documents
  await client.addDocuments([
    { text: "This is a test1", labels: {} },
    { text: "This is a test2", labels: {} },
  ]);

  // add string
  await client.addDocuments("This is a test string");

  // add multiple strings
  await client.addDocuments([
    "This is a test string1",
    "This is a test string 2",
  ]);

  // add mixed
  await client.addDocuments([
    "This is a mixed test 1",
    { text: "This is a mixed test 2", labels: {} },
  ]);

  await new Promise((r) => setTimeout(r, 5000));

  const content = await client.getContent();
  expect(content.length).toBe(8);
});

test("Search", async () => {
  const nanoid = generateNanoId(8);

  const policy: IExtractionPolicy = {
    extractor: "tensorlake/minilm-l6",
    name: `minilml6.${nanoid}`,
    labels_eq: "source:test",
  };

  const client = await IndexifyClient.createNamespace({
    namespace: `testsearch.${nanoid}`,
  });

  const resp = await client.addExtractionPolicy(policy);
  expect(resp.index_names.length).toBe(1);

  const indexName = resp.index_names[0];

  await client.addDocuments([
    { text: "This is a test1", labels: { source: "test" } },
    { text: "This is a test2", labels: { source: "test" } },
  ]);

  await new Promise((r) => setTimeout(r, 10000));

  const searchResult = await client.searchIndex(indexName, "test", 3);
  console.log(searchResult);
  expect(searchResult.length).toBe(2);
});

test("Upload file", async () => {
  const policy: IExtractionPolicy = {
    extractor: "tensorlake/minilm-l6",
    name: "minilml6",
    content_source: "ingestion",
    input_params: {},
  };

  const client = await IndexifyClient.createNamespace({
    namespace: "testuploadfile",
  });
  client.addExtractionPolicy(policy);
  await client.uploadFile(`${__dirname}/files/test.txt`);
  console.log("done");
});

test("Get content", async () => {
  const nanoid = generateNanoId(8);
  const client = await IndexifyClient.createNamespace({
    namespace: `testgetcontent.${nanoid}`,
  });
  await client.addDocuments([
    { text: "This is a test1", labels: { source: "test" } },
    { text: "This is a test2", labels: { source: "test" } },
  ]);

  let content;

  content = await client.getContent("idontexist");
  expect(content.length).toBe(0);

  content = await client.getContent(undefined, "source:test");
  expect(content.length).toBe(2);
  expect(content[0].content_url).toContain("http://");

  content = await client.getContent(undefined, "source:nothing");
  expect(content.length).toBe(0);
});

test("Download content", async () => {
  const nanoid = generateNanoId(8);
  const client = await IndexifyClient.createNamespace({
    namespace: `testgetcontent.${nanoid}`,
  });
  await client.addDocuments([
    { text: "This is a download", labels: { source: "testdownload" } },
  ]);

  const content = await client.getContent(undefined, "source:testdownload");
  expect(content.length).toBeGreaterThanOrEqual(1);

  const resData = await client.downloadContent<string>(content[0].id);
  expect(resData).toBe("This is a download");
});

test("Get Extraction Policies", async () => {
  const client = await IndexifyClient.createNamespace({
    namespace: "testgetpolicies",
  });

  await client.addExtractionPolicy({
    extractor: "tensorlake/minilm-l6",
    name: "minilml6",
  });
  expect(client.extractionPolicies.length).toBe(1);

  const policies = await client.getExtractionPolicies();
  expect(policies.length).toBe(1);
});

test("Ingest remote url", async () => {
  const client = await IndexifyClient.createClient();
  await client.ingestRemoteFile(
    "https://gif-search.diptanu-6d5.workers.dev/OlG-5EjOENZLvlxHcXXmT.gif",
    "image/gif",
    {},
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
