import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HpnewsComponent } from './hpnews.component';

describe('HpnewsComponent', () => {
  let component: HpnewsComponent;
  let fixture: ComponentFixture<HpnewsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
    imports: [HpnewsComponent]
})
    .compileComponents();
    
    fixture = TestBed.createComponent(HpnewsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
