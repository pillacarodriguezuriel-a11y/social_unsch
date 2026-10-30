# Historias de usuario

Las historias se redactaron a partir del comportamiento observado en el código y de las pantallas existentes. El estado indica si el flujo completo funciona con persistencia compartida; los requisitos asociados están en [Requisitos funcionales](04-requisitos-funcionales.md).

## Identidad y acceso

### HU-01 Registrarme con mi correo institucional

Como miembro de la comunidad, quiero crear una cuenta con mi correo `@unsch.edu.pe` para acceder a la plataforma.

- Dado un correo que no termina en `@unsch.edu.pe`, el registro se rechaza con un mensaje que lo explica.
- Dada una contraseña sin mayúscula, minúscula, número, símbolo o con menos de 8 caracteres, el registro se rechaza.
- Dado un correo ya registrado, el sistema responde que el correo ya existe.
- Dado el rol `administrator`, el registro se rechaza.
- Dado un registro válido, la cuenta queda creada con los términos sin aceptar.

**Estado:** Implementado.

### HU-02 Iniciar sesión

Como usuario registrado, quiero iniciar sesión para usar las funciones protegidas.

- Con credenciales correctas recibo un token válido por 24 horas y mis datos básicos.
- Con correo inexistente o contraseña incorrecta recibo el mismo mensaje, sin indicar cuál de los dos falló.
- Si el token expira o es inválido, la aplicación me devuelve a la pantalla de inicio de sesión.

**Estado:** Implementado.

### HU-03 Aceptar los términos antes de usar la plataforma

Como usuario nuevo, quiero conocer y aceptar las condiciones de uso antes de interactuar.

- Mientras no acepte, la aplicación muestra el aviso y bloquea el contenido.
- Al aceptar, la decisión queda guardada en mi cuenta.

**Estado:** Parcial. La aceptación se guarda en la base de datos, pero el bloqueo solo ocurre en el navegador; la API no rechaza a quien no ha aceptado.

### HU-04 Elegir mi escuela profesional de una lista oficial

Como usuario que se registra, quiero seleccionar mi escuela de una lista para no escribirla a mano.

- La lista muestra las escuelas agrupadas por facultad.
- El identificador enviado es el que tiene la escuela en la base de datos.
- Si el catálogo no puede cargarse, la selección se deshabilita y puede reintentarse; no se usa ninguna lista local.

**Estado:** Implementado.

## Radar del campus

### HU-05 Ver el estado del campus

Como estudiante, quiero ver el estado del comedor, el rectorado, la biblioteca y las alertas antes de desplazarme.

- Cada punto muestra su estado o «indefinido» si no hay consenso vigente.
- Un estado deja de mostrarse 15 minutos después de su última actualización.

**Estado:** Implementado.

### HU-06 Reportar el estado de un punto del campus

Como estudiante que está en el lugar, quiero reportar lo que veo para ayudar a otros.

- Mi reporte cuenta como un voto; el estado cambia cuando tres usuarios distintos reportan lo mismo.
- No puedo votar dos veces el mismo estado en la misma ventana.
- Un punto o estado no reconocido se rechaza.

**Estado:** Implementado.

## Comunidad

### HU-07 Leer publicaciones de mi comunidad

Como usuario, quiero ver las publicaciones recientes, con la posibilidad de filtrarlas por facultad o escuela.

- Las publicaciones aparecen de la más reciente a la más antigua, con nombre y rol del autor.
- Solo se muestran publicaciones visibles.
- La API admite filtros y paginación con un máximo de 50 por página.

**Estado:** Parcial. La API implementa filtros y paginación; la pantalla solicita el feed sin filtros.

### HU-08 Publicar en el feed

Como usuario, quiero publicar un mensaje para mi comunidad.

- Un mensaje vacío o de más de 2000 caracteres se rechaza.
- El contenido se guarda con los caracteres especiales de HTML escapados.

**Estado:** Implementado.

### HU-09 Encontrar compañeros para un proyecto

Como estudiante, quiero ver perfiles de otros estudiantes que buscan equipo y expresar mi interés.

- No veo mi propio perfil ni los que ya evalué recientemente.
- Si ambos expresamos interés, se nos revela el contacto.
- Si descarto un perfil, no vuelve a aparecer durante 30 días.

**Estado:** Parcial. El descubrimiento y la interacción funcionan; no existe API para crear o editar el propio perfil ni un proyecto, y las habilidades mostradas en pantalla se generan en el navegador.

## Movilidad

### HU-10 Solicitar un asiento en una ruta compartida

Como pasajero, quiero ver rutas disponibles y solicitar un asiento.

- Solo aparecen rutas con asientos disponibles.
- No puedo solicitar asiento en mi propia ruta ni tener dos solicitudes activas en la misma ruta.

**Estado:** Parcial. La API lo implementa; la pantalla usa rutas guardadas en el navegador.

### HU-11 Confirmar a un pasajero

Como conductor, quiero confirmar una solicitud para reservar el asiento e intercambiar contactos.

- Solo el conductor de la ruta puede confirmar.
- Al confirmar se descuenta un asiento y ambos reciben los datos de contacto del otro.
- Confirmar dos veces no descuenta dos asientos.

**Estado:** Parcial, por el mismo motivo que HU-10.

### HU-12 Publicar una ruta

Como conductor, quiero publicar una ruta con origen, destino, hora y asientos.

**Estado:** Simulado. No existe ruta de API para crear rutas; la pantalla las guarda en el navegador.

## Recursos y convivencia

### HU-13 Compartir y descargar material académico con créditos

Como estudiante, quiero subir apuntes y descargar los de otros usando créditos.

**Estado:** Simulado en la pantalla. El esquema de datos y la lógica de cobro existen en la base de datos, sin API que los use.

### HU-14 Reportar una publicación inapropiada

Como usuario, quiero reportar una publicación para que se oculte si varios coincidimos.

**Estado:** Simulado en la pantalla. Las tablas y el disparador de ocultamiento existen en la base de datos, sin API que los use.

### HU-15 Comprar y vender entre miembros de la comunidad / HU-16 Consultar ofertas de empleo / HU-17 Editar mi perfil

**Estado:** Simulado. Las tres pantallas trabajan solo con datos del navegador; no hay API ni tablas para marketplace y empleo, ni ruta para actualizar el perfil.

[← Índice](../README.md)
