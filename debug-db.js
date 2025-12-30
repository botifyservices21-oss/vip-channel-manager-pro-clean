const { connectDB, collections } = require("./db");

(async () => {
  await connectDB();

  const posts = await collections.scheduledPosts.find().toArray();

  console.log("📌 POSTS EN BD:");
  console.log(posts);

  process.exit();
})();
