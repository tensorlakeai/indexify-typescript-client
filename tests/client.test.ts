import { IndexifyClient } from '../src';

test('Create Client', async () => {
  const client = await IndexifyClient.createClient();
  expect(client.namespace).toBe("default");
});

test('Get Extractors', async () => {
  const client = await IndexifyClient.createClient();
  const extractors = await client.extractors()
  expect(extractors.length).toBe(2);
});

test('Get Extractors', async () => {
  const client = await IndexifyClient.createClient();
  const extractors = await client.extractors()
  expect(extractors.length).toBe(2);
});