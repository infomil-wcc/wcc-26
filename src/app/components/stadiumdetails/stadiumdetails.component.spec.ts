import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StadiumdetailsComponent } from './stadiumdetails.component';

describe('StadiumdetailsComponent', () => {
  let component: StadiumdetailsComponent;
  let fixture: ComponentFixture<StadiumdetailsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [StadiumdetailsComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(StadiumdetailsComponent);
    component = fixture.componentInstance;
    component.stadium = { id: 1, name: 'Test Stadium', city: 'Test City', image: 'test.jpg' } as any;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
