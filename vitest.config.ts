import "dotenv/config";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globalSetup: "./src/test/global-setup.ts",
    setupFiles: "./src/test/setup.ts",
    // Test files share one Postgres database and truncate it between
    // every test (src/test/setup.ts). Running files in parallel workers
    // means one file's beforeEach can truncate rows another file's test
    // just inserted mid-test — a real race, not a flake. Serializing
    // file execution is the correct fix, not per-file isolation, since
    // the concurrency test below needs two connections to see the same
    // committed data across a real race.
    fileParallelism: false,
  },
});
