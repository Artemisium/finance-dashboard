'use client';

import { useEffect } from 'react';
import { loadData } from '@/lib/store';

export default function DataSync() {
  useEffect(() => {
    async function sync() {
      try {
        const res = await fetch('/api/data');
        if (!res.ok) return;

        let raw;
        try {
          raw = await res.json();
        } catch {
          return; // Response wasn't valid JSON
        }

        if (!raw) {
          // No server data — push local data up
          const local = loadData();
          if (local.transactions.length > 0 || local.incomeEntries.length > 0) {
            fetch('/api/data', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(local),
            }).catch(function() {});
          }
          return;
        }

        let server;
        try {
          server = typeof raw === 'string' ? JSON.parse(raw) : raw;
        } catch {
          return; // Invalid JSON in stored data
        }

        if (!server || !server.lastUpdated) return;

        const local = loadData();
        const localTime = new Date(local.lastUpdated).getTime();
        const serverTime = new Date(server.lastUpdated).getTime();

        if (!isNaN(serverTime) && !isNaN(localTime) && serverTime > localTime) {
          // Server is newer — update localStorage and reload
          try {
            localStorage.setItem('finance_dashboard_v1', JSON.stringify(server));
          } catch {
            return;
          }
          window.location.reload();
        } else if (!isNaN(localTime) && localTime > serverTime) {
          // Local is newer — push to server
          fetch('/api/data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(local),
          }).catch(function() {});
        }
      } catch {
        // Server unavailable — localStorage continues to work
      }
    }
    sync();
  }, []);

  return null;
}
