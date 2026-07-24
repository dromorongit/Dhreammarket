"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { Card, CardContent } from "@/components/Card";
import { Button } from "@/components/Button";
import { Badge } from "@/components/Badge";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/Skeleton";
import { isManagedSectionSlug } from "@/lib/homepage-constants";
import { getCurrencySymbol } from "@/lib/platform-preferences";


interface HomepageSectionProduct {
  id: string;
  productId: string;
  displayOrder: number;
  product: Product;
}

interface HomepageSectionBrand {
  id: string;
  sectionId: string;
  brandId: string;
  brand: Brand;
}

interface HomepageSection {
  id: string;
  name: string;
  slug: string;
  isEnabled: boolean;
  displayOrder: number;
  type: string;
  subtitle: string | null;
  settings: any;
  createdAt: string;
  updatedAt: string;
  products?: HomepageSectionProduct[];
  vendors?: unknown[];
  brands?: HomepageSectionBrand[];
  _count?: {
    products: number;
    vendors: number;
  };
}

interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  images: Array<{ id: string; url: string; alt: string | null }>;
  store?: { id: string; name: string };
  category?: { id: string; name: string };
}

interface Brand {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  description: string | null;
  isActive: boolean;
  displayOrder: number;
  _count?: { products: number };
}

interface Vendor {
  id: string;
  name: string;
  storeName?: string;
  email?: string;
  mobileNumber?: string;
  user?: { id: string; email: string };
  profile?: { firstName: string; lastName: string };
  store?: { id: string; name: string; isVerified: boolean; isFeatured: boolean };
}

const SECTION_TYPES = [
  { value: "TRENDING_NOW", label: "Trending Now" },
  { value: "FLASH_SALES", label: "Flash Sales" },
  { value: "SPONSORED_PRODUCTS", label: "Sponsored Products" },
  { value: "LARGE_FEATURE_CARDS", label: "Gadget Display" },
  { value: "BIG_DEALS", label: "Big Top Deals" },
  { value: "BRAND_GRID", label: "Brand Store" },
  { value: "PRODUCT_GRID", label: "Product Grid" },
  { value: "QUICKLINK_CARD_GRID", label: "Quicklink Cards" },
  { value: "SERVICE_GRID", label: "Service Grid" },
  { value: "TOP_SELLING", label: "Top Selling Items" },
  { value: "CLEARANCE_SALES", label: "Clearance Sales" },
  { value: "EXPRESS_OFFERS", label: "Express Offers" },
];

const DEFAULT_SECTIONS = [
  {
    name: "Trending Now",
    slug: "trending-now",
    type: "TRENDING_NOW",
    subtitle: "Discover what's currently trending across Dhream Market.",
  },
  {
    name: "Flash Sales",
    slug: "flash-sales",
    type: "FLASH_SALES",
    subtitle: "Limited time offers",
  },
  {
    name: "Sponsored Products",
    slug: "sponsored-products",
    type: "SPONSORED_PRODUCTS",
    subtitle: "Featured by vendors",
  },
  {
    name: "Gadget Display",
    slug: "gadget-display",
    type: "LARGE_FEATURE_CARDS",
    subtitle: "Premium tech deals",
  },
  {
    name: "Big Top Deals",
    slug: "big-top-deals",
    type: "BIG_DEALS",
    subtitle: "Biggest savings on premium products",
  },
  {
    name: "Brand Store",
    slug: "brand-store",
    type: "BRAND_GRID",
    subtitle: "Explore products from your favorite brands",
  },
  {
    name: "Top Clearance Sales",
    slug: "top-clearance-sales",
    type: "FLASH_SALES",
    subtitle: "Massive clearance offers",
  },
  {
    name: "Top Services",
    slug: "top-services",
    type: "SERVICE_GRID",
    subtitle: "Premium services marketplace",
  },
  {
    name: "Home Theatre",
    slug: "home-theatre",
    type: "PRODUCT_GRID",
    subtitle: "Home entertainment systems",
  },
  {
    name: "Top Express Offers",
    slug: "top-express-offers",
    type: "BIG_DEALS",
    subtitle: "Express delivery exclusive deals",
  },
];

export default function SuperAdminHomepagePage() {
  const [sections, setSections] = useState<HomepageSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingSection, setEditingSection] = useState<HomepageSection | null>(
    null,
  );
  const [managingSection, setManagingSection] =
    useState<HomepageSection | null>(null);
  const [managingTrendingSettings, setManagingTrendingSettings] =
    useState<HomepageSection | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(
    new Set(),
  );
  const [selectedVendors, setSelectedVendors] = useState<Set<string>>(
    new Set(),
  );
  const [brands, setBrands] = useState<Brand[]>([]);
  const [selectedBrands, setSelectedBrands] = useState<Set<string>>(new Set());
  const [assignedBrands, setAssignedBrands] = useState<HomepageSectionBrand[]>(
    [],
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [productPage, setProductPage] = useState(1);
  const [productTotalPages, setProductTotalPages] = useState(1);
  const [assignedProducts, setAssignedProducts] = useState<
    HomepageSectionProduct[]
  >([]);
  const [saving, setSaving] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [trendingSettings, setTrendingSettings] = useState({
    mode: 'MANUAL' as 'MANUAL' | 'AUTOMATIC',
    maxProducts: 20,
    weights: {
      recentSales: 40,
      productViews: 20,
      wishlistAdds: 15,
      cartAdds: 15,
      recentReviews: 5,
      averageRating: 5,
    },
    timeWindow: '7D' as '24H' | '7D' | '30D',
    excludeOutOfStock: true,
    excludeHiddenProducts: true,
    excludeArchivedProducts: true,
  });
  const [currency, setCurrency] = useState<string>('')

  useEffect(() => {
    if (typeof window !== 'undefined' && window.__PLATFORM_CURRENCY__) {
      setCurrency(window.__PLATFORM_CURRENCY__)
    } else {
      fetch('/api/platform')
        .then((res) => res.json())
        .then((data) => {
          if (data.defaultCurrency) setCurrency(data.defaultCurrency)
        })
        .catch(() => setCurrency('GHS'))
    }
  }, [])

  const fetchSections = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/homepage-sections");
      if (response.ok) {
        const data = await response.json();
        setSections(data.sections || []);
      } else {
        setError("Failed to load sections");
      }
    } catch (err) {
      setError("Failed to load sections");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchProducts = useCallback(async (page = 1, search = "") => {
    try {
      const params = new URLSearchParams({ page: String(page), limit: "24" });
      if (search) params.set("search", search);
      const response = await fetch(`/api/admin/products?${params}`);
      if (response.ok) {
        const data = await response.json();
        setProducts(data.products || []);
        setProductTotalPages(data.pagination?.totalPages || 1);
      }
    } catch (err) {
      console.error("Error fetching products:", err);
    }
  }, []);

  const fetchVendors = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/vendors?limit=100");
      if (response.ok) {
        const data = await response.json();
        setVendors(data.vendors || []);
      }
    } catch (err) {
      console.error("Error fetching vendors:", err);
    }
  }, []);

  const fetchBrands = useCallback(async () => {
    try {
      const response = await fetch(
        "/api/super-admin/brands?includeInactive=true",
      );
      if (response.ok) {
        const data = await response.json();
        setBrands(data.brands || []);
      }
    } catch (err) {
      console.error("Error fetching brands:", err);
    }
  }, []);

  useEffect(() => {
    fetchSections();
    fetchVendors();
    fetchBrands();
  }, [fetchSections, fetchVendors, fetchBrands]);

  useEffect(() => {
    if (managingSection) {
      fetchProducts(productPage, searchQuery);
      fetch(`/api/homepage-sections/${managingSection.id}`)
        .then((r) => r.json())
        .then((data) => {
          setAssignedProducts(data.section?.products || []);
          setAssignedBrands(data.section?.brands || []);
        })
        .catch(console.error);
    }
  }, [managingSection, productPage, searchQuery, fetchProducts]);

  const handleToggle = async (section: HomepageSection) => {
    try {
      const response = await fetch(`/api/homepage-sections/${section.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isEnabled: !section.isEnabled }),
      });
      if (response.ok) {
        setSections((prev) =>
          prev.map((s) =>
            s.id === section.id ? { ...s, isEnabled: !s.isEnabled } : s,
          ),
        );
      }
    } catch (err) {
      console.error("Error toggling section:", err);
    }
  };

  const handleCreate = async (data: {
    name: string;
    slug: string;
    type: string;
    subtitle?: string;
  }) => {
    setSaving(true);
    try {
      const response = await fetch("/api/homepage-sections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (response.ok) {
        await fetchSections();
        setShowCreateModal(false);
      }
    } catch (err) {
      console.error("Error creating section:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (data: {
    name?: string;
    slug?: string;
    type?: string;
    subtitle?: string | null;
  }) => {
    if (!editingSection) return;
    setSaving(true);
    try {
      const response = await fetch(
        `/api/homepage-sections/${editingSection.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        },
      );
      if (response.ok) {
        await fetchSections();
        setEditingSection(null);
      }
    } catch (err) {
      console.error("Error updating section:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, slug: string) => {
    if (isManagedSectionSlug(slug)) {
      alert(
        "Core homepage sections cannot be deleted. You can disable them instead.",
      );
      return;
    }
    if (!confirm("Are you sure you want to delete this section?")) return;
    try {
      const response = await fetch(`/api/homepage-sections/${id}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (!response.ok) {
        alert(data.error || 'Failed to delete section');
        return;
      }
      setSections((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      console.error("Error deleting section:", err);
      alert('Failed to delete section');
    }
  };

  const handleReorder = async () => {
    if (draggedIndex === null) return;
    const orders = sections.map((s, i) => ({ id: s.id, displayOrder: i }));
    try {
      const response = await fetch("/api/homepage-sections/reorder", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orders }),
      });
      if (response.ok) {
        await fetchSections();
      }
    } catch (err) {
      console.error("Error reordering sections:", err);
    } finally {
      setDraggedIndex(null);
    }
  };

  const handleAssignProducts = async () => {
    if (!managingSection) return;
    setSaving(true);
    try {
      const response = await fetch(
        `/api/homepage-sections/${managingSection.id}/products`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productIds: Array.from(selectedProducts) }),
        },
      );
      if (response.ok) {
        await fetchSections();
        setSelectedProducts(new Set());
        // Refresh assigned products
        const data = await fetch(
          `/api/homepage-sections/${managingSection.id}`,
        ).then((r) => r.json());
        setAssignedProducts(data.section?.products || []);
      }
    } catch (err) {
      console.error("Error assigning products:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleAssignVendors = async () => {
    if (!managingSection) return;
    setSaving(true);
    try {
      const response = await fetch(
        `/api/homepage-sections/${managingSection.id}/vendors`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ vendorIds: Array.from(selectedVendors) }),
        },
      );
      if (response.ok) {
        await fetchSections();
        setManagingSection(null);
        setSelectedVendors(new Set());
      }
    } catch (err) {
      console.error("Error assigning vendors:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleAssignBrands = async () => {
    if (!managingSection) return;
    setSaving(true);
    try {
      const response = await fetch(
        `/api/homepage-sections/${managingSection.id}/brands`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ brandIds: Array.from(selectedBrands) }),
        },
      );
      if (response.ok) {
        await fetchSections();
        setSelectedBrands(new Set());
        // Refresh assigned brands
        const data = await fetch(
          `/api/homepage-sections/${managingSection.id}`,
        ).then((r) => r.json());
        setAssignedBrands(data.section?.brands || []);
      }
    } catch (err) {
      console.error("Error assigning brands:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveProduct = async (sectionId: string, productId: string) => {
    try {
      await fetch(
        `/api/homepage-sections/${sectionId}/products?productId=${productId}`,
        {
          method: "DELETE",
        },
      );
      setAssignedProducts((prev) =>
        prev.filter((p) => p.productId !== productId),
      );
      await fetchSections();
    } catch (err) {
      console.error("Error removing product:", err);
    }
  };

  const handleRemoveVendor = async (sectionId: string, vendorId: string) => {
    try {
      await fetch(
        `/api/homepage-sections/${sectionId}/vendors?vendorId=${vendorId}`,
        {
          method: "DELETE",
        },
      );
      await fetchSections();
    } catch (err) {
      console.error("Error removing vendor:", err);
    }
  };

  const handleRemoveBrand = async (sectionId: string, brandId: string) => {
    try {
      await fetch(
        `/api/homepage-sections/${sectionId}/brands?brandId=${brandId}`,
        {
          method: "DELETE",
        },
      );
      setAssignedBrands((prev) => prev.filter((b) => b.brandId !== brandId));
      await fetchSections();
    } catch (err) {
      console.error("Error removing brand:", err);
    }
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    const newSections = [...sections];
    const [dragged] = newSections.splice(draggedIndex, 1);
    newSections.splice(index, 0, dragged);
    setSections(newSections);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    if (draggedIndex !== null) {
      handleReorder();
    }
  };

  const handleBulkRemoveProducts = async (productIds: string[]) => {
    if (!managingSection || productIds.length === 0) return;
    setSaving(true);
    try {
      await fetch(
        `/api/homepage-sections/${managingSection.id}/products/bulk-delete`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productIds }),
        },
      );
      setAssignedProducts((prev) =>
        prev.filter((p) => !productIds.includes(p.productId)),
      );
      await fetchSections();
    } catch (err) {
      console.error("Error bulk removing products:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleReorderProducts = async (
    orders: { productId: string; displayOrder: number }[],
  ) => {
    if (!managingSection) return;
    try {
      await fetch(
        `/api/homepage-sections/${managingSection.id}/products/reorder`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orders }),
        },
      );
      setAssignedProducts((prev) =>
        [...prev].sort((a, b) => {
          const orderA =
            orders.find((o) => o.productId === a.productId)?.displayOrder ??
            a.displayOrder;
          const orderB =
            orders.find((o) => o.productId === b.productId)?.displayOrder ??
            b.displayOrder;
          return orderA - orderB;
        }),
      );
    } catch (err) {
      console.error("Error reordering products:", err);
    }
  };

  const filteredProducts = products;

  const filteredVendors = vendors.filter(
    (v) =>
      (v.user?.email ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (v.name ?? '').toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const filteredBrands = brands.filter(
    (b) =>
      (b.name ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (b.slug ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (b.description ?? '').toLowerCase().includes(searchQuery.toLowerCase()),
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Skeleton className="h-10 w-64 mb-8" />
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <EmptyState
            icon={
              <svg
                className="w-12 h-12 text-rose-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            }
            title="Error loading sections"
            description={error}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-4 sm:py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col gap-4 mb-6 sm:mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-deep-navy">
              Homepage Sections
            </h1>
            <p className="text-slate-600 mt-1 text-sm sm:text-base">
              Manage Flash Sales, Sponsored Products, Gadget Display, Big Top
              Deals, and Brand Store. Top Selling Items is automatic from
              completed sales.
            </p>
          </div>
<div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 w-full sm:w-auto">
            <Button asChild variant="outline" className="w-full sm:w-auto min-h-[44px]">
              <Link href="/dashboard/super-admin/brands">Manage Brands</Link>
            </Button>
            <Button onClick={() => setShowCreateModal(true)} className="w-full sm:w-auto min-h-[44px]">
              + Add Section
            </Button>
          </div>
        </div>

        {/* Sections List */}
        {sections.length === 0 ? (
          <EmptyState
            icon={
              <svg
                className="w-12 h-12 text-slate-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
            }
            title="No sections yet"
            description="Create your first homepage section to get started."
            actionLabel="Create First Section"
            onAction={() => setShowCreateModal(true)}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {sections.map((section, index) => (
              <Card
                key={section.id}
                variant="elevated"
                className={`transition-all duration-200 ${
                  draggedIndex === index
                    ? "opacity-50 ring-2 ring-royal-blue"
                    : ""
                } ${!section.isEnabled ? "opacity-60" : ""}`}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
              >
                <CardContent className="p-4 sm:p-5 flex flex-col h-full">
                  <div className="flex items-start sm:items-center gap-3 mb-3">
                    {/* Drag Handle */}
                    <div className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 min-w-[44px] min-h-[44px] flex items-center justify-center">
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 8h16M4 16h16"
                        />
                      </svg>
                    </div>

                    {/* Toggle */}
                    <button
                      onClick={() => handleToggle(section)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors min-w-[44px] min-h-[44px] ${
                        section.isEnabled ? "bg-royal-blue" : "bg-slate-300"
                      }`}
                      aria-label={`Toggle ${section.name} ${section.isEnabled ? 'off' : 'on'}`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          section.isEnabled ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>

                    {/* Section Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                        <h3 className="font-semibold text-deep-navy text-sm sm:text-base truncate">
                          {section.name}
                        </h3>
                        <Badge variant="default" size="sm" className="text-[10px] sm:text-xs">
                          {section.type.replace(/_/g, " ")}
                        </Badge>
                      </div>
                      {section.subtitle && (
                        <span className="text-xs text-slate-500 truncate block mt-1">
                          — {section.subtitle}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Secondary Details - Mobile friendly */}
                  <div className="flex flex-col gap-1 mb-3 px-11 sm:px-0 sm:ml-11 text-xs text-slate-500">
                    <span className="truncate">Slug: {section.slug}</span>
                    <span>Order: {section.displayOrder}</span>
                    {section._count && (
                      <span className="truncate">{section._count.products} products</span>
                    )}
                  </div>

                  {/* Actions - Full width stacked on mobile */}
                  <div className="flex flex-col gap-2 mt-auto">
                    {section.slug === "brand-store" ? (
                      <Button asChild variant="outline" size="sm" className="w-full min-h-[44px]">
                        <Link href="/dashboard/super-admin/brands">Manage Brands</Link>
                      </Button>
                    ) : section.slug === "trending-now" ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full min-h-[44px]"
                          onClick={() => setManagingSection(section)}
                        >
                          Manage Products
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full min-h-[44px]"
                          onClick={() => {
                            setTrendingSettings({
                              mode: ((section.settings as any)?.mode as 'MANUAL' | 'AUTOMATIC') || 'MANUAL',
                              maxProducts: (section.settings as any)?.maxProducts || 20,
                              weights: (section.settings as any)?.weights || {
                                recentSales: 40,
                                productViews: 20,
                                wishlistAdds: 15,
                                cartAdds: 15,
                                recentReviews: 5,
                                averageRating: 5,
                              },
                              timeWindow: (section.settings as any)?.timeWindow || '7D',
                              excludeOutOfStock: (section.settings as any)?.excludeOutOfStock ?? true,
                              excludeHiddenProducts: (section.settings as any)?.excludeHiddenProducts ?? true,
                              excludeArchivedProducts: (section.settings as any)?.excludeArchivedProducts ?? true,
                            });
                            setManagingTrendingSettings(section);
                          }}
                        >
                          Trending Settings
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full min-h-[44px]"
                        onClick={() => setManagingSection(section)}
                      >
                        Manage
                      </Button>
                    )}
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="flex-1 min-h-[44px]"
                        onClick={() => window.open("/", "_blank")}
                      >
                        Preview
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="flex-1 min-h-[44px]"
                        onClick={() => setEditingSection(section)}
                      >
                        Edit
                      </Button>
                      {!isManagedSectionSlug(section.slug) && (
                        <Button
                          variant="danger"
                          size="sm"
                          className="flex-1 min-h-[44px]"
                          onClick={() => handleDelete(section.id, section.slug)}
                        >
                          Delete
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Create Section Modal */}
        {showCreateModal && (
          <SectionModal
            title="Create Section"
            onSubmit={handleCreate}
            onClose={() => setShowCreateModal(false)}
            saving={saving}
          />
        )}

        {/* Edit Section Modal */}
        {editingSection && (
          <SectionModal
            title="Edit Section"
            initialData={{
              name: editingSection.name,
              slug: editingSection.slug,
              type: editingSection.type,
              subtitle: editingSection.subtitle || "",
            }}
            onSubmit={handleUpdate}
            onClose={() => setEditingSection(null)}
            saving={saving}
          />
        )}

        {/* Manage Section Modal */}
        {managingSection && (
          <ManageSectionModal
            section={managingSection}
            products={filteredProducts}
            vendors={vendors}
            brands={filteredBrands}
            assignedProducts={assignedProducts}
            assignedBrands={assignedBrands}
            selectedProducts={selectedProducts}
            selectedVendors={selectedVendors}
            selectedBrands={selectedBrands}
            searchQuery={searchQuery}
            productPage={productPage}
            productTotalPages={productTotalPages}
            onSearchChange={(q) => {
              setSearchQuery(q);
              setProductPage(1);
            }}
            onPageChange={setProductPage}
            onProductToggle={(id) => {
              setSelectedProducts((prev) => {
                const next = new Set(prev);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                return next;
              });
            }}
            onVendorToggle={(id) => {
              setSelectedVendors((prev) => {
                const next = new Set(prev);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                return next;
              });
            }}
            onBrandToggle={(id) => {
              setSelectedBrands((prev) => {
                const next = new Set(prev);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                return next;
              });
            }}
            onAssignProducts={async () => {
              await handleAssignProducts();
            }}
            onAssignVendors={handleAssignVendors}
            onAssignBrands={handleAssignBrands}
            onRemoveProduct={async (sectionId, productId) => {
              await handleRemoveProduct(sectionId, productId);
            }}
            onRemoveBrand={async (sectionId, brandId) => {
              await handleRemoveBrand(sectionId, brandId);
            }}
            onBulkRemove={(ids) => handleBulkRemoveProducts(ids)}
            onReorderProducts={handleReorderProducts}
onClose={() => {
               setManagingSection(null);
               setSelectedProducts(new Set());
               setSelectedVendors(new Set());
               setSelectedBrands(new Set());
               setAssignedProducts([]);
               setAssignedBrands([]);
               setSearchQuery("");
               setProductPage(1);
             }}
             saving={saving}
           />
        )}

        {/* Trending Settings Modal */}
        {managingTrendingSettings && (
          <TrendingSettingsModal
            section={managingTrendingSettings}
            settings={trendingSettings}
            onSettingsChange={setTrendingSettings}
            onSave={async () => {
              setSaving(true);
              try {
                const response = await fetch(
                  `/api/homepage-sections/${managingTrendingSettings.id}`,
                  {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ settings: trendingSettings }),
                  },
                );
                if (response.ok) {
                  await fetchSections();
                  setManagingTrendingSettings(null);
                }
              } catch (err) {
                console.error("Error saving trending settings:", err);
              } finally {
                setSaving(false);
              }
            }}
            onClose={() => setManagingTrendingSettings(null)}
            saving={saving}
          />
        )}
      </div>
    </div>
  );
}

// Section Create/Edit Modal
function SectionModal({
  title,
  initialData,
  onSubmit,
  onClose,
  saving,
}: {
  title: string;
  initialData?: { name: string; slug: string; type: string; subtitle: string };
  onSubmit: (data: {
    name: string;
    slug: string;
    type: string;
    subtitle?: string;
  }) => void;
  onClose: () => void;
  saving: boolean;
}) {
  const [name, setName] = useState(initialData?.name || "");
  const [slug, setSlug] = useState(initialData?.slug || "");
  const [type, setType] = useState(initialData?.type || "PRODUCT_GRID");
  const [subtitle, setSubtitle] = useState(initialData?.subtitle || "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !slug.trim()) return;
    onSubmit({
      name: name.trim(),
      slug: slug.trim().toLowerCase().replace(/\s+/g, "-"),
      type,
      subtitle: subtitle.trim() || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
      <Card variant="elevated" className="w-full max-w-none sm:max-w-lg max-h-[100dvh] sm:max-h-none sm:h-auto sm:rounded-2xl flex flex-col">
        <CardContent className="p-4 sm:p-6 flex flex-col flex-1 min-h-0">
          <h2 className="text-lg sm:text-xl font-bold text-deep-navy mb-4 sm:mb-6">{title}</h2>
          <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
            <div>
              <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">
                Section Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!initialData) {
                    setSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"));
                  }
                }}
                className="w-full px-4 py-3 sm:py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-royal-blue focus:border-transparent outline-none min-h-[44px]"
                placeholder="e.g. Flash Sales"
                required
              />
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">
                Slug
              </label>
              <input
                type="text"
                value={slug}
                onChange={(e) =>
                  setSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"))
                }
                className="w-full px-4 py-3 sm:py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-royal-blue focus:border-transparent outline-none min-h-[44px]"
                placeholder="e.g. flash-sales"
                required
              />
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">
                Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full px-4 py-3 sm:py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-royal-blue focus:border-transparent outline-none min-h-[44px]"
              >
                {SECTION_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">
                Subtitle (optional)
              </label>
              <input
                type="text"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                className="w-full px-4 py-3 sm:py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-royal-blue focus:border-transparent outline-none min-h-[44px]"
                placeholder="e.g. Up to 60% Off"
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button type="submit" loading={saving} className="w-full sm:w-auto min-h-[44px]">
                {initialData ? "Save Changes" : "Create Section"}
              </Button>
              <Button type="button" variant="outline" onClick={onClose} className="w-full sm:w-auto min-h-[44px]">
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

// Manage Section Modal (assign products/vendors/brands)
function ManageSectionModal({
  section,
  products,
  vendors,
  brands,
  assignedProducts,
  assignedBrands,
  selectedProducts,
  selectedVendors,
  selectedBrands,
  searchQuery,
  productPage,
  productTotalPages,
  onSearchChange,
  onPageChange,
  onProductToggle,
  onVendorToggle,
  onBrandToggle,
  onAssignProducts,
  onAssignVendors,
  onAssignBrands,
  onRemoveProduct,
  onRemoveBrand,
  onBulkRemove,
  onReorderProducts,
  onClose,
  saving,
}: {
  section: HomepageSection;
  products: Product[];
  vendors: Vendor[];
  brands: Brand[];
  assignedProducts: HomepageSectionProduct[];
  assignedBrands: HomepageSectionBrand[];
  selectedProducts: Set<string>;
  selectedVendors: Set<string>;
  selectedBrands: Set<string>;
  searchQuery: string;
  productPage: number;
  productTotalPages: number;
  onSearchChange: (q: string) => void;
  onPageChange: (page: number) => void;
  onProductToggle: (id: string) => void;
  onVendorToggle: (id: string) => void;
  onBrandToggle: (id: string) => void;
  onAssignProducts: () => void;
  onAssignVendors: () => void;
  onAssignBrands: () => void;
  onRemoveProduct: (sectionId: string, productId: string) => void;
  onRemoveBrand: (sectionId: string, brandId: string) => void;
  onBulkRemove: (productIds: string[]) => void;
  onReorderProducts: (
    orders: { productId: string; displayOrder: number }[],
  ) => void;
  onClose: () => void;
  saving: boolean;
}) {
  const [activeTab, setActiveTab] = useState<
    "assigned" | "products" | "vendors" | "brands"
  >("assigned");
  const [selectedAssigned, setSelectedAssigned] = useState<Set<string>>(
    new Set(),
  );
  const [draggedProductIndex, setDraggedProductIndex] = useState<number | null>(
    null,
  );

  const sortedAssignedProducts = [...assignedProducts].sort(
    (a, b) => a.displayOrder - b.displayOrder,
  );
  const sortedAssignedBrands = [...assignedBrands].sort(
    (a, b) => a.brand.displayOrder - b.brand.displayOrder,
  );

  const handleAssignedDragEnd = () => {
    if (draggedProductIndex === null) return;
    const orders = sortedAssignedProducts.map((item, index) => ({
      productId: item.productId,
      displayOrder: index,
    }));
    onReorderProducts(orders);
    setDraggedProductIndex(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
       <Card
         variant="elevated"
         className="w-full max-w-none sm:max-w-4xl h-[100dvh] sm:max-h-[90vh] sm:h-auto sm:rounded-2xl flex flex-col"
       >
         <CardContent className="p-4 sm:p-6 flex flex-col flex-1 min-h-0">
           <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4 sm:mb-6">
             <div className="flex-1">
               <h2 className="text-lg sm:text-xl font-bold text-deep-navy">
                 Manage: {section.name}
               </h2>
               <p className="text-xs sm:text-sm text-slate-500 mt-1">
                 Search products, bulk add/remove, and drag to reorder
               </p>
             </div>
             <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
               {activeTab === "products" && (
                 <Button
                   onClick={onAssignProducts}
                   loading={saving}
                   disabled={selectedProducts.size === 0}
                   size="sm"
                   className="w-full sm:w-auto min-h-[44px]"
                 >
                   Assign {selectedProducts.size} Product
                   {selectedProducts.size !== 1 ? "s" : ""}
                 </Button>
               )}
               {activeTab === "vendors" && (
                 <Button
                   onClick={onAssignVendors}
                   loading={saving}
                   disabled={selectedVendors.size === 0}
                   size="sm"
                   className="w-full sm:w-auto min-h-[44px]"
                 >
                   Assign {selectedVendors.size} Vendor
                   {selectedVendors.size !== 1 ? "s" : ""}
                 </Button>
               )}
               {activeTab === "brands" && (
                 <Button
                   onClick={onAssignBrands}
                   loading={saving}
                   disabled={selectedBrands.size === 0}
                   size="sm"
                   className="w-full sm:w-auto min-h-[44px]"
                 >
                   Assign {selectedBrands.size} Brand
                   {selectedBrands.size !== 1 ? "s" : ""}
                 </Button>
               )}
             </div>
             <button
               onClick={onClose}
               className="ml-0 sm:ml-4 text-slate-400 hover:text-slate-600 min-w-[44px] min-h-[44px] flex items-center justify-center"
               aria-label="Close modal"
             >
               <svg
                 className="w-6 h-6"
                 fill="none"
                 stroke="currentColor"
                 viewBox="0 0 24 24"
               >
                 <path
                   strokeLinecap="round"
                   strokeLinejoin="round"
                   strokeWidth={2}
                   d="M6 18L18 6M6 6l12 12"
                 />
               </svg>
             </button>
           </div>

           <div className="flex gap-2 mb-4 border-b border-slate-200 pb-3 overflow-x-auto flex-nowrap">
             {(["assigned", "products", "vendors", "brands"] as const).map(
               (tab) => (
                 <button
                   key={tab}
                   onClick={() => setActiveTab(tab)}
                   className={`px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap min-h-[44px] ${
                     activeTab === tab
                       ? "bg-royal-blue text-white"
                       : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                   }`}
                 >
                   {tab === "assigned" &&
                     `Assigned (${sortedAssignedProducts.length})`}
                   {tab === "products" &&
                     `Add Products (${selectedProducts.size})`}
                   {tab === "vendors" && `Vendors (${selectedVendors.size})`}
                   {tab === "brands" && `Brands (${selectedBrands.size})`}
                 </button>
               ),
             )}
           </div>

{(activeTab === "products" ||
                activeTab === "vendors" ||
                activeTab === "brands") && (
                <div className="mb-4">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => onSearchChange(e.target.value)}
                    placeholder={`Search ${activeTab}...`}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-royal-blue outline-none min-h-[44px]"
                  />
                </div>
              )}

            <div className="flex-1 overflow-y-auto min-h-0">
              {activeTab === "assigned" && (
                <>
                  {sortedAssignedProducts.length === 0 ? (
                    <p className="text-sm text-slate-500 text-center py-8">
                      No products assigned yet. Use Add Products tab.
                    </p>
                  ) : (
                    <div className="mb-4">
                      <p className="text-font-medium text-slate-600 mb-2">
                        Assigned Products ({sortedAssignedProducts.length})
                      </p>
                      <div className="space-y-2">
                        {sortedAssignedProducts.map((item, index) => (
                          <div
                            key={item.id}
                            draggable
                            onDragStart={() => setDraggedProductIndex(index)}
                            onDragOver={(e) => e.preventDefault()}
                            onDragEnd={handleAssignedDragEnd}
                            className={`flex items-center gap-3 p-3 sm:p-4 rounded-xl border border-slate-200 bg-white min-h-[60px] ${
                              draggedProductIndex === index ? "opacity-50" : ""
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={selectedAssigned.has(item.productId)}
                              onChange={() => {
                                setSelectedAssigned((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(item.productId))
                                    next.delete(item.productId);
                                  else next.add(item.productId);
                                  return next;
                                });
                              }}
                              className="min-w-[20px] min-h-[20px]"
                            />
                            <div className="text-slate-400 cursor-grab min-w-[24px] min-h-[44px] flex items-center justify-center">⋮⋮</div>
{item.product.images?.[0] && (
                               <Image
                                 src={item.product.images[0].url}
                                 alt=""
                                 width={400}
                                 height={400}
                                 className="w-10 h-10 rounded-lg object-cover"
                               />
                             )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">
                                {item.product.name}
                              </p>
                              <p className="text-xs text-slate-500 truncate">
                                {item.product.store?.name}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="min-h-[44px]"
                              onClick={() =>
                                onRemoveProduct(section.id, item.productId)
                              }
                            >
                              Remove
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {sortedAssignedBrands.length > 0 && (
                    <div className="mb-4">
                      <p className="text-font-medium text-slate-600 mb-2">
                        Assigned Brands ({sortedAssignedBrands.length})
                      </p>
                      <div className="space-y-3">
                        {sortedAssignedBrands.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center gap-3 p-4 rounded-xl border border-slate-200 bg-white min-h-[60px]"
                          >
{item.brand.logo ? (
                               <Image
                                 src={item.brand.logo}
                                 alt={item.brand.name}
                                 width={400}
                                 height={400}
                                 className="w-10 h-10 rounded-lg object-cover"
                               />
                             ) : (
                              <div className="w-10 h-10 flex items-center justify-center bg-slate-200 rounded-full">
                                <span className="text-xs font-medium">
                                  {item.brand.name?.charAt(0) || "B"}
                                </span>
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">
                                {item.brand.name}
                              </p>
                              <p className="text-xs text-slate-500">
                                {item.brand._count?.products || 0} products
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="min-h-[44px]"
                              onClick={() =>
                                onRemoveBrand(section.id, item.brandId)
                              }
                            >
                              Remove
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
{activeTab === "products" && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {products.map((product) => (
                    <div
                      key={product.id}
                      onClick={() => onProductToggle(product.id)}
                      className={`relative cursor-pointer rounded-xl border-2 transition-all min-h-[44px] ${
                        selectedProducts.has(product.id)
                          ? "border-royal-blue bg-royal-blue/5"
                          : "border-slate-200"
                      }`}
                    >
                      <div className="p-2 flex flex-col h-full">
                        <p className="text-xs font-medium line-clamp-2 flex-1">
                          {product.name}
                        </p>
                        <p className="text-[10px] text-royal-blue font-bold mt-1">
                           {getCurrencySymbol(currency || 'GHS')} {product.price.toFixed(2)}
                        </p>
                        {product.store && (
                          <p className="text-[10px] text-slate-400 truncate mt-1">
                            {product.store.name}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
{activeTab === "vendors" && (
                <div className="space-y-3">
                  {vendors.filter((v) =>
                      (v.user?.email ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                      (v.name ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                      (v.storeName ?? '').toLowerCase().includes(searchQuery.toLowerCase()),
                    ).map((vendor: Vendor) => (
                      <div
                        key={vendor.id}
                        onClick={() => onVendorToggle(vendor.id)}
                        className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer min-h-[60px] ${
                          selectedVendors.has(vendor.id)
                            ? "border-royal-blue bg-royal-blue/5"
                            : "border-slate-200"
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {vendor.storeName ?? vendor.name ?? 'Unnamed Store'}
                          </p>
                          <p className="text-xs text-slate-500 truncate">
                            {vendor.user?.email || vendor.email}
                          </p>
                          {vendor.mobileNumber && (
                            <p className="text-xs text-slate-500 truncate">
                              {vendor.mobileNumber}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            {activeTab === "brands" && (
              <div className="space-y-3">
                {brands.map((brand) => (
                  <div
                    key={brand.id}
                    onClick={() => onBrandToggle(brand.id)}
                    className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer min-h-[60px] ${
                      selectedBrands.has(brand.id)
                        ? "border-royal-blue bg-royal-blue/5"
                        : "border-slate-200"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {brand.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {brand._count?.products || 0} products
                      </p>
                    </div>
{brand.logo ? (
                       <Image
                         src={brand.logo}
                         alt={brand.name}
                         width={400}
                         height={400}
                         className="w-10 h-10 rounded-lg object-cover"
                       />
                     ) : (
                      <div className="w-10 h-10 flex items-center justify-center bg-slate-200 rounded-full">
                        <span className="text-xs font-medium">
                          {brand.name?.charAt(0) || "B"}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            </div>

            <div className="sticky bottom-0 bg-white pt-4 mt-4 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 z-10 pb-safe">
              {activeTab === "products" && (
                <div className="flex gap-2 items-center justify-center sm:justify-start">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={productPage <= 1}
                    onClick={() => onPageChange(productPage - 1)}
                    className="min-h-[44px]"
                  >
                    Prev
                  </Button>
                  <span className="text-sm text-slate-500">
                    Page {productPage} / {productTotalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={productPage >= productTotalPages}
                    onClick={() => onPageChange(productPage + 1)}
                    className="min-h-[44px]"
                  >
                    Next
                  </Button>
                </div>
              )}
              {activeTab === "assigned" && selectedAssigned.size > 0 && (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => {
                    onBulkRemove(Array.from(selectedAssigned));
                    setSelectedAssigned(new Set());
                  }}
                  className="w-full sm:w-auto min-h-[44px]"
                >
                  Remove {selectedAssigned.size} selected
                </Button>
              )}
              <Button variant="outline" onClick={onClose} className="w-full sm:w-auto min-h-[44px]">
                Close
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

// Trending Settings Modal
function TrendingSettingsModal({
  section,
  settings,
  onSettingsChange,
  onSave,
  onClose,
  saving,
}: {
  section: HomepageSection;
  settings: {
    mode: 'MANUAL' | 'AUTOMATIC';
    maxProducts: number;
    weights: {
      recentSales: number;
      productViews: number;
      wishlistAdds: number;
      cartAdds: number;
      recentReviews: number;
      averageRating: number;
    };
    timeWindow: '24H' | '7D' | '30D';
    excludeOutOfStock: boolean;
    excludeHiddenProducts: boolean;
    excludeArchivedProducts: boolean;
  };
  onSettingsChange: (newSettings: typeof settings) => void;
  onSave: () => void;
  onClose: () => void;
  saving: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
      <Card variant="elevated" className="w-full max-w-none sm:max-w-lg max-h-[100dvh] sm:max-h-none sm:h-auto sm:rounded-2xl flex flex-col">
        <CardContent className="p-4 sm:p-6 flex flex-col flex-1 min-h-0">
          <h2 className="text-lg sm:text-xl font-bold text-deep-navy mb-4 sm:mb-6">
            Trending Settings
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">
                Mode
              </label>
              <select
                value={settings.mode}
                onChange={(e) => onSettingsChange({ ...settings, mode: e.target.value as 'MANUAL' | 'AUTOMATIC' })}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-royal-blue outline-none min-h-[44px]"
              >
                <option value="MANUAL">Manual - Select products manually</option>
                <option value="AUTOMATIC">Automatic - Algorithm selects products</option>
              </select>
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">
                Max Products to Display
              </label>
              <input
                type="number"
                value={settings.maxProducts}
                onChange={(e) => onSettingsChange({ ...settings, maxProducts: parseInt(e.target.value) || 20 })}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-royal-blue outline-none min-h-[44px]"
                min="1"
                max="100"
              />
            </div>
            {settings.mode === 'AUTOMATIC' && (
              <>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">
                    Time Window
                  </label>
                  <select
                    value={settings.timeWindow}
                    onChange={(e) => onSettingsChange({ ...settings, timeWindow: e.target.value as '24H' | '7D' | '30D' })}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-royal-blue outline-none min-h-[44px]"
                  >
                    <option value="24H">Last 24 Hours</option>
                    <option value="7D">Last 7 Days</option>
                    <option value="30D">Last 30 Days</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <p className="text-xs sm:text-sm font-medium text-slate-700">Algorithm Weights</p>
                  {Object.entries(settings.weights).map(([key, value]) => (
                    <div key={key}>
                      <label className="block text-[10px] sm:text-xs text-slate-600 mb-1 capitalize">
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                      </label>
                      <input
                        type="range"
                        value={value}
                        onChange={(e) => onSettingsChange({
                          ...settings,
                          weights: { ...settings.weights, [key]: parseInt(e.target.value) }
                        })}
                        className="w-full"
                        min="0"
                        max="100"
                      />
                      <span className="text-[10px] text-slate-500">{value}%</span>
                    </div>
                  ))}
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-medium text-slate-700 mb-2">Filters</p>
                  <label className="flex items-center gap-2 mb-2">
                    <input
                      type="checkbox"
                      checked={settings.excludeOutOfStock}
                      onChange={(e) => onSettingsChange({ ...settings, excludeOutOfStock: e.target.checked })}
                    />
                    <span className="text-xs">Exclude out of stock products</span>
                  </label>
                  <label className="flex items-center gap-2 mb-2">
                    <input
                      type="checkbox"
                      checked={settings.excludeHiddenProducts}
                      onChange={(e) => onSettingsChange({ ...settings, excludeHiddenProducts: e.target.checked })}
                    />
                    <span className="text-xs">Exclude hidden products</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={settings.excludeArchivedProducts}
                      onChange={(e) => onSettingsChange({ ...settings, excludeArchivedProducts: e.target.checked })}
                    />
                    <span className="text-xs">Exclude archived products</span>
                  </label>
                </div>
              </>
            )}
          </div>
          <div className="flex flex-col sm:flex-row gap-3 pt-4 mt-auto">
            <Button onClick={onSave} loading={saving} className="w-full sm:w-auto min-h-[44px]">
              Save Settings
            </Button>
            <Button type="button" variant="outline" onClick={onClose} className="w-full sm:w-auto min-h-[44px]">
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


