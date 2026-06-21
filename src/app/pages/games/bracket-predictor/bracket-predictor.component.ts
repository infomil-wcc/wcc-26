import { Component, inject, OnInit, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { TeamsService } from '../../../shared/services/content/teams.service';
import { forkJoin } from 'rxjs';
import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';

interface PredictorTeam {
  name: string;
  flagUrl: string;
  flagId?: string; // Added to map back to flag codes (e.g., 'fr', 'br')
  isSelectedThird?: boolean; 
}

interface PredictorGroup {
  group_title: string;
  color: string;
  teams: PredictorTeam[];
}

@Component({
    selector: 'app-bracket-predictor',
    templateUrl: './bracket-predictor.component.html',
    styleUrl: './bracket-predictor.component.scss',
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class BracketPredictorComponent implements OnInit {
  private teamService = inject(TeamsService);

  // Emit event containing the final ordered 32 qualified teams
  @Output() public groupStageComplete = new EventEmitter<any[]>();

  protected groupsData: PredictorGroup[] = [];
  private initialGroupsData: PredictorGroup[] = [];
  protected isLoading: boolean = true;

  protected currentStep: number = 1; 
  protected thirdPlacedTeams: PredictorTeam[] = [];
  protected selectedThirdsCount: number = 0;
  protected confirmedGroups: boolean[] = [];

  private targetDate = new Date(2026, 5, 12, 22, 55, 0);
  private currentDate = new Date();
  protected jeuFermer: boolean = false;

  ngOnInit(): void {

    if (this.currentDate < this.targetDate) {
      this.jeuFermer = false;
    }
    else {
      this.jeuFermer = true;
    }

    forkJoin({
      groups: this.teamService.getGroups(),
      flags: this.teamService.getFlags()
    }).subscribe({
      next: (res) => {
        const flagMap = new Map(res.flags.map((f: any) => [f.name, { url: f.flag_url, iso: f.iso }]));
        
        this.groupsData = res.groups.map((g: any) => ({
          group_title: g.group_title,
          color: g.color || '#2b2b2b',
          teams: [g.team_1, g.team_2, g.team_3, g.team_4].map(teamName => {
            const teamInfo = flagMap.get(teamName);
            return {
              name: teamName,
              flagUrl: (teamInfo as any)?.url || 'assets/flags/tbc.png',
              flagId: (teamInfo as any)?.iso?.toLowerCase() || teamName.substring(0,2).toLowerCase()
            };
          })
        }));
        
        this.initialGroupsData = JSON.parse(JSON.stringify(this.groupsData));
        this.confirmedGroups = new Array(this.groupsData.length).fill(false);
        this.isLoading = false;
      }
    });
  }

  protected toggleGroupConfirmation(index: number): void {
    this.confirmedGroups[index] = !this.confirmedGroups[index];
  }

  protected areAllGroupsConfirmed(): boolean {
    return this.confirmedGroups.every(c => c);
  }

  protected dropTeam(event: CdkDragDrop<PredictorTeam[]>, groupIndex: number): void {
    moveItemInArray(this.groupsData[groupIndex].teams, event.previousIndex, event.currentIndex);
    this.confirmedGroups[groupIndex] = false; // Reset confirmation if reordered
  }

  protected randomizeGroup(groupIndex: number): void {
    const teams = this.groupsData[groupIndex].teams;
    for (let i = teams.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [teams[i], teams[j]] = [teams[j], teams[i]];
    }
  }

  protected randomizeAllGroups(): void {
    for (let i = 0; i < this.groupsData.length; i++) {
      this.randomizeGroup(i);
    }
    this.confirmedGroups.fill(true);
  }

  protected resetAllPredictions(): void {
    this.groupsData = JSON.parse(JSON.stringify(this.initialGroupsData));
    this.currentStep = 1;
    this.selectedThirdsCount = 0;
    this.confirmedGroups.fill(false); // Also unvalidate all groups when resetting all predictions
  }

  protected unvalidateAllGroups(): void {
    this.confirmedGroups.fill(false);
  }

  protected validateAllGroups(): void {
    this.confirmedGroups.fill(true);
  }

  protected goToThirdPlaceSelection(): void {
    this.thirdPlacedTeams = this.groupsData.map(group => {
      const team = group.teams[2];
      return {
        ...team,
        group: group.group_title
      };
    });
    this.updateSelectedCount();
    this.currentStep = 2;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  protected goBackToGroups(): void {
    this.currentStep = 1;
  }

  protected toggleThirdPlaceSelection(team: PredictorTeam): void {
    if (!team.isSelectedThird && this.selectedThirdsCount >= 8) {
      alert("Vous pouvez sélectionner un maximum de 8 équipes troisièmes !");
      return;
    }
    team.isSelectedThird = !team.isSelectedThird;
    this.updateSelectedCount();
  }

  protected randomizeThirds(): void {
    // 1. Reset all selections
    this.thirdPlacedTeams.forEach(t => t.isSelectedThird = false);
    
    // 2. Shuffle array or pick 8 random indices
    const shuffled = [...this.thirdPlacedTeams].sort(() => 0.5 - Math.random());
    
    // 3. Mark the first 8 as selected
    for (let i = 0; i < 8 && i < shuffled.length; i++) {
      shuffled[i].isSelectedThird = true;
    }
    
    this.updateSelectedCount();
  }

  private updateSelectedCount(): void {
    this.selectedThirdsCount = this.thirdPlacedTeams.filter(t => t.isSelectedThird).length;
  }

  protected submitGroupStagePredictions(): void {
    if (this.selectedThirdsCount !== 8) return;

    const qualifiedTeams: any[] = [];

    // 1. Gather all 1er (Winners) and 2ème (Runners-up) from all 12 groups
    this.groupsData.forEach(group => {
      qualifiedTeams.push({
        name: group.teams[0].name,
        flagUrl: group.teams[0].flagUrl,
        flagId: group.teams[0].flagId || group.teams[0].name.substring(0,2).toLowerCase(),
        group: group.group_title,
        rankIndex: 0,
        rank: group.group_title + ' Winner',
        placeholderName: group.group_title + ' Winner'
      });
      qualifiedTeams.push({
        name: group.teams[1].name,
        flagUrl: group.teams[1].flagUrl,
        flagId: group.teams[1].flagId || group.teams[1].name.substring(0,2).toLowerCase(),
        group: group.group_title,
        rankIndex: 1,
        rank: group.group_title + ' Runner-up',
        placeholderName: group.group_title + ' Runner-up'
      });
    });

    // 2. Gather the 8 selected best 3rd placed teams
    this.thirdPlacedTeams.forEach(team => {
      if (team.isSelectedThird) {
        qualifiedTeams.push({
          name: team.name,
          flagUrl: team.flagUrl,
          flagId: team.flagId || team.name.substring(0,2).toLowerCase(),
          group: (team as any).group,
          rankIndex: 2,
          rank: 'Best 3rd Place (' + (team as any).group + ')',
          placeholderName: 'Best 3rd Place (' + (team as any).group + ')'
        });
      }
    });

    // Emit the payload up to the parent view coordinator
    this.groupStageComplete.emit(qualifiedTeams);
  }
}