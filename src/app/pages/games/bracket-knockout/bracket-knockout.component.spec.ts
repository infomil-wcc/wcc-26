import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BracketKnockoutComponent } from './bracket-knockout.component';
import { StateService } from '../../../shared/services/core/state.service';
import { GlobaltimeService } from '../../../shared/services/core/globaltime.service';
import { BracketService } from '../../../shared/services/games/bracket.service';
import { CookieService } from '../../../shared/services/core/cookie.service';
import { of } from 'rxjs';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';

describe('BracketKnockoutComponent', () => {
  let component: BracketKnockoutComponent;
  let fixture: ComponentFixture<BracketKnockoutComponent>;
  let mockBracketService: any;
  let mockCookieService: any;
  let mockStateService: any;
  let mockGlobaltimeService: any;

  beforeEach(async () => {
    mockBracketService = {
      getUserBracket: jasmine.createSpy('getUserBracket').and.returnValue(of({})),
      postBracket: jasmine.createSpy('postBracket').and.returnValue(of({}))
    };
    mockCookieService = {
      get: jasmine.createSpy('get').and.returnValue('test-user')
    };
    mockStateService = {
      currentState: of({})
    };
    mockGlobaltimeService = {};

    await TestBed.configureTestingModule({
    imports: [HttpClientTestingModule, BracketKnockoutComponent],
    providers: [
        { provide: BracketService, useValue: mockBracketService },
        { provide: CookieService, useValue: mockCookieService },
        { provide: StateService, useValue: mockStateService },
        { provide: GlobaltimeService, useValue: mockGlobaltimeService }
    ],
    schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
    .compileComponents();

    fixture = TestBed.createComponent(BracketKnockoutComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
