import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { VAPID as LOCAL_VAPID } from './family/public_vapid';
import treeData from './family-tree.json';
import { Hero } from './components/Hero';
import { Legend } from './components/Legend';
import { TreeBoard } from './components/TreeBoard';
import { buildFilterOptions, createInitialFilterState, filterPeople, filterRelations } from './family/filtering';
import type { JsonPerson, TreeSettings } from './family/types';

const settings = treeData as unknown as TreeSettings;
const updateApiBaseUrl = 'https://riko-family-update.guigui0246.workers.dev';
const updatePageId = 'default';
const updateNotificationText = 'The page you follow has been deployed.';

type MegaPfpPriority = 'hovered' | 'pinned';

type MegaPfpCandidate = {
  personId: string;
  imageUrl: string;
  priority: MegaPfpPriority;
  sequence: number;
};

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let index = 0; index < rawData.length; index += 1) {
    outputArray[index] = rawData.charCodeAt(index);
  }

  return outputArray;
}

async function getUpdateServiceWorkerRegistration() {
  if (!('serviceWorker' in navigator)) {
    throw new Error('Service workers are not supported in this browser.');
  }

  return navigator.serviceWorker.register('/sw.js', { scope: '/' });
}

async function readJsonResponse<T>(response: Response) {
  const text = await response.text();

  if (!text.trim()) {
    return null as T | null;
  }

  return JSON.parse(text) as T;
}

export default function App() {
  const peopleById = useMemo(
    () => new Map<string, JsonPerson>(settings.people.map((person) => [person.id, person])),
    [],
  );
  const sequenceRef = useRef(0);
  const [megaPfpCandidates, setMegaPfpCandidates] = useState<Record<string, MegaPfpCandidate>>({});
  const [filters, setFilters] = useState(createInitialFilterState);
  const [updatesSubscribed, setUpdatesSubscribed] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState('Checking update subscription status...');
  const [isUpdatingSubscription, setIsUpdatingSubscription] = useState(false);
  const filterOptions = useMemo(() => buildFilterOptions(settings.people, settings.relations), []);
  const visiblePeople = useMemo(
    () => filterPeople(settings.people, settings.relations, filters),
    [filters],
  );
  const visibleRelations = useMemo(
    () => filterRelations(settings.relations, visiblePeople, filters),
    [filters, visiblePeople],
  );

  const activeMegaPfp = useMemo(() => {
    const candidates = Object.values(megaPfpCandidates);

    if (candidates.length === 0) {
      return null;
    }

    return [...candidates].sort((left, right) => {
      if (left.priority !== right.priority) {
        return left.priority === 'pinned' ? -1 : 1;
      }

      return right.sequence - left.sequence;
    })[0];
  }, [megaPfpCandidates]);

  const handleMegaPfpChange = useCallback(
    (personId: string, payload: { imageUrl: string; priority: MegaPfpPriority } | null) => {
      setMegaPfpCandidates((current) => {
        const existing = current[personId];

        if (!payload) {
          if (!existing) {
            return current;
          }

          const next = { ...current };
          delete next[personId];
          return next;
        }

        if (
          existing &&
          existing.imageUrl === payload.imageUrl &&
          existing.priority === payload.priority
        ) {
          return current;
        }

        sequenceRef.current += 1;

        return {
          ...current,
          [personId]: {
            personId,
            imageUrl: payload.imageUrl,
            priority: payload.priority,
            sequence: sequenceRef.current,
          },
        };
      });
    },
    [],
  );

  const pageStyle = useMemo(
    () => ({
      '--page-mega-pfp-bg': activeMegaPfp ? `url("${activeMegaPfp.imageUrl}")` : 'none',
      '--page-mega-pfp-opacity': activeMegaPfp ? '1' : '0',
    } as CSSProperties),
    [activeMegaPfp],
  );

  const openEditDiscordRequest = () => {
    window.open(settings.editContact.href, '_blank', 'noopener,noreferrer');
  };

  const openEditMailRequest = () => {
    window.open(`mailto:${settings.editContact.mail}`, '_blank', 'noopener,noreferrer');
  };

  const openEditGithubRequest = () => {
    window.open(settings.editContact.github, '_blank', 'noopener,noreferrer');
  };

  useEffect(() => {
    let cancelled = false;

    async function syncSubscriptionState() {
      try {
        const registration = await getUpdateServiceWorkerRegistration();
        const subscription = await registration.pushManager.getSubscription();

        if (cancelled) {
          return;
        }

        setUpdatesSubscribed(Boolean(subscription));
        setSubscriptionStatus("");
      } catch (error) {
        if (!cancelled) {
          setSubscriptionStatus(error instanceof Error ? error.message : String(error));
        }
      }
    }

    syncSubscriptionState();

    return () => {
      cancelled = true;
    };
  }, []);

  const toggleUpdatesSubscription = async () => {
    setIsUpdatingSubscription(true);

    try {
      const registration = await getUpdateServiceWorkerRegistration();

      if (updatesSubscribed) {
        const subscription = await registration.pushManager.getSubscription();

        if (!subscription) {
          setUpdatesSubscribed(false);
          setSubscriptionStatus('No active push subscription found.');
          return;
        }

        const response = await fetch(`${updateApiBaseUrl}/api/unsubscribe`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            pageId: updatePageId,
            endpoint: subscription.endpoint,
          }),
        });

        const data = await readJsonResponse<{ error?: string }>(response);

        if (!response.ok) {
          throw new Error(data?.error || 'Failed to unsubscribe.');
        }

        await subscription.unsubscribe();
        setUpdatesSubscribed(false);
        setSubscriptionStatus(`Unsubscribed from ${updatePageId}.`);
        return;
      }

      if (!('PushManager' in window) || !('Notification' in window)) {
        throw new Error('Push notifications are not supported in this browser.');
      }

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        throw new Error('Notification permission was not granted.');
      }

      // Prefer the local public VAPID key if available to avoid cross-origin requests.
      const publicKey = LOCAL_VAPID || (await (async () => {
        const publicKeyResponse = await fetch(`${updateApiBaseUrl}/api/public-key`);
        const publicKeyData = await readJsonResponse<{ publicKey?: string; error?: string }>(publicKeyResponse);

        if (!publicKeyResponse.ok) {
          throw new Error(publicKeyData?.error || 'VAPID public key is not configured.');
        }

        if (!publicKeyData?.publicKey) {
          throw new Error('VAPID public key is missing.');
        }

        return publicKeyData.publicKey as string;
      })());

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      const response = await fetch(`${updateApiBaseUrl}/api/subscribe`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          pageId: updatePageId,
          subscription: subscription.toJSON(),
          note: updateNotificationText,
        }),
      });

      const data = await readJsonResponse<{ error?: string }>(response);

      if (!response.ok) {
        throw new Error(data?.error || 'Failed to subscribe.');
      }

      setUpdatesSubscribed(true);
      setSubscriptionStatus(`Subscribed to ${updatePageId}.`);
    } catch (error) {
      setSubscriptionStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setIsUpdatingSubscription(false);
    }
  };

  return (
    <main className="page-shell" style={pageStyle}>
      <Hero
        title={settings.title}
        subtitle={settings.subtitle}
        updatesSubscribed={updatesSubscribed}
        subscriptionStatus={subscriptionStatus}
        isUpdatingSubscription={isUpdatingSubscription}
        onToggleUpdatesSubscription={toggleUpdatesSubscription}
        onEditDiscord={openEditDiscordRequest}
        onEditMail={openEditMailRequest}
        onEditGithub={openEditGithubRequest}
      />
      <Legend
        filters={filters}
        setFilters={setFilters}
        options={filterOptions}
        visiblePeopleCount={visiblePeople.length}
        visibleRelationsCount={visibleRelations.length}
        totalPeopleCount={settings.people.length}
        totalRelationsCount={settings.relations.length}
      />
      <TreeBoard
        people={visiblePeople}
        relations={visibleRelations}
        peopleById={peopleById}
        onMegaPfpChange={handleMegaPfpChange}
      />
    </main>
  );
}
