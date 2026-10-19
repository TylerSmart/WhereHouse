import { environment } from '../../../environments/environment';

export function apiUrl(path: string): string {
  const base = environment.apiBaseUrl.replace(/\/$/, '');
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${base}${suffix}`;
}
