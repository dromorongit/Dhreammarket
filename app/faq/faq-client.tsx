"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { FAQJsonLd } from "@/components/seo/FAQJsonLd";

interface FAQ {
  id: string;
  category: string;
  question: string;
  answer: string;
}

const faqData: FAQ[] = [
  {
    id: "1",
    category: "Customer FAQs",
    question: "How do I create an account?",
    answer:
      'Click on the "Sign Up" button in the top right corner of the homepage. Fill in your email, password, and select "Customer" as your role. Verify your email address to complete registration.',
  },
  {
    id: "2",
    category: "Customer FAQs",
    question: "How do I place an order?",
    answer:
      "Browse products, add items to your cart, then proceed to checkout. Select your payment method (Paystack), enter shipping details, and complete the payment. You'll receive an order confirmation via email.",
  },
  {
    id: "3",
    category: "Customer FAQs",
    question: "How can I track my order?",
    answer:
      "Go to your Dashboard > Orders. Click on any order to see its current status. You can also track order updates through email notifications.",
  },
  {
    id: "4",
    category: "Vendor FAQs",
    question: "How do I become a vendor?",
    answer:
      'Register an account and select "Vendor" as your role. Complete your profile, set up your store, and submit your store for verification. Our team will review your application within 1-2 business days.',
  },
  {
    id: "5",
    category: "Vendor FAQs",
    question: "How do I add products?",
    answer:
      'Navigate to your Vendor Dashboard > Products. Click "Add Product", fill in product details, upload images via Cloudinary, set pricing and stock, then publish.',
  },
  {
    id: "6",
    category: "Vendor FAQs",
    question: "How are vendor payouts calculated?",
    answer:
      "Vendors receive 100% of the product price minus platform commission (if applicable) and payment processing fees. Payouts are processed monthly via bank transfer.",
  },
  {
    id: "7",
    category: "Payments & Refunds",
    question: "What payment methods do you accept?",
    answer:
      "We accept all major credit/debit cards, mobile money, and bank transfers through Paystack, our secure payment processor.",
  },
  {
    id: "8",
    category: "Payments & Refunds",
    question: "How do I request a refund?",
    answer:
      "Contact the seller directly through your order page to initiate a refund request. If unresolved, our support team can assist. Refunds are processed within 5-7 business days.",
  },
  {
    id: "9",
    category: "Payments & Refunds",
    question: "Why was my payment declined?",
    answer:
      "Payment declines can occur due to insufficient funds, incorrect card details, or bank security flags. Please verify your information or contact your bank. You can also try an alternative payment method.",
  },
  {
    id: "10",
    category: "Orders & Delivery",
    question: "How long does delivery take?",
    answer:
      "Delivery times vary by seller location and shipping method. Standard delivery typically takes 3-7 business days. You'll receive tracking information once your order ships.",
  },
  {
    id: "11",
    category: "Orders & Delivery",
    question: "Can I modify or cancel my order?",
    answer:
      "Orders can only be modified or cancelled within 1 hour of placement if they haven't entered processing. Contact support immediately for assistance.",
  },
  {
    id: "12",
    category: "Orders & Delivery",
    question: "What if my order arrives damaged?",
    answer:
      "Take photos of the damaged items and contact the seller immediately through your order page. If the seller doesn't respond within 48 hours, our support team will intervene.",
  },
  {
    id: "13",
    category: "Vendor Verification",
    question: "Why is my store verification taking long?",
    answer:
      "Verification typically takes 1-2 business days. Delays may occur if additional documentation is needed. Check your email for updates or contact support.",
  },
  {
    id: "14",
    category: "Vendor Verification",
    question: "What documents are required for verification?",
    answer:
      "We require a valid government-issued ID (passport, driver's license, or national ID) and proof of business registration if applicable. Business licenses may be required for certain product categories.",
  },
  {
    id: "15",
    category: "Featured Vendors",
    question: "How do I become a featured vendor?",
    answer:
      "Featured vendor status is awarded to top-performing stores with excellent customer ratings, fast shipping, and high-quality products. Admin may also feature vendors manually based on merit.",
  },
  {
    id: "16",
    category: "Featured Vendors",
    question: "What are the benefits of being featured?",
    answer:
      "Featured vendors receive premium placement on the marketplace, increased visibility, a special badge on their store, and access to promotional opportunities.",
  },
  {
    id: "17",
    category: "Account & Security",
    question: "How do I reset my password?",
    answer:
      'Click "Forgot Password" on the login page. Enter your email address and follow the reset link sent to your inbox. The link expires in 1 hour.',
  },
  {
    id: "18",
    category: "Account & Security",
    question: "How do I update my profile information?",
    answer:
      "Log in and go to Dashboard > Settings. You can update your name, phone, address, and profile picture there.",
  },
  {
    id: "19",
    category: "Account & Security",
    question: "How do I delete my account?",
    answer:
      "Contact our support team to request account deletion. Please note that account deletion is permanent and will remove all your data, order history, and reviews.",
  },
  {
    id: "20",
    category: "Technical Issues",
    question: "The website is not loading properly. What should I do?",
    answer:
      "Try clearing your browser cache, disabling browser extensions, or using a different browser. If the issue persists, try accessing the site from a different device or contact support.",
  },
  {
    id: "21",
    category: "Technical Issues",
    question: "I can't upload product images. Help!",
    answer:
      "Ensure your images are in JPG, PNG, or WebP format and under 10MB. If uploads still fail, check your internet connection or try a different browser. Contact support if the problem continues.",
  },
  {
    id: "22",
    category: "Technical Issues",
    question: "I'm not receiving email notifications.",
    answer:
      "Check your spam folder first. Ensure you've added our email address to your contacts. Verify your email address in account settings. If issues persist, contact support to update your email.",
  },
];

const categories = [
  "All",
  "Customer FAQs",
  "Vendor FAQs",
  "Payments & Refunds",
  "Orders & Delivery",
  "Vendor Verification",
  "Featured Vendors",
  "Account & Security",
  "Technical Issues",
];

function groupByCategory(faqs: FAQ[], category: string): Record<string, FAQ[]> {
  if (category !== "All") {
    return { [category]: faqs };
  }
  const result: Record<string, FAQ[]> = {};
  faqs.forEach((faq) => {
    if (!result[faq.category]) result[faq.category] = [];
    result[faq.category].push(faq);
  });
  return result;
}

export default function FAQClient() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filteredFAQs, setFilteredFAQs] = useState<FAQ[]>(faqData);

  useEffect(() => {
    let filtered = faqData;

    if (selectedCategory !== "All") {
      filtered = filtered.filter((faq) => faq.category === selectedCategory);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (faq) =>
          faq.question.toLowerCase().includes(query) ||
          faq.answer.toLowerCase().includes(query),
      );
    }

    setFilteredFAQs(filtered);
  }, [searchQuery, selectedCategory]);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const groupedFAQs: Record<string, FAQ[]> = groupByCategory(
    filteredFAQs,
    selectedCategory,
  );

  return (
    <>
      <FAQJsonLd
        faqs={faqData.map((f) => ({ question: f.question, answer: f.answer }))}
      />
      <div className="min-h-screen bg-slate-50">
        <div className="bg-gradient-to-br from-deep-navy to-purple-900 relative overflow-hidden">
          <div className="absolute inset-0">
            <img
              src="/assets/images/faq.jpg"
              alt=""
              className="w-full h-full object-cover opacity-30"
            />
            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-tr from-royal-blue/20 to-transparent"></div>
            <div className="absolute top-20 -right-40 w-96 h-96 bg-premium-gold/10 rounded-full blur-3xl"></div>
            <div className="absolute bottom-0 -left-40 w-96 h-96 bg-royal-blue/10 rounded-full blur-3xl"></div>
          </div>

          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
            <div className="text-center text-white">
              <Badge variant="premium" className="mb-4 mx-auto">
                Help & Support
              </Badge>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-4 tracking-tight">
                Frequently Asked Questions
              </h1>
              <p className="text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto">
                Find answers to common questions about Dhream Market. Browse by
                category or search for specific topics.
              </p>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-12 relative z-10 pb-16 lg:pb-24">
          <Card variant="elevated" className="mb-8">
            <CardContent className="p-6">
              <div className="flex flex-col lg:flex-row gap-4">
                <div className="flex-1">
                  <Input
                    type="text"
                    placeholder="Search FAQs..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full"
                    icon={
                      <svg
                        className="w-5 h-5 text-slate-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                        />
                      </svg>
                    }
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {categories.map((category) => (
                    <Button
                      key={category}
                      variant={
                        selectedCategory === category ? "primary" : "outline"
                      }
                      size="sm"
                      onClick={() => setSelectedCategory(category)}
                    >
                      {category}
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {Object.keys(groupedFAQs).length === 0 ? (
            <Card variant="elevated">
              <CardContent className="p-12 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
                  <svg
                    className="w-8 h-8 text-slate-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-slate-700 mb-2">
                  No FAQs found
                </h3>
                <p className="text-slate-500">
                  Try adjusting your search or filter to find what you&apos;re
                  looking for.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-8">
              {selectedCategory === "All"
                ? Object.entries(groupedFAQs).map(([category, faqs]) => (
                    <div key={category}>
                      <h2 className="text-2xl font-bold text-deep-navy mb-4 flex items-center gap-3">
                        {category}
                        <Badge variant="default">{faqs.length}</Badge>
                      </h2>
                      <div className="space-y-3">
                        {faqs.map((faq) => (
                          <Card
                            key={faq.id}
                            variant="outline"
                            className={`cursor-pointer transition-all duration-200 hover:shadow-md ${expandedId === faq.id ? "ring-2 ring-royal-blue" : ""}`}
                            onClick={() => toggleExpand(faq.id)}
                          >
                            <CardContent className="p-0">
                              <div className="p-6">
                                <div className="flex items-start justify-between gap-4">
                                  <h3 className="text-lg font-semibold text-slate-800 pr-4">
                                    {faq.question}
                                  </h3>
                                  <button className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors">
                                    <svg
                                      className={`w-5 h-5 text-slate-600 transition-transform duration-200 ${expandedId === faq.id ? "rotate-180" : ""}`}
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M19 9l-7 7-7-7"
                                      />
                                    </svg>
                                  </button>
                                </div>
                                {expandedId === faq.id && (
                                  <div className="mt-4 pt-4 border-t border-slate-100">
                                    <p className="text-slate-600 leading-relaxed">
                                      {faq.answer}
                                    </p>
                                  </div>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  ))
                : groupedFAQs[selectedCategory]?.map((faq) => (
                    <Card
                      key={faq.id}
                      variant="outline"
                      className={`cursor-pointer transition-all duration-200 hover:shadow-md ${expandedId === faq.id ? "ring-2 ring-royal-blue" : ""}`}
                      onClick={() => toggleExpand(faq.id)}
                    >
                      <CardContent className="p-0">
                        <div className="p-6">
                          <div className="flex items-start justify-between gap-4">
                            <h3 className="text-lg font-semibold text-slate-800 pr-4">
                              {faq.question}
                            </h3>
                            <button className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors">
                              <svg
                                className={`w-5 h-5 text-slate-600 transition-transform duration-200 ${expandedId === faq.id ? "rotate-180" : ""}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 9l-7 7-7-7"
                                />
                              </svg>
                            </button>
                          </div>
                          {expandedId === faq.id && (
                            <div className="mt-4 pt-4 border-t border-slate-100">
                              <p className="text-slate-600 leading-relaxed">
                                {faq.answer}
                              </p>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
            </div>
          )}

          <Card
            variant="elevated"
            className="mt-12 bg-gradient-to-br from-royal-blue to-purple-600 text-white"
          >
            <CardContent className="p-8 text-center">
              <h3 className="text-2xl font-bold mb-3">Still need help?</h3>
              <p className="text-blue-100 mb-6 max-w-2xl mx-auto">
                Can&apos;t find the answer you&apos;re looking for? Our support
                team is here to help.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button
                  variant="secondary"
                  size="lg"
                  onClick={() => (window.location.href = "/help")}
                >
                  Contact Support
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => (window.location.href = "/contact")}
                  className="!border-white !text-white hover:!bg-white/10"
                >
                  Send Feedback
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
