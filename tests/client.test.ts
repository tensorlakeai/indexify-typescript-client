import { IndexifyClient } from "../src";
import { IExtractionPolicy } from "../src/types";

jest.setTimeout(30000);

test("Create Client", async () => {
  const client = await IndexifyClient.createClient();
  expect(client.namespace).toBe("default");
});

test("Create Namespace", async () => {
  const policy: IExtractionPolicy = {
    extractor: "tensorlake/minilm-l6",
    name: "testpolicy",
    content_source: "ingestion",
    input_params: {},
  };
  const client = await IndexifyClient.createNamespace(
    "testnamespace",
    [policy],
    {}
  );
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
  const client = await IndexifyClient.createNamespace(
    "test.adddocuments",
    [],
    {}
  );

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
    content_source: "ingestion",
    input_params: {},
    labels_eq: "source:test",
  };

  const client = await IndexifyClient.createNamespace("testsearch");
  const resp = await client.addExtractionPolicy(policy);
  expect(resp.index_names.length).toBe(1);

  const indexName = resp.index_names[0];

  await client.addDocuments([
    { text: "This is a test1", labels: {source:"test"} },
    { text: "This is a test2", labels: {source:"test"} },
  ]);

  await new Promise((r) => setTimeout(r, 10000));

  const searchResult = await client.searchIndex(indexName, "test", 3);
  expect(searchResult.length).toBe(2)
});

test("Upload file", async () => {
  const policy: IExtractionPolicy = {
    extractor: "tensorlake/minilm-l6",
    name: "minilml6",
    content_source: "ingestion",
    input_params: {},
  };

  const client = await IndexifyClient.createNamespace("testuploadfile");
  client.addExtractionPolicy(policy)
  await client.uploadFile(`${__dirname}/files/test.txt`)
})