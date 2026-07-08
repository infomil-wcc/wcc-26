import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { of } from 'rxjs';
import { tap } from 'rxjs/operators';

const cache = new Map<string, any>();

export const cacheInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.method !== 'GET') {
    return next(req);
  }

  const cachedResponse = cache.get(req.urlWithParams);
  if (cachedResponse) {
    return of(cachedResponse.clone());
  }

  return next(req).pipe(
    tap(event => {
      if (event instanceof HttpResponse) {
        cache.set(req.urlWithParams, event);
      }
    })
  );
};
