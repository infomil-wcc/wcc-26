import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BestScorerComponent } from './best-scorer.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { LoginComponent } from '../../../shared/components/login/login.component';
import { ReactiveFormsModule } from '@angular/forms';

describe('BestScorerComponent', () => {
  let component: BestScorerComponent;
  let fixture: ComponentFixture<BestScorerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReactiveFormsModule],
      declarations: [BestScorerComponent, ModalComponent, LoginComponent]
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
