'use client';

import React, { useState, useEffect } from 'react';
import { Radio, Users, Clock, MapPin, Info, RefreshCw, ChevronRight } from 'lucide-react';
import { CampusRadar } from '../../../components/ui/CampusRadar';
import Image from 'next/image';

interface CampusSpot {
  id: string;
  name: string;
  description: string;
  image: string;
  category: 'comedor' | 'biblioteca' | 'admin' | 'pabellon';
  hours: string;
  location: string;
}

const CAMPUS_SPOTS: CampusSpot[] = [
  {
    id: 'comedor',
    name: 'Comedor Universitario',
    description: 'Servicio de alimentación subsidiado para estudiantes UNSCH. Almuerzo completo a precio accesible.',
    image: '/images/campus/comedor.jpg',
    category: 'comedor',
    hours: 'Lun–Vie 12:00 – 15:00',
    location: 'Residencia Universitaria — Jr. Independencia N° 1217',
  },
  {
    id: 'biblioteca',
    name: 'Biblioteca Central',
    description: 'Repositorio académico con más de 80,000 volúmenes. Cuatro pisos de salas de estudio y acceso a bases de datos científicas.',
    image: '/images/campus/biblioteca.jpg',
    category: 'biblioteca',
    hours: 'Lun–Vie 07:30 – 20:00 · Sáb 08:00 – 13:00',
    location: 'Ciudad Universitaria — Av. Independencia s/n, Ayacucho',
  },
  {
    id: 'rectorado',
    name: 'Rectorado',
    description: 'Centro administrativo de la UNSCH. Trámites de matrícula, constancias, certificados y gestión académica.',
    image: '/images/campus/rectorado.jpg',
    category: 'admin',
    hours: 'Lun–Vie 08:00 – 16:30',
    location: 'Rectorado — Portal Independencia Nº 57',
  },
  {
    id: 'campus',
    name: 'Ciudad Universitaria',
    description: 'Campus principal de la UNSCH, sede de las facultades de ingeniería, ciencias y humanidades.',
    image: '/images/campus/campus-unsch.jpg',
    category: 'pabellon',
    hours: 'Abierto todos los días',
    location: 'Ciudad Universitaria — Av. Independencia s/n, Ayacucho',
  },
];

const getCategoryStyle = (category: CampusSpot['category']) => {
  switch (category) {
    case 'comedor':    return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'biblioteca': return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'admin':      return 'bg-purple-50 text-purple-700 border-purple-200';
    case 'pabellon':   return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  }
};

const getCategoryLabel = (category: CampusSpot['category']) => {
  switch (category) {
    case 'comedor':    return 'Servicio Alimentario';
    case 'biblioteca': return 'Centro Académico';
    case 'admin':      return 'Administración';
    case 'pabellon':   return 'Campus Principal';
  }
};

export default function RadarPage() {
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [selectedSpot, setSelectedSpot] = useState<CampusSpot | null>(null);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setLastUpdated(
        now.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
      );
    };
    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col gap-8 select-none max-w-5xl mx-auto">

      {/* ── Cabecera Institucional ── */}
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-black text-primary flex items-center gap-2 tracking-tight">
          <Radio className="w-6 h-6 text-primary" />
          Campus Radar — Estado en Tiempo Real
        </h1>
        <p className="text-xs text-neutral-gray font-medium leading-relaxed max-w-2xl">
          Reporta y consulta la afluencia actual en los principales espacios del campus UNSCH.
          El estado se consolida tras recibir 3 reportes coincidentes de estudiantes verificados.
        </p>
        <div className="flex items-center gap-2 text-[10px] text-neutral-gray/70 font-bold">
          <RefreshCw className="w-3 h-3" />
          <span>Actualizado: {lastUpdated || '...'} — se refresca cada 60 s</span>
        </div>
      </div>

      {/* ── Layout Principal ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* Columna izquierda: Widget del Radar */}
        <div className="lg:col-span-2 flex flex-col gap-5">
          <CampusRadar />

          {/* Leyenda de estados */}
          <div className="bg-white border border-secondary/15 rounded-2xl p-4 shadow-sm flex flex-col gap-3">
            <span className="text-xs font-bold text-primary uppercase tracking-wider">Leyenda de Estados</span>
            <div className="flex flex-col gap-2">
              {[
                { color: 'bg-green-100 text-green-800 border-green-200',  label: 'Fluido',     desc: 'Sin espera. Acceso directo.' },
                { color: 'bg-yellow-100 text-yellow-800 border-yellow-200', label: 'Cola Media', desc: 'Espera de 5–15 minutos.' },
                { color: 'bg-primary/10 text-primary border-primary/20',  label: 'Colapsado', desc: 'Alta congestión, más de 15 min.' },
                { color: 'bg-neutral-gray/10 text-neutral-gray/70 border-neutral-gray/20', label: 'Sin Datos', desc: 'Sin reportes recientes.' },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-2.5">
                  <span className={`text-[9px] font-bold px-2 py-0.5 border rounded-full shrink-0 ${item.color}`}>
                    {item.label}
                  </span>
                  <span className="text-[10px] text-neutral-gray font-medium">{item.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Columna derecha: Tarjetas de espacios */}
        <div className="lg:col-span-3 flex flex-col gap-4">
          <span className="text-xs font-bold text-primary uppercase tracking-wider">
            Espacios del Campus
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {CAMPUS_SPOTS.map((spot) => (
              <div
                key={spot.id}
                onClick={() => setSelectedSpot(spot)}
                className="bg-white border border-secondary/15 rounded-2xl overflow-hidden shadow-sm hover:shadow-md hover:border-primary/20 transition-all cursor-pointer group"
              >
                {/* Imagen del espacio */}
                <div className="relative w-full h-36 overflow-hidden">
                  <Image
                    src={spot.image}
                    alt={spot.name}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                  <span className={`absolute top-2 left-2 text-[9px] font-bold px-2 py-0.5 border rounded-full ${getCategoryStyle(spot.category)}`}>
                    {getCategoryLabel(spot.category)}
                  </span>
                </div>

                {/* Contenido */}
                <div className="p-3.5 flex flex-col gap-2">
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-black text-primary leading-tight">{spot.name}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-neutral-gray/50 flex-shrink-0 mt-0.5 group-hover:text-primary transition-colors" />
                  </div>
                  <p className="text-[10px] text-neutral-gray font-medium leading-relaxed line-clamp-2">
                    {spot.description}
                  </p>
                  <div className="flex flex-col gap-1 border-t border-secondary/10 pt-2">
                    <div className="flex items-center gap-1.5 text-[9px] text-neutral-gray font-bold">
                      <Clock className="w-3 h-3 text-secondary flex-shrink-0" />
                      <span>{spot.hours}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[9px] text-neutral-gray font-bold">
                      <MapPin className="w-3 h-3 text-secondary flex-shrink-0" />
                      <span>{spot.location}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Nota legal */}
          <div className="p-4 bg-tertiary/5 border border-tertiary/15 rounded-2xl flex gap-3">
            <Info className="w-5 h-5 text-tertiary flex-shrink-0 mt-0.5" />
            <div className="flex flex-col gap-1">
              <p className="text-[10px] text-tertiary font-bold leading-relaxed">
                <strong>Participación Comunitaria:</strong> El radar funciona gracias a los reportes de la comunidad estudiantil. 
                Cada reporte es anónimo y se valida automáticamente con 3 confirmaciones coincidentes antes de publicarse.
              </p>
              <p className="text-[10px] text-tertiary/80 font-semibold leading-relaxed">
                Los estados se resetean automáticamente a medianoche para garantizar información actualizada cada día.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de detalle de espacio */}
      {selectedSpot && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedSpot(null)}
        >
          <div
            className="bg-white rounded-3xl overflow-hidden shadow-xl max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative w-full h-48">
              <Image
                src={selectedSpot.image}
                alt={selectedSpot.name}
                fill
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <button
                onClick={() => setSelectedSpot(null)}
                className="absolute top-3 right-3 bg-white/20 backdrop-blur-sm text-white w-7 h-7 rounded-full flex items-center justify-center hover:bg-white/30 transition-colors cursor-pointer"
              >
                ✕
              </button>
              <div className="absolute bottom-3 left-4">
                <h2 className="text-white font-black text-base">{selectedSpot.name}</h2>
                <span className={`text-[9px] font-bold px-2 py-0.5 border rounded-full ${getCategoryStyle(selectedSpot.category)}`}>
                  {getCategoryLabel(selectedSpot.category)}
                </span>
              </div>
            </div>
            <div className="p-5 flex flex-col gap-3">
              <p className="text-xs text-neutral-gray font-medium leading-relaxed">
                {selectedSpot.description}
              </p>
              <div className="flex flex-col gap-2 bg-surface p-3 rounded-xl border border-secondary/10">
                <div className="flex items-center gap-2 text-xs text-primary font-bold">
                  <Clock className="w-4 h-4 text-secondary flex-shrink-0" />
                  <span>{selectedSpot.hours}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-primary font-bold">
                  <MapPin className="w-4 h-4 text-secondary flex-shrink-0" />
                  <span>{selectedSpot.location}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
