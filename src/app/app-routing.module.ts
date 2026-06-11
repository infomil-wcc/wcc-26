import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { BracketChallengeComponent } from './pages/games/bracket-challenge/bracket-challenge.component';

const routes: Routes = [
  { path: 'bracket-challenge', component: BracketChallengeComponent }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
