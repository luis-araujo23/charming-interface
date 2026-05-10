import type { DiaryEntryPreview } from "@/components/diary/DiaryEntryCard";

export const mockEntries: DiaryEntryPreview[] = [
  {
    id: "1",
    title: "El café de las 7 am",
    excerpt: "Hoy llegué temprano al café de la esquina. La luz entraba en diagonal y todo olía a pan recién hecho. A veces los días buenos empiezan por cosas pequeñas.",
    date: "21 Abr",
    song: { title: "Sunflower", artist: "Rex Orange County" },
    photoCount: 3,
    tagCount: 1,
  },
  {
    id: "2",
    title: "Caminata sin rumbo",
    excerpt: "Después del trabajo decidí no tomar el bus. Caminé hasta el parque y me senté a mirar el cielo. Pensé en cosas que llevaba meses evitando.",
    date: "20 Abr",
    song: { title: "Holocene", artist: "Bon Iver" },
    photoCount: 2,
  },
  {
    id: "3",
    title: "Cena con los de siempre",
    excerpt: "Risas, vino, y esa conversación que parece eterna. Hay personas que se sienten como casa.",
    date: "18 Abr",
    photoCount: 5,
    tagCount: 3,
  },
  {
    id: "4",
    title: "Lluvia toda la tarde",
    excerpt: "Me quedé leyendo junto a la ventana. El tipo de día que no se cuenta, se vive en silencio.",
    date: "17 Abr",
    song: { title: "Liability", artist: "Lorde" },
  },
  {
    id: "5",
    title: "Algo nuevo",
    excerpt: "Empecé a aprender a tocar guitarra. Los dedos me duelen pero hace tiempo no me sentía tan presente.",
    date: "15 Abr",
    photoCount: 1,
  },
  {
    id: "6",
    title: "Domingo lento",
    excerpt: "Desayuno largo, sin reloj. La pereza también es un regalo.",
    date: "14 Abr",
    song: { title: "Coffee", artist: "beabadoobee" },
  },
];

export const mockFriends = [
  { id: "1", username: "lucia.m", name: "Lucía Méndez", initials: "LM" },
  { id: "2", username: "andrespz", name: "Andrés Pérez", initials: "AP" },
  { id: "3", username: "valeg", name: "Valentina G.", initials: "VG" },
  { id: "4", username: "nicom", name: "Nicolás M.", initials: "NM" },
  { id: "5", username: "camilao", name: "Camila O.", initials: "CO" },
];

export const mockRequests = [
  { id: "r1", username: "danielab", name: "Daniela B." },
  { id: "r2", username: "jeronimoa", name: "Jerónimo A." },
];

export const mockTagged = [
  { id: "t1", author: "Lucía Méndez", title: "Concierto del sábado", date: "19 Abr", excerpt: "No me lo voy a olvidar nunca, gracias por estar." },
  { id: "t2", author: "Andrés Pérez", title: "Viaje al sur", date: "10 Abr", excerpt: "Una semana entera de carretera y montañas." },
];

export const mockMemories = [
  { id: "m1", year: "2025", title: "Mi cumpleaños 22", excerpt: "Una noche que parecía no terminar. Todos estuvieron ahí." },
  { id: "m2", year: "2024", title: "Primer día en la oficina", excerpt: "Estaba muerto de nervios y emocionado al mismo tiempo." },
  { id: "m3", year: "2023", title: "El verano del cambio", excerpt: "Empecé a correr y a escribir todos los días." },
];
