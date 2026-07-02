import { Component, Input, Output, EventEmitter, OnInit, inject } from '@angular/core';
import { NgClass, NgStyle } from '@angular/common';
import { TeamsService } from '../../services/content/teams.service';

interface LineupPlayer {
  id?: number;
  name: string;
  player_name?: string; // fallback
  position: string;
  shirtNumber?: number;
  shirt_number?: number; // fallback
}

@Component({
  selector: 'app-tactical-lineup',
  standalone: true,
  imports: [NgClass, NgStyle],
  templateUrl: './tactical-lineup.component.html',
  styleUrl: './tactical-lineup.component.scss'
})
export class TacticalLineupComponent implements OnInit {
  @Input() teamA!: string;
  @Input() teamB!: string;
  @Input() teamAFlag: string = '';
  @Input() teamBFlag: string = '';
  @Input() lineupsData: any;
  @Input() fallbackPlayers: any[] = [];
  @Output() playerSelected = new EventEmitter<string>();

  private teamsService = inject(TeamsService);

  protected homeStarters: LineupPlayer[] = [];
  protected homeBench: LineupPlayer[] = [];
  protected awayStarters: LineupPlayer[] = [];
  protected awayBench: LineupPlayer[] = [];

  protected homeRows: LineupPlayer[][] = [];
  protected awayRows: LineupPlayer[][] = [];
  protected homeFormation: string = '4-3-3';
  protected awayFormation: string = '4-3-3';

  protected activeTeam: 'home' | 'away' = 'home';

  protected homeColors: string[] = ['#3b5bdb', '#ffffff'];
  protected awayColors: string[] = ['#f76707', '#ffffff'];

  ngOnInit() {
    this.fetchTeamColors();
    this.parseLineups();
  }

  private fetchTeamColors() {
    this.teamsService.getTeamByName(this.teamA).subscribe(res => {
      if (res && res.length > 0 && (res[0] as any).colors) {
        this.homeColors = (res[0] as any).colors;
      }
    });
    this.teamsService.getTeamByName(this.teamB).subscribe(res => {
      if (res && res.length > 0 && (res[0] as any).colors) {
        this.awayColors = (res[0] as any).colors;
      }
    });
  }

  private parseLineups() {
    if (this.lineupsData && (this.lineupsData.homeTeam?.lineup?.length > 0 || this.lineupsData.awayTeam?.lineup?.length > 0)) {
      // Use football-data API lineups
      const home = this.lineupsData.homeTeam;
      const away = this.lineupsData.awayTeam;

      this.homeStarters = (home.lineup || []).map((p: any) => this.mergePlayerWithLocalDb(p, this.teamA));
      this.homeBench = (home.bench || []).map((p: any) => this.mergePlayerWithLocalDb(p, this.teamA));
      this.awayStarters = (away.lineup || []).map((p: any) => this.mergePlayerWithLocalDb(p, this.teamB));
      this.awayBench = (away.bench || []).map((p: any) => this.mergePlayerWithLocalDb(p, this.teamB));
    } else {
      // Fallback: Parse from local squads database list
      this.parseFallbackSquads();
    }

    this.groupPlayers();
  }

  private mergePlayerWithLocalDb(apiPlayer: any, teamName: string): LineupPlayer {
    const apiName = (apiPlayer.name || apiPlayer.player_name || '').toLowerCase();
    
    // Find player in local squad database list (in fallbackPlayers)
    const localMatch = this.fallbackPlayers.find(p => {
      const matchTeam = p.teamName === teamName || p.nationality === teamName;
      if (!matchTeam) return false;
      const pName = (p.player_name || p.name || '').toLowerCase();
      // Try exact or partial match
      return pName.includes(apiName) || apiName.includes(pName);
    });

    const resolvedPos = localMatch?.position || apiPlayer.position || 'MF';
    const resolvedShirt = apiPlayer.shirtNumber || apiPlayer.shirt_number || localMatch?.shirt_number || localMatch?.shirtNumber || 99;

    return {
      name: apiPlayer.name || apiPlayer.player_name || localMatch?.player_name || localMatch?.name || 'Joueur',
      position: resolvedPos,
      shirtNumber: resolvedShirt
    };
  }

  private parseFallbackSquads() {
    // Separate fallbackPlayers by team and select top 11 by some criteria or default first 11 as starters
    // In our case, the fallbackPlayers usually contains all squad players for the active team.
    // Let's filter fallbackPlayers
    const teamAPlayers = this.fallbackPlayers.filter(p => p.teamName === this.teamA || p.nationality === this.teamA).map(p => this.mapFallbackPlayer(p));
    const teamBPlayers = this.fallbackPlayers.filter(p => p.teamName === this.teamB || p.nationality === this.teamB).map(p => this.mapFallbackPlayer(p));

    // Simple rule: first 11 are starters, rest are bench
    this.homeStarters = teamAPlayers.slice(0, 11);
    this.homeBench = teamAPlayers.slice(11);
    this.awayStarters = teamBPlayers.slice(0, 11);
    this.awayBench = teamBPlayers.slice(11);
  }

  private mapFallbackPlayer(p: any): LineupPlayer {
    return {
      name: p.player_name || p.name || 'Joueur',
      position: p.position || 'MF',
      shirtNumber: p.shirt_number || p.shirtNumber || 99
    };
  }

  private groupPlayers() {
    this.homeFormation = this.lineupsData?.homeTeam?.formation || '4-3-3';
    this.awayFormation = this.lineupsData?.awayTeam?.formation || '4-3-3';

    this.homeRows = this.buildTeamRows(this.homeStarters, this.homeFormation);
    this.awayRows = this.buildTeamRows(this.awayStarters, this.awayFormation);
  }

  private buildTeamRows(starters: LineupPlayer[], formationStr: string): LineupPlayer[][] {
    const gk = starters.find(p => p.position.toUpperCase().includes('GK') || p.position.toUpperCase().includes('GOAL') || p.position.toUpperCase().includes('GARDIEN'));
    const gkList = gk ? [gk] : [];

    const outfield = starters.filter(p => !p.position.toUpperCase().includes('GK') && !p.position.toUpperCase().includes('GOAL') && !p.position.toUpperCase().includes('GARDIEN'));

    const getPosOrder = (pos: string) => {
      const p = pos.toUpperCase();
      if (p.includes('FW') || p.includes('OFF') || p.includes('ATT') || p.includes('ATTAQUE')) return 1;
      if (p.includes('MF') || p.includes('MID') || p.includes('MILIEU')) return 2;
      return 3;
    };
    outfield.sort((a, b) => getPosOrder(a.position) - getPosOrder(b.position));

    const cleanFormation = formationStr.replace(/\([^)]*\)/g, '').trim();
    const parts = cleanFormation.split('-').map(Number);
    const isValid = parts.length > 0 && parts.every(n => !isNaN(n)) && parts.reduce((a, b) => a + b, 0) === outfield.length;

    const outfieldRows: LineupPlayer[][] = [];
    if (isValid) {
      let index = 0;
      for (const count of parts) {
        outfieldRows.push(outfield.slice(index, index + count));
        index += count;
      }
    } else {
      outfieldRows.push(outfield.slice(0, 3));
      outfieldRows.push(outfield.slice(3, 7));
      outfieldRows.push(outfield.slice(7));
    }

    return [...outfieldRows, gkList];
  }

  protected selectPlayer(player: LineupPlayer) {
    this.playerSelected.emit(player.name);
  }

  protected switchTeam(team: 'home' | 'away'): void {
    this.activeTeam = team;
  }

  protected get displayedRows(): LineupPlayer[][] {
    return this.activeTeam === 'home' ? this.homeRows : this.awayRows;
  }

  protected get displayedBench(): LineupPlayer[] {
    return this.activeTeam === 'home' ? this.homeBench : this.awayBench;
  }

  protected get displayedFormation(): string {
    return this.activeTeam === 'home' ? this.homeFormation : this.awayFormation;
  }

  protected get displayedTeamName(): string {
    return this.activeTeam === 'home' ? this.teamA : this.teamB;
  }

  protected get displayedTeamFlag(): string {
    return this.activeTeam === 'home' ? this.teamAFlag : this.teamBFlag;
  }

  protected get displayedTeamColors(): string[] {
    return this.activeTeam === 'home' ? this.homeColors : this.awayColors;
  }

  protected getPositionAbbreviation(pos: string): string {
    const p = pos.toUpperCase();
    if (p.includes('GK') || p.includes('GOAL') || p.includes('GARDIEN')) return 'GK';
    if (p.includes('DF') || p.includes('BACK') || p.includes('DEF') || p.includes('DÉFENSE')) return 'DF';
    if (p.includes('MF') || p.includes('MID') || p.includes('MILIEU')) return 'MF';
    if (p.includes('FW') || p.includes('OFF') || p.includes('ATT') || p.includes('ATTAQUE')) return 'FW';
    return pos;
  }

  protected getTeamJerseyStyle(player: LineupPlayer, isHome: boolean): { [key: string]: string } {
    const isGK = player.position.toUpperCase().includes('GK') || player.position.toUpperCase().includes('GOAL') || player.position.toUpperCase().includes('GARDIEN');
    if (isGK) {
      // Default GK neon green/yellow color
      return {
        '--primary-color': '#adff2f',
        '--secondary-color': '#000000',
        '--text-color': '#000000'
      };
    }

    const colors = isHome ? this.homeColors : this.awayColors;
    const primary = colors[0] || '#ffffff';
    const secondary = colors[1] || '#000000';
    
    // Choose high contrast text color (either black or white depending on jersey background luminance)
    const getTextColor = (hex: string) => {
      const c = hex.substring(1);
      const rgb = parseInt(c, 16);
      const r = (rgb >> 16) & 0xff;
      const g = (rgb >> 8) & 0xff;
      const b = (rgb >> 0) & 0xff;
      const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      return luma > 140 ? '#000000' : '#ffffff';
    };

    return {
      '--primary-color': primary,
      '--secondary-color': secondary,
      '--text-color': getTextColor(primary)
    };
  }

  protected getShirtClass(player: LineupPlayer, isHome: boolean): string {
    const isGK = player.position.toUpperCase().includes('GK') || player.position.toUpperCase().includes('GOAL') || player.position.toUpperCase().includes('GARDIEN');
    if (isGK) {
      return 'shirt-gk';
    }
    return isHome ? 'shirt-home' : 'shirt-away';
  }

  protected getLastName(name: string): string {
    if (!name) return '';
    const parts = name.trim().split(/\s+/);
    return parts.length > 1 ? parts[parts.length - 1] : name;
  }

  protected getFirstName(name: string): string {
    if (!name) return '';
    const parts = name.trim().split(/\s+/);
    return parts[0] || '';
  }

  protected getInitials(name: string): string {
    if (!name) return '';
    const parts = name.split(' ');
    if (parts.length > 1) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }
}
