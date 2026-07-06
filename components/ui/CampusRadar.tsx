'use client';

import React, { useState, useEffect } from 'react';
import { Radio, ShieldAlert, Check, RefreshCw } from 'lucide-react';
import { api } from '../../app/lib/api';
import { Alert } from './Alert';

interface RadarNode {
  name: string;
  label: string;
  status: string;
  is_definite: boolean;
}

export function CampusRadar() {
  const [comedor, setComedor] = useState<RadarNode>({ name: 'comedor', label: 'Comedor Universitario', status: 'indefinido', is_definite: false });
  const [rectorado, setRectorado] = useState<RadarNode>({ name: 'rectorado', label: 'Rectorado (Trámites)', status: 'indefinido', is_definite: false });
  const [campusAlert, setCampusAlert] = useState<RadarNode>({ name: 'campus_alert', label: 'Alertas de Campus', status: 'indefinido', is_definite: false });
  
  const [library1, setLibrary1] = useState<RadarNode>({ name: 'biblioteca_floor_1', label: 'Biblioteca Piso 1', status: 'indefinido', is_definite: false });
  const [library2, setLibrary2] = useState<RadarNode>({ name: 'biblioteca_floor_2', label: 'Biblioteca Piso 2', status: 'indefinido', is_definite: false });
  const [library3, setLibrary3] = useState<RadarNode>({ name: 'biblioteca_floor_3', label: 'Biblioteca Piso 3', status: 'indefinido', is_definite: false });
  const [library4, setLibrary4] = useState<RadarNode>({ name: 'biblioteca_floor_4', label: 'Biblioteca Piso 4', status: 'indefinido', is_definite: false });

  const [loading, setLoading] = useState(true);
  const [errorAlert, setErrorAlert] = useState<{ message: string; code: string } | null>(null);

  const fetchRadarStatus = async () => {
    try {
      const response = await api.get('/radar/status');
      const data = response?.data || {};

      setComedor({ 
        name: 'comedor', 
        label: 'Comedor Universitario', 
        status: data?.comedor?.status || 'indefinido', 
        is_definite: data?.comedor?.is_definite || false 
      });
      setRectorado({ 
        name: 'rectorado', 
        label: 'Rectorado (Trámites)', 
        status: data?.rectorado?.status || 'indefinido', 
        is_definite: data?.rectorado?.is_definite || false 
      });
      setCampusAlert({
        name: 'campus_alert',
        label: 'Alertas de Campus',
        status: data?.campus_alert?.status || 'indefinido',
        is_definite: data?.campus_alert?.is_definite || false
      });
      setLibrary1({ 
        name: 'biblioteca_floor_1', 
        label: 'Biblioteca Piso 1', 
        status: data?.biblioteca?.floor_1?.occupancy ? String(data.biblioteca.floor_1.occupancy) : 'indefinido', 
        is_definite: data?.biblioteca?.floor_1?.is_definite || false 
      });
      setLibrary2({ 
        name: 'biblioteca_floor_2', 
        label: 'Biblioteca Piso 2', 
        status: data?.biblioteca?.floor_2?.occupancy ? String(data.biblioteca.floor_2.occupancy) : 'indefinido', 
        is_definite: data?.biblioteca?.floor_2?.is_definite || false 
      });
      setLibrary3({ 
        name: 'biblioteca_floor_3', 
        label: 'Biblioteca Piso 3', 
        status: data?.biblioteca?.floor_3?.occupancy ? String(data.biblioteca.floor_3.occupancy) : 'indefinido', 
        is_definite: data?.biblioteca?.floor_3?.is_definite || false 
      });
      setLibrary4({ 
        name: 'biblioteca_floor_4', 
        label: 'Biblioteca Piso 4', 
        status: data?.biblioteca?.floor_4?.occupancy ? String(data.biblioteca.floor_4.occupancy) : 'indefinido', 
        is_definite: data?.biblioteca?.floor_4?.is_definite || false 
      });
      
      setErrorAlert(null);
    } catch (err: any) {
      console.error('Error al cargar radar:', err);
      // Fallback a estados seguros indefinidos
      setComedor(prev => ({ ...prev, status: 'indefinido', is_definite: false }));
      setRectorado(prev => ({ ...prev, status: 'indefinido', is_definite: false }));
      setCampusAlert(prev => ({ ...prev, status: 'indefinido', is_definite: false }));
      setLibrary1(prev => ({ ...prev, status: 'indefinido', is_definite: false }));
      setLibrary2(prev => ({ ...prev, status: 'indefinido', is_definite: false }));
      setLibrary3(prev => ({ ...prev, status: 'indefinido', is_definite: false }));
      setLibrary4(prev => ({ ...prev, status: 'indefinido', is_definite: false }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRadarStatus();
    const interval = setInterval(fetchRadarStatus, 60000);
    return () => clearInterval(interval);
  }, []);

  const getPillStyles = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'fluid' || s === 'fluido' || s === 'empty_window' || s === 'ventanilla vacía') {
      return 'bg-green-100 text-green-800 border-green-200';
    }
    if (s === 'medium_queue' || s === 'cola media' || s === 'waiting_15' || s === 'espera 15 min') {
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    }
    if (s === 'long_queue' || s === 'cola larga' || s === 'collapsed' || s === 'colapsado') {
      return 'bg-primary/10 text-primary border-primary/20';
    }
    // Alertas de Campus
    if (s === 'class_suspended' || s === 'clase suspendida') {
      return 'bg-amber-100 text-amber-800 border-amber-200';
    }
    if (s === 'cultural_event' || s === 'evento cultural') {
      return 'bg-violet-100 text-violet-800 border-violet-200';
    }
    if (s.startsWith('lost_item') || s.startsWith('pérdida de')) {
      return 'bg-blue-100 text-blue-800 border-blue-200';
    }
    return 'bg-neutral-gray/10 text-neutral-gray/70 border-neutral-gray/20';
  };

  const getStatusLabel = (node: string, status: string) => {
    if (status === 'indefinido') return 'Sin reportes';
    
    if (node.startsWith('biblioteca_floor_')) {
      return `Aforo: ${status}%`;
    }
    
    const mapping: Record<string, string> = {
      fluid: 'Fluido',
      medium_queue: 'Cola Media',
      long_queue: 'Cola Larga',
      closed: 'Cerrado',
      empty_window: 'Ventanilla Vacía',
      waiting_15: 'Espera 15 min',
      collapsed: 'Colapsado',
      class_suspended: 'Clase suspendida',
      cultural_event: 'Evento cultural',
      lost_item_dni: 'Pérdida de DNI',
      lost_item_keys: 'Pérdida de Llaves',
      lost_item_other: 'Pérdida de objeto',
    };
    return mapping[status] || status;
  };

  const handleReport = async (node: RadarNode, newStatus: string, setter: React.Dispatch<React.SetStateAction<RadarNode>>) => {
    const previousNodeState = { ...node };

    setter({
      ...node,
      status: newStatus,
      is_definite: true,
    });
    setErrorAlert(null);

    try {
      const response = await api.post('/radar/report', {
        node: node.name,
        status: newStatus,
      });
      
      const data = response.data;
      if (data.updated) {
        setter({
          ...node,
          status: data.current_status,
          is_definite: true,
        });
      } else {
        console.log(data.message);
      }
    } catch (err: any) {
      console.error(err);
      setter(previousNodeState);

      const errorMessage = err.response?.data?.message || 'Error al enviar reporte de radar.';
      const errorCode = err.response?.data?.code || 'ERR_RADAR_REPORT_FAILED';
      
      setErrorAlert({
        message: errorMessage,
        code: errorCode,
      });
    }
  };

  if (loading) {
    return (
      <div className="bg-white border border-secondary/15 rounded-2xl p-5 shadow-sm flex flex-col gap-4 text-center">
        <div className="flex items-center justify-between border-b border-secondary/10 pb-3">
          <h3 className="text-sm font-extrabold text-primary flex items-center gap-2">
            <Radio className="w-4 h-4 text-primary animate-pulse" />
            Campus Radar
          </h3>
        </div>
        <div className="py-6 flex items-center justify-center">
          <RefreshCw className="w-5 h-5 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  const renderRadarCard = (node: RadarNode, options: string[], setter: React.Dispatch<React.SetStateAction<RadarNode>>) => {
    const optionLabels: Record<string, string> = {
      fluid: 'Fluido',
      medium_queue: 'Cola Media',
      long_queue: 'Cola Larga',
      closed: 'Cerrado',
      empty_window: 'Vacía',
      waiting_15: 'Espera 15m',
      collapsed: 'Colapsado',
      class_suspended: 'Suspensión',
      cultural_event: 'Cultural',
      lost_item_dni: 'Perdí DNI',
      lost_item_keys: 'Perdí Llaves',
      lost_item_other: 'Perdí Objeto',
    };

    return (
      <div className="p-3 border border-secondary/10 rounded-xl flex flex-col gap-2.5 text-left bg-surface/30">
        <div className="flex justify-between items-start">
          <span className="text-xs font-bold text-primary truncate max-w-[140px]">{node.label}</span>
          <span className={`text-[10px] font-bold px-2 py-0.5 border rounded-full ${getPillStyles(node.status)}`}>
            {getStatusLabel(node.name, node.status)}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-secondary/5">
          {options.map((opt) => (
            <button
              key={opt}
              onClick={() => handleReport(node, opt, setter)}
              className="text-[10px] font-bold py-1 px-1.5 text-center bg-white border border-secondary/15 rounded-lg text-neutral-gray hover:text-primary hover:border-primary/50 transition-all cursor-pointer outline-none focus:ring-1 focus:ring-primary/20"
            >
              {optionLabels[opt] || opt}
            </button>
          ))}
        </div>
      </div>
    );
  };

  const libraryFloors = [
    { node: library1, setter: setLibrary1, label: 'Nivel 1 — Sótano' },
    { node: library2, setter: setLibrary2, label: 'Nivel 2 — 1er Piso' },
    { node: library3, setter: setLibrary3, label: 'Nivel 3 — 2do Piso' },
    { node: library4, setter: setLibrary4, label: 'Nivel 4 — 3er Piso' },
  ];

  return (
    <div className="bg-white border border-secondary/15 rounded-2xl p-5 shadow-sm flex flex-col gap-4 select-none">
      {/* Cabecera */}
      <div className="flex items-center justify-between border-b border-secondary/10 pb-3">
        <h3 className="text-sm font-extrabold text-primary flex items-center gap-2">
          <Radio className="w-4 h-4 text-primary" />
          Campus Radar
        </h3>
        <button onClick={fetchRadarStatus} className="text-neutral-gray hover:text-primary transition-colors focus:outline-none">
          <RefreshCw className="w-4 h-4 cursor-pointer" />
        </button>
      </div>

      {/* Alerta de error en caso de fallo */}
      {errorAlert && (
        <Alert
          title="Fallo al Reportar Radar"
          description={errorAlert.message}
          variant="error"
          className="p-3 rounded-xl border-primary/20 bg-primary/5 text-xs text-primary"
        />
      )}

      {/* Nodos del Radar */}
      <div className="flex flex-col gap-3.5">
        {renderRadarCard(comedor, ['fluid', 'medium_queue', 'long_queue', 'closed'], setComedor)}
        {renderRadarCard(rectorado, ['empty_window', 'waiting_15', 'collapsed'], setRectorado)}
        {renderRadarCard(campusAlert, ['class_suspended', 'cultural_event', 'lost_item_dni', 'lost_item_keys', 'lost_item_other'], setCampusAlert)}
        
        {/* Biblioteca Aforos */}
        <div className="p-3 border border-secondary/10 rounded-xl bg-surface/30 text-left flex flex-col gap-3">
          <span className="text-xs font-bold text-primary block">Biblioteca Central (Aforo)</span>
          <div className="flex flex-col gap-2">
            {libraryFloors.map(({ node, setter, label }) => (
              <div key={node.name} className="flex justify-between items-center bg-white border border-secondary/5 p-2 rounded-lg gap-2">
                <span className="text-[10px] font-bold text-neutral-gray truncate max-w-[110px]">{label}</span>
                <div className="flex gap-1.5 items-center shrink-0">
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 border rounded-full ${getPillStyles(node.status)}`}>
                    {node.status === 'indefinido' ? 'Vacío' : `${node.status}%`}
                  </span>
                  <div className="flex gap-1">
                    {['25', '50', '80'].map((pct) => (
                      <button
                        key={pct}
                        onClick={() => handleReport(node, pct, setter)}
                        className="text-[8px] font-bold p-1 bg-surface border border-secondary/10 rounded hover:border-primary/50 text-neutral-gray hover:text-primary cursor-pointer outline-none"
                      >
                        {pct}%
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Leyenda Didáctica */}
      <div className="p-3 bg-tertiary/5 border border-tertiary/20 rounded-xl text-left flex gap-2">
        <ShieldAlert className="w-4 h-4 text-tertiary flex-shrink-0 mt-0.5" />
        <p className="text-[10px] leading-relaxed text-tertiary font-bold">
          El estado se consolidará de forma pública en el radar tras recibir reportes coincidentes de 3 estudiantes distintos.
        </p>
      </div>
    </div>
  );
}
