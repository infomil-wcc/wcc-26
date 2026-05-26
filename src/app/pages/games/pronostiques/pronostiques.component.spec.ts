import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CorrectScoreComponent } from './pronostiques.component';

describe('CorrectScoreComponent', () => {
  let component: CorrectScoreComponent;
  let fixture: ComponentFixture<CorrectScoreComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [CorrectScoreComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(CorrectScoreComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
