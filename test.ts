#!/usr/bin/env tsx
// 簡單測試 tsx 執行環境

import {camelToSnakeCase} from "./src/utils/native.js";

console.log("🧪 Testing tsx execution...");
console.log("✓ Import works");

const testResult = camelToSnakeCase("MessageCreate");
console.log(`✓ Function works: "MessageCreate" → "${testResult}"`);

if (testResult === "_message_create") {
    console.log("✅ All tests passed! tsx is working correctly.");
    process.exit(0);
} else {
    console.error("❌ Test failed!");
    process.exit(1);
}
