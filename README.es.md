# Editor de plantas Flora

[English](README.md) · [Deutsch](README.de.md) · **Español** · [Français](README.fr.md)

Una aplicación web independiente para diseñar plantas para [Flora](https://github.com/jaseknighter/flora) en el monome norns dibujándolas.
Tú dibujas la forma y la aplicación escribe el sistema L: axioma, reglas, etapas de crecimiento y melodía.
Muestra una vista previa del norns, reproduce la melodía y exporta un archivo `.flora` listo para usar.

Todo está en un único archivo, `index.html`. No hay nada que instalar ni compilar, y funciona sin conexión.

## Inicio rápido

1. Abre `index.html` en un navegador actual (Chrome, Edge, Firefox o Safari), por ejemplo con doble clic.
2. Con **✏️ Dibujar**, traza una línea desde el punto de inicio rojo. Se ajusta a las direcciones del ángulo elegido.
3. Elige **Simetría** (p. ej. 6 veces) y **Espejo** para construir un copo de nieve a partir de un solo brazo.
4. Pulsa **▶ Reproducir** para oír la melodía. El control **Mostrar hasta la generación** muestra cómo crece la planta.
5. Haz clic en **Guardar (.flora)** y copia el archivo al norns (consulta [Usar la planta en el norns](#usar-la-planta-en-el-norns)).

Con el menú 🌐 de arriba a la derecha cambias entre inglés, alemán, español y francés.

## Publicar en la web

La aplicación es una página estática con `index.html` como archivo de entrada. Cualquier servidor web o alojamiento estático puede servirla,
p. ej. GitHub Pages, Netlify o un servidor propio. Sube `index.html`; los archivos README son opcionales.
No hay código en el servidor y la aplicación no carga nada de otros servidores.

- Se recomienda **HTTPS**: allí la aplicación copia mediante la interfaz del portapapeles del navegador. Con HTTP simple usa un método de copia más antiguo; todo lo demás funciona igual.
- Lo que la aplicación recuerda se guarda en el navegador de cada visitante, por separado para cada dirección web.

## Funciones

### Dibujo
- **Cuadrícula:** ángulos de 30°, 45°, 60° y 90°. Las líneas se ajustan a las direcciones permitidas y se dividen en pasos de la tortuga.
- **Simetría:** de 2 a 12 veces, según el ángulo.
- **Espejo:** añade cada línea nueva reflejada en el eje vertical.
- **Tipos de línea:**
  - ♪ **Nota** (`F`): dibuja y toca una nota.
  - — **Línea** (`G`): dibuja con un silencio.
  - ┄ **Salto** (`f`): se mueve de forma invisible, p. ej. del centro a un anillo.
- **Herramientas:** Dibujar, Seleccionar, Aplicar (tipo y generación), Borrar. Deshacer/rehacer con Ctrl+Z / Ctrl+Y.
- **Navegación:** la rueda del ratón hace zoom y el botón derecho desplaza la vista.

### Crecimiento
- **Generaciones:** cada línea tiene una generación, que se reconoce por su color. La generación 0 aparece enseguida; las superiores crecen una tras otra.
- **Reglas:** la aplicación las genera automáticamente. Las partes posteriores quedan detrás de letras auxiliares que crecen una etapa por generación.
- **Control:** «Mostrar hasta la generación» muestra cada etapa en el editor, en la vista previa y en la melodía.

### Melodía
- **Alturas:** cada línea de nota muestra el grado de la escala (1–24) que Flora tocaría en ese punto.
- **Altura fija:** selecciona una línea de nota con **↖ Seleccionar** y fija una **altura fija**. El código recibe entonces símbolos que no cambian la forma (`[]`, `+-`, `|---`) y fijan exactamente ese grado.
- **Las copias simétricas** siempre suenan como el brazo dibujado.
- **Mismas notas:** con esta opción, también los reflejos tocan las mismas notas que su original.
- **Reproducción** en el navegador, con escala, nota base, el *note scalar* de Flora y duración de nota a elegir. La nota que suena se ilumina en el dibujo y en la vista previa.

### Código
- **Código en vivo:** el axioma, las reglas, el ángulo, la longitud de paso, el punto de inicio y las generaciones aparecen junto al dibujo y se actualizan al momento.
- **Edición a mano:** puedes editar el código tú mismo. Entonces el dibujo deja de estar vinculado, y la aplicación lo indica.
- **Construir dibujo desde el código:** convierte las líneas de cualquier código (p. ej. un ejemplo) en un dibujo.
- **Avisos:** una tabla muestra por generación los caracteres, las notas y los silencios. La aplicación avisa de frases de más de 300 caracteres, de notas fuera de la escala y de reglas no válidas.

### Exportación
- **Archivo `.flora`:** para el vivero (*nursery*) de Flora. El dibujo se guarda en el archivo como comentario de Lua, así que al cargarlo se recupera exactamente. Flora ignora el comentario.
- **Comando maiden:** crea el archivo directamente en el norns.
- **Entrada de catálogo:** para `lib/gardens/garden_catalog_default.lua`.
- **Ejemplos:** incluye diez copos de nieve, disponibles en **Cargar ejemplo…**.

## Usar la planta en el norns

1. Copia el archivo `.flora` a `dust/data/flora/nursery/` en el norns.
   - Windows: `\\norns.local\dust` en el Explorador (usuario `we`).
   - macOS: Finder → Ir → Conectarse al servidor → `smb://norns.local/dust`.
   - O pega el **comando maiden** en la REPL de maiden. Crea el archivo por ti.
2. En Flora: **K1 → PARAMETERS → EDIT → GARDENING → ADD PLANT TO GARDEN** y elige el archivo.
3. En la página de la planta, mantén **K1** y gira **E2** hasta encontrarla. **K2 / K3** recorren sus generaciones.

## Cómo imita la aplicación a Flora

La vista previa y la melodía siguen el propio código de Flora (`lib/l_system.lua`, `lib/turtle.lua`, `lib/plant_sounds.lua`):

- **Reglas:** letras sueltas. Cada generación se recorta a 300 caracteres (`MAX_SENTENCE_LENGTH`).
- **Símbolos de la tortuga:** `F` dibuja y toca una nota, `G` dibuja con un silencio, `f` se mueve sin dibujar, `+`/`-` giran según el ángulo, `|` gira 180°, `[`/`]` guardan y recuperan posición y dirección.
- **Altura:**
  - `+` y `-` cambian la altura en `ceil(note scalar × ángulo en radianes)` grados. Con el *note scalar* por defecto (3) son +4/−3 a 60° y +2/−1 a 30°.
  - `]` devuelve la altura al grado 12 de 24, porque en Flora `[` no guarda ninguna altura.
- **Visualización:** Flora muestra la planta 1 desplazada 32 px a la izquierda. La vista previa hace lo mismo y muestra además la planta 2 atenuada.

## Limitaciones

- **Sonido:** el sonido del navegador es solo una aproximación al motor de Flora.
- **Números de escala:** se supone que siguen el orden de `MusicUtil` en el norns (5 = dórica).
- **Líneas que desaparecen al crecer**, p. ej. una punta que avanza hacia fuera, no se pueden representar en un dibujo. El código importado de este tipo solo conserva su forma final.
- **Límite de caracteres:** los dibujos grandes, la simetría alta y muchas alturas fijas cuestan caracteres. Vigila el límite de 300 caracteres en la tabla de generaciones.
- **Guardado en el navegador:** la aplicación recuerda tu trabajo en el navegador, pero solo si la página se abre normalmente (no en ventanas de vista previa incrustadas). Lo que quieras conservar, guárdalo como archivo `.flora`.

## Autoprueba

Abre la consola del navegador y ejecuta `floraSelfTest()`. Convierte cada uno de los diez copos de nieve incluidos en un dibujo, genera de nuevo el código a partir de él y comprueba que la forma final sea idéntica.
