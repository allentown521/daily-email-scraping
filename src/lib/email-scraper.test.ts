import { scrapeEmails } from "@/lib/email-scraper";

async function testEmailScraper() {
  console.log("🧪 Testing email scraper...\n");

  // Test 1: Simple email detection
  console.log("Test 1: Testing with example.com");
  try {
    const result = await scrapeEmails("https://example.com");
    console.log(`✅ Scraped ${result.length} emails`);
    console.log("Result:", result);
  } catch (error) {
    console.error("❌ Error:", error);
  }

  console.log("\n---\n");

  // Test 2: Test regex patterns
  console.log("Test 2: Testing email regex patterns");
  const testCases = [
    { text: "Contact us at support@example.com", expected: 1 },
    { text: "Email: info@test.org or sales@test.org", expected: 2 },
    { text: "Contact [at] example [dot] com", expected: 1 },
    { text: "hello(at)example(dot)com", expected: 1 },
    { text: "no emails here", expected: 0 },
  ];

  for (const testCase of testCases) {
    const EMAIL_REGEX = /[\w\.-]+@[\w\.-]+\.\w+/g;
    const matches = testCase.text.match(EMAIL_REGEX) || [];
    const status = matches.length === testCase.expected ? "✅" : "❌";
    console.log(
      `${status} "${testCase.text}" -> Found: ${matches.length}, Expected: ${testCase.expected}`,
    );
  }
}

testEmailScraper().catch(console.error);
