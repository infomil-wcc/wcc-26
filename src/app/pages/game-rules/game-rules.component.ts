import { Component, OnInit } from '@angular/core';
import { CommonModule, KeyValue } from '@angular/common';
import { ApiResponse, GameElement } from '../../shared/contracts/game-rules.contract';
import { GameRulesService } from '../../shared/services/content/game-rules.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-game-rules',
  templateUrl: './game-rules.component.html',
  styleUrls: ['./game-rules.component.scss']
})
export class GameRulesComponent implements OnInit {
  
  apiResponse$!: Observable<ApiResponse>;
  titleGeneral = '';
  introduction = '';
  sortedSteps: GameElement[] = [];
  
  activeStepIndex = 0;
  openAccordionIndex: number | null = 0;

  constructor(private gameRulesService: GameRulesService) { }

  ngOnInit() {
    this.apiResponse$ = this.gameRulesService.getGameRules();
    this.apiResponse$.subscribe(response => {
      this.titleGeneral = response.titre_general;
      this.introduction = response.introduction;

      const gamePhases = response.elements.filter((e: GameElement) => e.date_debut) as GameElement[];
      const rulesClauses = response.elements.filter((e: GameElement) => !e.date_debut) as GameElement[];

      gamePhases.sort((a, b) => new Date(a.date_debut!).getTime() - new Date(b.date_debut!).getTime());

      this.sortedSteps = [...gamePhases, ...rulesClauses];
    });
  }

  goToStep(index: number) {
    if (index >= 0 && index < this.sortedSteps.length) {
      this.activeStepIndex = index;
    }
  }

  nextStep() {
    if (this.activeStepIndex < this.sortedSteps.length - 1) {
      this.activeStepIndex++;
    }
  }

  prevStep() {
    if (this.activeStepIndex > 0) {
      this.activeStepIndex--;
    }
  }

  resetStepper() {
    this.activeStepIndex = 0;
  }

  toggleAccordion(index: number) {
    this.openAccordionIndex = this.openAccordionIndex === index ? null : index;
  }

  formatKey(key: string): string {
    return key.replace(/_/g, ' ').replace('eme', 'ème');
  }

  // Custom comparison function for KeyValue pipe to sort bracket phases
  public bracketOrder = (a: KeyValue<string, number>, b: KeyValue<string, number>): number => {
   const order = [
    'phase_groupe',
    '16eme_de_finale',
    '8eme_de_finale',
    'quart_de_finale',
    'demi_finale',
    'finaliste',
    'finale'
  ];

  const indexA = order.indexOf(a.key);
  const indexB = order.indexOf(b.key);

  // If a key isn't found in the predefined order array
  if (indexA === -1 && indexB === -1) return 0; 
  if (indexA === -1) return 1; 
  if (indexB === -1) return -1; 

  return indexA - indexB;
  };
}