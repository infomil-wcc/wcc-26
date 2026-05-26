import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BestScorerComponent } from './best-scorer.component';

describe('BestScorerComponent', () => {
  let component: BestScorerComponent;
  let fixture: ComponentFixture<BestScorerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [BestScorerComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(BestScorerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
