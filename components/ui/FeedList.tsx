'use client';

import React from 'react';
import { Heart, MessageCircle, Share2, ShieldCheck, Clock } from 'lucide-react';

interface FeedPost {
  id: string;
  user_id: string;
  faculty_id: number | null;
  professional_school_id: number | null;
  content: string;
  is_visible: boolean;
  created_at: string;
  author_name: string;
  author_role: string;
  likes?: number;
  liked?: boolean;
}

interface FeedListProps {
  posts: FeedPost[];
  onLikeToggle?: (postId: string) => void;
}

export function FeedList({ posts, onLikeToggle }: FeedListProps) {
  const getRoleLabel = (role: string) => {
    switch (role.toLowerCase()) {
      case 'student':
      case 'estudiante':
        return 'Estudiante';
      case 'alumnus':
      case 'egresado':
        return 'Egresado';
      case 'professor':
      case 'docente':
        return 'Docente';
      case 'administrator':
      case 'administrativo':
        return 'Moderador';
      default:
        return 'Comunidad';
    }
  };

  const getSchoolLabel = (schoolId: number | null) => {
    const schools: Record<number, string> = {
      1: 'Ingeniería de Sistemas',
      2: 'Ingeniería Civil',
      3: 'Administración de Empresas',
      4: 'Derecho',
    };
    return schoolId ? schools[schoolId] || `Escuela ${schoolId}` : 'Foro General';
  };

  const formatTimestamp = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);

      if (diffMins < 1) return 'Hace unos instantes';
      if (diffMins < 60) return `Hace ${diffMins} min`;
      if (diffHours < 24) return `Hace ${diffHours} h`;
      
      return date.toLocaleDateString('es-PE', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'Hace poco';
    }
  };

  if (posts.length === 0) {
    return (
      <div className="bg-white border border-secondary/15 rounded-2xl p-8 text-center select-none flex flex-col items-center gap-3">
        <span className="text-3xl">📭</span>
        <h4 className="text-sm font-bold text-primary">No hay publicaciones disponibles</h4>
        <p className="text-xs text-neutral-gray max-w-xs leading-relaxed">
          Sé el primero en compartir anuncios, dudas o apuntes académicos seleccionando tu escuela profesional.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 select-none">
      {posts.map((post) => (
        <article
          key={post.id}
          className={`bg-white border rounded-2xl p-5 shadow-sm text-left flex flex-col gap-3.5 transition-all duration-300 ${
            post.id.startsWith('temp-') ? 'opacity-65 border-secondary/25 bg-surface/10' : 'border-secondary/15'
          }`}
        >
          {/* Cabecera de la Publicación */}
          <div className="flex justify-between items-start">
            <div className="flex gap-3">
              {/* Avatar */}
              <div className="w-10 h-10 rounded-full bg-primary/5 border border-primary/10 flex items-center justify-center font-bold text-primary uppercase text-sm">
                {post.author_name.substring(0, 2)}
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-extrabold text-primary">{post.author_name}</span>
                  <ShieldCheck className="w-4 h-4 text-secondary" title="Usuario Institucional Verificado" />
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] font-bold bg-primary/5 text-primary border border-primary/10 px-1.5 py-0.5 rounded-md">
                    {getRoleLabel(post.author_role)}
                  </span>
                  <span className="text-[10px] font-bold bg-surface border border-secondary/15 text-neutral-gray px-1.5 py-0.5 rounded-md">
                    {getSchoolLabel(post.professional_school_id)}
                  </span>
                </div>
              </div>
            </div>
            
            {/* Timestamp */}
            <div className="flex items-center gap-1 text-[10px] font-bold text-neutral-gray/60">
              <Clock className="w-3.5 h-3.5" />
              <span>{formatTimestamp(post.created_at)}</span>
            </div>
          </div>

          {/* Cuerpo del Mensaje */}
          <p className="text-sm font-medium leading-relaxed text-primary/90 whitespace-pre-wrap">
            {post.content}
          </p>

          {/* Botones de Interacción */}
          <div className="flex gap-6 pt-3.5 border-t border-secondary/5 text-neutral-gray">
            <button
              onClick={() => onLikeToggle && onLikeToggle(post.id)}
              disabled={post.id.startsWith('temp-')}
              className={`flex items-center gap-1.5 text-xs font-bold transition-colors cursor-pointer focus:outline-none ${
                post.liked ? 'text-primary' : 'hover:text-primary'
              }`}
            >
              <Heart className={`w-4 h-4 ${post.liked ? 'fill-primary text-primary' : ''}`} />
              <span>{post.likes || 0}</span>
            </button>
            
            <button
              disabled={post.id.startsWith('temp-')}
              className="flex items-center gap-1.5 text-xs font-bold hover:text-primary transition-colors cursor-pointer focus:outline-none"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Comentar</span>
            </button>

            <button
              disabled={post.id.startsWith('temp-')}
              className="flex items-center gap-1.5 text-xs font-bold hover:text-primary transition-colors cursor-pointer focus:outline-none"
            >
              <Share2 className="w-4 h-4" />
              <span>Compartir</span>
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
