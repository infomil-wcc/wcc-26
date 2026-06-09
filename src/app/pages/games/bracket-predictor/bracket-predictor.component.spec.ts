import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BracketPredictorComponent } from './bracket-predictor.component';

describe('BracketPredictorComponent', () => {
  let component: BracketPredictorComponent;
  let fixture: ComponentFixture<BracketPredictorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [BracketPredictorComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BracketPredictorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
