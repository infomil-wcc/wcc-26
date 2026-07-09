import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ScoresheetComponent } from './scoresheet.component';

describe('ScoresheetComponent', () => {
  let component: ScoresheetComponent;
  let fixture: ComponentFixture<ScoresheetComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ScoresheetComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ScoresheetComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
