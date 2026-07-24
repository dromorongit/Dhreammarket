import { Card, CardContent } from '@/components/Card'
import { Badge } from '@/components/Badge'
import Image from 'next/image'
import { getBrandingPreferences } from '@/lib/platform-preferences'

export const metadata = {
  title: 'Managing Products - Help Center - Dhream Market',
  description: 'Complete guide for vendors on managing products on Dhream Market. Learn how to add, edit, and organize your product listings.',
}

export default async function ManagingProductsGuide() {
  const branding = await getBrandingPreferences()
  const supportPhone = branding.supportPhone || '+233 59 652 2239'
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-gradient-to-br from-deep-navy to-purple-900 relative overflow-hidden">
        <div className="absolute inset-0">
          <Image src="/assets/images/products.jpg" alt="" fill priority className="object-cover opacity-30" />
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-tr from-royal-blue/20 to-transparent"></div>
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
          <div className="text-center text-white">
            <Badge variant="premium" className="mb-4 mx-auto">Vendor Guide</Badge>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-4 tracking-tight">Managing Products</h1>
            <p className="text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto">
              Add and manage your product listings
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 -mt-12 relative z-10 pb-16 lg:pb-24">
        <Card variant="elevated" className="mb-8">
          <CardContent className="p-6 sm:p-8">
            <div className="prose prose-lg max-w-none">
              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-deep-navy mb-4 flex items-center gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center text-white text-sm font-bold">1</span>
                  Adding New Products
                </h2>
                <h3 className="text-xl font-medium text-deep-navy mb-3">Step 1: Access Products Page</h3>
                <p className="text-slate-600 mb-3">
                  Navigate to Vendor Dashboard &gt; Products and click &quot;Add Product&quot;.
                </p>
                <h3 className="text-xl font-medium text-deep-navy mb-3">Step 2: Enter Product Details</h3>
                <p className="text-slate-600 mb-3">
                  Fill in product name, description, price, and select appropriate categories.
                </p>
                <h3 className="text-xl font-medium text-deep-navy mb-3">Step 3: Upload Images</h3>
                <p className="text-slate-600 mb-3">
                  Upload high-quality images via Cloudinary. Include multiple angles and details.
                </p>
                <h3 className="text-xl font-medium text-deep-navy mb-3">Step 4: Set Stock and Pricing</h3>
                <p className="text-slate-600">
                  Set initial stock quantity and confirm pricing. Toggle &quot;Publish&quot; to make product live.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-deep-navy mb-4 flex items-center gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-sm font-bold">2</span>
                  Managing Existing Products
                </h2>
                <h3 className="text-xl font-medium text-deep-navy mb-3">Editing Products</h3>
                <p className="text-slate-600 mb-3">
                  Click &quot;Edit&quot; on any product to modify details, pricing, or images.
                </p>
                <h3 className="text-xl font-medium text-deep-navy mb-3">Stock Management</h3>
                <p className="text-slate-600 mb-3">
                  Update stock quantities manually or enable inventory tracking for automatic updates.
                </p>
                <h3 className="text-xl font-medium text-deep-navy mb-3">Status Control</h3>
                <p className="text-slate-600">
                  Toggle &quot;Published&quot; to hide/show products. Deleted products can be recovered within 30 days.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-deep-navy mb-4 flex items-center gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white text-sm font-bold">3</span>
                  Product Best Practices
                </h2>
                <ul className="space-y-2">
                  <li className="flex items-start gap-3"><span className="w-2 h-2 rounded-full bg-amber-500 mt-2 flex-shrink-0"></span><span className="text-slate-600">Use clear, high-resolution images (minimum 800x800px)</span></li>
                  <li className="flex items-start gap-3"><span className="w-2 h-2 rounded-full bg-amber-500 mt-2 flex-shrink-0"></span><span className="text-slate-600">Write detailed descriptions with all relevant specifications</span></li>
                  <li className="flex items-start gap-3"><span className="w-2 h-2 rounded-full bg-amber-500 mt-2 flex-shrink-0"></span><span className="text-slate-600">Set competitive prices based on market research</span></li>
                  <li className="flex items-start gap-3"><span className="w-2 h-2 rounded-full bg-amber-500 mt-2 flex-shrink-0"></span><span className="text-slate-600">Organize products with appropriate categories and tags</span></li>
                </ul>
              </section>
            </div>
          </CardContent>
        </Card>

        <Card variant="elevated" className="mb-8">
          <CardContent className="p-6 sm:p-8">
            <h2 className="text-2xl font-semibold text-deep-navy mb-4">FAQ</h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium text-deep-navy mb-2">How many images can I upload?</h3>
                <p className="text-slate-600">You can upload up to 8 images per product. First image becomes the main thumbnail.</p>
              </div>
              <div>
                <h3 className="text-lg font-medium text-deep-navy mb-2">Can I schedule product availability?</h3>
                <p className="text-slate-600">Yes, use scheduled publishing to set future availability dates.</p>
              </div>
              <div>
                <h3 className="text-lg font-medium text-deep-navy mb-2">What happens when stock reaches zero?</h3>
                <p className="text-slate-600">The product becomes unavailable for purchase until restocked.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card variant="elevated" className="mb-8">
          <CardContent className="p-6 sm:p-8">
            <h2 className="text-2xl font-semibold text-deep-navy mb-4">Related Guides</h2>
            <div className="flex flex-wrap gap-3">
              <a href="/help/managing-inventory" className="text-royal-blue hover:underline">Managing Inventory</a>
              <a href="/help/creating-store" className="text-royal-blue hover:underline">Creating a Store</a>
              <a href="/help/fulfillment-workflow" className="text-royal-blue hover:underline">Fulfillment Workflow</a>
            </div>
          </CardContent>
        </Card>

<Card variant="elevated">
           <CardContent className="p-6 sm:p-8">
             <h2 className="text-2xl font-semibold text-deep-navy mb-4">Need Help?</h2>
             <p className="text-slate-600 mb-4">
               Contact our vendor support team if you need assistance with products.
             </p>
             <div className="flex flex-col sm:flex-row gap-4">
               <a href="/help" className="text-royal-blue hover:underline">Visit Help Center</a>
               <a href="/contact" className="text-royal-blue hover:underline">Contact Support</a>
               <div className="flex flex-col sm:flex-row gap-2"><a href={`tel:${supportPhone.replace(/\s/g, ``)}`} className="text-royal-blue hover:underline">{supportPhone}</a></div>
             </div>
           </CardContent>
         </Card>
      </div>
    </div>
  )
}




