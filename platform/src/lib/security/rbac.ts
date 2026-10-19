export type Role = 'admin' | 'nazoratchi' | 'prorab' | 'kuzatuvchi';

export const ROLES: Role[] = ['admin', 'nazoratchi', 'prorab', 'kuzatuvchi'];

export const roleLabel: Record<Role, string> = {
  admin: 'Administrator',
  nazoratchi: 'Xavfsizlik nazoratchisi',
  prorab: 'Prorab',
  kuzatuvchi: 'Kuzatuvchi (faqat ko\'rish)',
};

const rank: Record<Role, number> = { kuzatuvchi: 1, prorab: 2, nazoratchi: 3, admin: 4 };

/** Huquqlar matritsasi — har bir server amali shu yerdan tekshiriladi. */
export const PERMS = {
  view: 'kuzatuvchi',
  'alert.handle': 'prorab',
  'detector.run': 'prorab',
  'zone.edit': 'nazoratchi',
  'camera.edit': 'nazoratchi',
  'worker.edit': 'nazoratchi',
  'report.export': 'nazoratchi',
  'device.manage': 'admin',
  'user.manage': 'admin',
  'settings.manage': 'admin',
  'audit.view': 'admin',
} as const satisfies Record<string, Role>;

export type Perm = keyof typeof PERMS;

export function can(role: Role, perm: Perm) {
  return rank[role] >= rank[PERMS[perm]];
}
