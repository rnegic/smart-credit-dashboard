import { createBrowserRouter } from 'react-router-dom'
import { DashboardPage } from '@/pages/dashboard'
import { NotFoundPage } from '@/pages/not-found'
import { ROUTES } from '@/shared/config'

export const router = createBrowserRouter(
  [
    {
      path: ROUTES.dashboard,
      Component: DashboardPage,
    },
    {
      path: '*',
      Component: NotFoundPage,
    },
  ],
  {
    basename: import.meta.env.BASE_URL,
  },
)
