# Modelo C4

El modelo C4 describe un sistema en cuatro niveles de detalle, del más general al más concreto. Cada nivel responde a una pregunta distinta y sirve a un lector distinto.

| Nivel | Nombre | Pregunta | Documento | Describe |
|---|---|---|---|---|
| C1 | Contexto | ¿Quién usa el sistema y con qué se relaciona? | [01-contexto.md](01-contexto.md) | Estado actual |
| C2 | Contenedores | ¿Qué piezas se ejecutan o almacenan datos por separado? | [02-contenedores-actuales.md](02-contenedores-actuales.md) | Estado actual |
| C3 | Componentes | ¿Cómo se divide por dentro un contenedor? | [03-componentes-del-backend.md](03-componentes-del-backend.md) | Estado actual |
| C4 | Código | ¿Qué clases realizan un flujo concreto? | [04-codigo-y-secuencias.md](04-codigo-y-secuencias.md) | Estado actual |
| C2 | Contenedores de transición | ¿Cómo conviven lo existente y lo nuevo? | [05-contenedores-de-transicion.md](05-contenedores-de-transicion.md) | **Propuesta** |
| C2 | Contenedores objetivo | ¿Cuál es el destino? | [06-contenedores-objetivo.md](06-contenedores-objetivo.md) | **Propuesta** |

## Dos aclaraciones de vocabulario

- **Contenedor** en C4 es cualquier cosa que se ejecuta o almacena datos de forma independiente: una aplicación web, una API, una base de datos. **No significa contenedor Docker.** La API de SOCIAL-UNSCH es un contenedor C4 aunque no se despliegue con Docker.
- **Componente** es una agrupación de código dentro de un contenedor. No se despliega por separado. Los módulos de `src/modules` son componentes, no servicios.

## Convenciones de los diagramas

Los diagramas usan diagramas de flujo de Mermaid en lugar de la sintaxis C4 específica de Mermaid, que es experimental; así se asegura que GitHub los muestre.

| Elemento | Representación |
|---|---|
| Persona | Nodo redondeado |
| Sistema o contenedor de software | Rectángulo |
| Almacén de datos | Cilindro |
| Elemento existente | Trazo continuo |
| Elemento propuesto | Trazo discontinuo |
| Límite del sistema o de un contenedor | Recuadro que agrupa |

Cada diagrama incluye su propia leyenda cuando mezcla elementos existentes y propuestos.

## Línea base

Los niveles C1 a C4 corresponden al commit `8e56bfa` de `main`. Los dos diagramas de propuesta no corresponden a ningún código existente.

[← Índice](../README.md)
