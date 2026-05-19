import { ComponentFixture, TestBed } from "@angular/core/testing";

import { WindrawComponent } from "./windraw.component";

describe("WindrawComponent", () => {
  let component: WindrawComponent;
  let fixture: ComponentFixture<WindrawComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WindrawComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(WindrawComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
