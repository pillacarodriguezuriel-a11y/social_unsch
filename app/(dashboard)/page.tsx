'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PostPublisher } from '../../components/ui/PostPublisher';
import { FeedList } from '../../components/ui/FeedList';
import { CampusRadar } from '../../components/ui/CampusRadar';
import { api } from '../lib/api';
import { Alert } from '../../components/ui/Alert';

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

export default function DashboardPage() {
  const router = useRouter();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [errorAlert, setErrorAlert] = useState<{ message: string; code: string } | null>(null);

  const fetchFeedPosts = async () => {
    try {
      const response = await api.get('/feed');
      // Añadir propiedades de likes locales simulados para demo
      const postsWithLikes = (response?.data?.data || []).map((p: any) => ({
        ...p,
        likes: Math.floor(Math.random() * 12),
        liked: false,
      }));
      setPosts(postsWithLikes);
    } catch (err: any) {
      console.error('Error al cargar posts:', err);
      setPosts([]); // Fallback seguro a arreglo vacío
    }
  };

  useEffect(() => {
    fetchFeedPosts();
  }, []);

  /**
   * Manejador de publicación optimista
   */
  const handlePublishPost = async (optimisticPost: FeedPost, apiPromise: Promise<any>) => {
    // 1. Agregar inmediatamente al estado (Actualización Optimista)
    setPosts((prevPosts) => [optimisticPost, ...prevPosts]);
    setErrorAlert(null);

    try {
      const response = await apiPromise;
      const data = response.data;

      // 2. Éxito: Reemplazar el ID temporal por el ID final retornado
      setPosts((prevPosts) =>
        prevPosts.map((p) =>
          p.id === optimisticPost.id ? { ...p, id: data.post_id } : p
        )
      );
    } catch (err: any) {
      // 3. Fallo: Rollback del post optimista y desplegar alerta de error
      setPosts((prevPosts) => prevPosts.filter((p) => p.id !== optimisticPost.id));

      const errorMessage = err.response?.data?.message || 'Error al publicar en el feed.';
      const errorCode = err.response?.data?.code || 'ERR_FEED_POST_FAILED';

      setErrorAlert({
        message: errorMessage,
        code: errorCode,
      });
    }
  };

  const handleLikeToggle = (postId: string) => {
    setPosts((prevPosts) =>
      prevPosts.map((p) => {
        if (p.id === postId) {
          const liked = !p.liked;
          return {
            ...p,
            liked,
            likes: (p.likes || 0) + (liked ? 1 : -1),
          };
        }
        return p;
      })
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 select-none">
      
      {/* Columna Central (Workspace del Feed y Publicador) - Toma 2 columnas en lg */}
      <div className="lg:col-span-2 flex flex-col gap-6">
        
        {/* Banner de error de publicación */}
        {errorAlert && (
          <Alert
            title="Error de Publicación"
            description={errorAlert.message}
            variant="error"
          />
        )}

        {/* Publicador de posts */}
        <PostPublisher onPublish={handlePublishPost} />

        {/* Listado de posts del feed */}
        <FeedList posts={posts} onLikeToggle={handleLikeToggle} />
      </div>

      {/* Columna Derecha (Campus Radar & Utilidades) - Toma 1 columna en lg */}
      <div className="flex flex-col gap-6">
        
        {/* Widget del Campus Radar en tiempo real */}
        <CampusRadar />

        {/* Widget de Matchmaking Académico de prueba */}
        <div className="bg-white border border-secondary/15 rounded-2xl p-5 shadow-sm text-left flex flex-col gap-3">
          <span className="text-xs font-bold text-primary uppercase tracking-wider block">
            Sugerencia de Conexión
          </span>
          <div className="p-3 bg-surface border border-secondary/10 rounded-xl flex flex-col gap-1.5">
            <span className="text-xs font-bold text-primary">Proyecto: "Sistema Integrado UNSCH"</span>
            <span className="text-[10px] text-neutral-gray font-medium">Buscando: Desarrollador Backend</span>
            <button 
              onClick={() => router.push('/matchmaking')}
              className="mt-2 text-center text-[10px] font-extrabold py-2 px-3 bg-primary text-surface rounded-lg hover:bg-primary/95 cursor-pointer outline-none focus:ring-2 focus:ring-primary/25"
            >
              Ver Detalles del Proyecto
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
