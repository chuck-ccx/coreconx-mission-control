"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase";

/**
 * Subscribe to Supabase real-time changes on a table.
 * Calls `onUpdate` whenever an INSERT, UPDATE, or DELETE occurs.
 * Automatically cleans up the subscription on unmount.
 */
export function useRealtime(table: string, onUpdate: () => void) {
  useEffect(() => {
    const channel = supabase
      .channel(`realtime-${table}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => onUpdate(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [table, onUpdate]);
}
