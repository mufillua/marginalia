import { CanMatchFn, Routes, UrlSegment } from '@angular/router';
import { authGuard, configuredGuard, guestGuard } from './core/guards/auth.guards';

const AUTH_PAGES = ['sign-in', 'register', 'forgot-password', 'reset-password', 'setup'];

/** The auth layout only claims its own pages, so "/" falls through to the library. */
const isAuthPage: CanMatchFn = (_route, segments: UrlSegment[]) =>
  segments.length > 0 && AUTH_PAGES.includes(segments[0].path);

export const routes: Routes = [
  {
    path: '',
    canMatch: [isAuthPage],
    loadComponent: () => import('./features/auth/auth-layout.component').then((m) => m.AuthLayoutComponent),
    children: [
      {
        path: 'sign-in',
        canActivate: [guestGuard],
        title: 'Sign in · Marginalia',
        loadComponent: () => import('./features/auth/sign-in.component').then((m) => m.SignInComponent),
      },
      {
        path: 'register',
        canActivate: [guestGuard],
        title: 'Create your library · Marginalia',
        loadComponent: () => import('./features/auth/register.component').then((m) => m.RegisterComponent),
      },
      {
        path: 'forgot-password',
        canActivate: [guestGuard],
        title: 'Reset your password · Marginalia',
        loadComponent: () => import('./features/auth/forgot-password.component').then((m) => m.ForgotPasswordComponent),
      },
      {
        path: 'reset-password',
        title: 'Choose a new password · Marginalia',
        loadComponent: () => import('./features/auth/reset-password.component').then((m) => m.ResetPasswordComponent),
      },
      {
        path: 'setup',
        canActivate: [configuredGuard],
        title: 'Setup needed · Marginalia',
        loadComponent: () => import('./features/auth/setup.component').then((m) => m.SetupComponent),
      },
    ],
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell.component').then((m) => m.ShellComponent),
    children: [
      {
        path: '',
        pathMatch: 'full',
        title: 'Home · Marginalia',
        loadComponent: () => import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'shelf',
        title: 'My books · Marginalia',
        loadComponent: () => import('./features/bookshelf/bookshelf.component').then((m) => m.BookshelfComponent),
      },
      {
        path: 'add',
        title: 'Add a book · Marginalia',
        loadComponent: () => import('./features/add-book/add-book.component').then((m) => m.AddBookComponent),
      },
      {
        path: 'book/:id',
        title: 'Book · Marginalia',
        loadComponent: () => import('./features/book-details/book-details.component').then((m) => m.BookDetailsComponent),
      },
      {
        path: 'book/:id/edit',
        title: 'Edit book · Marginalia',
        loadComponent: () => import('./features/add-book/edit-book.component').then((m) => m.EditBookComponent),
      },
      {
        path: 'journal',
        title: 'Journal · Marginalia',
        loadComponent: () => import('./features/reading-journal/journal.component').then((m) => m.JournalComponent),
      },
      {
        path: 'to-read',
        title: 'To read · Marginalia',
        loadComponent: () => import('./features/wishlist/wishlist.component').then((m) => m.WishlistComponent),
      },
      {
        path: 'stats',
        title: 'Reading year · Marginalia',
        loadComponent: () => import('./features/statistics/statistics.component').then((m) => m.StatisticsComponent),
      },
      {
        path: 'settings',
        title: 'Settings · Marginalia',
        loadComponent: () => import('./features/settings/settings.component').then((m) => m.SettingsComponent),
      },
      {
        path: '**',
        title: 'Page not found · Marginalia',
        loadComponent: () => import('./features/not-found.component').then((m) => m.NotFoundComponent),
      },
    ],
  },
];
