import { IndexifyClient } from "../src";
import { IExtractionPolicy } from "../src/types";

jest.setTimeout(30000);

test("Create Client", async () => {
  const client = await IndexifyClient.createClient();
  expect(client.namespace).toBe("default");
});

test("Create Namespace", async () => {
  const client = await IndexifyClient.createNamespace({
    namespace: "testnamespace",
    extraction_policies: [
      {
        extractor: "tensorlake/minilm-l6",
        name: "testpolicy",
      },
    ],
  });

  expect(client.namespace).toBe("testnamespace");
  // test get namespaces
  const namespaces = await IndexifyClient.namespaces();
  expect(
    namespaces.filter((item) => item.name === "testnamespace").length
  ).toBe(1);
});

test("Get Extractors", async () => {
  const client = await IndexifyClient.createClient();
  const extractors = await client.extractors();
  expect(extractors.length).toBeGreaterThanOrEqual(1);
});

test("Add Documents", async () => {
  const client = await IndexifyClient.createNamespace({
    namespace: "test.adddocuments",
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
  const policy: IExtractionPolicy = {
    extractor: "tensorlake/minilm-l6",
    name: "minilml6",
    labels_eq: "source:test",
  };

  const client = await IndexifyClient.createNamespace({
    namespace: "testsearch",
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
  const client = await IndexifyClient.createNamespace({
    namespace: "testgetcontent",
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
  const client = await IndexifyClient.createNamespace({
    namespace: "testgetcontent",
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
