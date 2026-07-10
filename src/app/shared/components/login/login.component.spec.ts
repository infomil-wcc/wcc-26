import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LoginComponent } from './login.component';
import { ReactiveFormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/core/auth.service';
import { CookieService } from '../../../core/services/core/cookie.service';
import { StateService } from '../../../core/services/core/state.service';
import { MailService } from '../../../core/services/core/mail.service';
import { ActivatedRoute, Router } from '@angular/router';
import { of, throwError } from 'rxjs';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;

  // Mocks
  let authServiceMock: any;
  let cookieServiceMock: any;
  let stateServiceMock: any;
  let mailServiceMock: any;
  let routerMock: any;
  let activatedRouteMock: any;

  beforeEach(async () => {
    authServiceMock = {
      trylogin: jasmine.createSpy('trylogin').and.returnValue(of({ data: { user: { id: 1 }, token: 'mock-token' } })),
      requestPasswordReset: jasmine.createSpy('requestPasswordReset').and.returnValue(of({})),
      resetPassword: jasmine.createSpy('resetPassword').and.returnValue(of({})),
      tryCreateUser: jasmine.createSpy('tryCreateUser').and.returnValue(of({ success: true })),
      setTokenCookie: jasmine.createSpy('setTokenCookie'),
      setUserCookie: jasmine.createSpy('setUserCookie')
    };

    cookieServiceMock = {
      getCookie: jasmine.createSpy('getCookie'),
      setCookie: jasmine.createSpy('setCookie')
    };

    stateServiceMock = {
      updateState: jasmine.createSpy('updateState'),
      updateUser: jasmine.createSpy('updateUser')
    };

    mailServiceMock = {
      sendConfirmationEmail: jasmine.createSpy('sendConfirmationEmail').and.returnValue(of({}))
    };

    routerMock = {
      navigate: jasmine.createSpy('navigate')
    };

    activatedRouteMock = {
      queryParams: of({})
    };

    await TestBed.configureTestingModule({
      imports: [LoginComponent, ReactiveFormsModule],
      providers: [
        { provide: AuthService, useValue: authServiceMock },
        { provide: CookieService, useValue: cookieServiceMock },
        { provide: StateService, useValue: stateServiceMock },
        { provide: MailService, useValue: mailServiceMock },
        { provide: Router, useValue: routerMock },
        { provide: ActivatedRoute, useValue: activatedRouteMock }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  describe('Form Initialization', () => {
    it('should initialize login form with default values', () => {
      expect(component['loginForm'].get('email')?.value).toBe('');
      expect(component['loginForm'].get('pass')?.value).toBe('');
    });

    it('should initialize register form with default values', () => {
      expect(component['registerForm'].get('email')?.value).toBe('');
      expect(component['registerForm'].get('trigramme')?.value).toBe('');
      expect(component['registerForm'].get('pass')?.value).toBe('');
    });
  });

  describe('UI Toggles', () => {
    it('should toggle password visibility', () => {
      expect(component['facade'].passType()).toBe('password');
      expect(component['facade'].visibility()).toBe('visibility_off');
      
      component['toggleType']();
      
      expect(component['facade'].passType()).toBe('text');
      expect(component['facade'].visibility()).toBe('visibility');
    });

    it('should toggle register view', () => {
      expect(component['facade'].login()).toBeTrue();
      expect(component['facade'].register()).toBeFalse();
      
      component['toggleRegister']();
      
      expect(component['facade'].login()).toBeFalse();
      expect(component['facade'].register()).toBeTrue();
    });

    it('should toggle forgot password view', () => {
      expect(component['facade'].login()).toBeTrue();
      expect(component['facade'].forgotPasswordView()).toBeFalse();
      
      component['toggleForgotPassword']();
      
      expect(component['facade'].login()).toBeFalse();
      expect(component['facade'].forgotPasswordView()).toBeTrue();
    });
  });

  describe('Login Functionality', () => {
    it('should login successfully', () => {
      component['verifyLogin']('test@infomil.mu', 'password123');
      expect(authServiceMock.trylogin).toHaveBeenCalledWith('test@infomil.mu', 'password123');
    });

    it('should handle login error correctly', () => {
      const errorResponse = { error: { error: { message: 'Invalid credentials' } } };
      authServiceMock.trylogin.and.returnValue(throwError(() => errorResponse));
      
      component['verifyLogin']('wrong@infomil.mu', 'wrongpass');
      
      expect(component['facade'].otherError()).toBe('Identifiants incorrects.');
      expect(component['facade'].loginLoader()).toBeFalse();
    });
  });

  describe('Registration & Confirmation Functionality', () => {
    it('should generate a confirmation code and send email on registerAccount', () => {
      component['registerAccount']('newuser@infomil.mu', 'iml-new', 'password123');
      
      expect(component['facade'].confirmation()).toBeTrue();
      expect(component['facade'].confirmationCode()).toBeGreaterThanOrEqual(10000);
      expect(component['facade'].confirmationCode()).toBeLessThanOrEqual(99999);
      expect(mailServiceMock.sendConfirmationEmail).toHaveBeenCalled();
    });

    it('should handle registration error', () => {
      mailServiceMock.sendConfirmationEmail.and.returnValue(throwError(() => new Error('Mail error')));
      
      component['registerAccount']('newuser@infomil.mu', 'iml-new', 'password123');
      
      expect(component['facade'].confirmation()).toBeFalse();
      expect(component['facade'].issueHandling()).toBeTrue();
      expect(component['facade'].issueMsg()).toContain('difficultés techniques');
    });

    it('should confirm registration and login user', () => {
      spyOn<any>(component, 'verifyLogin').and.callThrough();
      component['facade'].userData.set([{ email: 'test@infomil.mu', trigramme: 'iml-tst', pass: 'password123' }]);

      component['confirmRegistration']();
      
      expect(authServiceMock.tryCreateUser).toHaveBeenCalledWith('test@infomil.mu', 'iml-tst', 'password123');
    });
    
    it('should handle confirm registration duplicate user error', () => {
      const errorResponse = { error: { error: { code: 204 } } };
      authServiceMock.tryCreateUser.and.returnValue(throwError(() => errorResponse));
      component['facade'].userData.set([{ email: 'test@infomil.mu', trigramme: 'iml-tst', pass: 'password123' }]);
      
      component['confirmRegistration']();
      
      expect(component['facade'].issueHandling()).toBeTrue();
      expect(component['facade'].issueMsg()).toContain('Ce compte est déjà enregistré');
    });
  });

  describe('Password Reset Functionality', () => {
    it('should request a password reset', () => {
      component['requestReset']('test@infomil.mu');
      
      expect(authServiceMock.requestPasswordReset).toHaveBeenCalled();
      expect(component['facade'].forgotPassMsg()).toContain('Un email de réinitialisation vous a été envoyé');
    });

    it('should submit new password', () => {
      component['facade'].resetToken.set('valid-token');
      component['submitNewPassword']('newpassword123');
      
      expect(authServiceMock.resetPassword).toHaveBeenCalledWith('valid-token', 'newpassword123');
      expect(component['facade'].issueHandling()).toBeTrue();
      expect(component['facade'].issueMsg()).toContain('réinitialisé avec succès');
      expect(routerMock.navigate).toHaveBeenCalled();
    });
  });

});
