export const ROUTES = {
  dashboard: '/',
  applications: '/applications',
  credits: '/credits',
  documents: '/documents',
  catalog: '/products',
  productDetails: (id = ':id') => `/products/${id}`,
  application: {
    root: '/apply',
    step: (step = ':step') => `/apply/${step}`,
  },
  decision: (applicationId = ':id') => `/decision/${applicationId}`,
} as const
