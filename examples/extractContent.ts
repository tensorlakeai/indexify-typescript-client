import { IndexifyClient } from "getindexify";
const fs = require("fs");

// Extract wikipedia article directly from client
(async () => {
  // Initialize client
  const client = await IndexifyClient.createClient();

  // Read html file
  const html = fs.readFileSync(
    __dirname + "/../tests/files/steph_curry.html",
    "utf8"
  );

  // Call extract method on running wikipedia extractor
  const response = await client.extract({
    name: "tensorlake/wikipedia",
    content: { bytes: html, content_type: "text/plain" },
  });

  // Output preview
  console.log(`Number of contents created ${response.content.length}`);
  response.content.forEach((c, i) => {
    console.log(`content ${i}`, c.content_type);
    if (c.content_type === "text/plain" && c.bytes.length) {
        console.log("Preview:", String.fromCharCode(...c.bytes).slice(0, 100));
    }
    if (c.features?.length) {
        console.log(`Features:`, c.features);
    }
  });

  /*
    Output should look like this following

    Number of contents created 29
    content 0 text/plain
    Preview: Curry is the son of Sonya and Dell Curry. He was born in Akron, Ohio, at Summa Akron City Hospital, 
    Features: [
    {
        feature_type: 'metadata',
        name: 'metadata',
        data: { headline: 'Early life', title: 'Stephen Curry' }
    }
    ]
    content 1 text/plain
    Preview: Before Curry even played in his first game for the Wildcats, head coach Bob McKillop praised him at 
    Features: [
    {
        feature_type: 'metadata',
        name: 'metadata',
        data: { headline: 'College career', title: 'Stephen Curry' }
    }
    ]
  */
})();
