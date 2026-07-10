import { inject } from '@angular/core';
import { HttpHeaders } from '@angular/common/http';
import { Observable, switchMap, tap } from 'rxjs';
import { MailApiService } from '../api/mail-api.service';
import { AuthApiService } from '../api/auth-api.service';
import { Service } from '@angular/core';

export interface MailRecipient {
  name: string;
  email: string;
}

export interface MailRequest {
  to: MailRecipient[];
  subject: string;
  body: string;
}

@Service()
export class MailService {
  private mailApiService = inject(MailApiService);
  private authApiService = inject(AuthApiService);

  private sudo = {
    'email': 'infomil.foot@gmail.com',
    'password': '1nf0m1l2024'
  };

  private token: string = '';

  private httpOptions = {
    headers: new HttpHeaders({
      'Content-Type':  'application/json'
    })
  };

  sendConfirmationEmail(
    name: string,
    email: string,
    tokenNumber: string
  ): Observable<any> {
    return this.authApiService.authenticate(
      this.sudo,
      this.httpOptions
    ).pipe(
      tap((res) => {
        this.token = res.data.token;
      }),
      switchMap(() => {
        const headers = new HttpHeaders({
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        });

        const payload: MailRequest = {
          to: [
            {
              name,
              email
            }
          ],
          subject: 'Account confirmation for Infomil World Cup Challenge 2026',
          body: `
            <p>Hello ${name},</p>
            <p>Please use the following token to confirm your account:</p>
            <h3>${tokenNumber}</h3>
          `
        };

        return this.mailApiService.sendMail(payload, { headers });
      })
    );
  }
}