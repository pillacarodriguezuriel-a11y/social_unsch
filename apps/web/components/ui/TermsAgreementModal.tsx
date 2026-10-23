'use client';

import React, { useState } from 'react';
import { ShieldCheck, Scale, FileText, ScrollText } from 'lucide-react';
import { Button } from './Button';
import { api } from '../../app/lib/api';

interface TermsAgreementModalProps {
  onAcceptSuccess: () => void;
}

/**
 * Modal obligatorio a pantalla completa para el consentimiento de términos y condiciones.
 * Asegura el cumplimiento de la Ley N° 29733 (Ley de Protección de Datos Personales del Perú).
 */
export function TermsAgreementModal({ onAcceptSuccess }: TermsAgreementModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAcceptTerms = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      // Llamada al endpoint PATCH de persistencia
      await api.patch('/users/accept-terms');

      // Actualizar el token y el perfil localmente
      if (typeof window !== 'undefined') {
        const userStr = localStorage.getItem('user');
        if (userStr) {
          const userObj = JSON.parse(userStr);
          userObj.has_accepted_terms = true;
          localStorage.setItem('user', JSON.stringify(userObj));
        }
      }

      onAcceptSuccess();
    } catch (err: any) {
      console.error(err);
      setError(
        err.response?.data?.message || 
        'No se pudo registrar la aceptación de términos. Inténtalo de nuevo.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary/40 backdrop-blur-md p-4 overflow-y-auto">
      {/* Contenedor del Modal */}
      <div className="bg-white w-full max-w-2xl rounded-2xl border border-secondary/20 shadow-xl overflow-hidden flex flex-col max-h-[90vh] animate-fadeIn">
        
        {/* Cabecera del Modal */}
        <div className="bg-primary text-surface p-6 flex items-center gap-3">
          <ShieldCheck className="w-8 h-8 flex-shrink-0 text-secondary" />
          <div className="text-left">
            <h2 className="text-lg font-extrabold tracking-tight">Consentimiento de Términos y Privacidad</h2>
            <p className="text-xs font-semibold opacity-85">
              SOCIAL-UNSCH • Plataforma Universitaria Exclusiva
            </p>
          </div>
        </div>

        {/* Cuerpo del Modal con Viewport Scrollable */}
        <div className="p-6 md:p-8 overflow-y-auto flex-1 text-left flex flex-col gap-5 text-sm leading-relaxed text-neutral-gray">
          
          <div className="flex gap-2 items-center text-primary font-bold">
            <Scale className="w-5 h-5 flex-shrink-0" />
            <h3>Protección de Datos Personales (Ley N° 29733 - Perú)</h3>
          </div>
          <p className="text-xs font-medium">
            En cumplimiento de la <strong>Ley de Protección de Datos Personales del Perú (Ley N° 29733)</strong>, se le informa que los datos recopilados (correo institucional, carrera, nombres y registros de afluencia) se utilizarán exclusivamente para habilitar las funcionalidades de la plataforma. La universidad garantiza el secreto profesional y la seguridad técnica en el almacenamiento de esta información sensible.
          </p>

          <div className="flex gap-2 items-center text-primary font-bold">
            <FileText className="w-5 h-5 flex-shrink-0" />
            <h3>Estándares de Comportamiento y Convivencia Académica</h3>
          </div>
          <ul className="list-disc pl-5 text-xs font-medium space-y-2">
            <li><strong>Exclusividad:</strong> El uso de la plataforma está restringido a miembros activos de la comunidad universitaria. Está prohibida la suplantación de identidad.</li>
            <li><strong>Moderación Anti-Toxicidad:</strong> La plataforma utiliza un sistema de crowdsourcing para reportar publicaciones impropias. Al acumular 3 reportes coincidentes, el contenido se ocultará automáticamente para revisión de la Oficina de Disciplina.</li>
            <li><strong>Mercado Sancristobalino:</strong> Las transacciones comerciales son responsabilidad exclusiva de los usuarios. Los artículos deben cumplir con las políticas éticas (prohibida la venta de exámenes oficiales).</li>
          </ul>

          <div className="flex gap-2 items-center text-primary font-bold">
            <ScrollText className="w-5 h-5 flex-shrink-0" />
            <h3>Uso Eficiente del Repositorio (Wiki-Banco) y Campus Radar</h3>
          </div>
          <p className="text-xs font-medium">
            El sistema incentiva la contribución mutua mediante un <strong>Esquema de Créditos Académicos</strong>. La descarga de recursos requiere un balance positivo. Las falsificaciones o plagios detectados acarrearán la eliminación permanente del contenido y la deducción de créditos del saldo personal.
          </p>

          {error && (
            <div className="bg-primary/5 p-3 rounded-lg border border-primary/20 text-xs font-bold text-primary">
              ⚠️ {error}
            </div>
          )}
        </div>

        {/* Acciones del Modal */}
        <div className="bg-surface/50 border-t border-secondary/15 p-6 flex flex-col sm:flex-row gap-3">
          <Button
            variant="ghost"
            onClick={handleLogout}
            className="sm:w-1/3 hover:bg-primary/5 text-primary"
            disabled={isSubmitting}
          >
            Rechazar y Salir
          </Button>
          <Button
            variant="primary"
            onClick={handleAcceptTerms}
            className="sm:w-2/3 shadow-md"
            isLoading={isSubmitting}
          >
            Acepto los Términos y Condiciones de la Comunidad
          </Button>
        </div>
      </div>
    </div>
  );
}
