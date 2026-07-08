import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WinDrawComponent } from './win-draw.component';

describe('WinDrawComponent', () => {
  let component: WinDrawComponent;
  let fixture: ComponentFixture<WinDrawComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
    imports: [WinDrawComponent]
})
    .compileComponents();
    
    fixture = TestBed.createComponent(WinDrawComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
