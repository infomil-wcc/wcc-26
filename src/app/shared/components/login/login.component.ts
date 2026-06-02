import { Component, Input, SimpleChanges, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService } from '../../services/core/auth.service';
import { CookieService } from 'ngx-cookie-service';
import { StateService } from '../../services/core/state.service';
import { MailService } from '../../services/core/mail.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
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
  protected issueHandling: boolean = false;
  protected passType: string = 'password';
  protected visibility: string = 'visibility_off';
  protected issueMsg: string = '';
  protected confirmationCode!: number;
  protected disableConfirm: boolean = true;
  protected userData: any;

  protected otherError!: string;


  ngOnInit(): void {
    this.loginForm = this.formBuilder.group({
      email: ['', [Validators.required, Validators.pattern(/^[a-zA-Z0-9._%+-]+@infomil\.mu$/)]],
      pass: ['', [Validators.required, Validators.minLength(4)]]
    });


    this.registerForm = this.formBuilder.group({
      // email: ['', [Validators.required, Validators.pattern(/^[a-zA-Z0-9._%+-]+@infomil\.mu$/)]],
      email: ['', [Validators.required, Validators.pattern(/^[a-zA-Z0-9._%+-]+@gmail\.com$/)]],
      trigramme: ['', [Validators.required, Validators.pattern(/^(iml-[a-zA-Z]{3}|iml-[a-zA-Z]{2}|[a-zA-Z]{3})$/)]],
      pass: ['', [Validators.required, Validators.minLength(4)]]
    });

    this.confirmationForm = this.formBuilder.group({
      confirmationCode: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(5)]]
    });

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
    this.login = !this.login;
    this.register = !this.register;
    this.loginForm.reset();
    this.registerForm.reset();
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
        if(response.data.id) {
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
    let userObj = obj.data.user;
    let token = obj.data.token;

    this.authService.setTokenCookie(token);
    this.authService.setUserCookie(userObj.id);

    this.loginLoader = false;

    location.reload();
  }
}
