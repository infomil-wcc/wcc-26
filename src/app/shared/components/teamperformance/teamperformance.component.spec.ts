import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TeamperformanceComponent } from './teamperformance.component';

describe('TeamperformanceComponent', () => {
  let component: TeamperformanceComponent;
  let fixture: ComponentFixture<TeamperformanceComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TeamperformanceComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(TeamperformanceComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
