import React from 'react';

interface AuthLayoutProps {
  children: React.ReactNode;
}

/**
 * Layout de autenticación que proporciona el fondo institucional "Crimson Heritage"
 * y centra el card de interacción.
 */
export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-surface px-4 py-12 relative overflow-hidden select-none">
      {/* Elementos geométricos decorativos sutiles de fondo para wow factor estético */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary/5 blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-15%] right-[-10%] w-[60%] h-[60%] rounded-full bg-secondary/5 blur-3xl pointer-events-none" />

      {/* Cabecera institucional con logo real */}
      <div className="mb-8 text-center z-10 flex flex-col items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/logos/logo-unsch.png"
          alt="Logo UNSCH"
          className="h-16 w-auto object-contain drop-shadow-sm"
        />
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-primary flex items-center justify-center gap-2">
            <span className="bg-primary text-surface px-3 py-1 rounded-xl text-2xl font-black shadow-sm">U</span>
            SOCIAL-UNSCH
          </h1>
          <p className="text-sm text-neutral-gray mt-2 font-medium">
            Red Social Académica y Tecnológica de la UNSCH
          </p>
        </div>
      </div>

      {/* Contenedor central (Card) */}
      <main className="w-full max-w-md z-10">
        {children}
      </main>

      {/* Pie de página institucional */}
      <footer className="mt-8 text-center text-xs text-neutral-gray/70 z-10 font-medium">
        © 2026 Universidad Nacional de San Cristóbal de Huamanga. Todos los derechos reservados.
      </footer>
    </div>
  );
}
