// Textos y ejemplos editoriales. No representan resultados de un modelo ni datos de usuarios.
export const navigation = [
  { href: "#inicio", label: "Inicio" },
  { href: "#plataforma", label: "Plataforma" },
  { href: "#aprendizaje", label: "Aprendizaje" },
  { href: "#instituciones", label: "Instituciones" },
];
export const materials = [
  {
    id: "plastic",
    name: "Plástico",
    code: "01 / PET",
    example: "Una botella. Muchas posibilidades.",
    detail:
      "Una botella de PET puede tener otra vida cuando se separa y entrega correctamente.",
    steps: [
      "Vacía el contenido.",
      "Retira los restos y deja secar.",
      "Consulta qué plásticos recibe tu centro de acopio.",
    ],
    note: "La apariencia por sí sola no confirma el tipo de plástico. Revisa la identificación del envase.",
  },
  {
    id: "paper",
    name: "Papel",
    code: "02 / PAPEL",
    example: "Las ideas también se reciclan.",
    detail:
      "Las hojas y los periódicos limpios pueden recuperarse. Mantenerlos secos hace la diferencia.",
    steps: [
      "Separa el papel limpio.",
      "Evita mezclarlo con comida o grasa.",
      "Guárdalo seco y consulta la recepción local.",
    ],
    note: "El papel sanitario y los papeles contaminados no se mezclan con papel recuperable.",
  },
  {
    id: "cardboard",
    name: "Cartón",
    code: "03 / CARTÓN",
    example: "Dale otra vuelta a esa caja.",
    detail:
      "Separar el cartón limpio facilita su almacenamiento y recuperación.",
    steps: [
      "Vacía la caja.",
      "Separa partes con grasa o comida.",
      "Desarma y aplana el cartón seco.",
    ],
    note: "Los envases multicapa requieren una recepción específica; no todo envase es solo cartón.",
  },
  {
    id: "metal",
    name: "Metal",
    code: "04 / METAL",
    example: "Pequeña lata. Nueva oportunidad.",
    detail:
      "Las latas de bebidas y conservas pueden recuperarse en centros que acepten esos materiales.",
    steps: [
      "Vacía el envase.",
      "Retira residuos de comida con cuidado.",
      "Consulta dónde reciben aluminio y acero.",
    ],
    note: "Evita bordes cortantes. Los aerosoles y envases de químicos requieren manejo específico.",
  },
  {
    id: "glass",
    name: "Vidrio",
    code: "05 / VIDRIO",
    example: "Transparente, también en su destino.",
    detail:
      "Botellas y frascos de vidrio se separan de otros objetos que pueden parecer similares.",
    steps: [
      "Vacía la botella o el frasco.",
      "Separa tapas según indicaciones locales.",
      "Entrega sin romper en un lugar que lo acepte.",
    ],
    note: "Espejos, cerámica y bombillas no se mezclan con botellas de vidrio. Pide ayuda con vidrio roto.",
  },
  {
    id: "organic",
    name: "Orgánico",
    code: "06 / ORGÁNICO",
    example: "Lo que vuelve a la tierra.",
    detail:
      "Algunos restos vegetales pueden aprovecharse en un programa de compostaje supervisado.",
    steps: [
      "Separa cáscaras y restos vegetales.",
      "Retira empaques y etiquetas.",
      "Sigue las reglas del compostaje de tu escuela.",
    ],
    note: "No todos los restos se aceptan en cada sistema de compostaje. Consulta a tu docente.",
  },
] as const;
export type MaterialId = (typeof materials)[number]["id"];
export const roles = [
  {
    name: "Estudiantes",
    title: "Aprender haciendo.",
    text: "Convertir cada residuo en una pregunta, una respuesta y un hábito que se lleva a casa.",
    items: [
      "Guías claras por material",
      "Lecciones y retos de aprendizaje",
      "Progreso personal y logros",
    ],
    label: "RECORRIDO PROPUESTO",
    rows: [
      "Explorar un material",
      "Practicar la clasificación",
      "Compartir lo aprendido",
    ],
  },
  {
    name: "Docentes",
    title: "Acompañar cada avance.",
    text: "Llevar la educación ambiental a la práctica y conocer qué necesita reforzar cada grupo.",
    items: [
      "Actividades para el aula",
      "Seguimiento de grupos asignados",
      "Evaluaciones antes y después",
    ],
    label: "HERRAMIENTAS PREVISTAS",
    rows: [
      "Preparar una actividad",
      "Acompañar al grupo",
      "Revisar el aprendizaje",
    ],
  },
  {
    name: "Directores",
    title: "Una comunidad que participa.",
    text: "Organizar el programa ambiental de la institución con información útil para tomar decisiones.",
    items: [
      "Gestión institucional",
      "Participación por grupos",
      "Reportes y objetivos ambientales",
    ],
    label: "GESTIÓN PREVISTA",
    rows: [
      "Organizar grupos y docentes",
      "Definir metas de participación",
      "Evaluar resultados del programa",
    ],
  },
] as const;
export const faqs = [
  {
    q: "¿Necesitamos comprar equipo especial?",
    a: "No. La propuesta está pensada para aprovechar la cámara de laptops, tabletas y teléfonos. Arduino se contempla únicamente como una extensión experimental opcional.",
  },
  {
    q: "¿La inteligencia artificial ya está disponible?",
    a: "Ya existe la interfaz de cámara, pero el reconocimiento automático no está activo: SortlyScan Vision aún necesita un modelo especializado, pruebas de precisión y validación antes de habilitar el reconocimiento por cámara.",
  },
  {
    q: "¿Cómo funcionará el programa piloto?",
    a: "Se propone un piloto gratuito con escuelas públicas de El Salvador. La selección de centros, fechas, acompañamiento y condiciones todavía deben confirmarse. La dirección puede enviar una solicitud institucional en línea; queda pendiente de revisión y no confirma un cupo.",
  },
  {
    q: "¿Qué pasa si hay poca conexión a internet?",
    a: "Esta presentación usa recursos locales y gráficos ligeros. El acceso sin conexión a lecciones y el procesamiento de imágenes con bajo consumo de datos se evaluarán en las siguientes fases; todavía no están disponibles.",
  },
  {
    q: "¿Cómo se cuidará la privacidad de los estudiantes?",
    a: "Las cuentas de estudiantes las crea su docente con un nombre o seudónimo, sin correo personal. Cada rol ve solo lo que le corresponde y los datos de cada institución están separados. La política de privacidad deberá validarse antes de recopilar información de estudiantes reales.",
  },
];
