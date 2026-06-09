import { Component, inject, OnInit } from '@angular/core';
import { TeamsService } from '../../../shared/services/content/teams.service';
import { forkJoin } from 'rxjs';
import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';

interface PredictorTeam {
  name: string;
  flagUrl: string;
  isSelectedThird?: boolean; // Track checkbox selection state
}

interface PredictorGroup {
  group_title: string;
  color: string;
  teams: PredictorTeam[];
}

@Component({
  selector: 'app-bracket-predictor',
  templateUrl: './bracket-predictor.component.html',
  styleUrl: './bracket-predictor.component.scss'
})
export class BracketPredictorComponent implements OnInit {
  private teamService = inject(TeamsService);

  protected groupsData: PredictorGroup[] = [];
  private initialGroupsData: PredictorGroup[] = [];
  protected isLoading: boolean = true;

  // Step wizard tracking variables
  protected currentStep: number = 1; // 1 = Group stage brackets, 2 = Choose 3rd places
  protected thirdPlacedTeams: PredictorTeam[] = [];
  protected selectedThirdsCount: number = 0;

  ngOnInit(): void {
    forkJoin({
      groups: this.teamService.getGroups(),
      flags: this.teamService.getFlags()
    }).subscribe({
      next: (res) => {
        this.combineGroupsAndFlags(res.groups, res.flags);
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Failed loading bracket data', err);
        this.isLoading = false;
      }
    });
  }

  private combineGroupsAndFlags(groups: any[], flags: any[]): void {
    const flagMap = new Map(flags.map(f => [f.name, f.flag_url]));

    this.groupsData = groups.map(g => {
      const teamNames = [g.team_1, g.team_2, g.team_3, g.team_4];
      return {
        group_title: g.group_title,
        color: g.color || '#2b2b2b',
        teams: teamNames.map(name => ({
          name,
          flagUrl: flagMap.get(name) || '',
          isSelectedThird: false
        }))
      };
    });

    this.initialGroupsData = JSON.parse(JSON.stringify(this.groupsData));
  }

  protected dropTeam(event: CdkDragDrop<PredictorTeam[]>, groupIndex: number): void {
    moveItemInArray(this.groupsData[groupIndex].teams, event.previousIndex, event.currentIndex);
  }

  protected randomizeGroup(groupIndex: number): void {
    const teamsArray = [...this.groupsData[groupIndex].teams];
    for (let i = teamsArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [teamsArray[i], teamsArray[j]] = [teamsArray[j], teamsArray[i]];
    }
    this.groupsData[groupIndex].teams = teamsArray;
  }

  protected resetAllGroups(): void {
    this.groupsData = JSON.parse(JSON.stringify(this.initialGroupsData));
    this.currentStep = 1;
    this.selectedThirdsCount = 0;
  }

  // Navigates to Step 2 and pulls whoever sits at index 2 (3rd place) in every group
  protected goToThirdPlaceSelection(): void {
    this.thirdPlacedTeams = this.groupsData.map(group => group.teams[2]);
    this.updateSelectedCount();
    this.currentStep = 2;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  protected goBackToGroups(): void {
    this.currentStep = 1;
  }

  // Toggles the checked status of a third-placed team (max limit: 8)
  protected toggleThirdPlaceSelection(team: PredictorTeam): void {
    if (!team.isSelectedThird && this.selectedThirdsCount >= 8) {
      alert("You can only select up to 8 third-placed teams!");
      return; // Cap limit restriction
    }
    
    team.isSelectedThird = !team.isSelectedThird;
    this.updateSelectedCount();
  }

  private updateSelectedCount(): void {
    this.selectedThirdsCount = this.thirdPlacedTeams.filter(t => t.isSelectedThird).length;
  }

  protected submitPredictions(): void {
    console.log("Advancing Teams Selected:", this.thirdPlacedTeams.filter(t => t.isSelectedThird));
    // Ready to calculate Knockout Stage combinations here!
  }
}