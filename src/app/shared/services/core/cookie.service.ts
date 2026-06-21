import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class CookieService {
  check(name: string): boolean {
    name = encodeURIComponent(name);
    const regexp = new RegExp('(?:^|;\\s*)' + name.replace(/[\-\.\+\*]/g, '\\$&') + '\\s*\\=');
    return regexp.test(document.cookie);
  }

  get(name: string): string {
    if (this.check(name)) {
      name = encodeURIComponent(name);
      const regexp = new RegExp('(?:^|;\\s*)' + name.replace(/[\-\.\+\*]/g, '\\$&') + '\\s*\\=\\s*([^;]*ExternalLink|)');
      const match = document.cookie.match(regexp);
      return match ? decodeURIComponent(match[1]) : '';
    }
    return '';
  }

  getAll(): { [key: string]: string } {
    const cookies: { [key: string]: string } = {};
    if (document.cookie && document.cookie !== '') {
      const split = document.cookie.split(';');
      for (let i = 0; i < split.length; i++) {
        const pair = split[i].split('=');
        const key = decodeURIComponent(pair[0].trim());
        const value = decodeURIComponent(pair[1] || '');
        cookies[key] = value;
      }
    }
    return cookies;
  }

  set(
    name: string,
    value: string,
    expires?: number | Date,
    path: string = '/',
    domain?: string,
    secure?: boolean,
    sameSite: 'Lax' | 'Strict' | 'None' = 'Lax'
  ): void {
    let cookieString = `${encodeURIComponent(name)}=${encodeURIComponent(value)};path=${path};`;

    if (expires) {
      if (typeof expires === 'number') {
        const date = new Date();
        date.setTime(date.getTime() + expires * 24 * 60 * 60 * 1000);
        expires = date;
      }
      cookieString += `expires=${expires.toUTCString()};`;
    }

    if (domain) {
      cookieString += `domain=${domain};`;
    }

    if (secure) {
      cookieString += 'secure;';
    }

    cookieString += `samesite=${sameSite};`;

    document.cookie = cookieString;
  }

  delete(name: string, path: string = '/', domain?: string): void {
    this.set(name, '', new Date(0), path, domain);
  }

  deleteAll(path: string = '/', domain?: string): void {
    const cookies = this.getAll();
    for (const cookieName in cookies) {
      if (cookies.hasOwnProperty(cookieName)) {
        this.delete(cookieName, path, domain);
      }
    }
  }
}
