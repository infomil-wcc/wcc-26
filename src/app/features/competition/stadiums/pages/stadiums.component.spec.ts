import { describe, it, expect, beforeEach, vi } from 'vitest';
  beforeEach(async () => {
    await TestBed.configureTestingModule({
    imports: [StadiumsComponent, LoaderComponent]
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
