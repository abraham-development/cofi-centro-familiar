# Sistema visual

Decisión del usuario (18 oct 2026): la interfaz **no debe parecer hecha por IA**. Las referencias son dos paneles de producto:

| Tema | Referencia | Rasgos |
| --- | --- | --- |
| Claro | ACRU (panel financiero) | Lienzo gris perla, tarjetas blancas sin sombra, botones negros, acento lima con amarillo y naranja, barras rayadas |
| Oscuro | Stakent (panel cripto) | Casi negro azulado, tarjetas grafito con borde fino, acento lavanda, cifras ligeras, tarjeta destacada en degradado violeta |

- El menú se queda arriba, por decisión del usuario.
- El tema se elige en el menú del usuario: Claro, Oscuro o «Según el equipo» (por defecto).
- La noche automática de las pantallas sigue cambiando el tema.

## Reglas

1. **Jerarquía por tamaño y peso, no por cajas.**
   - Título de tarjeta: 16 px semibold, con subtítulo de 13 px en gris.
   - Página: 24–28 px semibold.
   - Cifras: grandes, con la utilidad `figure`.
2. **Radios constantes:**
   - tarjetas `rounded-2xl` (18 px);
   - filas y controles `rounded-xl` o `rounded-lg`;
   - chips `rounded-md`.
   - Nada de `rounded-3xl` ni `rounded-full` en chips de texto. Sin sombras en tarjetas.
3. **El acento tiene significado:** lo activo, el progreso, lo destacado y «Ahora». Lo demás va en grises.
4. **Detalles de producto:**
   - subtítulos (`caption`);
   - estados con punto de color y texto (el color nunca es la única señal);
   - botones de icono cuadrados con borde;
   - barras rayadas;
   - parte secundaria de las cifras atenuada («6:40» y «AM»).
5. **Sin emojis de sistema como iconos.** «Importante» se marca con `ImportantMark` (estrella lucide con texto accesible). Los emojis que eligen los integrantes como avatar se respetan.
6. **Iconos lucide de trazo 1,75**, aplicado de forma global.
7. **Densidad:**
   - relleno `p-5` en tarjetas y `gap-4` entre bloques;
   - controles de 40 px que suben a 44 px con puntero táctil (`pointer-coarse:`).
   - Las pantallas de hijos y cocina (`Panel size="lg"`) conservan la letra grande para leerse a distancia.

## Tokens (`src/app/globals.css`)

| Token | Claro | Oscuro | Uso |
| --- | --- | --- | --- |
| `background` | #F3F3F1 | #0B0B10 | Lienzo |
| `card` | #FFFFFF | #14141B | Tarjetas |
| `border` | #E6E6E2 | blanco 8 % | Bordes finos |
| `foreground` | #151515 | #F1F1F4 | Texto |
| `muted-foreground` | #66665F | #8F8F9D | Texto secundario (AA) |
| `primary` | #151515 | #B3A3FF | Botón principal, día elegido |
| `brand` | #8CC63F | #A794FF | Relleno de acento (barras, casillas hechas, «Ahora») |
| `brand-soft` | #EDF6E0 | lavanda 14 % | Fondo de lo activo (parte del día actual, hoy) |
| `brand-strong` | #477318 | #C4B8FF | Acento **como texto** (legible) |
| `featured` | degradado lima | degradado violeta | Tarjeta destacada (`bg-featured`) |
| `success`, `warning`, `destructive` | ajustados a AA | ajustados a AA | Estados |

**Trampa:** el lima (#8CC63F) no alcanza 4,5:1 sobre blanco. Nunca va como color de texto; como texto se usa `brand-strong`.

**Contraste comprobado (AA ≥ 4,5:1) en ambos temas:**

- texto y texto gris sobre fondo, tarjeta y gris suave;
- botón principal;
- texto sobre acento;
- acento legible;
- éxito y error;
- tarjeta destacada.

Tipografía: **Plus Jakarta Sans** (`--font-jakarta`), con `word-spacing: 0.08em` en `body` porque su espacio es estrecho. Geist Mono para códigos.

Utilidades:

- `figure`: cifras tabulares; en oscuro, peso ligero.
- `bg-stripes`: relleno rayado.
- `bg-featured`: tarjeta destacada.

## Primitivas

| Componente | Archivo | Para qué |
| --- | --- | --- |
| `Panel` | `src/components/panel.tsx` | Tarjeta con título, subtítulo y acciones. El nombre de la región es solo el título (las pruebas dependen de esos nombres). Variantes `featured` y `plain`; `size="lg"` para pantallas a distancia |
| `Stat` | `src/components/stat.tsx` | Cifra con etiqueta y nota; con `href`, la tarjeta es un enlace |
| `Meter` | `src/components/meter.tsx` | Barra rayada (`role="meter"`). Admite el color del integrante |
| `ImportantMark` | `src/components/important-mark.tsx` | Marca de evento importante |
| `Badge` | `src/components/ui/badge.tsx` | Variantes `brand`, `success`, `warning` y `neutral` |
| `TaskStateBadge` | `src/features/tasks/components/task-state-badge.tsx` | Estado de tarea con punto y texto |

Nuevas tarjetas: usa `Panel`; no copies clases de tarjeta a mano.

## Evidencia

Las capturas de antes y después, en ambos temas, están en [`capturas/rediseno/`](capturas/rediseno). Por ejemplo, `antes-casa-claro-escritorio.png` y `despues-casa-claro-escritorio.png`.
