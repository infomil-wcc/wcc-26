import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TeamListComponent } from './team-list.component';
import { By } from '@angular/platform-browser';

describe('TeamListComponent', () => {
  let component: TeamListComponent;
  let fixture: ComponentFixture<TeamListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TeamListComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(TeamListComponent);
    component = fixture.componentInstance;
    component.teams = [
      { name: 'France', iso: 'FR', flag_url: '' } as any
    ];
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should emit teamSelected on click', () => {
    spyOn(component.teamSelected, 'emit');
    const button = fixture.debugElement.query(By.css('button'));
    button.triggerEventHandler('click', null);
    
    expect(component.teamSelected.emit).toHaveBeenCalledWith(component.teams[0]);
  });
});
