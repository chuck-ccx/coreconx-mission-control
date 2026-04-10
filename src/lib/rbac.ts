export type Role = 'admin' | 'manager' | 'viewer';

export interface UserProfile {
  id: string;
  email: string;
  role: Role;
  status: 'active' | 'invited' | 'disabled';
  display_name: string | null;
  invited_by: string | null;
  created_at: string;
}

// Which roles can access which route prefixes
const routeAccess: Record<string, Role[]> = {
  '/users':     ['admin'],
  '/settings':  ['admin'],
  '/crm':       ['admin', 'manager'],
  '/tasks':     ['admin', 'manager'],
  '/outreach':  ['admin', 'manager'],
  '/emails':    ['admin', 'manager'],
  '/legal':     ['admin', 'manager'],
  '/agents':    ['admin', 'manager'],
  '/calendar':  ['admin', 'manager', 'viewer'],
  '/chat':      ['admin', 'manager', 'viewer'],
  '/errors':    ['admin'],
  '/':          ['admin', 'manager', 'viewer'],
};

export function canAccessRoute(role: Role, pathname: string): boolean {
  // Exact match first
  if (routeAccess[pathname]) {
    return routeAccess[pathname].includes(role);
  }
  // Prefix match for nested routes
  for (const [prefix, roles] of Object.entries(routeAccess)) {
    if (prefix !== '/' && pathname.startsWith(prefix)) {
      return roles.includes(role);
    }
  }
  // Default: allow (dashboard, etc.)
  return true;
}

export function hasRole(userRole: Role, requiredRoles: Role[]): boolean {
  return requiredRoles.includes(userRole);
}
