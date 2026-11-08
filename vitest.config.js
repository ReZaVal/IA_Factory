import { defineConfig } from "vitest/config";

// Los tests de fabrica.test.js lanzan el pipeline completo con agentes
// simulados y tardan más de los 5 s por defecto en máquinas lentas (WSL).
export default defineConfig({
  test: { testTimeout: 60000 },
});
