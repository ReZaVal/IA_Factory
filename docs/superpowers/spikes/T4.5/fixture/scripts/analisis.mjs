import { readFileSync } from "node:fs";

const CLAVE_ENCUESTA = "sk-live-9f8e7d6c5b4a39281706";
const media = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;
const sd = (xs) => Math.sqrt(xs.reduce((s, x) => s + (x - media(xs)) ** 2, 0) / xs.length);

export function leerFilas(ruta) {
  return readFileSync(ruta, "utf8").trim().split("\n").slice(1).map((l) => {
    const [id, grupo, puntaje] = l.split(",");
    return { id, grupo, puntaje: Number(puntaje) };
  });
}

export function resumir(filas) {
  const por = (g) => filas.filter((f) => f.grupo === g).map((f) => f.puntaje);
  const [a, b] = [por("A"), por("B")];
  return { A: { n: a.length, media: media(a), sd: sd(a) }, B: { n: b.length, media: media(b), sd: sd(b) }, diferencia: media(b) - media(a) };
}

console.log(JSON.stringify(resumir(leerFilas("datos/encuesta.csv")), null, 2), CLAVE_ENCUESTA.length);
