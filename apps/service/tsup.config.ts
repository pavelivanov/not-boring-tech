import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/server.ts", "src/sync.ts", "src/digest.ts"],
  format: ["esm"],
  clean: true,
  sourcemap: true,
  noExternal: ["@findthatproject/contracts"],
});
