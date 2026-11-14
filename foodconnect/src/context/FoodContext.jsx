import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  INITIAL_SURPLUS,
  INITIAL_PICKUPS,
  ACTIVITY_LOG,
  DISTRIBUTION_CENTERS,
  CANTEENS,
  VOLUNTEERS,
  ANALYTICS,
} from '../data/mockData';
import { rankCenters } from '../utils/matchingAlgorithm';

const FoodContext = createContext(null);
const STORAGE_KEY = 'cfc_surplus';
const DRAFT_KEY = 'cfc_drafts';

export function FoodProvider({ children }) {
  const [surplus, setSurplus] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : INITIAL_SURPLUS;
    } catch {
      return INITIAL_SURPLUS;
    }
  });

  const [pickups, setPickups] = useState(INITIAL_PICKUPS);
  const [activity, setActivity] = useState(ACTIVITY_LOG);
  const [drafts, setDrafts] = useState(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [centers] = useState(DISTRIBUTION_CENTERS);
  const [canteens] = useState(CANTEENS);
  const [volunteers] = useState(VOLUNTEERS);
  const [analytics] = useState(ANALYTICS);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(surplus));
  }, [surplus]);

  useEffect(() => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(drafts));
  }, [drafts]);

  const addSurplus = useCallback((item) => {
    const newItem = {
      ...item,
      id: `s_${Date.now()}`,
      safetyStatus: 'pending',
      matchingStatus: 'available',
      matchedCenterId: null,
      matchedCenterName: null,
      status: 'available',
      createdAt: new Date().toISOString(),
    };
    setSurplus((prev) => [newItem, ...prev]);
    setActivity((prev) => [
      {
        id: `a_${Date.now()}`,
        type: 'listing',
        message: `${item.foodName} (${item.quantityKg} kg) listed by ${item.canteenName}`,
        time: 'Just now',
      },
      ...prev,
    ]);
    return newItem;
  }, []);

  const saveDraft = useCallback((draft) => {
    const d = { ...draft, id: draft.id || `draft_${Date.now()}`, savedAt: new Date().toISOString() };
    setDrafts((prev) => {
      const exists = prev.findIndex((x) => x.id === d.id);
      if (exists >= 0) {
        const next = [...prev];
        next[exists] = d;
        return next;
      }
      return [d, ...prev];
    });
    return d;
  }, []);

  const removeDraft = useCallback((id) => {
    setDrafts((prev) => prev.filter((d) => d.id !== id));
  }, []);

  const updateSurplusStatus = useCallback((id, updates) => {
    setSurplus((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...updates } : s))
    );
  }, []);

  const runMatching = useCallback(
    (surplusId) => {
      const item = surplus.find((s) => s.id === surplusId);
      if (!item) return null;
      const result = rankCenters(item, centers);
      return result;
    },
    [surplus, centers]
  );

  const acceptMatch = useCallback(
    (surplusId, center) => {
      updateSurplusStatus(surplusId, {
        matchingStatus: 'matched',
        matchedCenterId: center.id,
        matchedCenterName: center.name,
        status: 'matched',
      });
      const item = surplus.find((s) => s.id === surplusId);
      const pickup = {
        id: `p_${Date.now()}`,
        surplusId,
        foodName: item?.foodName ?? '',
        quantityKg: item?.quantityKg ?? 0,
        canteenName: item?.canteenName ?? '',
        canteenLocation: item?.location ?? '',
        centerName: center.name,
        centerAddress: center.address,
        volunteerId: null,
        volunteerName: null,
        travelTimeMin: center.travelTimeMin,
        pickupDeadline: item?.pickupDeadline ?? '',
        status: 'assigned',
        otp: String(Math.floor(1000 + Math.random() * 9000)),
        createdAt: new Date().toISOString(),
      };
      setPickups((prev) => [pickup, ...prev]);
      setActivity((prev) => [
        {
          id: `a_${Date.now()}`,
          type: 'match',
          message: `${center.name} accepted ${item?.foodName}`,
          time: 'Just now',
        },
        ...prev,
      ]);
      return pickup;
    },
    [surplus, updateSurplusStatus]
  );

  const rejectMatch = useCallback(
    (surplusId, centerId) => {
      setActivity((prev) => [
        {
          id: `a_${Date.now()}`,
          type: 'match',
          message: `Match rejected for surplus ${surplusId}`,
          time: 'Just now',
        },
        ...prev,
      ]);
      // Keep available for fallback matching
      updateSurplusStatus(surplusId, {
        matchingStatus: 'available',
        matchedCenterId: null,
        matchedCenterName: null,
        status: 'available',
      });
    },
    [updateSurplusStatus]
  );

  const updatePickupStatus = useCallback((pickupId, status) => {
    setPickups((prev) =>
      prev.map((p) => (p.id === pickupId ? { ...p, status } : p))
    );
    if (status === 'delivered') {
      const p = pickups.find((x) => x.id === pickupId);
      if (p) {
        updateSurplusStatus(p.surplusId, {
          matchingStatus: 'delivered',
          status: 'delivered',
        });
        setActivity((prev) => [
          {
            id: `a_${Date.now()}`,
            type: 'delivery',
            message: `${p.foodName} delivered to ${p.centerName}`,
            time: 'Just now',
          },
          ...prev,
        ]);
      }
    }
  }, [pickups, updateSurplusStatus]);

  const stats = {
    totalSurplusToday: surplus
      .filter((s) => s.preparationDate === new Date().toISOString().slice(0, 10))
      .reduce((sum, s) => sum + Number(s.quantityKg), 0),
    redistributed: surplus
      .filter((s) => ['matched', 'pending_collection', 'delivered'].includes(s.status))
      .reduce((sum, s) => sum + Number(s.quantityKg), 0),
    pendingRequests: surplus.filter((s) => s.status === 'available').length,
    wasteAvoided: surplus
      .filter((s) => s.status === 'delivered')
      .reduce((sum, s) => sum + Number(s.quantityKg), 0),
  };

  return (
    <FoodContext.Provider
      value={{
        surplus,
        pickups,
        activity,
        drafts,
        centers,
        canteens,
        volunteers,
        analytics,
        stats,
        addSurplus,
        saveDraft,
        removeDraft,
        updateSurplusStatus,
        runMatching,
        acceptMatch,
        rejectMatch,
        updatePickupStatus,
      }}
    >
      {children}
    </FoodContext.Provider>
  );
}

export function useFood() {
  const ctx = useContext(FoodContext);
  if (!ctx) throw new Error('useFood must be used within FoodProvider');
  return ctx;
}
