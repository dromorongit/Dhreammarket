'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface Category {
  id: string
  name: string
  slug?: string
  parentId: string | null
  children?: Category[]
}

interface SearchableCategorySelectorProps {
  categories: Category[]
  selectedCategoryIds: string[]
  onChange: (categoryIds: string[]) => void
  maxCategories?: number
  placeholder?: string
}

export function SearchableCategorySelector({
  categories,
  selectedCategoryIds,
  onChange,
  maxCategories = 3,
  placeholder = "Search product categories...",
}: SearchableCategorySelectorProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  // Flatten all categories (including children) for searching
  const allCategories: Category[] = (categories || []).reduce((acc: Category[], cat) => {
    acc.push(cat)
    if (cat.children && cat.children.length > 0) {
      acc.push(...flattenChildren(cat.children))
    }
    return acc
  }, [])

  function flattenChildren(children: Category[]): Category[] {
    return children.reduce((acc: Category[], child) => {
      acc.push(child)
      if (child.children && child.children.length > 0) {
        acc.push(...flattenChildren(child.children))
      }
      return acc
    }, [])
  }

  // Get category by ID
  const getCategoryById = useCallback((id: string): Category | undefined => {
    return allCategories.find(cat => cat.id === id)
  }, [allCategories])

  // Get selected categories
  const selectedCategories = (selectedCategoryIds || [])
    .map(id => getCategoryById(id))
    .filter((cat): cat is Category => cat !== undefined)

  // Filter categories based on search query (case-insensitive, partial match)
  const filteredCategories = (allCategories || []).filter(cat => {
    if (!searchQuery.trim()) return true
    const query = searchQuery.toLowerCase()
    return cat.name.toLowerCase().includes(query) || 
           (cat.slug && cat.slug.toLowerCase().includes(query))
  })

  // Remove category from selection
  const removeCategory = (categoryId: string) => {
    const newSelection = (selectedCategoryIds || []).filter(id => id !== categoryId)
    onChange(newSelection)
  }

  // Add category to selection
  const addCategory = (category: Category) => {
    const currentSelection = selectedCategoryIds || []
    
    // Prevent duplicates
    if (currentSelection.includes(category.id)) {
      return
    }
    
    // Check max limit
    if (currentSelection.length >= maxCategories) {
      return
    }
    
    onChange([...currentSelection, category.id])
    setSearchQuery('')
    setIsOpen(false)
    inputRef.current?.blur()
  }

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    if (searchQuery.trim()) {
      debounceRef.current = setTimeout(() => {
        setIsOpen(true)
      }, 150)
    } else {
      setIsOpen(false)
    }

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [searchQuery])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || filteredCategories.length === 0) {
      if (e.key === 'Enter' && searchQuery.trim()) {
        setIsOpen(true)
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setActiveIndex((prev) => (prev < filteredCategories.length - 1 ? prev + 1 : 0))
        break
      case 'ArrowUp':
        e.preventDefault()
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : filteredCategories.length - 1))
        break
      case 'Enter':
        e.preventDefault()
        if (activeIndex >= 0 && filteredCategories[activeIndex]) {
          addCategory(filteredCategories[activeIndex])
        }
        break
      case 'Escape':
        setIsOpen(false)
        setActiveIndex(-1)
        inputRef.current?.blur()
        break
    }
  }

  // Check if at max categories
  const isAtMaxCategories = (selectedCategoryIds || []).length >= maxCategories

  return (
    <div className="relative w-full" ref={dropdownRef}>
      {/* Selected Categories as Chips */}
      {selectedCategories.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {selectedCategories.map((cat) => (
            <div
              key={cat.id}
              className="rounded-full px-3 py-1 text-sm flex items-center gap-2 bg-blue-100 text-blue-800"
            >
              <span>{cat.name}</span>
              <button
                type="button"
                onClick={() => removeCategory(cat.id)}
                className="hover:bg-blue-200 rounded-full p-0.5 transition-colors"
                aria-label={`Remove ${cat.name}`}
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Warning when at max categories */}
      {isAtMaxCategories && (
        <p className="text-amber-600 text-xs mb-2">
          Maximum of {maxCategories} categories reached. Remove a category to select a different one.
        </p>
      )}

      {/* Search Input */}
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 transition-colors pointer-events-none"
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

        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => searchQuery.trim() && setIsOpen(true)}
          placeholder={isAtMaxCategories ? `Max ${maxCategories} categories selected` : placeholder}
          disabled={isAtMaxCategories}
          className="w-full h-10 pl-10 pr-10 rounded-md border border-gray-300 bg-white text-base md:text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
          aria-label="Search categories"
          aria-autocomplete="list"
        />

        {/* Clear button */}
        {searchQuery && (
          <button
            type="button"
            onClick={() => {
              setSearchQuery('')
              setIsOpen(false)
              inputRef.current?.focus()
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
            aria-label="Clear search"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div
          role="listbox"
          className="absolute top-full left-0 right-0 mt-1 bg-white rounded-md shadow-lg border border-gray-200 overflow-hidden z-50 max-h-60 overflow-y-auto"
        >
          {filteredCategories.length === 0 ? (
            <div className="px-4 py-3 text-sm text-gray-500 text-center">
              No categories found
            </div>
          ) : (
            <div className="py-1">
              {filteredCategories.map((cat, index) => {
                const isSelected = (selectedCategoryIds || []).includes(cat.id)
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => addCategory(cat)}
                    disabled={isSelected}
                    className={`w-full px-4 py-2 text-left text-sm transition-colors flex items-center justify-between ${
                      index === activeIndex ? 'bg-blue-50' : 'hover:bg-gray-50'
                    } ${isSelected ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    role="option"
                    aria-selected={isSelected}
                  >
                    <span className="text-gray-800">{cat.name}</span>
                    {isSelected && (
                      <span className="text-xs text-gray-500">Selected</span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}