// Shipping configuration and calculation system

export interface ShippingZone {
  id: string
  name: string
  regions: string[]
  basePrice: number
  estimatedDays: { min: number; max: number }
  description?: string
}

export interface ShippingRate {
  zone: ShippingZone
  price: number
  estimatedDays: { min: number; max: number }
}

// Ghana-specific shipping zones
export const SHIPPING_ZONES: ShippingZone[] = [
  {
    id: 'accra-metro',
    name: 'Accra Metropolitan',
    regions: ['Accra', 'Tema', 'Kotoka International Airport Area'],
    basePrice: 15.00,
    estimatedDays: { min: 1, max: 2 },
    description: 'Same-day and next-day delivery available'
  },
  {
    id: 'greater-accra',
    name: 'Greater Accra Region',
    regions: ['Madina', 'Adenta', 'Weija', 'Nsawam', 'Achimota', 'Kumasi Road', 'Aburi', 'Nsawam', 'Koforidua Road'],
    basePrice: 20.00,
    estimatedDays: { min: 1, max: 3 },
    description: 'Accra and surrounding areas'
  },
  {
    id: 'ashanti',
    name: 'Ashanti Region',
    regions: ['Kumasi', 'Obuasi', 'Kwadaso', 'Suhum', 'Nkawkaw', 'Mankessim', 'Techiman', 'Sunyani', 'Bekwai', 'Ejumako'],
    basePrice: 25.00,
    estimatedDays: { min: 2, max: 4 },
    description: 'Kumasi and Ashanti region'
  },
  {
    id: 'central',
    name: 'Central Region',
    regions: ['Cape Coast', 'Winneba', 'Kasoa', 'Assin', 'Mfantsiman', 'Komenda', 'Elmina'],
    basePrice: 30.00,
    estimatedDays: { min: 2, max: 4 },
    description: 'Central region coastal areas'
  },
  {
    id: 'western',
    name: 'Western Region',
    regions: ['Takoradi', 'Sekondi', 'Tarkwa', 'Axim', 'Bibiani', 'Presto'],
    basePrice: 35.00,
    estimatedDays: { min: 3, max: 5 },
    description: 'Western region'
  },
  {
    id: 'eastern',
    name: 'Eastern Region',
    regions: ['Koforidua', 'Nkawkaw', 'Mampong', 'Akwapim', 'Somanya', 'Atimpoku', 'Aburi'],
    basePrice: 30.00,
    estimatedDays: { min: 2, max: 4 },
    description: 'Eastern region'
  },
  {
    id: 'northern',
    name: 'Northern Region',
    regions: ['Tamale', 'Yendi', 'Bole', 'Buipe', 'Salaga', 'Savelugu'],
    basePrice: 45.00,
    estimatedDays: { min: 3, max: 6 },
    description: 'Northern region'
  },
  {
    id: 'upper-east',
    name: 'Upper East Region',
    regions: ['Bolgatanga', 'Navrongo', 'Bawku', 'Zebilla', 'Sandema'],
    basePrice: 50.00,
    estimatedDays: { min: 4, max: 7 },
    description: 'Upper East region'
  },
  {
    id: 'upper-west',
    name: 'Upper West Region',
    regions: ['Wa', 'Tumu', 'Jirapa', 'Nandom', 'Gwollu'],
    basePrice: 50.00,
    estimatedDays: { min: 4, max: 7 },
    description: 'Upper West region'
  },
  {
    id: 'volta',
    name: 'Volta Region',
    regions: ['Ho', 'Keta', 'Kpando', 'Hohoe', 'Anloga', 'Aflao', 'Sogakope'],
    basePrice: 35.00,
    estimatedDays: { min: 3, max: 5 },
    description: 'Volta region'
  },
  {
    id: 'brong-ahafo',
    name: 'Bono East / Ahafo',
    regions: ['Techiman', 'Kintampo', 'Nsawkaw', 'Duayaw Nkwanta', 'Goaso', 'Bechem'],
    basePrice: 35.00,
    estimatedDays: { min: 2, max: 5 },
    description: 'Brong Ahafo and Bono East regions'
  }
]

// Get shipping rate based on city/region
export function getShippingRate(city: string, region?: string): ShippingRate | null {
  const searchLocation = (city || region || '').toLowerCase().trim()
  
  for (const zone of SHIPPING_ZONES) {
    for (const zoneRegion of zone.regions) {
      if (zoneRegion.toLowerCase() === searchLocation) {
        return {
          zone,
          price: zone.basePrice,
          estimatedDays: zone.estimatedDays
        }
      }
    }
  }
  
  // Default rate for unknown locations
  return {
    zone: {
      id: 'default',
      name: 'Other Locations',
      regions: [],
      basePrice: 40.00,
      estimatedDays: { min: 3, max: 7 }
    },
    price: 40.00,
    estimatedDays: { min: 3, max: 7 }
  }
}

// Calculate total shipping for multiple items
export function calculateShipping(items: Array<{ product: { price: number; weight?: number } }>, city: string, region?: string): number {
  const rate = getShippingRate(city, region)
  return rate ? rate.price : 40.00
}

// Get all available regions for dropdown
// Returns the 16 regions of Ghana
export function getAvailableRegions(): string[] {
  return [
    'Ashanti Region',
    'Brong-Ahafo Region',
    'Central Region',
    'Eastern Region',
    'Greater Accra Region',
    'Northern Region',
    'Upper East Region',
    'Upper West Region',
    'Volta Region',
    'Western Region',
    'Western North Region',
    'Ahafo Region',
    'Bono East Region',
    'Savannah Region',
    'North East Region',
    'Oti Region'
]
}

// Get all available zones for admin
export function getAvailableZones(): ShippingZone[] {
  return SHIPPING_ZONES
}

// Calculate tax - Always returns 0 as per business rules
// Tax is no longer automatically calculated; delivery fees are negotiated separately
export function calculateTax(subtotal: number, taxRate: number = 0): number {
  return 0
}

// Calculate grand total - Shipping and tax are not automatically calculated
export function calculateGrandTotal(
  subtotal: number,
  shipping: number = 0,
  tax: number = 0,
  discount: number = 0
): number {
  return Math.round((subtotal + shipping + tax - discount) * 100) / 100
}