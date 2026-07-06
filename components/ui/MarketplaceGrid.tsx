'use client';

import React, { useState } from 'react';
import { 
  ShoppingBag, 
  MapPin, 
  CheckCircle, 
  MessageCircle, 
  Bookmark,
  Sparkles,
  BookOpen,
  PenTool,
  Pizza,
  Laptop,
  HelpCircle
} from 'lucide-react';
import { Button } from './Button';

export interface MarketplaceItem {
  id: string;
  seller_id: string;
  seller_name: string;
  seller_role: string;
  seller_school?: string;
  title: string;
  description: string;
  price: number | null; // null represents barter
  is_barter: boolean;
  condition: 'new' | 'like_new' | 'used';
  delivery_pavilion_code: string;
  delivery_pavilion_name: string;
  image_url: string;
  category: string;
  created_at: string;
}

interface MarketplaceGridProps {
  items: MarketplaceItem[];
  onContactSeller: (item: MarketplaceItem) => void;
}

const CATEGORIES = [
  { id: 'Todos', label: 'Todos', icon: <ShoppingBag className="w-4 h-4" /> },
  { id: 'Libros / Copias', label: 'Libros / Copias', icon: <BookOpen className="w-4 h-4" /> },
  { id: 'Útiles de Escritorio', label: 'Útiles de Escritorio', icon: <PenTool className="w-4 h-4" /> },
  { id: 'Herramientas / Equipos', label: 'Herramientas / Equipos', icon: <Laptop className="w-4 h-4" /> },
  { id: 'Snacks / Comida', label: 'Snacks / Comida', icon: <Pizza className="w-4 h-4" /> },
  { id: 'Otros', label: 'Otros', icon: <HelpCircle className="w-4 h-4" /> }
];

export function MarketplaceGrid({ items, onContactSeller }: MarketplaceGridProps) {
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredItems = items.filter(item => {
    const matchesCategory = selectedCategory === 'Todos' || item.category === selectedCategory;
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.delivery_pavilion_name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const getConditionLabel = (condition: 'new' | 'like_new' | 'used') => {
    switch (condition) {
      case 'new':
        return 'Nuevo';
      case 'like_new':
        return 'Como nuevo';
      case 'used':
        return 'Usado';
      default:
        return 'Usado';
    }
  };

  const getConditionStyle = (condition: 'new' | 'like_new' | 'used') => {
    switch (condition) {
      case 'new':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200/50';
      case 'like_new':
        return 'bg-blue-50 text-blue-700 border-blue-200/50';
      case 'used':
        return 'bg-amber-50 text-amber-700 border-amber-200/50';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200/50';
    }
  };

  // Function to render a beautiful category gradient fallback if thumbnail fails
  const renderThumbnail = (item: MarketplaceItem) => {
    let gradient = 'from-rose-500 to-red-700';
    let icon = <ShoppingBag className="w-10 h-10 text-white" />;

    if (item.category === 'Libros / Copias') {
      gradient = 'from-amber-500 to-amber-700';
      icon = <BookOpen className="w-10 h-10 text-white" />;
    } else if (item.category === 'Útiles de Escritorio') {
      gradient = 'from-emerald-500 to-teal-700';
      icon = <PenTool className="w-10 h-10 text-white" />;
    } else if (item.category === 'Snacks / Comida') {
      gradient = 'from-orange-400 to-red-600';
      icon = <Pizza className="w-10 h-10 text-white" />;
    } else if (item.category === 'Herramientas / Equipos') {
      gradient = 'from-indigo-500 to-purple-700';
      icon = <Laptop className="w-10 h-10 text-white" />;
    }

    return (
      <div className="relative w-full h-40 bg-surface rounded-t-2xl overflow-hidden border-b border-secondary/10 flex-shrink-0 group">
        {item.image_url && !item.image_url.startsWith('mock://') ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img 
            src={item.image_url} 
            alt={item.title} 
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            onError={(e) => {
              // Si falla, limpiar url para que renderice el fallback
              e.currentTarget.style.display = 'none';
            }}
          />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${gradient} flex flex-col items-center justify-center relative overflow-hidden`}>
            {/* Patrón de fondo decorativo */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-[-20%] right-[-20%] w-32 h-32 rounded-full bg-white" />
              <div className="absolute bottom-[-10%] left-[-10%] w-24 h-24 rounded-full bg-white" />
            </div>
            <div className="relative flex flex-col items-center gap-2 transition-transform duration-300 group-hover:scale-110">
              {icon}
              <span className="text-[9px] font-black text-white/90 uppercase tracking-widest px-2 text-center leading-tight max-w-[100px]">
                {item.category}
              </span>
            </div>
            <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        )}

        {/* 3. Condición del artículo (Badge flotante superior izquierdo) */}
        <span className={`absolute top-3 left-3 text-[10px] font-bold px-2 py-0.5 rounded-md border backdrop-blur-sm shadow-sm ${getConditionStyle(item.condition)}`}>
          {getConditionLabel(item.condition)}
        </span>

        {/* Botón guardar favorito flotante */}
        <button className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/80 hover:bg-white text-secondary hover:text-primary flex items-center justify-center transition-all shadow-sm focus:outline-none">
          <Bookmark className="w-4 h-4" />
        </button>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6 select-none w-full">
      {/* Barra de Búsqueda */}
      <div className="flex flex-col md:flex-row gap-3 w-full">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Buscar artículos en el campus por título, descripción, pabellón..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-secondary/15 rounded-xl px-4 py-3 text-sm font-semibold text-primary placeholder:text-neutral-gray/60 focus:outline-none focus:border-primary/50 shadow-sm"
          />
        </div>
      </div>

      {/* Fila Deslizante Horizontal de Chips de Categorías (Sección 3.3 Frontend Skill) */}
      <div className="w-full overflow-x-auto no-scrollbar scroll-smooth flex items-center gap-2 pb-2 -mx-1 px-1">
        {CATEGORIES.map((cat) => {
          const isSelected = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border cursor-pointer focus:outline-none ${
                isSelected
                  ? 'bg-primary text-surface border-primary shadow-sm'
                  : 'bg-white text-neutral-gray border-secondary/15 hover:border-primary/30 hover:text-primary'
              }`}
            >
              {cat.icon}
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Rejilla de 4 Columnas de Tarjetas de Producto */}
      {filteredItems.length === 0 ? (
        <div className="bg-white border border-secondary/15 rounded-2xl p-16 text-center shadow-sm w-full">
          <ShoppingBag className="w-12 h-12 text-secondary/45 mx-auto mb-3" />
          <h4 className="text-sm font-bold text-primary mb-1">No se encontraron artículos</h4>
          <p className="text-xs text-neutral-gray max-w-xs mx-auto font-medium">
            Intenta cambiar de categoría o ajustar los términos de búsqueda.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 w-full">
          {filteredItems.map((item) => (
            <div 
              key={item.id}
              className="bg-white border border-secondary/15 rounded-2xl flex flex-col justify-between overflow-hidden shadow-sm hover:shadow-md transition-all hover:border-secondary/35 group"
            >
              <div>
                {/* 1. Thumbnail Image Asset de Alta Fidelidad */}
                {renderThumbnail(item)}

                {/* Contenido Textual */}
                <div className="p-4 text-left flex flex-col gap-2">
                  <div className="flex justify-between items-start gap-1">
                    <h4 className="text-sm font-extrabold text-primary line-clamp-1 group-hover:text-primary/90 transition-colors">
                      {item.title}
                    </h4>
                  </div>
                  <p className="text-[11px] text-neutral-gray font-medium line-clamp-2 leading-relaxed h-8">
                    {item.description}
                  </p>
                  
                  {/* 2. Precio destacado en Crimson / Trueque */}
                  <div className="flex items-center gap-1.5 mt-1">
                    {item.is_barter ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black bg-tertiary/10 text-tertiary border border-tertiary/20 uppercase tracking-wider">
                        ¡Trueque!
                      </span>
                    ) : (
                      <span className="text-sm font-black text-primary">
                        S/. {item.price?.toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Pie de Tarjeta */}
              <div className="px-4 pb-4 flex flex-col gap-3">
                {/* 4. Ubicación de entrega verificada en el campus */}
                <div className="flex items-center gap-1.5 text-secondary border-t border-secondary/5 pt-2 text-[10px] font-bold">
                  <MapPin className="w-3.5 h-3.5 text-secondary flex-shrink-0" />
                  <span className="truncate" title={`Entrega: ${item.delivery_pavilion_name}`}>
                    Entrega: {item.delivery_pavilion_name}
                  </span>
                </div>

                {/* 5. Seller Verification Capsule & Launch interaction trigger */}
                <div className="flex items-center justify-between gap-2 p-2 bg-surface/50 border border-secondary/10 rounded-xl">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className="w-6 h-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-primary text-[10px] uppercase flex-shrink-0">
                      {item.seller_name.substring(0, 2)}
                    </div>
                    <div className="min-w-0 flex flex-col">
                      <span className="text-[10px] font-extrabold text-primary truncate flex items-center gap-0.5">
                        {item.seller_name.split(' ')[0]}
                        <CheckCircle className="w-2.5 h-2.5 text-primary flex-shrink-0" />
                      </span>
                      <span className="text-[8px] font-bold text-neutral-gray truncate">
                        {item.seller_role === 'student' ? 'Estudiante' : 'Comunidad'}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => onContactSeller(item)}
                    className="p-1.5 bg-primary hover:bg-primary/95 text-surface rounded-lg transition-colors flex items-center justify-center cursor-pointer focus:outline-none"
                    title="Contactar por chat"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
