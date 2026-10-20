import { createBrowserRouter } from 'react-router-dom'
import { DashboardPage } from '@/pages/dashboard'
import {
  ApplicationsPage,
  CreditsPage,
  DocumentsPage,
} from '@/pages/cabinet-sections'
import { NotFoundPage } from '@/pages/not-found'
import { ROUTES } from '@/shared/config'
import { CabinetLayout } from '../layouts/CabinetLayout'

export const router = createBrowserRouter(
  [
    {
      Component: CabinetLayout,
      children: [
        { path: ROUTES.dashboard, Component: DashboardPage },
        { path: ROUTES.applications, Component: ApplicationsPage },
        { path: ROUTES.credits, Component: CreditsPage },
        { path: ROUTES.documents, Component: DocumentsPage },
        { path: '*', Component: NotFoundPage },
      ],
    },
  ],
  {
    basename: import.meta.env.BASE_URL,
  },
)
