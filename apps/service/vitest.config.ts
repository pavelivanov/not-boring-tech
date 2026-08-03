import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Integration files share one disposable database and clean it between cases.
    fileParallelism: false,
  },
});
