# Criterios de validación

Qué debe comprobarse antes, durante y después de extraer un servicio, y cómo decidir si la migración debe continuar.

> **Estado: PROPUESTO.** Son criterios por aplicar. Radar es el primer caso: tiene código, pero ninguna extracción está activa en producción, y los umbrales numéricos son objetivos pendientes de validación. Su situación frente a estos criterios está en [Estrategia de migración](../migracion/README.md#principio-no-distribuir-por-distribuir).

## Principio

Una extracción solo se da por buena si el sistema hace **lo mismo que antes**, con **garantías iguales o mejores**, y puede **deshacerse**. Ser «más moderno» no es un criterio.

## Lista previa a cualquier extracción

Todas las casillas deben cumplirse antes de mover el primer archivo.

### Sobre el dominio que se extrae

- [ ] Sus dependencias de datos ajenos están identificadas, tabla por tabla.
- [ ] Ninguna de sus transacciones incluye tablas de otro dominio, o está decidido cómo se resolverá.
- [ ] Su contrato HTTP está escrito y cubierto por pruebas.
- [ ] Tiene pruebas contra servicios reales que pueden ejecutarse sin cambios contra el servicio nuevo.
- [ ] No hay cambios funcionales pendientes en el módulo.

### Sobre la plataforma

- [ ] La entrada de API permite enrutar ese prefijo y devolverlo al monolito.
- [ ] El servicio nuevo tiene ruta de salud y registro de solicitudes.
- [ ] La verificación de tokens funciona fuera del monolito con la clave pública.
- [ ] Existe un respaldo reciente de la base y se ha probado su restauración, si la extracción toca datos.
- [ ] La integración continua ejecuta las pruebas de ambos lados.

### Sobre la operación

- [ ] El procedimiento de reversión está escrito y se ha ensayado.
- [ ] Hay una forma de observar errores y latencia del servicio nuevo.
- [ ] El operador dispone de tiempo para vigilar el periodo de observación.

## Validaciones durante la convivencia

| Validación | Cómo | Criterio de aceptación |
|---|---|---|
| Equivalencia funcional | Ejecutar la misma suite contra el monolito y contra el servicio | Mismos resultados |
| Contrato | Pruebas de contrato sobre las rutas que usa el frontend | Sin diferencias en rutas, campos, estados ni códigos de error |
| Concurrencia | Repetir las pruebas reales de concurrencia del dominio | Mismas garantías |
| Latencia | Medir antes y después, incluyendo el arranque en frío | **Objetivo pendiente de validación:** percentil 95 no peor que el previo en más de un 20 % |
| Errores | Tasa de respuestas 5xx durante el periodo de observación | **Objetivo pendiente de validación:** no superior a la previa |
| Aislamiento | Detener el servicio nuevo | El resto del sistema sigue respondiendo |
| Reversión | Ejecutar la reversión en condiciones reales | El monolito atiende de nuevo sin pérdida de datos |

No existe hoy una medición previa de latencia ni de errores. Obtenerla es un requisito de la etapa 3: sin punto de partida no hay comparación posible.

## Validaciones específicas por dominio

| Dominio | Qué vigilar en particular | Prueba de referencia |
|---|---|---|
| Radar | Consenso con 3 usuarios, voto duplicado, vigencia de 15 minutos, mismas claves de Redis que el monolito | [radar.real.test.ts](../../apps/api/tests/real/radar.real.test.ts) |
| Identidad | Registro e inicio de sesión sin interrupción; rechazo del rol administrador; los tokens emitidos antes siguen siendo válidos | [auth.real.test.ts](../../apps/api/tests/real/auth.real.test.ts) |
| Comunidad | Publicaciones con datos de autor correctos sin `JOIN`; máquina de estados del matchmaking; privacidad del contacto | [feed_matchmaking.real.test.ts](../../apps/api/tests/real/feed_matchmaking.real.test.ts) |
| Movilidad | Sin sobreventa; una sola solicitud activa; solo el conductor confirma; contacto revelado solo al confirmar | [carpooling.real.test.ts](../../apps/api/tests/real/carpooling.real.test.ts) |
| Recursos | El saldo nunca es incoherente; sin cobro doble por reintento; descarga propia y repetida sin costo | Por escribir: hoy no hay pruebas |
| Datos y esquema | Identificadores de catálogo intactos; migraciones registradas; índice único presente | [migrations.real.test.ts](../../apps/api/tests/real/migrations.real.test.ts) |

## Validación de cambios de datos

Para cualquier etapa que modifique el esquema o traslade datos:

| N.º | Comprobación |
|---|---|
| 1 | Respaldo completo tomado y restauración ensayada en un entorno aislado |
| 2 | Migración ejecutada primero sobre la copia restaurada |
| 3 | Recuento de filas por tabla antes y después |
| 4 | Comprobación de claves: ningún identificador existente ha cambiado |
| 5 | Comprobación de restricciones e índices esperados en el catálogo de la base |
| 6 | La versión anterior del código sigue funcionando con el esquema nuevo |
| 7 | Solo entonces, ejecución en producción y repetición de las comprobaciones 3 a 5 |

Procedimiento completo en [Proceso de entrega](../05-despliegue-y-operacion/03-proceso-de-entrega.md).

## Criterios de cierre de una etapa

Una etapa se cierra cuando:

1. Se cumplen sus criterios de salida del [plan de migración](03-plan-de-migracion.md).
2. Ha transcurrido el periodo de observación sin reversión.
3. La documentación refleja el nuevo estado: arquitectura actual, C4, inventario y un ADR si se tomó una decisión.
4. El módulo antiguo se retira del monolito, o se registra por qué se conserva.

El informe de cierre debe distinguir lo implementado, lo verificado con pruebas y lo comprobado en producción. Los informes de las etapas 1 y 2 muestran por qué: lo verificado en local y lo confirmado en el entorno remoto no siempre coinciden.

## Decisión de continuar o detenerse

Tras cada etapa a partir de la 4 conviene responder estas preguntas con datos:

| Pregunta | Señal para continuar | Señal para detenerse o replantear |
|---|---|---|
| ¿Se cumplió el aislamiento de fallos? | Un fallo del servicio no afectó al resto | Los fallos se propagan igual que antes |
| ¿Cuánto tiempo exige la operación? | Asumible por el operador | Crece con cada servicio hasta desplazar el desarrollo |
| ¿Empeoró la experiencia del usuario? | Latencia equivalente | Arranques en frío perceptibles en funciones de uso frecuente |
| ¿La reversión se ha usado o ensayado? | Funciona | No se ha probado o falló |
| ¿Hay funcionalidad más urgente? | No | Las pantallas simuladas siguen sin resolverse y los usuarios las necesitan |
| ¿Las plataformas lo soportan? | Sí, con el plan actual | Se necesitan recursos de pago no disponibles |

Detenerse es un resultado válido. La [alternativa de alcance reducido](03-plan-de-migracion.md#alternativa-de-alcance-reducido) describe cómo quedaría el sistema en ese caso.

## Validación de esta documentación

Esta documentación debe revisarse cuando ocurra cualquiera de estos hechos:

| Hecho | Documentos que actualizar |
|---|---|
| Se añade, cambia o elimina una ruta | Contratos, requisitos, matriz de trazabilidad, inventario |
| Se conecta una pantalla simulada a la API | Inventario, requisitos, arquitectura actual |
| Se extrae un servicio | Arquitectura actual, C4 actual, mapa de despliegue, plan |
| Cambia una plataforma o su configuración | Mapa de despliegue, ADR-006 |
| Se toma una decisión de las propuestas | ADR correspondiente: de «Propuesto» a «Aceptado», con fecha y responsable |
| Se verifica algo marcado como pendiente | El documento donde figura |

[← Índice](../README.md)
