// context/ListingsContext.tsx
import React, { createContext, useContext, useMemo, useState } from 'react';

export type ListingStatus = 'live' | 'paused' | 'review' | 'draft';

export interface Listing {
  id: string;
  title: string;
  location: string;
  image: string;
  status: ListingStatus;
  pricePerNight: number;
  rating: number;
  reviewCount: number;
  lat?: number;
  lon?: number;
  /** Group multiple rooms under one property (e.g., “Sunrise Apartments”) */
  propertyGroup?: string;
  /** Optional: name/number of the room/unit (e.g., “A-203”) */
  unitName?: string;
}

type ListingsCtx = {
  listings: Listing[];
  addListing: (l: Listing) => void;
  updateListing: (id: string, patch: Partial<Listing>) => void;
  removeListing: (id: string) => void;
  clearAll: () => void;
};

const ListingsContext = createContext<ListingsCtx | undefined>(undefined);

const initialMock: Listing[] = [
  {
    id: '1',
    title: 'Modern Studio',
    location: 'Koramangala, Bangalore',
    image: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800',
    status: 'live',
    pricePerNight: 2200,
    rating: 4.8,
    reviewCount: 128,
    lat: 12.9352,
    lon: 77.6245,
    propertyGroup: 'Sunrise Apartments',
    unitName: 'A-203',
  },
  {
    id: '2',
    title: 'Beachfront Villa',
    location: 'Whitefield, Bangalore',
    image: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800',
    status: 'paused',
    pricePerNight: 5500,
    rating: 4.9,
    reviewCount: 64,
    lat: 12.9698,
    lon: 77.7499,
  },
];

export function ListingsProvider({ children }: { children: React.ReactNode }) {
  const [listings, setListings] = useState<Listing[]>(initialMock);

  const addListing = (l: Listing) => setListings((prev) => [l, ...prev]);
  const updateListing = (id: string, patch: Partial<Listing>) =>
    setListings((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const removeListing = (id: string) =>
    setListings((prev) => prev.filter((x) => x.id !== id));
  const clearAll = () => setListings([]);

  const value = useMemo(
    () => ({ listings, addListing, updateListing, removeListing, clearAll }),
    [listings]
  );

  return <ListingsContext.Provider value={value}>{children}</ListingsContext.Provider>;
}

export function useListings() {
  const ctx = useContext(ListingsContext);
  if (!ctx) throw new Error('useListings must be used within ListingsProvider');
  return ctx;
}
