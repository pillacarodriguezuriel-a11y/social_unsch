'use client';

import React from 'react';
import { FolderArchive, Upload } from 'lucide-react';
import { Button } from './Button';

interface RepositoryEmptyStateProps {
  onUploadClick: () => void;
}

export function RepositoryEmptyState({ onUploadClick }: RepositoryEmptyStateProps) {
  return (
    <div className="bg-white border border-secondary/15 rounded-2xl p-10 md:p-16 text-center shadow-sm max-w-lg mx-auto flex flex-col items-center gap-6 select-none transition-all hover:border-secondary/30">
      
      {/* Ilustración o Contenedor de Icono Minimalista */}
      <div className="w-20 h-20 rounded-full bg-surface border border-secondary/20 flex items-center justify-center text-secondary shadow-inner relative animate-pulse">
        <FolderArchive className="w-10 h-10 text-primary/80" />
        <span className="absolute -top-1 -right-1 bg-primary text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded-full">
          +2 Cr
        </span>
      </div>

      {/* Encabezado Motivador (Sección 4.2 Frontend Skill) */}
      <div className="flex flex-col gap-2">
        <h3 className="text-lg font-black text-primary tracking-tight">
          Vaya, parece que nadie ha subido exámenes aquí todavía. 📭
        </h3>
        <p className="text-xs text-neutral-gray font-semibold leading-relaxed max-w-sm">
          Sé el primer héroe de tu clase en compartir apuntes, prácticas o exámenes pasados y gana créditos de descarga al instante.
        </p>
      </div>

      {/* Botón de Llamada a la Acción Elevado y Gamificado */}
      <Button
        onClick={onUploadClick}
        className="w-full sm:w-auto bg-primary text-surface font-extrabold text-sm py-3 px-6 rounded-xl hover:bg-primary/95 flex items-center justify-center gap-2 shadow-sm transition-transform active:scale-95"
      >
        <Upload className="w-4 h-4" />
        + Subir Primer Documento (+2 Créditos)
      </Button>
    </div>
  );
}
