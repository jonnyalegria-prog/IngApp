import type { EnglishLevel } from '../lib/types'

export interface DiscoveryItem {
  id: string
  level: EnglishLevel
  category: 'error_comun' | 'vocabulario'
  title: string
  explanation: string
  example: string
}

export const discoveryContent: DiscoveryItem[] = [
  { id: 'much-vs-many', level: 'principiante', category: 'error_comun', title: '"much" vs "many"', explanation: '"many" va con sustantivos contables (many friends), "much" con incontables (much time).', example: "I don't have much time, but I have many things to do." },
  { id: 'double-negative', level: 'principiante', category: 'error_comun', title: 'No uses doble negativo', explanation: 'En español "no sé nada" es normal, pero en inglés no se usan dos negativos juntos.', example: "I don't know anything (no \"I don't know nothing\")." },
  { id: 'people-plural', level: 'principiante', category: 'error_comun', title: '"people" ya es plural', explanation: 'A diferencia de "gente" en español (singular), "people" siempre lleva el verbo en plural.', example: 'People are nice here (no "people is nice").' },
  { id: 'embarrassed-false-friend', level: 'principiante', category: 'error_comun', title: 'Falso amigo: "embarrassed"', explanation: '"embarrassed" significa avergonzado/a, no embarazada. Para eso se usa "pregnant".', example: 'I felt so embarrassed when I forgot her name.' },
  { id: 'actually-false-friend', level: 'intermedio', category: 'error_comun', title: 'Falso amigo: "actually"', explanation: '"actually" significa "en realidad", no "actualmente". Para eso se usa "currently" o "nowadays".', example: "Actually, I don't agree with that plan." },
  { id: 'make-vs-do', level: 'intermedio', category: 'error_comun', title: '"make" vs "do"', explanation: '"do" para tareas/actividades generales (do homework), "make" para crear algo (make a decision).', example: 'I need to do my homework before I make dinner.' },
  { id: 'since-vs-for', level: 'intermedio', category: 'error_comun', title: '"since" vs "for"', explanation: '"since" con un punto en el tiempo (since 2020), "for" con una duración (for three years).', example: "I've lived here since 2020, so for about six years." },
  { id: 'married-to', level: 'intermedio', category: 'error_comun', title: '"married to", no "married with"', explanation: 'La preposición correcta después de "married" es "to", aunque en español digamos "casado con".', example: 'She has been married to him for ten years.' },
  { id: 'borrow-vs-lend', level: 'intermedio', category: 'error_comun', title: '"borrow" vs "lend"', explanation: '"borrow" = pedir prestado (vos recibís), "lend" = prestar (vos das).', example: 'Can I borrow your pen? / Can you lend me your pen?' },
  { id: 'adjective-order', level: 'avanzado', category: 'error_comun', title: 'Orden de adjetivos', explanation: 'En inglés el tamaño suele ir antes que el color: "a big red house", no "a red big house".', example: 'She bought a beautiful small wooden table.' },
  { id: 'advice-uncountable', level: 'avanzado', category: 'error_comun', title: '"advice" es incontable', explanation: 'No se dice "an advice" ni "advices". Se dice "some advice" o "a piece of advice".', example: 'Let me give you a piece of advice.' },
  { id: 'life-no-article', level: 'avanzado', category: 'error_comun', title: 'Sin artículo para conceptos generales', explanation: 'Para hablar de algo en general no se usa "the": "Life is short", no "The life is short".', example: 'Life is short, so travel while you can.' },
  { id: 'vocab-office', level: 'principiante', category: 'vocabulario', title: 'Vocabulario: en la oficina', explanation: 'meeting (reunión), deadline (fecha límite), coworker (compañero de trabajo).', example: "The deadline for this project is Friday, so let's schedule a meeting." },
  { id: 'vocab-travel', level: 'principiante', category: 'vocabulario', title: 'Vocabulario: viajes', explanation: 'luggage (equipaje), boarding pass (tarjeta de embarque), delay (demora).', example: 'I almost missed my flight because of the delay.' },
  { id: 'vocab-home', level: 'principiante', category: 'vocabulario', title: 'Vocabulario: la casa', explanation: 'to tidy up (ordenar), landlord (dueño del alquiler), rent (alquiler).', example: 'I need to tidy up before the landlord comes to collect the rent.' },
  { id: 'vocab-weather', level: 'principiante', category: 'vocabulario', title: 'Vocabulario: el clima', explanation: 'humid (húmedo), breeze (brisa), forecast (pronóstico).', example: 'The forecast says it will be humid today.' },
  { id: 'vocab-cooking', level: 'principiante', category: 'vocabulario', title: 'Vocabulario: cocina', explanation: 'to chop (picar), to bake (hornear), leftovers (sobras).', example: 'I chopped some vegetables and baked the leftovers.' },
  { id: 'vocab-tech', level: 'intermedio', category: 'vocabulario', title: 'Vocabulario: tecnología', explanation: 'password (contraseña), to update (actualizar), device (dispositivo).', example: 'You should update your password on every device.' },
  { id: 'vocab-emotions', level: 'intermedio', category: 'vocabulario', title: 'Vocabulario: emociones', explanation: 'overwhelmed (abrumado), relieved (aliviado), frustrated (frustrado).', example: 'I was overwhelmed at first, but I felt relieved later.' },
  { id: 'vocab-health', level: 'intermedio', category: 'vocabulario', title: 'Vocabulario: salud', explanation: 'to recover (recuperarse), symptom (síntoma), appointment (turno/cita).', example: "I had a doctor's appointment because of a strange symptom." },
  { id: 'vocab-shopping', level: 'intermedio', category: 'vocabulario', title: 'Vocabulario: compras', explanation: 'refund (reembolso), receipt (recibo), to exchange (cambiar un producto).', example: 'I want to exchange this shirt, but I need the receipt.' },
  { id: 'vocab-finance', level: 'avanzado', category: 'vocabulario', title: 'Vocabulario: finanzas personales', explanation: 'to save up (ahorrar), budget (presupuesto), to owe (deber dinero).', example: "I'm trying to save up, so I made a strict budget." },
  { id: 'vocab-job-interview', level: 'avanzado', category: 'vocabulario', title: 'Vocabulario: entrevistas de trabajo', explanation: 'to negotiate (negociar), strengths and weaknesses, background (experiencia).', example: 'We talked about my strengths and weaknesses before we negotiated the salary.' },
  { id: 'vocab-environment', level: 'avanzado', category: 'vocabulario', title: 'Vocabulario: medio ambiente', explanation: 'sustainable (sostenible), to reduce waste (reducir residuos), renewable (renovable).', example: 'The company switched to renewable energy to be more sustainable.' },
]
