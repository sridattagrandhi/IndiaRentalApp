// context/ListingsContext.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

// ---------------------------
// Types
// ---------------------------
export type ListingStatus = 'draft' | 'review' | 'live' | 'paused';
export type DayStatus = 'available' | 'booked' | 'blocked';

export type CalendarCell = {
  status: DayStatus;
  price?: number;
  bookingId?: string;   // set when status === 'booked'
  guestName?: string;   // convenience for grid (booked)
};

export type Booking = {
  id: string;
  listingId: string;
  start: string;   // ISO date (inclusive)
  end: string;     // ISO date (inclusive)
  guestName: string;
};

export type Listing = {
  id: string;
  title: string;
  location: string;         // e.g., "Bengaluru, Karnataka"
  image: string;            // local picker URI or remote URL
  status: ListingStatus;
  pricePerNight: number;
  rating: number;
  reviewCount: number;

  address?: string;
  amenities?: string[];

  // Building-based grouping
  buildingKey?: string;     // normalized "street|city|state|pincode"
  buildingLabel?: string;   // pretty to show in UI, e.g., "Sunrise Apartments"
  unitName?: string;        // e.g., "A-203"

  calendar?: Record<string, CalendarCell>; // "YYYY-MM-DD" -> cell
  bookings?: Booking[];

  coords?: { latitude: number; longitude: number };
  images?: string[];       // ← all photos
  rules?: string[];        // ← house rules
  prohibited?: string[];   // ← things not allowed
  maxGuests?: number;
};

type Ctx = {
  listings: Listing[];

  addListing: (l: Listing) => void;
  /** Old name kept for backward-compat */
  removeListing: (id: string) => void;
  /** New, clearer name used by screens */
  deleteListing: (id: string) => void;

  updateListing: (id: string, patch: Partial<Listing>) => void;
  replaceAll: (rows: Listing[]) => void;

  blockDates: (listingId: string, isoDates: string[]) => void;
  unblockDates: (listingId: string, isoDates: string[]) => void;
  upsertBooking: (listingId: string, booking: Omit<Booking, 'id' | 'listingId'> & { id?: string }) => string;
  removeBooking: (listingId: string, bookingId: string) => void;
};

// ---------------------------
// Context
// ---------------------------
const STORAGE_KEY = 'host:listings';
const ListingsCtx = createContext<Ctx | null>(null);

export function ListingsProvider({ children }: { children: React.ReactNode }) {
  const [listings, setListings] = useState<Listing[]>([]);

  // Load once
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as Listing[];
          if (Array.isArray(parsed)) setListings(parsed);
        }
      } catch {
        setListings([]);
      }
    })();
  }, []);

  // Persist on change
  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(listings)).catch(() => {});
  }, [listings]);

  // --- CRUD (top-level) ---
  const addListing = (l: Listing) =>
    setListings(prev => [
      {
        calendar: {},
        bookings: [],
        ...l,
      },
      ...prev,
    ]);

  const removeListing = (id: string) =>
    setListings(prev => prev.filter(x => x.id !== id));

  // Alias for clarity in UI code
  const deleteListing = (id: string) => removeListing(id);

  const updateListing = (id: string, patch: Partial<Listing>) =>
    setListings(prev => prev.map(x => (x.id === id ? { ...x, ...patch } : x)));

  const replaceAll = (rows: Listing[]) => setListings(rows);

  // --- Helpers USED by value (must be before useMemo) ---
  const mutateListing = (id: string, mut: (l: Listing) => Listing) =>
    setListings(prev => prev.map(x => (x.id === id ? mut({ ...x }) : x)));

  const ensureMaps = (l: Listing) => {
    if (!l.calendar) l.calendar = {};
    if (!l.bookings) l.bookings = [];
    return l;
  };

  const blockDates: Ctx['blockDates'] = (listingId, isoDates) => {
    mutateListing(listingId, (l) => {
      l = ensureMaps(l);
      isoDates.forEach(d => {
        const c = l.calendar![d] || { status: 'available' as DayStatus };
        if (c.status !== 'booked') {
          l.calendar![d] = { ...c, status: 'blocked' };
        }
      });
      return l;
    });
  };

  const unblockDates: Ctx['unblockDates'] = (listingId, isoDates) => {
    mutateListing(listingId, (l) => {
      l = ensureMaps(l);
      isoDates.forEach(d => {
        const c = l.calendar![d];
        if (c?.status === 'blocked') {
          l.calendar![d] = { status: 'available' };
        }
      });
      return l;
    });
  };

  const eachDate = (startISO: string, endISO: string) => {
    const acc: string[] = [];
    const d = new Date(startISO); d.setHours(0,0,0,0);
    const end = new Date(endISO); end.setHours(0,0,0,0);
    while (d.getTime() <= end.getTime()) {
      acc.push(d.toISOString().slice(0,10));
      d.setDate(d.getDate() + 1);
    }
    return acc;
  };

  const upsertBooking: Ctx['upsertBooking'] = (listingId, b) => {
    const bookingId = b.id ?? (Date.now().toString(36) + Math.random().toString(36).slice(2,6));
    mutateListing(listingId, (l) => {
      l = ensureMaps(l);
      const clean = { id: bookingId, listingId, start: b.start, end: b.end, guestName: b.guestName };
      l.bookings = [...(l.bookings ?? []).filter(x => x.id !== bookingId), clean];

      eachDate(clean.start, clean.end).forEach(iso => {
        l.calendar![iso] = {
          ...(l.calendar![iso] || {}),
          status: 'booked',
          bookingId,
          guestName: clean.guestName,
        };
      });
      return l;
    });
    return bookingId;
  };

  const removeBooking: Ctx['removeBooking'] = (listingId, bookingId) => {
    mutateListing(listingId, (l) => {
      l = ensureMaps(l);
      const b = l.bookings!.find(x => x.id === bookingId);
      if (!b) return l;
      eachDate(b.start, b.end).forEach(iso => {
        if (l.calendar![iso]?.bookingId === bookingId) {
          l.calendar![iso] = { status: 'available' };
        }
      });
      l.bookings = l.bookings!.filter(x => x.id !== bookingId);
      return l;
    });
  };

  // --- Value (now safe) ---
  const value = useMemo<Ctx>(
    () => ({
      listings,
      addListing,
      removeListing,
      deleteListing,   // ← NEW
      updateListing,
      replaceAll,
      blockDates,
      unblockDates,
      upsertBooking,
      removeBooking,
    }),
    [listings]
  );

  return <ListingsCtx.Provider value={value}>{children}</ListingsCtx.Provider>;
}

export const useListings = () => {
  const ctx = useContext(ListingsCtx);
  if (!ctx) throw new Error('useListings must be used within ListingsProvider');
  return ctx;
};

// ---------------------------
// Building helpers
// ---------------------------
const normalize = (s: string) => (s || '').trim().toLowerCase();

/** Build a stable key from address parts (street+city+state+pincode). */
export function computeBuildingKey(address?: string, city?: string, state?: string, pincode?: string) {
  const parts = [address, city, state, pincode].map(x => normalize(x || ''));
  return parts.join('|').replace(/\s+/g, ' ').trim();
}

// ---------------------------
// Building grouping selector
// ---------------------------
export type BuildingGroup = {
  key: string;
  buildingLabel: string;
  location: string;
  units: Listing[];
};

export function useBuildingGroups(): BuildingGroup[] {
  const { listings } = useListings();

  return React.useMemo(() => {
    const map = new Map<string, BuildingGroup>();

    for (const l of listings) {
      const key = l.buildingKey ? normalize(l.buildingKey) : `__single__:${l.id}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          buildingLabel: l.buildingLabel || l.location,
          location: l.location,
          units: [],
        });
      }
      map.get(key)!.units.push(l);
    }

    const groups = Array.from(map.values());

    groups.forEach(g => {
      g.units.sort((a, b) => {
        const an = (a.unitName || '').toLowerCase();
        const bn = (b.unitName || '').toLowerCase();
        if (an !== bn) return an.localeCompare(bn, 'en');
        return (b.id || '').localeCompare(a.id || '');
      });
    });

    groups.sort((A, B) => {
      const aTop = A.units[0]?.id || '';
      const bTop = B.units[0]?.id || '';
      return bTop.localeCompare(aTop);
    });

    return groups;
  }, [listings]);
}

/** Filter helper for UI: 'All' | 'Live' | 'Paused' | 'In Review' | 'Draft' */
export function filterByStatusLabel(rows: Listing[], label: string) {
  if (label === 'All') return rows;
  const wanted = label === 'In Review' ? 'review' : label.toLowerCase();
  return rows.filter(l => l.status.toLowerCase() === wanted);
}
