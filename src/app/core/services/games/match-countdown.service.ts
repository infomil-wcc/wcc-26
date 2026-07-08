import { Injectable } from '@angular/core';

export interface CountdownState {
  text: string;
  isClosed: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class MatchCountdownService {
  constructor() {}

  getCountdownState(matchDate: string, currentStatus: string | undefined, hasPlayed: boolean, timeOffset: number): CountdownState {
    const matchTime = new Date(matchDate).getTime();
    const now = new Date().getTime() + timeOffset;
    const diff = matchTime - now;

    const status = currentStatus?.toLowerCase();
    
    if (status === 'finished' || hasPlayed || diff <= -150 * 60 * 1000) {
      return { text: 'Match terminé', isClosed: true };
    }

    if (status === 'live' || status === 'in_play' || diff <= 0) {
      return { text: 'Match commencé', isClosed: true };
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    let text = '';
    if (days > 0) {
      text += `${days}j ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      text += `${hours}h ${minutes}m ${seconds}s`;
    } else {
      text += `${minutes}m ${seconds}s`;
    }

    return { text, isClosed: false };
  }
}
