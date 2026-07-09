import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HpNewsComponent } from './hp-news.component';

describe('HpNewsComponent', () => {
  let component: HpNewsComponent;
  let fixture: ComponentFixture<HpNewsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
    imports: [HpNewsComponent]
})
    .compileComponents();
    
    fixture = TestBed.createComponent(HpNewsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
