export const ROUTES = {
  dashboard: '/',
  login: '/login',
  bank: '/bank',
  applications: '/applications',
  credits: '/credits',
  contract: (id = ':contractId') => `/credits/${id}`,
  documents: '/documents',
  catalog: '/products',
  productDetails: (id = ':id') => `/products/${id}`,
  application: {
    root: '/apply',
    step: (step = ':step') => `/apply/${step}`,
  },
  decision: (applicationId = ':id') => `/decision/${applicationId}`,
} as const
