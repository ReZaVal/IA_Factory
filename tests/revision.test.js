// Puente a los revisores Gemini (revision.md ## 3, memoria.md D15).
import { describe, it, expect } from "vitest";
import {
  parseArgs,
  forbiddenPaths,
  loadConfig,
  buildPrompt,
  buildSystem,
  mimeFor,
  clasificarError,
  pedirConReintentos
} from "../skills/ia-factory/plantillas/revision/scripts/revision/gemini.mjs";

describe("parseArgs", () => {
  it("lee rol, tarea, base e imágenes repetidas", () => {
    expect(
      parseArgs(["ui", "--tarea", "T2.5", "--base", "main~1", "--imagen", "a.png", "--imagen", "b.jpg"])
    ).toEqual({ rol: "ui", tarea: "T2.5", base: "main~1", carril: "software", imagenes: ["a.png", "b.jpg"], modelos: false });
  });

  it("carril por defecto software; --carril lo cambia", () => {
    expect(parseArgs(["logica", "--tarea", "T1.2"]).carril).toBe("software");
    expect(parseArgs(["logica", "--tarea", "T1.2", "--carril", "ml"]).carril).toBe("ml");
  });

  it("rechaza un carril que no es un nombre simple (no sale de la raíz)", () => {
    expect(() => parseArgs(["logica", "--tarea", "T1.2", "--carril", "../x"])).toThrow(/carril/);
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

describe("buildSystem", () => {
  const partes = { contexto: "CTX", rol: "ROL", formato: "FMT" };

  it("envía la constitución del carril entre el contexto y el rol", () => {
    const s = buildSystem({ ...partes, carril: "software", constitucion: "C1 nunca datos reales" });
    expect(s).toContain("C1 nunca datos reales");
    expect(s).toContain("constitucion-software.md");
    expect(s.indexOf("CTX")).toBeLessThan(s.indexOf("C1 nunca"));
    expect(s.indexOf("C1 nunca")).toBeLessThan(s.indexOf("ROL"));
    expect(s.indexOf("ROL")).toBeLessThan(s.indexOf("FMT"));
  });

  it("sin constitución (proyecto 1.0) queda contexto + rol + formato", () => {
    expect(buildSystem({ ...partes, carril: "software", constitucion: "" })).toBe("CTX\n\nROL\n\nFMT");
  });
});

describe("mimeFor", () => {
  it("solo acepta png y jpg", () => {
    expect(mimeFor("a.PNG")).toBe("image/png");
    expect(mimeFor("a.jpeg")).toBe("image/jpeg");
    expect(() => mimeFor("a.gif")).toThrow(/imagen/);
  });
});

const RETRY_34S = { "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay: "34s" };
const cuota = (quotaId) => ({ "@type": "type.googleapis.com/google.rpc.QuotaFailure", violations: [{ quotaId }] });
const fallo = (status, error = {}) => ({ ok: false, status, body: { error } });
const exito = { ok: true, status: 200, body: { candidates: [] } };

describe("clasificarError", () => {
  it("503 es transitorio", () => {
    expect(clasificarError(503, { message: "high demand" }).reintentar).toBe(true);
  });

  it("429 por minuto es transitorio y trae la espera del servidor", () => {
    const error = { message: "Quota exceeded, limit: 20", details: [cuota("GenerateRequestsPerMinutePerProjectPerModel-FreeTier"), RETRY_34S] };
    expect(clasificarError(429, error)).toMatchObject({ reintentar: true, esperaMs: 34_000 });
  });

  it("429 con limit: 0 es permanente y dice qué hacer", () => {
    const c = clasificarError(429, { message: "Quota exceeded for metric: x, limit: 0, model: y", details: [RETRY_34S] });
    expect(c.reintentar).toBe(false);
    expect(c.ayuda).toMatch(/facturación/);
  });

  it("429 de cuota diaria no se reintenta", () => {
    const c = clasificarError(429, { message: "Quota exceeded, limit: 20", details: [cuota("GenerateRequestsPerDayPerProjectPerModel-FreeTier"), RETRY_34S] });
    expect(c.reintentar).toBe(false);
    expect(c.ayuda).toMatch(/diaria/);
  });

  it("429 que pide esperar más que el tope no se reintenta", () => {
    const error = { message: "Quota exceeded", details: [{ ...RETRY_34S, retryDelay: "3600s" }] };
    expect(clasificarError(429, error).reintentar).toBe(false);
  });

  it("404 es permanente y apunta a --modelos", () => {
    const c = clasificarError(404, { message: "not found" });
    expect(c.reintentar).toBe(false);
    expect(c.ayuda).toMatch(/--modelos/);
  });

  it("ignora un retryDelay ilegible", () => {
    expect(clasificarError(503, { details: [{ retryDelay: "pronto" }] }).esperaMs).toBeNull();
  });

  it("otros errores no se reintentan", () => {
    expect(clasificarError(400, { message: "bad request" }).reintentar).toBe(false);
  });
});

describe("pedirConReintentos", () => {
  /** Responde en orden y anota cuántas veces se llamó y cuánto durmió. */
  function escenario(respuestas, azar = () => 0) {
    const r = { llamadas: 0, esperas: [], avisos: [] };
    r.opciones = { dormir: async (ms) => r.esperas.push(ms), azar, avisar: (m) => r.avisos.push(m) };
    r.hacer = async () => respuestas[Math.min(r.llamadas++, respuestas.length - 1)];
    return r;
  }

  it("devuelve el cuerpo sin esperar si la primera llamada sale bien", async () => {
    const e = escenario([exito]);
    await expect(pedirConReintentos(e.hacer, e.opciones)).resolves.toBe(exito.body);
    expect(e.llamadas).toBe(1);
    expect(e.esperas).toEqual([]);
  });

  it("se recupera de un 503 y avisa del reintento", async () => {
    const e = escenario([fallo(503), fallo(503), exito]);
    await expect(pedirConReintentos(e.hacer, e.opciones)).resolves.toBe(exito.body);
    expect(e.llamadas).toBe(3);
    expect(e.avisos).toHaveLength(2);
  });

  it("el backoff crece y el jitter lo varía dentro de un rango", async () => {
    const sinAzar = escenario([fallo(503)], () => 0);
    const conAzar = escenario([fallo(503)], () => 1);
    await pedirConReintentos(sinAzar.hacer, sinAzar.opciones).catch(() => {});
    await pedirConReintentos(conAzar.hacer, conAzar.opciones).catch(() => {});
    expect(sinAzar.esperas).toEqual([1000, 2000, 4000]);
    expect(conAzar.esperas).toEqual([2000, 4000, 8000]);
  });

  it("respeta la espera que pide el servidor", async () => {
    const e = escenario([fallo(429, { message: "Quota exceeded", details: [RETRY_34S] }), exito]);
    await pedirConReintentos(e.hacer, e.opciones);
    expect(e.esperas).toEqual([34_000]);
  });

  it("se rinde tras 3 reintentos con el error de la API", async () => {
    const e = escenario([fallo(503, { message: "high demand" })]);
    await expect(pedirConReintentos(e.hacer, e.opciones)).rejects.toThrow(/503: high demand.*3 reintentos/s);
    expect(e.llamadas).toBe(4);
  });

  it("falla a la primera con un error permanente, con la ayuda en el mensaje", async () => {
    const e = escenario([fallo(429, { message: "Quota exceeded, limit: 0" })]);
    await expect(pedirConReintentos(e.hacer, e.opciones)).rejects.toThrow(/429.*facturación/s);
    expect(e.llamadas).toBe(1);
    expect(e.esperas).toEqual([]);
  });
});
