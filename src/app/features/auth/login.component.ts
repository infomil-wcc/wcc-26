import { Component, OnInit, inject, ChangeDetectionStrategy, Input, Output, EventEmitter } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { LoginFacade } from './login.facade';
import { sanitizeEmailInput } from './login.utils';

// Import presentational components
import { LoginFormInterfaceComponent } from './components/login-form.component';
import { RegisterFormInterfaceComponent } from './components/register-form.component';
import { ConfirmationFormInterfaceComponent } from './components/confirmation-form.component';
import { ForgotPasswordComponent } from './components/forgot-password.component';
import { ResetPasswordComponent } from './components/reset-password.component';
import { ErrorViewComponent } from './components/error-view.component';

@Component({
    selector: 'app-login',
    standalone: true,
    templateUrl: './login.component.html',
    styleUrl: './login.component.scss',
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [
      ReactiveFormsModule,
      LoginFormInterfaceComponent,
      RegisterFormInterfaceComponent,
      ConfirmationFormInterfaceComponent,
      ForgotPasswordComponent,
      ResetPasswordComponent,
      ErrorViewComponent
    ],
    providers: [LoginFacade]
})
export class LoginComponent implements OnInit {
  @Input() showCloseButton: boolean = true;
  @Output() close = new EventEmitter<void>();

  protected facade = inject(LoginFacade);
  private formBuilder = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  protected loginForm!: FormGroup;
  protected registerForm!: FormGroup;
  protected confirmationForm!: FormGroup;
  protected forgotPasswordForm!: FormGroup;
  protected resetPasswordForm!: FormGroup;

  protected disableConfirm: boolean = true;

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      if (params['token']) {
        this.facade.setResetToken(params['token']);
      }
    });

    this.loginForm = this.formBuilder.group({
      email: ['', [Validators.required]],
      pass: ['', [Validators.required, Validators.minLength(4)]]
    });

    this.registerForm = this.formBuilder.group({
      email: ['', [Validators.required]],
      trigramme: ['', [Validators.required, Validators.pattern(/^(iml-[a-zA-Z]{3}|iml-[a-zA-Z]{2}|[a-zA-Z]{3})$/)]],
      pass: ['', [Validators.required, Validators.minLength(4)]]
    });

    this.confirmationForm = this.formBuilder.group({
      confirmationCode: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(5)]]
    });

    this.forgotPasswordForm = this.formBuilder.group({
      email: ['', [Validators.required]]
    });

    this.resetPasswordForm = this.formBuilder.group({
      pass: ['', [Validators.required, Validators.minLength(4)]]
    });
  }

  protected onEmailInput(type: 'login' | 'register' | 'forgot'): void {
    const form = type === 'login' ? this.loginForm : (type === 'register' ? this.registerForm : this.forgotPasswordForm);
    const emailControl = form.get('email');
    if (emailControl && emailControl.value) {
      const sanitized = sanitizeEmailInput(emailControl.value);
      if (sanitized !== emailControl.value) {
        emailControl.setValue(sanitized);
      }
    }
  }

  protected verifyLogin(login: string, pass: string): void {
    this.facade.verifyLogin(login, pass, () => {
      this.loginForm.reset();
    });
  }

  protected toggleType(): void {
    this.facade.toggleType();
  }

  protected toggleRegister(): void {
    this.facade.toggleRegister();
    this.loginForm.reset();
    this.registerForm.reset();
  }

  protected toggleForgotPassword(): void {
    this.facade.toggleForgotPassword();
    this.forgotPasswordForm.reset();
  }

  protected requestReset(email: string): void {
    this.facade.requestReset(email);
  }

  protected submitNewPassword(pass: string): void {
    this.facade.submitNewPassword(pass, () => {
      this.resetPasswordForm.reset();
      this.router.navigate([], { queryParams: { token: null }, queryParamsHandling: 'merge' });
    });
  }

  protected registerAccount(email: string, trigramme: string, pass: string): void {
    this.facade.registerAccount(email, trigramme, pass);
  }

  protected confirmRegistration(): void {
    const uData = this.facade.userData();
    if (!uData || !uData[0]) return;
    this.facade.confirmRegistration(uData[0].email, uData[0].trigramme, uData[0].pass, () => {
      this.loginForm.reset();
      this.registerForm.reset();
      this.confirmationForm.reset();
    });
  }

  protected checkConfirmationCode(inputVal: string): void {
    const expected = this.facade.confirmationCode();
    this.disableConfirm = inputVal !== expected.toString();
  }
}
