'use client';

import React, { useState } from 'react';
import { X, Heart, RefreshCw, Info } from 'lucide-react';
import { ProfileSplitCard, ProfileCardData } from './ProfileSplitCard';
import { api } from '../../app/lib/api';
import { Alert } from './Alert';

interface DiscoveryDeckProps {
  profiles: ProfileCardData[];
  onMatch: (matchData: { chatChannelId: string | null; contactInfo: ProfileCardData }) => void;
  onQueueEmpty: () => void;
  onInteractionError: (error: { message: string; code: string } | null) => void;
}

export function DiscoveryDeck({
  profiles,
  onMatch,
  onQueueEmpty,
  onInteractionError,
}: DiscoveryDeckProps) {
  const [deck, setDeck] = useState<ProfileCardData[]>(profiles);

  // Sincronizar deck si los perfiles provistos cambian
  React.useEffect(() => {
    setDeck(profiles);
  }, [profiles]);

  const handleInteraction = async (action: 'like' | 'dislike') => {
    if (deck.length === 0) return;

    // Obtener perfil actual al tope de la pila
    const currentProfile = deck[0];
    const remainingDeck = deck.slice(1);

    // Actualización optimista: remover inmediatamente la tarjeta de la cola local
    setDeck(remainingDeck);
    onInteractionError(null);

    // Si la cola queda vacía, avisar al padre
    if (remainingDeck.length === 0) {
      onQueueEmpty();
    }

    try {
      const response = await api.post('/matchmaking/interact', {
        receiver_profile_id: currentProfile.id,
        action,
      });

      const data = response.data;

      // Si es un match confirmado (Double Match Aceptado)
      if (data.match && data.status === 'accepted') {
        onMatch({
          chatChannelId: data.chat_channel_id,
          contactInfo: data.contact_info || currentProfile,
        });
      }
    } catch (err: any) {
      // Rollback gracioso ante fallos del API
      setDeck([currentProfile, ...remainingDeck]);

      const errorMessage = err.response?.data?.message || 'Error al procesar la conexión.';
      const errorCode = err.response?.data?.code || 'ERR_MATCH_INTERACTION_FAILED';

      onInteractionError({
        message: errorMessage,
        code: errorCode,
      });
    }
  };

  if (deck.length === 0) {
    return (
      <div className="bg-white border border-secondary/15 rounded-3xl p-10 shadow-sm text-center flex flex-col items-center justify-center min-h-[300px] select-none gap-4">
        <span className="text-4xl animate-pulse">🎓</span>
        <h4 className="text-sm font-extrabold text-primary">
          Cola de Descubrimiento Completada
        </h4>
        <p className="text-xs text-neutral-gray max-w-xs leading-relaxed font-medium">
          No hay más perfiles académicos disponibles con los filtros seleccionados. Intenta ampliar tus criterios o agregar nuevas habilidades.
        </p>
      </div>
    );
  }

  const currentProfile = deck[0];

  return (
    <div className="flex flex-col gap-6 select-none">
      
      {/* Contenedor de la Tarjeta del Perfil Actual */}
      <div className="relative">
        <ProfileSplitCard profile={currentProfile} />
      </div>

      {/* Panel Inferior de Acciones */}
      <div className="flex justify-center items-center gap-6">
        
        {/* Botón Omitir / Descartar (30-day Cooldown) */}
        <button
          onClick={() => handleInteraction('dislike')}
          className="w-12 h-12 bg-white border border-secondary/20 hover:border-primary/50 text-neutral-gray hover:text-primary rounded-full flex items-center justify-center shadow-sm transition-all cursor-pointer outline-none focus:ring-4 focus:ring-primary/10"
          title="Omitir (30 días de cooldown)"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Botón Conectar / Hacer Match (Like) */}
        <button
          onClick={() => handleInteraction('like')}
          className="py-3 px-8 bg-primary hover:bg-primary/95 text-surface font-black text-sm rounded-xl shadow-md flex items-center gap-2 cursor-pointer transition-all border border-primary/20 outline-none focus:ring-4 focus:ring-primary/10"
          title="Conectar"
        >
          <Heart className="w-4 h-4 fill-surface text-surface" />
          ¡Conectar / Hacer Match!
        </button>
      </div>
    </div>
  );
}
