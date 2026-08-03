declare module '*.css' {
  export {};
}

declare module 'uuid' {
  const uuid: any
  export default uuid
  export const v4: any
}

declare global {
  interface Window {
    gtag?: (...args: any[]) => void
    dataLayer: any[]
  }
}