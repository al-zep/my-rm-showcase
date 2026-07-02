
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL DEFAULT 'Happy Sabbath! 🌿',
  message text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_created_idx ON public.notifications (user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO anon, authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public select notifications" ON public.notifications FOR SELECT USING (true);
CREATE POLICY "Public insert notifications" ON public.notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update notifications" ON public.notifications FOR UPDATE USING (true);
CREATE POLICY "Public delete notifications" ON public.notifications FOR DELETE USING (true);

-- Weekly Sabbath broadcast: pick one message from pool based on ISO week number so consecutive weeks differ.
CREATE OR REPLACE FUNCTION public.broadcast_weekly_sabbath_notification()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pool text[] := ARRAY[
    'Happy Sabbath! 🌿 As we enjoy the blessings of this holy Sabbath, we kindly remind you to support our Church Development Resource Mobilization initiative. Every contribution, no matter the size, helps us build and strengthen God''s work for the benefit of our congregation and future generations. Your generosity makes a difference. Thank you for your continued love, support, and faithful partnership. May God richly bless you!',
    'Happy Sabbath! 🕊️ On this sacred day of rest, remember that your faithful giving fuels our Resource Mobilization vision. Together we are building a stronger house of worship for generations to come. Thank you for standing with us — may the Lord multiply every seed you sow.',
    'Happy Sabbath, beloved! 🌸 As we worship together today, let us also give thankfully toward our church development goals. No gift is too small in the hands of God. Your partnership is a blessing — may Heaven pour out favor upon you and your family.',
    'Happy Sabbath! ✨ May the peace of this holy day fill your heart. Please continue to support our Church Development Resource Mobilization — every shilling helps us reach our shared vision. Thank you for your faithfulness. God bless you abundantly.',
    'Sabbath blessings to you! 🙏 Today, as we rest in the Lord, remember our ongoing Resource Mobilization drive. Your contribution — big or small — moves the work of God forward. Asante sana kwa moyo wako wa ukarimu. May God repay you a hundredfold.',
    'Happy Sabbath! 🌿 The Lord loves a cheerful giver. As you enjoy this Sabbath, consider a gift toward our church development projects. Your generosity today builds a legacy of faith for tomorrow. Bwana akubariki sana.',
    'Happy Sabbath, family! 🕯️ Let this holy day renew your strength and your generosity. Our Resource Mobilization initiative needs every one of us. Thank you for partnering in the mission — God sees, God remembers, God rewards.',
    'Happy Sabbath! 🌾 "Bring the whole tithe into the storehouse..." (Malachi 3:10). As we celebrate this Sabbath, kindly remember our Church Development fund. Your gift is a seed of blessing. Thank you and God bless you richly.',
    'Sabbath shalom! 🌺 May today refresh your spirit. Our Resource Mobilization journey continues, and every contribution matters. Thank you for your love and support toward the work of the Lord in our church.',
    'Happy Sabbath! 🌟 God has blessed us so we may bless others. Please prayerfully support our Church Development Resource Mobilization this week. Your faithfulness is building something eternal. May the Lord''s face shine upon you.',
    'Happy Sabbath! 🌿 On this holy day, be reminded that you are part of something greater. Our Resource Mobilization initiative depends on hearts like yours. Karibu ku-contribute — kila senti inasaidia. Mungu akubariki sana!',
    'Happy Sabbath, beloved saints! 🕊️ Rest in His presence today, and let your heart be moved to give. Our church development work continues because of you. Thank you for your generosity — heaven records every gift.'
  ];
  msg text;
  idx int;
BEGIN
  -- Use ISO week to rotate through the pool
  idx := (EXTRACT(WEEK FROM now())::int % array_length(pool, 1)) + 1;
  msg := pool[idx];

  INSERT INTO public.notifications (user_id, title, message)
  SELECT p.id, 'Happy Sabbath! 🌿', msg
  FROM public.profiles p;
END;
$$;

-- Monthly reset: wipes all notifications on the 1st of every month.
CREATE OR REPLACE FUNCTION public.reset_notifications_monthly()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.notifications;
END;
$$;

GRANT EXECUTE ON FUNCTION public.broadcast_weekly_sabbath_notification() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reset_notifications_monthly() TO anon, authenticated, service_role;
