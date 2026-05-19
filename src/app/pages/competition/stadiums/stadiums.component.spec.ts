import { ComponentFixture, TestBed } from "@angular/core/testing";

import { StadiumsComponent } from "./stadiums.component";

describe("StadiumsComponent", () => {
  let component: StadiumsComponent;
  let fixture: ComponentFixture<StadiumsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StadiumsComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(StadiumsComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
