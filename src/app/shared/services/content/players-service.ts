import { Injectable, inject } from '@angular/core';
import { map, Observable, catchError, of } from 'rxjs';
import { PlayersApiService } from '../api/players-api-service';
import { DbPlayer } from '../../../models/db-player.model';

@Injectable({
  providedIn: 'root'
})
export class PlayersService {

  private playersApi = inject(PlayersApiService);

  getAllPlayers(): Observable<DbPlayer[]> {
    return this.playersApi.getPlayers().pipe(
      map(response => response?.data || []),
      catchError(() => of([]))
    );
  }
}