import { createBrowserRouter } from 'react-router-dom'
import { DashboardPage } from '@/pages/dashboard'
import {
  ApplicationsPage,
  CreditsPage,
  DocumentsPage,
} from '@/pages/cabinet-sections'
import { NotFoundPage } from '@/pages/not-found'
import { ROUTES } from '@/shared/config'
import { LoginPage } from '@/pages/login'
import { ApplicationPage } from '@/pages/application-flow'
import { BankLayout } from '../layouts/BankLayout/BankLayout'
import { SessionLayout } from '../layouts/SessionLayout'
import { CabinetLayout } from '../layouts/CabinetLayout'

export const router = createBrowserRouter(
  [
    {
      Component: SessionLayout,
      children: [
        { path: ROUTES.login, Component: LoginPage },
        { path: ROUTES.bank, Component: BankLayout },
        {
          Component: CabinetLayout,
          children: [
            { path: ROUTES.dashboard, Component: DashboardPage },
            { path: ROUTES.applications, Component: ApplicationsPage },
            { path: ROUTES.credits, Component: CreditsPage },
            { path: ROUTES.contract(), Component: CreditsPage },
            { path: ROUTES.documents, Component: DocumentsPage },
            { path: ROUTES.application.root, Component: ApplicationPage },
            { path: '*', Component: NotFoundPage },
          ],
        },
      ],
    },
  ],
  {
    basename: import.meta.env.BASE_URL,
  },
)
