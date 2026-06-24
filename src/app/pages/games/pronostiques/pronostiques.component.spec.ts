import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PronostiquesComponent } from './pronostiques.component';

describe('PronostiquesComponent', () => {
  let component: PronostiquesComponent;
  let fixture: ComponentFixture<PronostiquesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
    imports: [PronostiquesComponent]
})
    .compileComponents();
    
    fixture = TestBed.createComponent(PronostiquesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
