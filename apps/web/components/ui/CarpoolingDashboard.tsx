'use client';

import React, { useState, useEffect } from 'react';
import { 
  Car, 
  MapPin, 
  Clock, 
  Users, 
  Coins, 
  Search, 
  Compass,
  ArrowRightLeft,
  Navigation
} from 'lucide-react';
import { RouteBooking, CarpoolingRouteData } from './RouteBooking';
import { Button } from './Button';

const INITIAL_ROUTES: CarpoolingRouteData[] = [
  {
    route_id: 'r1',
    origin_district: 'San Juan Bautista',
    destination: 'Pabellón W',
    departure_time: '2026-07-06T07:30:00Z',
    available_seats: 3,
    price_soles: 1.50,
    driver_alias: 'Rayo Sancristobalino'
  },
  {
    route_id: 'r2',
    origin_district: 'Carmen Alto',
    destination: 'Biblioteca Central',
    departure_time: '2026-07-06T08:00:00Z',
    available_seats: 4,
    price_soles: 2.00,
    driver_alias: 'Churre UNSCH'
  },
  {
    route_id: 'r3',
    origin_district: 'Jesús Nazareno',
    destination: 'Comedor Central',
    departure_time: '2026-07-06T07:45:00Z',
    available_seats: 2,
    price_soles: 1.00,
    driver_alias: 'Minero Solitario'
  },
  {
    route_id: 'r4',
    origin_district: 'Ayacucho',
    destination: 'Pabellón AA',
    departure_time: '2026-07-06T13:00:00Z',
    available_seats: 1,
    price_soles: 1.50,
    driver_alias: 'Sistemas Rápido'
  }
];

const DISTRICTS = [
  'Todos',
  'San Juan Bautista',
  'Carmen Alto',
  'Jesús Nazareno',
  'Ayacucho',
  'Andrés Avelino Cáceres'
];

export function CarpoolingDashboard() {
  const [routes, setRoutes] = useState<CarpoolingRouteData[]>([]);
  const [selectedOrigin, setSelectedOrigin] = useState('Todos');
  const [searchDestination, setSearchDestination] = useState('');
  const [selectedRoute, setSelectedRoute] = useState<CarpoolingRouteData | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedRoutes = localStorage.getItem('carpooling_routes_list');
      if (storedRoutes) {
        setRoutes(JSON.parse(storedRoutes));
      } else {
        setRoutes(INITIAL_ROUTES);
        localStorage.setItem('carpooling_routes_list', JSON.stringify(INITIAL_ROUTES));
      }
    }
  }, []);

  const handleBookingComplete = () => {
    // When a booking is confirmed, decrement seats count dynamically
    if (selectedRoute) {
      const updated = routes.map(r => {
        if (r.route_id === selectedRoute.route_id) {
          return { ...r, available_seats: Math.max(r.available_seats - 1, 0) };
        }
        return r;
      });
      setRoutes(updated);
      localStorage.setItem('carpooling_routes_list', JSON.stringify(updated));
    }
  };

  const filteredRoutes = routes.filter(route => {
    const matchesOrigin = selectedOrigin === 'Todos' || route.origin_district === selectedOrigin;
    const matchesDestination = route.destination.toLowerCase().includes(searchDestination.toLowerCase());
    return matchesOrigin && matchesDestination;
  });

  return (
    <div className="flex flex-col gap-6 text-left max-w-5xl mx-auto select-none">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-secondary/15 pb-4">
        <div>
          <h1 className="text-xl font-black text-primary flex items-center gap-2 tracking-tight">
            <Car className="w-6 h-6 text-primary" />
            Ruta Sancristobalina
          </h1>
          <p className="text-xs text-neutral-gray font-medium">
            Red de movilidad estudiantil y carpooling seguro. Coordina viajes compartidos de forma económica dentro del campus.
          </p>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="bg-white border border-secondary/15 rounded-2xl p-5 shadow-sm flex flex-col gap-4">
        <span className="text-xs font-bold text-primary uppercase tracking-wider block">
          Buscador de Rutas y Horarios
        </span>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Selector de Distrito de Origen */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-neutral-gray uppercase tracking-wider">
              Distrito de Origen (Ayacucho)
            </label>
            <select
              value={selectedOrigin}
              onChange={(e) => setSelectedOrigin(e.target.value)}
              className="w-full bg-surface border border-secondary/15 rounded-xl px-3 py-3 text-xs font-bold text-primary focus:outline-none focus:border-primary/50"
            >
              {DISTRICTS.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          {/* Buscador de Destino Landmark */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-neutral-gray uppercase tracking-wider">
              Destino en el Campus (Pabellón, Biblioteca, Comedor...)
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-neutral-gray absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Ej: Pabellón W o Biblioteca"
                value={searchDestination}
                onChange={(e) => setSearchDestination(e.target.value)}
                className="w-full bg-surface border border-secondary/15 rounded-xl pl-10 pr-4 py-3 text-xs font-semibold text-primary placeholder:text-neutral-gray/60 focus:outline-none focus:border-primary/50"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Listado de Rutas */}
      <div className="flex flex-col gap-4">
        <h3 className="text-xs font-bold text-primary uppercase tracking-wider block">
          Rutas de Commute Disponibles ({filteredRoutes.length})
        </h3>

        {filteredRoutes.length === 0 ? (
          <div className="bg-white border border-secondary/15 rounded-2xl p-16 text-center shadow-sm">
            <Compass className="w-12 h-12 text-secondary/45 mx-auto mb-3 animate-spin" />
            <h4 className="text-sm font-bold text-primary mb-1">No hay rutas coincidentes</h4>
            <p className="text-xs text-neutral-gray font-medium max-w-xs mx-auto">
              Intenta cambiar el distrito de origen o buscar por otro punto de destino en la universidad.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredRoutes.map((route) => (
              <div 
                key={route.route_id}
                className="bg-white border border-secondary/15 rounded-2xl p-5 hover:border-primary/40 hover:shadow-sm transition-all flex flex-col justify-between gap-4 group"
              >
                {/* Cabecera de la Tarjeta */}
                <div className="flex justify-between items-start gap-2 border-b border-secondary/5 pb-3">
                  <div className="flex items-center gap-1.5">
                    <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary text-xs uppercase font-extrabold flex-shrink-0">
                      {route.driver_alias.substring(0, 2)}
                    </div>
                    <div>
                      <span className="text-xs font-black text-primary block leading-none">
                        {route.driver_alias}
                      </span>
                      <span className="text-[8px] font-bold text-neutral-gray tracking-wider uppercase mt-1 inline-block">
                        Conductor Verificado
                      </span>
                    </div>
                  </div>

                  <span className="text-xs font-black text-primary bg-primary/5 border border-primary/10 px-2.5 py-1 rounded-lg">
                    S/. {route.price_soles.toFixed(2)}
                  </span>
                </div>

                {/* Contenido / Trayecto */}
                <div className="flex flex-col gap-2.5 text-xs text-neutral-gray font-semibold">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-secondary shrink-0" />
                    <span className="truncate">Salida: <strong className="text-primary">{route.origin_district}</strong></span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Navigation className="w-4 h-4 text-primary shrink-0" />
                    <span className="truncate">Destino: <strong className="text-primary">{route.destination}</strong></span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-secondary shrink-0" />
                    <span>Salida: <strong className="text-primary">{new Date(route.departure_time).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} hrs</strong></span>
                  </div>
                </div>

                {/* Footer Tarjeta / Acción */}
                <div className="flex items-center justify-between border-t border-secondary/5 pt-3 mt-1">
                  <div className="flex items-center gap-1 text-[10px] font-bold text-neutral-gray">
                    <Users className="w-3.5 h-3.5 text-secondary shrink-0" />
                    <span>Vacantes: <strong className={route.available_seats > 0 ? 'text-emerald-600' : 'text-primary'}>{route.available_seats} asientos</strong></span>
                  </div>

                  <button
                    onClick={() => setSelectedRoute(route)}
                    className="py-2 px-4 bg-primary hover:bg-primary/95 text-surface rounded-xl text-[10px] font-black uppercase tracking-wide flex items-center gap-1.5 shadow-sm transition-transform active:scale-95 cursor-pointer focus:outline-none"
                  >
                    Ver Detalles
                  </button>
                </div>

              </div>
            ))}
          </div>
        )}
      </div>

      {/* Booking Drawer Slide-over */}
      <RouteBooking
        isOpen={selectedRoute !== null}
        onClose={() => setSelectedRoute(null)}
        route={selectedRoute}
        onBookingComplete={handleBookingComplete}
      />

    </div>
  );
}
