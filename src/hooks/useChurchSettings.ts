import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSupabaseClient } from "@/lib/supabase/database";


export interface ChurchSettings {
  id: string;
  year: number;
  annual_goal: number;
  best_group_id: string | null;
  best_group_name: string | null;
  best_group_percentage: number | null;
}

const currentYear = () => new Date().getFullYear();

export const useChurchSettings = () => {
  return useQuery({
    queryKey: ["church-settings", currentYear()],
    queryFn: async (): Promise<ChurchSettings | null> => {
      const client = getSupabaseClient();
      const { data, error } = await client
        .from("church_settings")
        .select("id, year, annual_goal, best_group_id, best_group_name, best_group_percentage")
        .eq("year", currentYear())
        .maybeSingle();
      if (error) {
        console.warn("useChurchSettings error:", error.message);
        return null;
      }
      return data as ChurchSettings | null;
    },
    refetchInterval: 30_000,
  });
};

export const useGroupsList = () => {
  return useQuery({
    queryKey: ["groups-list"],
    queryFn: async () => {
      const client = getSupabaseClient();
      const { data, error } = await client
        .from("groups")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
};

export const useChurchTotalCollected = () => {
  return useQuery({
    queryKey: ["church-total-collected"],
    queryFn: async (): Promise<number> => {
      const client = getSupabaseClient();
      const { data, error } = await client
        .from("contributions")
        .select("amount")
        .eq("status", "completed");
      if (error) return 0;
      return (data ?? []).reduce((sum, c: any) => sum + Number(c.amount || 0), 0);
    },
    refetchInterval: 30_000,
  });
};

export const useChurchTotalPledges = () => {
  return useQuery({
    queryKey: ["church-total-pledges", currentYear()],
    queryFn: async (): Promise<number> => {
      const client = getSupabaseClient();
      const { data, error } = await client
        .from("pledges")
        .select("pledge_amount")
        .eq("year", currentYear());
      if (error) return 0;
      return (data ?? []).reduce((sum, p: any) => sum + Number(p.pledge_amount || 0), 0);
    },
    refetchInterval: 30_000,
  });
};

export const useUpdateChurchSettings = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      annual_goal: number;
      best_group_name: string | null;
      best_group_percentage: number | null;
    }) => {
      const client = getSupabaseClient();
      const year = currentYear();

      const { data: existing } = await client
        .from("church_settings")
        .select("id")
        .eq("year", year)
        .maybeSingle();

      if (existing?.id) {
        const { error } = await client
          .from("church_settings")
          .update({
            annual_goal: input.annual_goal,
            best_group_name: input.best_group_name,
            best_group_percentage: input.best_group_percentage,
          } as any)
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await client.from("church_settings").insert({
          year,
          annual_goal: input.annual_goal,
          best_group_name: input.best_group_name,
          best_group_percentage: input.best_group_percentage,
        } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["church-settings"] });
      qc.invalidateQueries({ queryKey: ["public-dashboard"] });
    },
    onError: (e: any) => {
      console.error("Update church settings error:", e);
    },
  });
};
