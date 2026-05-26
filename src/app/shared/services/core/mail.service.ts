import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, map, switchMap, tap } from 'rxjs';

export interface MailRecipient {
  name: string;
  email: string;
}

export interface MailRequest {
  to: MailRecipient[];
  subject: string;
  body: string;
}

@Injectable({
  providedIn: 'root'
})
export class MailService {

  private mailApi = 'https://euro.omediainteractive.net/imleuro/mail';

  private sudo = {
    'email': 'infomil.foot@gmail.com',
    'password': '1nf0m1l2024'
  }

  private token: string = '';
  private prodUrl: string = 'https://euro.omediainteractive.net/imleuro';

  private httpOptions = {
    headers: new HttpHeaders({
      'Content-Type':  'application/json'
    })
  };

  constructor(private http: HttpClient) {}

  sendConfirmationEmail(
    name: string,
    email: string,
    tokenNumber: string
  ): Observable<any> {
    return this.http.post<any>(
      `${this.prodUrl}/auth/authenticate`,
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

        return this.http.post(this.mailApi, payload, { headers });
      })
    );
  }
}