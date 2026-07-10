import { Injectable, inject, signal, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { AuthService } from '../../core/services/core/auth.service';
import { MailService } from '../../core/services/core/mail.service';
import { StateService } from '../../core/services/core/state.service';
import { generateConfirmationCode } from './login.utils';

@Injectable()
export class LoginFacade {
  private authService = inject(AuthService);
  private mailService = inject(MailService);
  private stateService = inject(StateService);
  private platformId = inject(PLATFORM_ID);

  // States managed by signals
  readonly loginLoader = signal<boolean>(false);
  readonly login = signal<boolean>(true);
  readonly register = signal<boolean>(false);
  readonly confirmation = signal<boolean>(false);
  readonly forgotPasswordView = signal<boolean>(false);
  readonly resetPasswordView = signal<boolean>(false);
  readonly issueHandling = signal<boolean>(false);
  readonly passType = signal<string>('password');
  readonly visibility = signal<string>('visibility_off');
  readonly issueMsg = signal<string>('');
  readonly forgotPassMsg = signal<string>('');
  readonly resetToken = signal<string>('');
  readonly confirmationCode = signal<number>(0);
  readonly userData = signal<any>(null);
  readonly otherError = signal<string>('');

  setResetToken(token: string): void {
    this.resetToken.set(token);
    this.login.set(false);
    this.resetPasswordView.set(true);
  }

  toggleType(): void {
    if (this.passType() === 'password') {
      this.passType.set('text');
      this.visibility.set('visibility');
    } else {
      this.passType.set('password');
      this.visibility.set('visibility_off');
    }
  }

  toggleRegister(): void {
    this.issueHandling.set(false);
    this.forgotPasswordView.set(false);
    this.login.set(!this.login());
    this.register.set(!this.register());
  }

  toggleForgotPassword(): void {
    this.issueHandling.set(false);
    this.register.set(false);
    this.forgotPasswordView.set(!this.forgotPasswordView());
    this.login.set(!this.forgotPasswordView());
    this.forgotPassMsg.set('');
  }

  verifyLogin(email: string, pass: string, onFail: (errorMsg: string) => void): void {
    this.loginLoader.set(true);
    this.authService.trylogin(email, pass).subscribe({
      next: (response) => {
        this.loginFlow(response);
      },
      error: (error) => {
        let errorMsg = error?.error?.error?.message || 'Identifiants incorrects.';
        if (
          errorMsg === 'Invalid user credentials.' || 
          errorMsg === 'Invalid credentials' || 
          errorMsg.toLowerCase().includes('credentials')
        ) {
          errorMsg = 'Identifiants incorrects.';
        }
        this.otherError.set(errorMsg);
        this.loginLoader.set(false);
        onFail(errorMsg);
      }
    });
  }

  requestReset(email: string): void {
    this.loginLoader.set(true);
    const resetUrl = isPlatformBrowser(this.platformId)
      ? window.location.origin + window.location.pathname
      : '';
    this.authService.requestPasswordReset(email, resetUrl).subscribe({
      next: () => {
        this.loginLoader.set(false);
        this.forgotPassMsg.set("Un email de réinitialisation vous a été envoyé. Veuillez vérifier votre boîte mail.");
      },
      error: (error) => {
        this.loginLoader.set(false);
        this.forgotPassMsg.set("Si ce compte existe, un email de réinitialisation vous a été envoyé.");
        console.error(error);
      }
    });
  }

  submitNewPassword(pass: string, onComplete: () => void): void {
    if (!this.resetToken()) return;
    this.loginLoader.set(true);
    this.authService.resetPassword(this.resetToken(), pass).subscribe({
      next: () => {
        this.loginLoader.set(false);
        this.resetPasswordView.set(false);
        this.login.set(true);
        this.issueHandling.set(true);
        this.issueMsg.set("Votre mot de passe a été réinitialisé avec succès. Vous pouvez maintenant vous connecter.");
        onComplete();
      },
      error: (error) => {
        this.loginLoader.set(false);
        this.issueHandling.set(true);
        this.issueMsg.set("Le lien de réinitialisation est invalide ou a expiré.");
        console.error(error);
      }
    });
  }

  registerAccount(email: string, trigramme: string, pass: string): void {
    const code = generateConfirmationCode();
    this.confirmation.set(true);
    this.confirmationCode.set(code);
    this.userData.set([{ email, trigramme, pass }]);

    this.mailService.sendConfirmationEmail(trigramme, email, code.toString()).subscribe({
      next: (response) => {
        console.log('Confirmation email sent successfully', response);
      },
      error: (error) => {
        console.error('Error sending confirmation email', error);
        this.confirmation.set(false);
        this.issueHandling.set(true);
        this.issueMsg.set(
          "Nous rencontrons des difficultés techniques pour envoyer l'email de confirmation. Veuillez contacter l'équipe organisatrice ou réessayer plus tard."
        );
      }
    });
  }

  confirmRegistration(email: string, trigramme: string, pass: string, onFail: () => void): void {
    this.loginLoader.set(true);
    this.authService.tryCreateUser(email, trigramme, pass).subscribe({
      next: (response) => {
        if (response.success) {
          this.verifyLogin(email, pass, () => { });
        }
      },
      error: (error) => {
        this.loginLoader.set(false);
        this.login.set(false);
        this.register.set(false);
        this.issueHandling.set(true);
        this.confirmation.set(false);
        this.userData.set(null);
        onFail();

        if (error?.error?.error?.code === 204) {
          this.issueMsg.set(
            "Ce compte est déjà enregistré sur notre plateforme. Veuillez contacter l'équipe organisatrice pour réinitialiser votre mot de passe ou supprimer le compte."
          );
        } else {
          this.issueMsg.set(
            "Nous rencontrons des difficultés techniques pour créer votre compte. Veuillez contacter l'équipe organisatrice ou réessayer plus tard."
          );
        }
      }
    });
  }

  private loginFlow(obj: any): void {
    if (!obj) return;
    const data = obj.data || obj;
    const userObj = data.user;
    const token = data.token || data.access_token;

    if (!userObj || !token) {
      console.error('Invalid login response:', obj);
      this.loginLoader.set(false);
      return;
    }

    this.authService.setTokenCookie(token);
    this.authService.setUserCookie(userObj.id);
    this.stateService.updateUser(userObj);
    this.stateService.updateState({ loggedIn: true });
    this.loginLoader.set(false);
  }
}
