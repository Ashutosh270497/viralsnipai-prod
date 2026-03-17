import { lookupUser, getUserTweets } from "../lib/integrations/x-api";

async function test() {
  console.log("Testing X API...\n");

  // Test 1: Lookup @elonmusk
  console.log("1. Looking up @elonmusk...");
  const user = await lookupUser("elonmusk");
  if (user) {
    console.log("✓ Found:", user.username, `(ID: ${user.id})`);
    console.log("  Followers:", user.public_metrics?.followers_count);
  } else {
    console.log("✗ Failed to lookup user");
    return;
  }

  // Test 2: Fetch recent tweets
  console.log("\n2. Fetching recent tweets from @elonmusk...");
  const tweets = await getUserTweets({ userId: user.id, maxResults: 10 });
  if (tweets.data && tweets.data.length > 0) {
    console.log(`✓ Fetched ${tweets.data.length} tweets`);
    tweets.data.forEach((t, i) => {
      console.log(`\n  Tweet ${i + 1}:`);
      console.log(`    Text: ${t.text.substring(0, 80)}...`);
      console.log(`    Likes: ${t.public_metrics?.like_count ?? 0}`);
      console.log(`    RTs: ${t.public_metrics?.retweet_count ?? 0}`);
    });
  } else {
    console.log("✗ No tweets returned");
    console.log("  Response:", JSON.stringify(tweets, null, 2));
  }
}

test().catch(console.error);
