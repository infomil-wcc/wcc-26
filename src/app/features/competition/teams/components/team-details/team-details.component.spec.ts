import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TeamDetailsComponent } from './team-details.component';
import { HyphernatePipe } from '../../../../../shared/pipe/hyphernate.pipe';
import { TabContentComponent } from '../tab-content/tab-content.component';

describe('TeamDetailsComponent', () => {
  let component: TeamDetailsComponent;
  let fixture: ComponentFixture<TeamDetailsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
    imports: [TeamDetailsComponent, HyphernatePipe, TabContentComponent]
})
    .compileComponents();
    
    fixture = TestBed.createComponent(TeamDetailsComponent);
    component = fixture.componentInstance;
    component.team = { name: 'Test Team', iso: 'TST' } as any;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
