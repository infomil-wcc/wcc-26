import { Component, Input, SimpleChanges, inject, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/core/auth.service';
import { CookieService } from '../../../core/services/core/cookie.service';
import { StateService } from '../../../core/services/core/state.service';
import { MailService } from '../../../core/services/core/mail.service';
import { NgClass } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
@Component({
    selector: 'app-login',
    templateUrl: './login.component.html',
    styleUrl: './login.component.scss',
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [ReactiveFormsModule, NgClass]
})
export class LoginComponent {

  private authService = inject(AuthService);
  private formBuilder = inject(FormBuilder);
  private cookieService = inject(CookieService);
  private stateService = inject(StateService);
  private mailService = inject(MailService);
  protected loginLoader: boolean = false;
  protected loginForm!: FormGroup;
  protected registerForm!: FormGroup;
  protected confirmationForm!: FormGroup;

  protected login: boolean = true;
  protected register: boolean = false;
  protected confirmation: boolean = false;
  protected forgotPasswordView: boolean = false;
  protected resetPasswordView: boolean = false;
  protected issueHandling: boolean = false;
  protected passType: string = 'password';
  protected visibility: string = 'visibility_off';
  protected issueMsg: string = '';
  protected forgotPassMsg: string = '';
  protected resetToken: string = '';
  
  protected forgotPasswordForm!: FormGroup;
  protected resetPasswordForm!: FormGroup;
  protected confirmationCode!: number;
  protected disableConfirm: boolean = true;
  protected userData: any;

  protected otherError!: string;


  private route = inject(ActivatedRoute);
  private router = inject(Router);

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      if (params['token']) {
        this.resetToken = params['token'];
        this.login = false;
        this.resetPasswordView = true;
      }
    });

    this.loginForm = this.formBuilder.group({
      email: ['', [Validators.required, Validators.pattern(/^[a-zA-Z0-9._%+-]+@infomil\.mu$/)]],
      // email: ['', [Validators.required, Validators.pattern(/^[a-zA-Z0-9._%+-]+@yopmail\.com$/)]],
      pass: ['', [Validators.required, Validators.minLength(4)]]
    });


    this.registerForm = this.formBuilder.group({
      email: ['', [Validators.required, Validators.pattern(/^[a-zA-Z0-9._%+-]+@infomil\.mu$/)]],
      // email: ['', [Validators.required, Validators.pattern(/^[a-zA-Z0-9._%+-]+@yopmail\.com$/)]],
      trigramme: ['', [Validators.required, Validators.pattern(/^(iml-[a-zA-Z]{3}|iml-[a-zA-Z]{2}|[a-zA-Z]{3})$/)]],
      pass: ['', [Validators.required, Validators.minLength(4)]]
    });

    this.confirmationForm = this.formBuilder.group({
      confirmationCode: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(5)]]
    });

    this.forgotPasswordForm = this.formBuilder.group({
      email: ['', [Validators.required, Validators.pattern(/^[a-zA-Z0-9._%+-]+@infomil\.mu$/)]]
    });

    this.resetPasswordForm = this.formBuilder.group({
      pass: ['', [Validators.required, Validators.minLength(4)]]
    });

  }

  protected onEmailInput(type: 'login' | 'register' | 'forgot'): void {
    const form = type === 'login' ? this.loginForm : (type === 'register' ? this.registerForm : this.forgotPasswordForm);
    const emailControl = form.get('email');
    if (emailControl && emailControl.value) {
      const value = emailControl.value;
      if (value.endsWith('@')) {
        emailControl.setValue(value + 'infomil.mu');
      }
    }
  }

  protected autocompleteEmail(type: 'login' | 'register' | 'forgot'): void {
    const form = type === 'login' ? this.loginForm : (type === 'register' ? this.registerForm : this.forgotPasswordForm);
    const emailControl = form.get('email');
    if (emailControl && emailControl.value) {
      const value = emailControl.value.trim();
      if (value && !value.includes('@')) {
        emailControl.setValue(value + '@infomil.mu');
      }
    }
  }

  protected verifyLogin(login: string, pass: string):void {
    this.loginLoader = true;

    this.authService.trylogin(login, pass).subscribe({
      next: (response) => {
        this.loginFlow(response);
      },
      error: (error) => {
        this.loginForm.reset();
        this.otherError = error.error.error.message;
        this.loginLoader = false;
      }
    });
  }

  protected toggleType(): void {
    if(this.passType == 'password'){
      this.passType = 'text';
      this.visibility = 'visibility';
    } else {
      this.passType = 'password';
      this.visibility = 'visibility_off'
    }
  }

  protected toggleRegister(): void {
    this.issueHandling = false;
    this.forgotPasswordView = false;
    this.login = !this.login;
    this.register = !this.register;
    this.loginForm.reset();
    this.registerForm.reset();
  }

  protected toggleForgotPassword(): void {
    this.issueHandling = false;
    this.register = false;
    this.forgotPasswordView = !this.forgotPasswordView;
    this.login = !this.forgotPasswordView;
    this.forgotPassMsg = '';
    this.forgotPasswordForm.reset();
  }

  protected requestReset(email: string): void {
    this.loginLoader = true;
    const resetUrl = window.location.origin + window.location.pathname;
    this.authService.requestPasswordReset(email, resetUrl).subscribe({
      next: () => {
        this.loginLoader = false;
        this.forgotPassMsg = "Un email de réinitialisation vous a été envoyé. Veuillez vérifier votre boîte mail.";
      },
      error: (error) => {
        this.loginLoader = false;
        this.forgotPassMsg = "Si ce compte existe, un email de réinitialisation vous a été envoyé.";
        console.error(error);
      }
    });
  }

  protected submitNewPassword(pass: string): void {
    if (!this.resetToken) return;
    this.loginLoader = true;
    this.authService.resetPassword(this.resetToken, pass).subscribe({
      next: () => {
        this.loginLoader = false;
        this.resetPasswordView = false;
        this.login = true;
        this.issueHandling = true;
        this.issueMsg = "Votre mot de passe a été réinitialisé avec succès. Vous pouvez maintenant vous connecter.";
        // Clean URL from token
        this.router.navigate([], { queryParams: { token: null }, queryParamsHandling: 'merge' });
      },
      error: (error) => {
        this.loginLoader = false;
        this.issueHandling = true;
        this.issueMsg = "Le lien de réinitialisation est invalide ou a expiré.";
        console.error(error);
      }
    });
  }

  protected registerAccount(email: string, trigramme: string, pass: string): void {
    this.confirmation = true;
    this.confirmationCode = this.generateCode();

    this.userData = [{email: email, trigramme: trigramme, pass: pass}];

    this.mailService.sendConfirmationEmail(trigramme, email, this.confirmationCode.toString()).subscribe({
      next: (response) => {
        console.log('Confirmation email sent successfully', response);
      },
      error: (error) => {
        console.error('Error sending confirmation email', error);
        this.confirmation = false;
        this.issueHandling = true;
        this.issueMsg = "Nous rencontrons des difficultés techniques pour envoyer l'email de confirmation. Veuillez contacter l'équipe organisatrice ou réessayer plus tard."
      }
    });
  }

  protected generateCode(): number {
    return Math.floor(Math.random() * 90000) + 10000;
  }

  protected confirmRegistration(email: string, trigramme: string, pass: string): void {
    this.loginLoader = true;

    this.authService.tryCreateUser(email, trigramme, pass).subscribe({
      next: (response) => {
        if(response.success) {
          this.verifyLogin(email, pass);
        }
      },
      error: (error) => {
        this.loginLoader = false;
        this.login = false;
        this.register = false;
        this.issueHandling = true;
        this.loginForm.reset();
        this.registerForm.reset();
        this.confirmationForm.reset();
        this.confirmation = false;
        this.userData = null;

        if(error.error.error.code === 204){
          this.issueMsg = "Ce compte est déjà enregistré sur notre plateforme. Veuillez contacter l'équipe organisatrice pour réinitialiser votre mot de passe ou supprimer le compte."
        } else {
          this.issueMsg = "Nous rencontrons des difficultés techniques pour créer votre compte. Veuillez contacter l'équipe organisatrice ou réessayer plus tard."
        }
      }
    });
  }

  private loginFlow(obj: any){
    if (!obj) return;
    let data = obj.data || obj;
    let userObj = data.user;
    let token = data.token || data.access_token;

    if (!userObj || !token) {
      console.error('Invalid login response:', obj);
      this.loginLoader = false;
      return;
    }

    this.authService.setTokenCookie(token);
    this.authService.setUserCookie(userObj.id);

    this.loginLoader = false;

    location.reload();
  }
}
