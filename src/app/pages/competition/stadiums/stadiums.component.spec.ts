import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StadiumsComponent } from './stadiums.component';

describe('StadiumsComponent', () => {
  let component: StadiumsComponent;
  let fixture: ComponentFixture<StadiumsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [StadiumsComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(StadiumsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
