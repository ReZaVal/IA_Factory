// Puente a los revisores Gemini (revision.md ## 3, memoria.md D15).
import { describe, it, expect } from "vitest";
import {
  parseArgs,
  forbiddenPaths,
  loadConfig,
  buildPrompt,
  mimeFor
} from "../skills/ia-factory/plantillas/revision/scripts/revision/gemini.mjs";

describe("parseArgs", () => {
  it("lee rol, tarea, base e imágenes repetidas", () => {
    expect(
      parseArgs(["ui", "--tarea", "T2.5", "--base", "main~1", "--imagen", "a.png", "--imagen", "b.jpg"])
    ).toEqual({ rol: "ui", tarea: "T2.5", base: "main~1", imagenes: ["a.png", "b.jpg"], modelos: false });
  });

  it("base por defecto HEAD y modo listar modelos", () => {
    expect(parseArgs(["--modelos"])).toMatchObject({ rol: undefined, base: "HEAD", modelos: true });
  });

  it("rechaza un rol desconocido", () => {
    expect(() => parseArgs(["estilo", "--tarea", "T2.5"])).toThrow(/rol/);
  });

  it("exige --tarea salvo en modo --modelos", () => {
    expect(() => parseArgs(["seguridad"])).toThrow(/--tarea/);
  });
});

describe("forbiddenPaths", () => {
  it("detecta datos reales y secretos que nunca salen a la API", () => {
    expect(
      forbiddenPaths(["js/main.js", "local_privado/insp.csv", ".env.local", "sub/.env", "specs/T2.5.md"])
    ).toEqual(["local_privado/insp.csv", ".env.local", "sub/.env"]);
  });
});

describe("loadConfig", () => {
  it("prefiere variables de entorno sobre .env.local", () => {
    const env = { GEMINI_API_KEY: "k-env", GEMINI_MODEL: "m-env" };
    expect(loadConfig(env, "GEMINI_API_KEY=k-file\nGEMINI_MODEL=m-file")).toEqual({ apiKey: "k-env", model: "m-env" });
  });

  it("cae a .env.local, ignorando comentarios y comillas", () => {
    expect(loadConfig({}, '# clave\nGEMINI_API_KEY="k-file"\nGEMINI_MODEL=m-file\n')).toEqual({
      apiKey: "k-file",
      model: "m-file"
    });
  });

  it("sin clave devuelve apiKey vacía (el CLI explica cómo configurarla)", () => {
    expect(loadConfig({}, "")).toEqual({ apiKey: "", model: "" });
  });
});

describe("buildPrompt", () => {
  it("incluye tarea, spec y diff, y avisa si falta la spec", () => {
    const p = buildPrompt({ tarea: "T2.5", spec: "", diff: "+ cambio" });
    expect(p).toContain("T2.5");
    expect(p).toContain("+ cambio");
    expect(p).toMatch(/no hay spec/i);
  });
});

describe("mimeFor", () => {
  it("solo acepta png y jpg", () => {
    expect(mimeFor("a.PNG")).toBe("image/png");
    expect(mimeFor("a.jpeg")).toBe("image/jpeg");
    expect(() => mimeFor("a.gif")).toThrow(/imagen/);
  });
});
