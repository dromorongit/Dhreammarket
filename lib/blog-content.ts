export interface BlogArticle {
  id: string
  title: string
  excerpt: string
  coverImage: string
  readTime: string
  content: Array<{ type: 'heading' | 'paragraph'; text: string }>
}

export const BLOG_ARTICLES: BlogArticle[] = [
  {
    id: 'authentic-products',
    title: 'How to Spot Authentic Products When Shopping Online',
    excerpt:
      'Learn practical ways to verify real products, read reviews critically, and avoid common shopping pitfalls on e-commerce platforms.',
    coverImage: '/images/market.jpg',
    readTime: '5 min read',
    content: [
      {
        type: 'heading',
        text: 'Check Vendor Verification Badges',
      },
      {
        type: 'paragraph',
        text: 'Reputable marketplaces highlight verified vendors with clear badges. On Dhream Market, look for the verified seller icon and badge tier indicators. These are assigned after reviewing business documentation, so they give you a quick signal about who you are buying from.',
      },
      {
        type: 'heading',
        text: 'Read Reviews Carefully',
      },
      {
        type: 'paragraph',
        text: 'Customer reviews are one of the best tools for spotting authentic products. Focus on reviews with photos, detailed comments, and multiple purchases from the same buyer. A pattern of generic five-star reviews with no detail can be a red flag. Take the time to read both positive and critical reviews.',
      },
      {
        type: 'heading',
        text: 'Inspect Product Photos and Descriptions',
      },
      {
        type: 'paragraph',
        text: 'Authentic listings usually have high-quality, original photos and accurate descriptions. If images look copied from other sites or the description is vague, ask yourself whether the seller is being transparent. Good sellers answer questions about materials, dimensions, and warranty details.',
      },
      {
        type: 'heading',
        text: 'Use Secure Payment Options',
      },
      {
        type: 'paragraph',
        text: 'Always pay through the platform’s secure checkout. Payment methods like Paystack add a layer of protection because they verify transactions and give you a record of purchase. Avoid direct bank transfers or cash-on-delivery deals that fall outside the platform’s buyer-protection policies.',
      },
    ],
  },
  {
    id: 'safe-online-shopping-ghana',
    title: "A Beginner's Guide to Safe Online Shopping in Ghana",
    excerpt:
      'From choosing the right marketplace to understanding delivery and payments, here is what new shoppers should know before buying online.',
    coverImage: '/images/delivery.jpg',
    readTime: '6 min read',
    content: [
      {
        type: 'heading',
        text: 'Choose a Trusted Marketplace',
      },
      {
        type: 'paragraph',
        text: 'Not all online shopping platforms are the same. Look for a marketplace with transparent vendor policies, secure checkout, and visible customer support. Dhream Market is built for Ghanaian buyers and sellers, with local payment options and a structure that makes it easy to resolve issues.',
      },
      {
        type: 'heading',
        text: 'Understand Delivery Expectations',
      },
      {
        type: 'paragraph',
        text: 'Delivery times can vary based on your location and the seller’s location. Before you buy, check the seller’s shipping policy, estimated delivery window, and whether tracking is included. If you need an item urgently, confirm dispatch timing with the seller first.',
      },
      {
        type: 'heading',
        text: 'Pay Safely with Trusted Options',
      },
      {
        type: 'paragraph',
        text: 'Use secure payment gateways such as Paystack or mobile money integrations offered by the platform. These options protect your financial details and create a clear transaction trail. Avoid sending money outside the platform for goods that have not been delivered.',
      },
      {
        type: 'heading',
        text: 'What to Do If an Order Has Issues',
      },
      {
        type: 'paragraph',
        text: 'If a product arrives damaged, is different from the listing, or does not arrive at all, act quickly. Contact the seller through the platform’s messaging system, keep screenshots of your order and conversations, and open a dispute if needed. Most trusted marketplaces have a resolution process designed to protect buyers.',
      },
    ],
  },
  {
    id: 'start-selling-dhream-market',
    title: 'How to Start Selling on Dhream Market: A Vendor’s Guide',
    excerpt:
      'A step-by-step look at vendor registration, store setup, listing products well, and earning buyer trust from day one.',
    coverImage: '/images/selldhream.jpg',
    readTime: '7 min read',
    content: [
      {
        type: 'heading',
        text: 'Register and Complete Your Profile',
      },
      {
        type: 'paragraph',
        text: 'Start by creating a vendor account on Dhream Market. Fill in your business name, contact details, and location accurately. A complete profile with a clear logo and description helps buyers recognize you and feel confident about purchasing from your store.',
      },
      {
        type: 'heading',
        text: 'Set Up Your Store',
      },
      {
        type: 'paragraph',
        text: 'After registration, organize your store by adding a banner, choosing the right categories, and setting your payment and shipping preferences. Think of your store as your shop window: a tidy layout and consistent branding encourage buyers to browse more and return later.',
      },
      {
        type: 'heading',
        text: 'List Products the Right Way',
      },
      {
        type: 'paragraph',
        text: 'Use clear, honest titles and descriptions. Include exact prices, stock levels, and dimensions where relevant. Upload sharp photos from multiple angles and mention any warranty, return policy, or delivery note. The more detail you provide, the fewer questions you will get later.',
      },
      {
        type: 'heading',
        text: 'Build Trust as a New Vendor',
      },
      {
        type: 'paragraph',
        text: 'Respond to buyer messages quickly, ship on time, and politely handle any issues that arise. Positive reviews and repeat customers are the strongest signals of a healthy store. Over time, consistent performance can lead to verification badges and higher placement in search results.',
      },
    ],
  },
]
