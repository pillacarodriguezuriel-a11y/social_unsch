'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Image, File, AlertTriangle, Send, X } from 'lucide-react';
import { api } from '../../app/lib/api';
import { Button } from './Button';
import { SCHOOLS_BY_FACULTY } from '../../app/lib/unsch.constants';

interface PostPublisherProps {
  onPublish: (
    optimisticPost: any,
    apiPromise: Promise<any>
  ) => void;
}

export function PostPublisher({ onPublish }: PostPublisherProps) {
  const [content, setContent] = useState('');
  const [schoolId, setSchoolId] = useState('');
  const [user, setUser] = useState<any>(null);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [attachedImageName, setAttachedImageName] = useState<string | null>(null);
  const [isAlert, setIsAlert] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        try {
          setUser(JSON.parse(userStr));
        } catch {
          setUser({ id: 'mock-id', full_name: 'Estudiante', role: 'student', school_id: 1 });
        }
      }
    }
  }, []);

  const handleImageAttach = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tamaño: máx 5MB
    if (file.size > 5 * 1024 * 1024) {
      alert('La imagen no puede superar los 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      setAttachedImage(ev.target?.result as string);
      setAttachedImageName(file.name);
    };
    reader.readAsDataURL(file);

    // Limpiar el input para permitir seleccionar el mismo archivo de nuevo
    e.target.value = '';
  };

  const handleRemoveImage = () => {
    setAttachedImage(null);
    setAttachedImageName(null);
  };

  const handlePublishSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!content.trim() || content.length > 2000) return;

    const selectedSchoolId = schoolId ? Number(schoolId) : (user?.school_id || null);

    // 1. Construir post optimista
    const optimisticPost = {
      id: `temp-${Date.now()}`,
      user_id: user?.id || 'mock-id',
      faculty_id: user?.faculty_id || null,
      professional_school_id: selectedSchoolId,
      content: isAlert ? `🚨 ALERTA URGENTE: ${content.trim()}` : content.trim(),
      is_visible: true,
      created_at: new Date().toISOString(),
      author_name: user?.full_name || 'Estudiante',
      author_role: user?.role || 'student',
      image_data: attachedImage || undefined,
    };

    // 2. Definir promesa API
    const apiPromise = api.post('/feed', {
      content: optimisticPost.content,
      faculty_id: user?.faculty_id || null,
      school_id: selectedSchoolId,
    });

    // 3. Disparar callback de actualización optimista
    onPublish(optimisticPost, apiPromise);

    // 4. Limpiar campos
    setContent('');
    setAttachedImage(null);
    setAttachedImageName(null);
    setIsAlert(false);
  };

  return (
    <div className="bg-white border border-secondary/15 rounded-2xl p-5 shadow-sm select-none">
      <form onSubmit={handlePublishSubmit} className="flex flex-col gap-3.5">
        
        {/* Cabecera del Editor */}
        <div className="flex justify-between items-center">
          <span className="text-xs font-bold text-primary uppercase tracking-wider">
            Publicar en la Comunidad
          </span>
          
          {/* Selector de Escuela Profesional */}
          <select
            value={schoolId}
            onChange={(e) => setSchoolId(e.target.value)}
            className="text-xs font-bold text-primary bg-surface/50 border border-secondary/10 px-3 py-1.5 rounded-lg outline-none focus:border-primary cursor-pointer"
          >
            <option value="">Escuela (Por Defecto)</option>
            {SCHOOLS_BY_FACULTY.map((group) => (
              <optgroup key={group.faculty.id} label={`${group.faculty.name} (${group.faculty.abbreviation})`}>
                {group.schools.map((school) => (
                  <option key={school.id} value={school.id}>
                    {school.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        {/* Indicador de Alerta Urgente */}
        {isAlert && (
          <div className="flex items-center gap-2 px-3 py-2 bg-primary/5 border border-primary/20 rounded-xl text-xs font-bold text-primary">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>Modo Alerta Urgente activo — tu publicación tendrá prioridad en el feed.</span>
          </div>
        )}

        {/* Text Area */}
        <div className="relative">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={
              isAlert
                ? '⚠️ Describe la situación urgente en el campus...'
                : '¿Qué está pasando hoy en el campus universitario? Comparte anuncios, apuntes o consultas...'
            }
            maxLength={2000}
            rows={3}
            className={`w-full p-4 border rounded-xl text-sm font-medium text-primary placeholder:text-neutral-gray/50 outline-none focus:ring-4 resize-none transition-colors ${
              isAlert
                ? 'border-primary/30 focus:ring-primary/10 focus:border-primary'
                : 'border-secondary/15 focus:ring-primary/10 focus:border-primary'
            }`}
          />
          
          {/* Contador de Caracteres */}
          <span className="absolute bottom-3 right-3 text-[10px] font-bold text-neutral-gray/60">
            {content.length}/2000
          </span>
        </div>

        {/* Preview de imagen adjunta */}
        {attachedImage && (
          <div className="relative rounded-xl overflow-hidden border border-secondary/15 bg-surface">
            <img
              src={attachedImage}
              alt={attachedImageName || 'Imagen adjunta'}
              className="w-full max-h-48 object-cover"
            />
            <button
              type="button"
              onClick={handleRemoveImage}
              className="absolute top-2 right-2 bg-black/50 text-white w-6 h-6 rounded-full flex items-center justify-center hover:bg-black/70 transition-colors cursor-pointer"
              title="Eliminar imagen"
            >
              <X className="w-3.5 h-3.5" />
            </button>
            <div className="px-3 py-1.5 text-[10px] font-medium text-neutral-gray truncate">
              📎 {attachedImageName}
            </div>
          </div>
        )}

        {/* Input de archivo oculto */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={handleImageAttach}
        />

        {/* Barra de Herramientas y Envío */}
        <div className="flex justify-between items-center pt-2 border-t border-secondary/5">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={`p-2 rounded-lg transition-colors cursor-pointer focus:outline-none ${
                attachedImage
                  ? 'text-primary bg-primary/10 border border-primary/20'
                  : 'text-neutral-gray hover:text-primary hover:bg-primary/5'
              }`}
              title="Adjuntar Imagen (PNG, JPG, WebP — máx 5MB)"
            >
              <Image className="w-5 h-5" />
            </button>
            <button
              type="button"
              className="p-2 text-neutral-gray hover:text-primary hover:bg-primary/5 rounded-lg transition-colors cursor-pointer focus:outline-none"
              title="Adjuntar Archivo (próximamente)"
              onClick={() => alert('La subida de archivos PDF/DOCX estará disponible próximamente.')}
            >
              <File className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => setIsAlert(!isAlert)}
              className={`p-2 rounded-lg transition-colors cursor-pointer focus:outline-none ${
                isAlert
                  ? 'text-primary bg-primary/10 border border-primary/20'
                  : 'text-neutral-gray hover:text-primary hover:bg-primary/5'
              }`}
              title="Marcar como Alerta Urgente"
            >
              <AlertTriangle className="w-5 h-5" />
            </button>
          </div>

          <Button
            type="submit"
            disabled={!content.trim() || content.length > 2000}
            className="w-auto py-2.5 px-5 font-extrabold flex items-center gap-1.5"
          >
            Publicar
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}
