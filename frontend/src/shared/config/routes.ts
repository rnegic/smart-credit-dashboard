export const ROUTES = {
  dashboard: '/',
  catalog: '/products',
  productDetails: (id = ':id') => `/products/${id}`,
  application: {
    root: '/apply',
    step: (step = ':step') => `/apply/${step}`,
  },
  decision: (applicationId = ':id') => `/decision/${applicationId}`,
} as const
