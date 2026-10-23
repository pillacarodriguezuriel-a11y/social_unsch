'use client';

import React from 'react';
import { X, Check, Heart, Mail, ShieldAlert } from 'lucide-react';
import { ProfileCardData } from './ProfileSplitCard';

interface MatchCelebrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  matchData: {
    chatChannelId: string | null;
    contactInfo: ProfileCardData;
  } | null;
}

export function MatchCelebrationModal({ isOpen, onClose, matchData }: MatchCelebrationModalProps) {
  if (!isOpen || !matchData) return null;

  const { contactInfo } = matchData;

  const handleOpenChat = () => {
    // Redirigir o iniciar el canal de chat (simulado para alcance del dashboard)
    alert(`Mensajería UNSCH: Conectando al canal de chat privado: ${matchData.chatChannelId || 'canal-general'}`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-primary/20 backdrop-blur-md transition-opacity duration-300">
      
      {/* Tarjeta del Modal */}
      <div className="bg-white border border-secondary/15 rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl relative select-none flex flex-col gap-6 transform scale-100 transition-all duration-300">
        
        {/* Botón de Cerrar */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full text-neutral-gray hover:bg-surface hover:text-primary transition-colors cursor-pointer outline-none focus:outline-none"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Cabecera de Celebración */}
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-14 h-14 bg-primary/10 border border-primary/25 rounded-full flex items-center justify-center relative animate-bounce">
            <Heart className="w-6 h-6 text-primary fill-primary" />
            <span className="absolute -bottom-1 -right-1 bg-green-500 border-2 border-white rounded-full p-0.5">
              <Check className="w-3 h-3 text-white" />
            </span>
          </div>
          <h2 className="text-xl font-black text-primary tracking-tight leading-snug">
            ¡Conexión Sancristobalina Confirmada!
          </h2>
          <p className="text-xs text-neutral-gray font-medium leading-relaxed">
            Ambos han mostrado interés mutuo. Los tokens de contacto han sido revelados de forma segura cumpliendo con la <strong>Ley N° 29733 (Perú)</strong>.
          </p>
        </div>

        {/* Ficha de Contacto Revelada */}
        <div className="p-4 bg-surface border border-secondary/15 rounded-2xl flex flex-col gap-3 text-left">
          <div>
            <span className="text-[10px] font-black text-secondary uppercase tracking-widest block">
              Contacto Verificado
            </span>
            <span className="text-sm font-extrabold text-primary block mt-0.5">
              {contactInfo.full_name}
            </span>
            <span className="text-[10px] font-bold text-neutral-gray block mt-0.5">
              {contactInfo.role === 'student' ? 'Estudiante' : 'Miembro UNSCH'}
            </span>
          </div>
          
          <div className="flex items-center gap-2 pt-2.5 border-t border-secondary/5 text-xs text-primary font-bold">
            <Mail className="w-4 h-4 text-secondary flex-shrink-0" />
            <span className="truncate">{contactInfo.email || 'correo@unsch.edu.pe'}</span>
          </div>
        </div>

        {/* Advertencia de Cumplimiento Legal */}
        <div className="p-3 bg-tertiary/5 border border-tertiary/20 rounded-xl text-left flex gap-2">
          <ShieldAlert className="w-4 h-4 text-tertiary flex-shrink-0 mt-0.5" />
          <p className="text-[9px] leading-relaxed text-tertiary font-bold">
            La información expuesta debe ser utilizada estrictamente para propósitos de colaboración académica y proyectos universitarios.
          </p>
        </div>

        {/* Botón de Acción */}
        <button
          onClick={handleOpenChat}
          className="w-full py-3 px-5 text-sm font-black text-surface bg-primary rounded-xl hover:bg-primary/95 transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer border border-primary/20 outline-none focus:ring-4 focus:ring-primary/10"
        >
          Abrir Canal de Chat ➔
        </button>
      </div>
    </div>
  );
}
