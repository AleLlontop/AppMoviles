// Usuarios fake creados por scripts/demo_seed.sql.
// Los UUIDs son fijos para que el toggle "Modo presentación" pueda
// inyectarlos en la presencia local del usuario.

export const DEMO_USER_IDS = {
  maria: 'a0000000-0000-0000-0000-000000000001',
  lucia: 'a0000000-0000-0000-0000-000000000002',
  carlos: 'a0000000-0000-0000-0000-000000000003',
  camila: 'a0000000-0000-0000-0000-000000000004',
  juan: 'a0000000-0000-0000-0000-000000000005',
} as const;

export type DemoUser = {
  id: string;
  name: string;
  subjects: string[];
};

export const DEMO_USERS: DemoUser[] = [
  { id: DEMO_USER_IDS.maria,  name: 'María García',  subjects: ['Matemáticas Discreta', 'Análisis Matemático', 'Física I'] },
  { id: DEMO_USER_IDS.lucia,  name: 'Lucía Méndez',  subjects: ['Algoritmos', 'Bases de Datos', 'Frontend'] },
  { id: DEMO_USER_IDS.carlos, name: 'Carlos Rivera', subjects: ['Inglés C1', 'Italiano A2'] },
  { id: DEMO_USER_IDS.camila, name: 'Camila Ruiz',   subjects: ['Química Orgánica', 'Biología Celular'] },
  { id: DEMO_USER_IDS.juan,   name: 'Juan Pérez',    subjects: ['Cursos AWS', 'Lectura técnica'] },
];

export const isDemoUserId = (id: string): boolean =>
  id.startsWith('a0000000-0000-0000-0000-00000000000');
