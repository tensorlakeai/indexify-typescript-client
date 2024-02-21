import { IndexifyClient } from '../src';

test('Create Client', async () => {
  const client = await IndexifyClient.createClient();
  expect(client.namespace).toBe("default");
});