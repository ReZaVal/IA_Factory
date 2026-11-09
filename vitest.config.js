import { defineConfig, configDefaults } from "vitest/config";

// Los tests de fabrica.test.js lanzan el pipeline completo con agentes
// simulados y tardan más de los 5 s por defecto en máquinas lentas (WSL).
// Los fixtures de los spikes llevan defectos sembrados a propósito: no son tests de IA Factory.
export default defineConfig({
  test: { testTimeout: 60000, exclude: [...configDefaults.exclude, "docs/**/fixture/**"] },
});
