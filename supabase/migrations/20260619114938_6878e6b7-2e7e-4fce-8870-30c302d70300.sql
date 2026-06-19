-- Drop church-management schema entirely
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.process_contribution() CASCADE;
DROP FUNCTION IF EXISTS public.get_public_dashboard() CASCADE;
DROP FUNCTION IF EXISTS public.get_user_group_id(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role) CASCADE;
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;

DROP TABLE IF EXISTS public.audit_log CASCADE;
DROP TABLE IF EXISTS public.user_badges CASCADE;
DROP TABLE IF EXISTS public.badges CASCADE;
DROP TABLE IF EXISTS public.contributions CASCADE;
DROP TABLE IF EXISTS public.user_roles CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.projects CASCADE;
DROP TABLE IF EXISTS public.groups CASCADE;

DROP TYPE IF EXISTS public.app_role CASCADE;
DROP TYPE IF EXISTS public.member_category CASCADE;
DROP TYPE IF EXISTS public.project_status CASCADE;

CREATE TABLE public.users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.users TO anon, authenticated;
GRANT ALL ON public.users TO service_role;

CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  full_name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'user',
  access_token TEXT,
  token_expires_at TIMESTAMPTZ,
  annual_goal NUMERIC DEFAULT 0,
  total_contributed NUMERIC DEFAULT 0,
  level TEXT DEFAULT 'Seed Sower',
  group_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO anon, authenticated;
GRANT ALL ON public.profiles TO service_role;

CREATE TABLE public.otp_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT NOT NULL,
  otp TEXT NOT NULL,
  verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '5 minutes')
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.otp_codes TO anon, authenticated;
GRANT ALL ON public.otp_codes TO service_role;

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public insert users" ON public.users FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public select users" ON public.users FOR SELECT USING (true);

CREATE POLICY "Allow public select profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Allow public insert profiles" ON public.profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update profiles" ON public.profiles FOR UPDATE USING (true);

CREATE POLICY "Allow public insert otp" ON public.otp_codes FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public select otp" ON public.otp_codes FOR SELECT USING (true);
CREATE POLICY "Allow public update otp" ON public.otp_codes FOR UPDATE USING (true);

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- groups
CREATE TABLE public.groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  leader_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.groups TO anon, authenticated;
GRANT ALL ON public.groups TO service_role;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_group_id_fkey
  FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE SET NULL;
CREATE INDEX idx_profiles_group_id ON public.profiles(group_id);
CREATE INDEX idx_groups_leader_id ON public.groups(leader_id);

-- projects
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  target_amount NUMERIC NOT NULL CHECK (target_amount >= 0),
  collected_amount NUMERIC NOT NULL DEFAULT 0 CHECK (collected_amount >= 0),
  owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'ongoing' CHECK (status IN ('ongoing','completed','paused','cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO anon, authenticated;
GRANT ALL ON public.projects TO service_role;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_projects_status ON public.projects(status);
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- app_role and user_roles
CREATE TYPE public.app_role AS ENUM ('super_admin','admin','finance_admin','group_leader','member');

CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  assigned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_role ON public.user_roles(role);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Roles publicly viewable" ON public.user_roles FOR SELECT USING (true);
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- project policies
CREATE POLICY "Projects viewable by everyone" ON public.projects FOR SELECT USING (true);
CREATE POLICY "Admins can create projects" ON public.projects FOR INSERT
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "Admins can update projects" ON public.projects FOR UPDATE
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "Admins can delete projects" ON public.projects FOR DELETE
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "Groups publicly viewable" ON public.groups FOR SELECT USING (true);
CREATE POLICY "Group leaders can manage own group" ON public.groups FOR ALL
  USING (leader_id = auth.uid()) WITH CHECK (leader_id = auth.uid());

-- contributions
CREATE TABLE public.contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  method TEXT DEFAULT 'mobile_money',
  reference TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  clickpesa_order_reference TEXT,
  payment_provider TEXT DEFAULT 'clickpesa',
  currency TEXT DEFAULT 'TZS',
  payment_link TEXT,
  payment_method_used TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.contributions
  ADD CONSTRAINT contributions_method_check
  CHECK (method IN ('mobile_money','bank_transfer','cash','check','other','card'));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contributions TO anon, authenticated;
GRANT ALL ON public.contributions TO service_role;
ALTER TABLE public.contributions ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_contributions_user_id ON public.contributions(user_id);
CREATE INDEX idx_contributions_project_id ON public.contributions(project_id);
CREATE INDEX idx_contributions_created_at ON public.contributions(created_at);
CREATE INDEX idx_contributions_order_reference ON public.contributions(clickpesa_order_reference);
CREATE INDEX idx_contributions_status ON public.contributions(status);

CREATE POLICY "Public select contributions" ON public.contributions FOR SELECT USING (true);
CREATE POLICY "Public insert contributions" ON public.contributions FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update contributions status" ON public.contributions FOR UPDATE USING (true) WITH CHECK (true);

CREATE TRIGGER update_contributions_updated_at BEFORE UPDATE ON public.contributions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE OR REPLACE FUNCTION public.update_project_collected_amount()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  UPDATE public.projects
  SET collected_amount = (
    SELECT COALESCE(SUM(amount), 0) FROM public.contributions
    WHERE project_id = COALESCE(NEW.project_id, OLD.project_id) AND status = 'completed'
  )
  WHERE id = COALESCE(NEW.project_id, OLD.project_id);
  RETURN NEW;
END; $$;

CREATE TRIGGER update_project_collected_on_contribution
  AFTER INSERT OR UPDATE OR DELETE ON public.contributions
  FOR EACH ROW EXECUTE FUNCTION public.update_project_collected_amount();

CREATE OR REPLACE FUNCTION public.update_profile_total_contributed()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  UPDATE public.profiles
  SET total_contributed = (
    SELECT COALESCE(SUM(amount), 0) FROM public.contributions
    WHERE user_id = COALESCE(NEW.user_id, OLD.user_id) AND status = 'completed'
  )
  WHERE id = COALESCE(NEW.user_id, OLD.user_id);
  RETURN NEW;
END; $$;

CREATE TRIGGER update_profile_total_on_contribution
  AFTER INSERT OR UPDATE OR DELETE ON public.contributions
  FOR EACH ROW EXECUTE FUNCTION public.update_profile_total_contributed();

-- pledges
CREATE TABLE public.pledges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  pledge_amount NUMERIC NOT NULL CHECK (pledge_amount >= 0),
  year INTEGER NOT NULL CHECK (year >= 2020 AND year <= 2100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pledges TO anon, authenticated;
GRANT ALL ON public.pledges TO service_role;
ALTER TABLE public.pledges ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_pledges_user_id ON public.pledges(user_id);
CREATE INDEX idx_pledges_year ON public.pledges(year);
CREATE POLICY "Public create pledges" ON public.pledges FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update pledges" ON public.pledges FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Public select pledges" ON public.pledges FOR SELECT USING (true);
CREATE TRIGGER update_pledges_updated_at BEFORE UPDATE ON public.pledges
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- badges
CREATE TABLE public.badges (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.badges TO anon, authenticated;
GRANT ALL ON public.badges TO service_role;
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view badges" ON public.badges FOR SELECT USING (true);

CREATE TABLE public.user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  badge_id TEXT REFERENCES public.badges(id) ON DELETE CASCADE,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, badge_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_badges TO anon, authenticated;
GRANT ALL ON public.user_badges TO service_role;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public select user_badges" ON public.user_badges FOR SELECT USING (true);
CREATE POLICY "Public insert user_badges" ON public.user_badges FOR INSERT WITH CHECK (true);

INSERT INTO public.badges (id, name, description, icon) VALUES
  ('first', 'First Step', 'Made your first contribution', 'sparkle'),
  ('streak_7', '7-Day Streak', 'Contributed 7 days in a row', 'flame'),
  ('streak_30', '30-Day Streak', 'Contributed 30 days in a row', 'trophy'),
  ('milestone_100k', '100K Club', 'Contributed over 100,000 TZS', 'medal'),
  ('milestone_500k', '500K Club', 'Contributed over 500,000 TZS', 'crown')
ON CONFLICT (id) DO NOTHING;

-- church_settings
CREATE TABLE public.church_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  year INTEGER NOT NULL UNIQUE,
  annual_goal NUMERIC NOT NULL DEFAULT 0,
  best_group_id UUID REFERENCES public.groups(id) ON DELETE SET NULL,
  best_group_name TEXT,
  best_group_percentage NUMERIC,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.church_settings TO anon, authenticated;
GRANT ALL ON public.church_settings TO service_role;
ALTER TABLE public.church_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Church settings publicly viewable" ON public.church_settings FOR SELECT USING (true);
CREATE POLICY "Public can insert church settings" ON public.church_settings FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can update church settings" ON public.church_settings FOR UPDATE USING (true) WITH CHECK (true);
CREATE TRIGGER trg_church_settings_updated_at BEFORE UPDATE ON public.church_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- public dashboard
CREATE OR REPLACE FUNCTION public.get_public_dashboard()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  total_collected NUMERIC := 0;
  active_members INT := 0;
  current_project JSONB;
  best_group_data JSONB;
  annual_goal_amount NUMERIC := 0;
  best_name TEXT;
  best_pct NUMERIC;
  current_year INT := EXTRACT(YEAR FROM now())::INT;
BEGIN
  SELECT COALESCE(SUM(amount),0), COUNT(DISTINCT user_id)
    INTO total_collected, active_members
  FROM public.contributions WHERE status = 'completed';

  SELECT cs.annual_goal, cs.best_group_name, cs.best_group_percentage
    INTO annual_goal_amount, best_name, best_pct
  FROM public.church_settings cs WHERE cs.year = current_year LIMIT 1;

  IF best_name IS NOT NULL AND length(trim(best_name)) > 0 THEN
    best_group_data := jsonb_build_object('name', best_name, 'percentage', COALESCE(best_pct,0));
  END IF;

  SELECT jsonb_build_object(
    'id', p.id, 'name', p.name, 'description', p.description,
    'target_amount', p.target_amount, 'collected_amount', p.collected_amount, 'status', p.status
  ) INTO current_project
  FROM public.projects p WHERE p.status = 'ongoing'
  ORDER BY p.created_at DESC LIMIT 1;

  RETURN jsonb_build_object(
    'total_collected', total_collected,
    'active_members', active_members,
    'annual_goal', COALESCE(annual_goal_amount, 0),
    'current_project', COALESCE(current_project, '{}'::jsonb),
    'best_group', COALESCE(best_group_data, NULL),
    'groups_leaderboard', NULL
  );
END; $$;

GRANT EXECUTE ON FUNCTION public.get_public_dashboard() TO anon, authenticated;