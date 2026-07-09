import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StadiumDetailsComponent } from './stadium-details.component';

describe('StadiumDetailsComponent', () => {
  let component: StadiumDetailsComponent;
  let fixture: ComponentFixture<StadiumDetailsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
    imports: [StadiumDetailsComponent]
})
    .compileComponents();
    
    fixture = TestBed.createComponent(StadiumDetailsComponent);
    component = fixture.componentInstance;
    component.stadium = { id: 1, name: 'Test Stadium', city: 'Test City', image: 'test.jpg' } as any;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
