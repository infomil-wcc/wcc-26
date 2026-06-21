import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TeamDetailsComponent } from './team-details.component';
import { HyphernatePipe } from '../../pipe/hyphernate.pipe';
import { TabcontentComponent } from '../tabcontent/tabcontent.component';

describe('TeamDetailsComponent', () => {
  let component: TeamDetailsComponent;
  let fixture: ComponentFixture<TeamDetailsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TeamDetailsComponent, HyphernatePipe, TabcontentComponent]
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
