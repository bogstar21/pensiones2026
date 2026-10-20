# Pensiones en España

Un informe web sobre el sistema público de pensiones español, construido solo con
estadística oficial. Cada gráfico lleva debajo un desplegable con su fuente exacta,
el enlace, la fecha de descarga, la fórmula cuando la cifra es calculada, las
advertencias de interpretación y la tabla con los números que hay detrás del dibujo.

## Arrancar

```bash
npm install
npm run dev        # http://localhost:4321
```

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Genera el sitio estático en `dist/` |
| `npm start` | Sirve `dist/` escuchando en `$PORT` (lo que usa Railway) |
| `npm run datos` | Vuelve a descargar los datos de INE, Eurostat y Seguridad Social |
| `npm run check` | Comprobación de tipos de Astro |

## De dónde salen los datos

`npm run datos` ejecuta `scripts/fetch-data.mjs`, que no tiene dependencias externas:

- **INE** — API Tempus3, proyecciones de población de la edición 2026-2075.
- **Eurostat** — API de difusión: gasto en pensiones (ESSPROS), PIB, nacimientos,
  defunciones y fecundidad.
- **Seguridad Social** — hojas de cálculo oficiales de pensiones contributivas en
  vigor. Sus URL cambian en cada publicación mensual, así que el script las localiza
  leyendo los enlaces de la propia página de estadísticas. El XLSX se parsea con un
  lector mínimo propio (`scripts/lib/xlsx.mjs`), sin librerías.

Cada fichero de `src/data/generated/` guarda dentro la URL de la que salió y la fecha
de descarga, y el apartado de metodología del sitio se construye a partir de ahí.

Lo que no se puede automatizar está transcrito a mano con su tabla de origen indicada:

- `src/data/proyecciones-ue.json` — Ageing Report 2024 de la Comisión Europea.
- `src/data/comparativa-ocde.json` — Pensions at a Glance 2025 de la OCDE.
- `src/data/sistema.json` — parámetros legales del ejercicio, con su referencia al BOE.

Para actualizar un año nuevo: `npm run datos` cubre las series; los tres ficheros de
arriba hay que revisarlos a mano cuando se publiquen nuevas ediciones.

## Cómo está organizado

```
scripts/fetch-data.mjs     descarga y normaliza las fuentes
scripts/lib/xlsx.mjs       lector XLSX sin dependencias
src/data/fuentes.ts        registro único de fuentes (lo consume la metodología)
src/data/calculos.ts       toda cifra derivada, con su fórmula y sus entradas
src/data/generated/        salida del script de descarga
src/components/            figuras y gráficos (SVG generado en el servidor)
src/lib/chart.ts           escalas y trazado, sin librerías de gráficos
src/pages/                 el informe y la metodología
```

Los gráficos son SVG generado en el servidor; el único JavaScript que llega al
navegador es la capa de hover (`src/scripts/hover.ts`) y el conmutador de tema.

### Sobre los colores

La paleta categórica está verificada con el validador de accesibilidad cromática: pasa
el rango de luminosidad, el suelo de saturación, la separación para daltonismo y el
contraste mínimo de 3:1 en modo claro y oscuro. El orden de las series es parte de esa
verificación: reordenarlas sin volver a validar puede romperla.

## Despliegue

Pensado para Railway, que detecta el proyecto Node, ejecuta `npm run build` y arranca
con `npm start`. La configuración está en `railway.json`. Funciona igual en cualquier
plataforma que sirva un directorio estático.

## Aviso

No es asesoramiento financiero ni una previsión propia. Las proyecciones citadas son de
sus organismos de origen (INE, Comisión Europea, OCDE) y describen escenarios
condicionados, no pronósticos.
