'use client';

import React, { useState, useEffect } from 'react';
import { 
  ShoppingBag, 
  MessageCircle, 
  X, 
  CheckCircle, 
  MapPin, 
  ShieldCheck, 
  Plus,
  Send,
  AlertCircle
} from 'lucide-react';
import { MarketplaceGrid, MarketplaceItem } from '../../../components/ui/MarketplaceGrid';
import { Button } from '../../../components/ui/Button';
import { Alert } from '../../../components/ui/Alert';

const INITIAL_MARKETPLACE_ITEMS: MarketplaceItem[] = [
  {
    id: 'p1',
    seller_id: 's1',
    seller_name: 'Juan Carlos Quispe',
    seller_role: 'student',
    seller_school: 'Ingeniería de Sistemas',
    title: 'Libro de Cálculo Thomas (14ª Edición)',
    description: 'Libro original en excelente estado, sin rayaduras. Ideal para estudiantes de primer y segundo ciclo de ingeniería.',
    price: 45.00,
    is_barter: false,
    condition: 'like_new',
    delivery_pavilion_code: 'W',
    delivery_pavilion_name: 'Pabellón W',
    image_url: 'mock://calculo_thomas',
    category: 'Libros / Copias',
    created_at: '2026-07-01T10:00:00Z'
  },
  {
    id: 'p2',
    seller_id: 's2',
    seller_name: 'Ana María Huamán',
    seller_role: 'student',
    seller_school: 'Ciencias de la Salud',
    title: 'Calculadora Científica Casio ClassWiz',
    description: 'Modelo fx-991LAX con cargador solar y funda rígida. Perfecto estado de funcionamiento.',
    price: 75.00,
    is_barter: false,
    condition: 'used',
    delivery_pavilion_code: 'O',
    delivery_pavilion_name: 'Biblioteca Central',
    image_url: 'mock://casio_classwiz',
    category: 'Herramientas / Equipos',
    created_at: '2026-07-02T14:30:00Z'
  },
  {
    id: 'p3',
    seller_id: 's3',
    seller_name: 'Carlos Mendoza',
    seller_role: 'student',
    seller_school: 'Ingeniería Civil',
    title: 'Estuche de Reglas Técnicas Rotring',
    description: 'Set de escuadras, regla de 30cm y transportador profesional. Lo cambio por copias o exámenes pasados de topografía.',
    price: null,
    is_barter: true,
    condition: 'used',
    delivery_pavilion_code: 'AA',
    delivery_pavilion_name: 'Pabellón AA',
    image_url: 'mock://reglas_rotring',
    category: 'Útiles de Escritorio',
    created_at: '2026-07-03T11:20:00Z'
  },
  {
    id: 'p4',
    seller_id: 's4',
    seller_name: 'Sofía Prado',
    seller_role: 'student',
    seller_school: 'Administración de Empresas',
    title: 'Snacks Saludables - Barras de Quinua',
    description: 'Barras energéticas de quinua y frutos secos elaboradas de forma artesanal. Entrega inmediata en el almuerzo.',
    price: 2.50,
    is_barter: false,
    condition: 'new',
    delivery_pavilion_code: 'E',
    delivery_pavilion_name: 'Comedor Central',
    image_url: 'mock://snacks_quinua',
    category: 'Snacks / Comida',
    created_at: '2026-07-05T08:00:00Z'
  },
  {
    id: 'p5',
    seller_id: 's5',
    seller_name: 'Pedro Rojas',
    seller_role: 'alumnus',
    seller_school: 'Ingeniería Civil',
    title: 'Bata de Laboratorio blanca (Talla M)',
    description: 'Bata de algodón grueso en óptimo estado, lavada y lista para su uso en laboratorios de química o biología.',
    price: 20.00,
    is_barter: false,
    condition: 'like_new',
    delivery_pavilion_code: 'AR',
    delivery_pavilion_name: 'Pabellón AR',
    image_url: 'mock://bata_laboratorio',
    category: 'Otros',
    created_at: '2026-07-04T16:45:00Z'
  }
];

export default function MarketplacePage() {
  const [items, setItems] = useState<MarketplaceItem[]>([]);
  const [activeContactItem, setActiveContactItem] = useState<MarketplaceItem | null>(null);
  const [chatMessage, setChatMessage] = useState('');
  const [alertMessage, setAlertMessage] = useState<{ title: string; description: string; variant: 'info' | 'error' } | null>(null);

  // Form state for publishing item
  const [isPublishOpen, setIsPublishOpen] = useState(false);
  const [publishTitle, setPublishTitle] = useState('');
  const [publishDesc, setPublishDesc] = useState('');
  const [publishCategory, setPublishCategory] = useState('Libros / Copias');
  const [publishCondition, setPublishCondition] = useState<'new' | 'like_new' | 'used'>('new');
  const [publishPrice, setPublishPrice] = useState('');
  const [publishIsBarter, setPublishIsBarter] = useState(false);
  const [publishPavilion, setPublishPavilion] = useState('W');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedItems = localStorage.getItem('marketplace_items');
      if (storedItems) {
        setItems(JSON.parse(storedItems));
      } else {
        setItems(INITIAL_MARKETPLACE_ITEMS);
        localStorage.setItem('marketplace_items', JSON.stringify(INITIAL_MARKETPLACE_ITEMS));
      }
    }
  }, []);

  const handleContactSeller = (item: MarketplaceItem) => {
    setActiveContactItem(item);
    setChatMessage(`¡Hola ${item.seller_name.split(' ')[0]}! Estoy interesado en tu producto "${item.title}". ¿Sigue disponible para entrega en el ${item.delivery_pavilion_name}?`);
    setAlertMessage(null);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim()) return;

    // Simulate sending message
    console.log(`[Marketplace-Chat]: Sending message to ${activeContactItem?.seller_name}: "${chatMessage}"`);

    setAlertMessage({
      title: '¡Mensaje Enviado!',
      description: `Tu propuesta de compra o trueque ha sido enviada al chat de ${activeContactItem?.seller_name}. Serás notificado al recibir respuesta.`,
      variant: 'info'
    });

    setChatMessage('');
    setTimeout(() => {
      setActiveContactItem(null);
    }, 2000);
  };

  const handlePublishSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!publishTitle.trim() || !publishDesc.trim()) {
      alert('Por favor completa el título y la descripción del producto.');
      return;
    }

    const priceNum = parseFloat(publishPrice);
    if (!publishIsBarter && (isNaN(priceNum) || priceNum <= 0)) {
      alert('Por favor ingresa un precio válido mayor a 0 o marca la casilla de Trueque.');
      return;
    }

    const pavilionNames: Record<string, string> = {
      'W': 'Pabellón W',
      'AA': 'Pabellón AA',
      'AN': 'Pabellón AN',
      'O': 'Biblioteca Central',
      'E': 'Comedor Central',
      'AR': 'Pabellón AR'
    };

    const newItem: MarketplaceItem = {
      id: `p_${Date.now()}`,
      seller_id: 's_me',
      seller_name: 'Estudiante Logueado',
      seller_role: 'student',
      seller_school: 'Ingeniería de Sistemas',
      title: publishTitle,
      description: publishDesc,
      price: publishIsBarter ? null : priceNum,
      is_barter: publishIsBarter,
      condition: publishCondition,
      delivery_pavilion_code: publishPavilion,
      delivery_pavilion_name: pavilionNames[publishPavilion] || 'Pabellón W',
      image_url: 'mock://custom_item',
      category: publishCategory,
      created_at: new Date().toISOString()
    };

    const nextItems = [newItem, ...items];
    setItems(nextItems);
    localStorage.setItem('marketplace_items', JSON.stringify(nextItems));

    setAlertMessage({
      title: '¡Artículo Publicado!',
      description: `Tu producto "${publishTitle}" ha sido subido exitosamente y ya es visible para toda la comunidad UNSCH.`,
      variant: 'info'
    });

    // Reset fields
    setPublishTitle('');
    setPublishDesc('');
    setPublishPrice('');
    setPublishIsBarter(false);
    setIsPublishOpen(false);
  };

  return (
    <div className="flex flex-col gap-6 text-left max-w-6xl mx-auto select-none">
      
      {/* Cabecera del Marketplace */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-secondary/15 pb-4">
        <div>
          <h1 className="text-xl font-black text-primary flex items-center gap-2 tracking-tight">
            <ShoppingBag className="w-6 h-6 text-primary" />
            Marketplace Sancristobalino
          </h1>
          <p className="text-xs text-neutral-gray font-medium">
            Compra, vende o intercambia apuntes, libros, equipos de laboratorio y útiles con alumnos verificados del campus.
          </p>
        </div>

        <Button
          onClick={() => setIsPublishOpen(true)}
          className="w-full sm:w-auto py-2.5 px-4 bg-primary text-surface font-extrabold text-xs rounded-xl hover:bg-primary/95 flex items-center gap-1.5 shadow-sm shrink-0"
        >
          <Plus className="w-4 h-4" />
          Publicar Artículo
        </Button>
      </div>

      {/* Alertas del Sistema */}
      {alertMessage && (
        <Alert
          title={alertMessage.title}
          description={alertMessage.description}
          variant={alertMessage.variant}
        />
      )}

      {/* Exclusividad e Instructivo de Seguridad */}
      <div className="p-4 bg-tertiary/5 border border-tertiary/15 rounded-2xl flex gap-3 text-left">
        <ShieldCheck className="w-5 h-5 text-tertiary flex-shrink-0 mt-0.5" />
        <div className="flex flex-col gap-1">
          <p className="text-xs text-tertiary font-bold leading-relaxed">
            <strong>Filtro de Exclusividad Estudiantil (@unsch.edu.pe):</strong>
          </p>
          <p className="text-[10px] text-tertiary/90 leading-relaxed font-semibold">
            Solo miembros verificados de la comunidad pueden interactuar. Para coordinar la entrega de forma segura, acuerden el punto físico de intercambio dentro de las instalaciones universitarias.
          </p>
        </div>
      </div>

      {/* Rejilla Principal de Productos & Filtros */}
      <MarketplaceGrid 
        items={items} 
        onContactSeller={handleContactSeller} 
      />

      {/* Modal / Overlay de Publicación */}
      {isPublishOpen && (
        <div className="fixed inset-0 bg-black/45 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-secondary/15 rounded-3xl p-6 w-full max-w-lg shadow-lg text-left flex flex-col gap-4 relative animate-in fade-in zoom-in duration-200">
            
            {/* Header del Modal */}
            <div className="flex justify-between items-center border-b border-secondary/10 pb-3">
              <h3 className="text-sm font-black text-primary flex items-center gap-2">
                <ShoppingBag className="w-4.5 h-4.5 text-primary" />
                Publicar en el Marketplace
              </h3>
              <button 
                onClick={() => setIsPublishOpen(false)}
                className="text-neutral-gray hover:text-primary transition-colors cursor-pointer"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            {/* Formulario */}
            <form onSubmit={handlePublishSubmit} className="flex flex-col gap-3.5 text-xs">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-neutral-gray uppercase tracking-wider">
                  Título del Artículo
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Libro Cálculo Thomas o Bata de Laboratorio"
                  value={publishTitle}
                  onChange={(e) => setPublishTitle(e.target.value)}
                  className="w-full bg-white border border-secondary/15 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-primary focus:outline-none focus:border-primary/50"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-neutral-gray uppercase tracking-wider">
                  Descripción Corta
                </label>
                <textarea
                  required
                  rows={2}
                  placeholder="Describe las condiciones físicas, uso, o detalles del trueque..."
                  value={publishDesc}
                  onChange={(e) => setPublishDesc(e.target.value)}
                  className="w-full bg-white border border-secondary/15 rounded-xl px-3.5 py-2 text-xs font-semibold text-primary focus:outline-none focus:border-primary/50 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-neutral-gray uppercase tracking-wider">
                    Categoría
                  </label>
                  <select
                    value={publishCategory}
                    onChange={(e) => setPublishCategory(e.target.value)}
                    className="w-full bg-white border border-secondary/15 rounded-xl px-3 py-2.5 text-xs font-bold text-primary focus:outline-none"
                  >
                    <option value="Libros / Copias">Libros / Copias</option>
                    <option value="Útiles de Escritorio">Útiles de Escritorio</option>
                    <option value="Herramientas / Equipos">Herramientas / Equipos</option>
                    <option value="Snacks / Comida">Snacks / Comida</option>
                    <option value="Otros">Otros</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-neutral-gray uppercase tracking-wider">
                    Condición del Artículo
                  </label>
                  <select
                    value={publishCondition}
                    onChange={(e) => setPublishCondition(e.target.value as 'new' | 'like_new' | 'used')}
                    className="w-full bg-white border border-secondary/15 rounded-xl px-3 py-2.5 text-xs font-bold text-primary focus:outline-none"
                  >
                    <option value="new">Nuevo</option>
                    <option value="like_new">Como nuevo</option>
                    <option value="used">Usado</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-neutral-gray uppercase tracking-wider">
                    Punto de Entrega (Campus)
                  </label>
                  <select
                    value={publishPavilion}
                    onChange={(e) => setPublishPavilion(e.target.value)}
                    className="w-full bg-white border border-secondary/15 rounded-xl px-3 py-2.5 text-xs font-bold text-primary focus:outline-none"
                  >
                    <option value="W">Pabellón W</option>
                    <option value="AA">Pabellón AA</option>
                    <option value="AN">Pabellón AN</option>
                    <option value="O">Biblioteca Central</option>
                    <option value="E">Comedor Central</option>
                    <option value="AR">Pabellón AR</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-neutral-gray uppercase tracking-wider">
                    Precio (S/.) o Tipo de Intercambio
                  </label>
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="number"
                      step="0.10"
                      disabled={publishIsBarter}
                      placeholder="Precio en Soles"
                      value={publishPrice}
                      onChange={(e) => setPublishPrice(e.target.value)}
                      className="w-full bg-white border border-secondary/15 rounded-xl px-3.5 py-2 text-xs font-semibold text-primary focus:outline-none disabled:bg-surface disabled:text-neutral-gray/40"
                    />
                    <label className="flex items-center gap-1.5 shrink-0 font-bold text-primary text-[10px] uppercase cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        checked={publishIsBarter} 
                        onChange={(e) => setPublishIsBarter(e.target.checked)}
                        className="rounded accent-primary"
                      />
                      ¿Trueque?
                    </label>
                  </div>
                </div>
              </div>

              <Button
                type="submit"
                className="mt-2 py-3 bg-primary hover:bg-primary/95 text-surface font-extrabold text-xs tracking-wider uppercase rounded-xl flex items-center justify-center gap-1.5 shadow-sm"
              >
                Publicar Artículo en el Campus
              </Button>
            </form>
          </div>
        </div>
      )}

      {/* Cajón / Modal de Contacto de Vendedor */}
      {activeContactItem && (
        <div className="fixed inset-0 bg-black/45 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-secondary/15 rounded-3xl p-6 w-full max-w-md shadow-lg text-left flex flex-col gap-4 relative animate-in fade-in zoom-in duration-200">
            
            {/* Header */}
            <div className="flex justify-between items-center border-b border-secondary/10 pb-3">
              <h3 className="text-sm font-black text-primary flex items-center gap-1.5">
                <MessageCircle className="w-4.5 h-4.5 text-primary" />
                Contactar a Vendedor
              </h3>
              <button 
                onClick={() => setActiveContactItem(null)}
                className="text-neutral-gray hover:text-primary transition-colors cursor-pointer"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            {/* Información del Artículo e Identidad del Vendedor */}
            <div className="bg-surface border border-secondary/10 p-3.5 rounded-2xl flex flex-col gap-2.5">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-neutral-gray block uppercase tracking-wider">Artículo de Interés</span>
                <span className="text-xs font-bold text-primary truncate">{activeContactItem.title}</span>
                <span className="text-xs font-black text-primary mt-0.5">
                  {activeContactItem.is_barter ? '¡Trueque!' : `S/. ${activeContactItem.price?.toFixed(2)}`}
                </span>
              </div>

              <div className="border-t border-secondary/10 pt-2.5 flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-primary text-xs uppercase flex-shrink-0">
                  {activeContactItem.seller_name.substring(0, 2)}
                </div>
                <div className="min-w-0">
                  <span className="text-xs font-bold text-primary block truncate">{activeContactItem.seller_name}</span>
                  <span className="text-[9px] text-neutral-gray font-medium flex items-center gap-1">
                    {activeContactItem.seller_school || 'Universidad'} • {activeContactItem.seller_role === 'student' ? 'Alumno Verificado' : 'Comunidad'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-[9px] font-bold text-secondary mt-1">
                <MapPin className="w-3.5 h-3.5 text-secondary flex-shrink-0" />
                <span>Punto de Entrega: {activeContactItem.delivery_pavilion_name}</span>
              </div>
            </div>

            {/* Formulario de envío de propuesta */}
            <form onSubmit={handleSendMessage} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-neutral-gray uppercase tracking-wider">
                  Tu Mensaje o Propuesta
                </label>
                <textarea
                  required
                  rows={3}
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  className="w-full bg-white border border-secondary/15 rounded-xl p-3 text-xs font-semibold text-primary focus:outline-none focus:border-primary/50 resize-none leading-relaxed"
                />
              </div>

              <div className="flex items-center gap-2 text-[9px] text-tertiary font-bold bg-tertiary/5 border border-tertiary/10 p-2.5 rounded-xl">
                <AlertCircle className="w-4.5 h-4.5 text-tertiary flex-shrink-0" />
                <span>Por Ley N° 29733, los datos de contacto directos se revelarán en esta sala una vez que el vendedor responda y apruebe coordinar la entrega.</span>
              </div>

              <Button
                type="submit"
                className="py-3 bg-primary hover:bg-primary/95 text-surface font-extrabold text-xs tracking-wider uppercase rounded-xl flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Send className="w-3.5 h-3.5" />
                Enviar Mensaje a {activeContactItem.seller_name.split(' ')[0]}
              </Button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
