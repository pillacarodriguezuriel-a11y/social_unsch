'use client';

import React, { useState } from 'react';
import { 
  X, 
  MapPin, 
  Clock, 
  Users, 
  Coins, 
  ShieldCheck, 
  Phone, 
  MessageSquare,
  Mail,
  User,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { Button } from './Button';

export interface CarpoolingRouteData {
  route_id: string;
  origin_district: string;
  destination: string;
  departure_time: string;
  available_seats: number;
  price_soles: number;
  driver_alias: string;
}

interface RouteBookingProps {
  isOpen: boolean;
  onClose: () => void;
  route: CarpoolingRouteData | null;
  onBookingComplete?: () => void;
}

export function RouteBooking({ isOpen, onClose, route, onBookingComplete }: RouteBookingProps) {
  // Booking state machine: 'idle' | 'requesting' | 'requested' | 'confirming' | 'confirmed'
  const [bookingState, setBookingState] = useState<'idle' | 'requesting' | 'requested' | 'confirming' | 'confirmed'>('idle');
  const [unmaskedContacts, setUnmaskedContacts] = useState<{
    driver_phone: string;
    driver_whatsapp: string;
    driver_email: string;
    driver_name: string;
  } | null>(null);

  if (!isOpen || !route) return null;

  const handleRequestSeat = async () => {
    setBookingState('requesting');
    
    // Simulate API call to POST /api/v1/carpooling/:route_id/request
    await new Promise((resolve) => setTimeout(resolve, 1500));
    
    setBookingState('requested');
  };

  // Simulated button for driver approving the booking to demonstrate unmasking handshake
  const handleDriverApproveSimulation = async () => {
    setBookingState('confirming');

    // Simulate API call to PATCH /api/v1/carpooling/:route_id/confirm
    await new Promise((resolve) => setTimeout(resolve, 1500));

    setUnmaskedContacts({
      driver_name: 'Mateo Quispe Huamán',
      driver_phone: '+51 966 458 120',
      driver_whatsapp: 'https://wa.me/51966458120',
      driver_email: 'mquispeh@unsch.edu.pe',
    });
    setBookingState('confirmed');

    if (onBookingComplete) {
      onBookingComplete();
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden select-none">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/45 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />

      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white shadow-xl flex flex-col justify-between text-left animate-in slide-in-from-right duration-300">
          
          {/* Header */}
          <div className="px-6 py-5 border-b border-secondary/15 flex items-center justify-between">
            <h2 className="text-sm font-black text-primary flex items-center gap-1.5">
              <ShieldCheck className="w-5 h-5 text-primary" />
              Coordinación de Viaje - Ley N° 29733
            </h2>
            <button 
              onClick={onClose}
              className="text-neutral-gray hover:text-primary transition-colors cursor-pointer focus:outline-none"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
            
            {/* Detalles de la Ruta */}
            <div className="bg-surface/55 border border-secondary/15 rounded-2xl p-4 flex flex-col gap-3">
              <span className="text-[10px] font-black text-primary uppercase tracking-wider block border-b border-secondary/5 pb-1">
                Información del Trayecto
              </span>

              <div className="flex flex-col gap-2.5 text-xs text-neutral-gray font-semibold">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-secondary shrink-0" />
                  <span>Origen: <strong className="text-primary">{route.origin_district}</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary shrink-0" />
                  <span>Destino: <strong className="text-primary">{route.destination}</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-secondary shrink-0" />
                  <span>Salida: <strong className="text-primary">{new Date(route.departure_time).toLocaleString('es-ES')}</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-secondary shrink-0" />
                  <span>Asientos Disponibles: <strong className="text-primary">{route.available_seats} vacantes</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <Coins className="w-4 h-4 text-secondary shrink-0" />
                  <span>Precio Sugerido: <strong className="text-primary">S/. {route.price_soles.toFixed(2)}</strong></span>
                </div>
              </div>
            </div>

            {/* Aviso de Privacidad Ley 29733 */}
            <div className="p-4 bg-tertiary/5 border border-tertiary/15 rounded-2xl flex gap-3 text-left">
              <AlertCircle className="w-5 h-5 text-tertiary flex-shrink-0 mt-0.5" />
              <div className="flex flex-col gap-1">
                <p className="text-xs text-tertiary font-bold leading-relaxed">
                  <strong>Protección de Datos Personales:</strong>
                </p>
                <p className="text-[10px] text-tertiary/90 leading-relaxed font-semibold">
                  De conformidad con la Ley N° 29733, los datos de contacto y número de teléfono del conductor se mantienen ocultos bajo el alias <strong>{route.driver_alias}</strong>. Al solicitar tu asiento, tu carrera y ciclo se compartirán de forma protegida para la aprobación de seguridad.
                </p>
              </div>
            </div>

            {/* Estado de la Reserva */}
            {bookingState === 'idle' && (
              <div className="flex flex-col gap-2 mt-4">
                <p className="text-[10px] text-neutral-gray font-bold text-center">
                  ¿Deseas viajar con este conductor? Confirma para registrar tu solicitud.
                </p>
                <Button
                  onClick={handleRequestSeat}
                  className="bg-primary text-surface font-extrabold py-3.5 rounded-xl hover:bg-primary/95 shadow-sm"
                >
                  Solicitar Asiento
                </Button>
              </div>
            )}

            {bookingState === 'requesting' && (
              <div className="py-8 text-center flex flex-col items-center gap-3">
                <span className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-bold text-primary">Procesando solicitud de asiento...</span>
              </div>
            )}

            {bookingState === 'requested' && (
              <div className="flex flex-col gap-4 border border-secondary/15 rounded-2xl p-4 bg-surface/30">
                <div className="flex gap-2">
                  <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5 animate-bounce" />
                  <div>
                    <h4 className="text-xs font-black text-primary">Solicitud Enviada Correctamente</h4>
                    <p className="text-[10px] text-neutral-gray font-semibold mt-1">
                      Tu solicitud de asiento está en espera bajo el estado `SEAT_REQUESTED`.
                    </p>
                  </div>
                </div>

                <div className="border-t border-secondary/10 pt-3 flex flex-col gap-2">
                  <p className="text-[9px] text-secondary font-bold">
                    [MÓDULO DE SIMULACIÓN PARA EVALUACIÓN]:
                  </p>
                  <Button
                    onClick={handleDriverApproveSimulation}
                    className="bg-primary text-surface font-extrabold text-xs py-2.5 rounded-xl hover:bg-primary/95 flex items-center justify-center gap-1.5"
                  >
                    Aprobar Reserva (Simular Conductor)
                  </Button>
                </div>
              </div>
            )}

            {bookingState === 'confirming' && (
              <div className="py-8 text-center flex flex-col items-center gap-3">
                <span className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-bold text-primary">Estableciendo canal seguro de comunicación...</span>
              </div>
            )}

            {/* 3. Unmasking Logic: Confirmación exitosa desvela contactos */}
            {bookingState === 'confirmed' && unmaskedContacts && (
              <div className="flex flex-col gap-4 border border-emerald-300 rounded-2xl p-5 bg-emerald-50/45 animate-in fade-in duration-300">
                <div className="flex gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-black text-emerald-800">¡Reserva Confirmada (`SEAT_CONFIRMED`)!</h4>
                    <p className="text-[10px] text-emerald-700 font-bold mt-1">
                      La ruta ha sido aprobada. A continuación se desvelan las credenciales de comunicación para coordinar el viaje en el campus.
                    </p>
                  </div>
                </div>

                <div className="bg-white border border-emerald-200/50 p-4 rounded-xl flex flex-col gap-3 text-xs text-left">
                  <div className="flex items-center gap-2 text-primary font-bold">
                    <User className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Conductor: <strong className="text-emerald-800">{unmaskedContacts.driver_name}</strong></span>
                  </div>

                  <div className="flex items-center gap-2 text-primary font-bold">
                    <Mail className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Correo: <strong className="text-emerald-800">{unmaskedContacts.driver_email}</strong></span>
                  </div>

                  <div className="flex items-center gap-2 text-primary font-bold">
                    <Phone className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Teléfono: <strong className="text-emerald-800">{unmaskedContacts.driver_phone}</strong></span>
                  </div>

                  <div className="flex gap-2 mt-2 pt-2 border-t border-emerald-100">
                    <a
                      href={unmaskedContacts.driver_whatsapp}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-black uppercase text-center flex items-center justify-center gap-1.5 shadow-sm transition-colors"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      Chat WhatsApp
                    </a>
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* Footer Warning */}
          <div className="px-6 py-4 bg-surface border-t border-secondary/15">
            <span className="text-[9px] font-bold text-neutral-gray leading-relaxed block">
              Al confirmar el viaje, aceptas compartir tu ubicación aproximada en el campus durante la ruta académica para fines de seguridad.
            </span>
          </div>

        </div>
      </div>
    </div>
  );
}
