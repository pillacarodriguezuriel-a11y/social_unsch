import type { Config } from 'tailwindcss';

// En Tailwind CSS v4, la configuración de tema se gestiona directamente
// mediante el bloque @theme en app/globals.css.
// Este archivo se mantiene para compatibilidad con herramientas del ecosistema.
const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
};

export default config;
