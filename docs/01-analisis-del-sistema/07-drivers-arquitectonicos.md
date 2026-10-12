# Drivers arquitectónicos

Un *driver* arquitectónico es un requisito, atributo o restricción con peso suficiente para condicionar la estructura del sistema. Se seleccionaron los que explican las decisiones existentes y las propuestas.

## Drivers

| ID | Driver | Origen | Qué condiciona |
|---|---|---|---|
| DA-01 | El radar maneja datos efímeros, de escritura frecuente y sin relación con el resto del modelo | [RF-007, RF-008](04-requisitos-funcionales.md) | Almacén separado (Redis) y ser el primer candidato a servicio independiente |
| DA-02 | Acceso restringido a la comunidad universitaria | [RF-001 a RF-004](04-requisitos-funcionales.md) | Autenticación propia y un punto único de verificación de identidad |
| DA-03 | Operaciones que no admiten estados intermedios: reserva de asientos, doble coincidencia, créditos | Integridad en [Atributos de calidad](05-atributos-de-calidad.md) | Transacciones en PostgreSQL; limita qué datos pueden repartirse entre servicios |
| DA-04 | El sistema debe poder dividirse sin detener el servicio ni reescribirse | Objetivo del curso y del proyecto | Migración gradual; contratos estables antes de mover código |
| DA-05 | Un solo operador y planes de bajo costo | [RA-02, RA-03](06-restricciones.md) | Pocos servicios, sin infraestructura de orquestación propia |
| DA-06 | Los identificadores de catálogo ya están referenciados por datos existentes | [RT-09](06-restricciones.md) | Carga de catálogos no destructiva; los catálogos como dato de referencia compartido |
| DA-07 | Varias áreas funcionales todavía no tienen backend | [RF-018 a RF-023](04-requisitos-funcionales.md) | Las áreas nuevas pueden nacer ya con la estructura objetivo, sin migración |
| DA-08 | Los datos de contacto solo deben revelarse tras un acuerdo mutuo | [RF-012, RF-017](04-requisitos-funcionales.md) | La información de contacto no debe viajar en listados ni en el token |

## Relación entre drivers y decisiones

| Driver | Decisión existente | Decisión propuesta |
|---|---|---|
| DA-01 | Redis con script atómico y vigencia de 15 minutos ([ADR-001](../06-decisiones-arquitectonicas/ADR-001-estado-y-organizacion-actual.md)) | Extraer el radar primero ([ADR-004](../06-decisiones-arquitectonicas/ADR-004-extraccion-inicial-de-radar.md)) |
| DA-02 | JWT RS256 verificable con clave pública ([ADR-001](../06-decisiones-arquitectonicas/ADR-001-estado-y-organizacion-actual.md)) | Los servicios verifican el token con la clave pública sin consultar a identidad |
| DA-03 | Transacciones locales en los repositorios | Mantener en un mismo servicio los datos que cambian juntos ([ADR-005](../06-decisiones-arquitectonicas/ADR-005-propiedad-gradual-de-datos.md)) |
| DA-04 | Módulos sin importaciones cruzadas ([ADR-002](../06-decisiones-arquitectonicas/ADR-002-separacion-interna-de-responsabilidades.md)) | Migración por dominios con entrada reversible ([ADR-003](../06-decisiones-arquitectonicas/ADR-003-migracion-gradual-por-dominios.md)) |
| DA-05 | Plataformas gestionadas ([ADR-006](../06-decisiones-arquitectonicas/ADR-006-plataformas-de-despliegue.md)) | Limitar el número de servicios desplegados |
| DA-06 | Carga de catálogos que conserva identificadores | Catálogos como datos de referencia de solo lectura para los demás servicios |

## Tensiones

Los drivers no apuntan todos en la misma dirección. Las tensiones siguientes son las que más pesan en el diseño.

| Tensión | Descripción | Cómo se resuelve en la propuesta |
|---|---|---|
| DA-04 frente a DA-05 | Dividir en servicios aumenta el trabajo de operación de una sola persona | Extraer solo cuando haya un beneficio concreto; agrupar dominios afines |
| DA-04 frente a DA-03 | Repartir datos entre servicios rompe transacciones que hoy son locales | No separar tablas que participan en una misma transacción |
| DA-02 frente a DA-04 | Todos los módulos necesitan datos del usuario | Reducir lo que cada servicio necesita a lo que ya viaja en el token; lo demás, por contrato |
| DA-01 frente a DA-05 | Un servicio de radar aparte añade un despliegue más | El radar no depende de PostgreSQL, por lo que su costo de separación es el menor |

[← Índice](../README.md)
