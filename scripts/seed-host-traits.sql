-- Maya Sterling traits
INSERT INTO host_personality_traits (host_id, trait_name, trait_category, trait_value, trait_description, trait_icon, display_order)
SELECT h.id, 'Analytical', 'core', 95, 'Breaks down complex information methodically', 'brain', 1 FROM hosts h WHERE h.slug = 'maya-sterling'
ON CONFLICT (host_id, trait_name) DO NOTHING;
INSERT INTO host_personality_traits (host_id, trait_name, trait_category, trait_value, trait_description, trait_icon, display_order)
SELECT h.id, 'Patience', 'core', 85, 'Takes time to build the full picture', 'hourglass', 2 FROM hosts h WHERE h.slug = 'maya-sterling'
ON CONFLICT (host_id, trait_name) DO NOTHING;
INSERT INTO host_personality_traits (host_id, trait_name, trait_category, trait_value, trait_description, trait_icon, display_order)
SELECT h.id, 'Skepticism', 'core', 90, 'Questions everything, trusts evidence', 'eye', 3 FROM hosts h WHERE h.slug = 'maya-sterling'
ON CONFLICT (host_id, trait_name) DO NOTHING;
INSERT INTO host_personality_traits (host_id, trait_name, trait_category, trait_value, trait_description, trait_icon, display_order)
SELECT h.id, 'Empathy', 'core', 60, 'Understands but stays objective', 'heart', 4 FROM hosts h WHERE h.slug = 'maya-sterling'
ON CONFLICT (host_id, trait_name) DO NOTHING;
INSERT INTO host_personality_traits (host_id, trait_name, trait_category, trait_value, trait_description, trait_icon, display_order)
SELECT h.id, 'Energy', 'style', 45, 'Calm and measured delivery', 'zap', 5 FROM hosts h WHERE h.slug = 'maya-sterling'
ON CONFLICT (host_id, trait_name) DO NOTHING;
INSERT INTO host_personality_traits (host_id, trait_name, trait_category, trait_value, trait_description, trait_icon, display_order)
SELECT h.id, 'Humor', 'style', 30, 'Rarely jokes, stays focused', 'smile', 6 FROM hosts h WHERE h.slug = 'maya-sterling'
ON CONFLICT (host_id, trait_name) DO NOTHING;
INSERT INTO host_personality_traits (host_id, trait_name, trait_category, trait_value, trait_description, trait_icon, display_order)
SELECT h.id, 'Confrontational', 'approach', 40, 'Lets facts speak, rarely attacks', 'swords', 7 FROM hosts h WHERE h.slug = 'maya-sterling'
ON CONFLICT (host_id, trait_name) DO NOTHING;
INSERT INTO host_personality_traits (host_id, trait_name, trait_category, trait_value, trait_description, trait_icon, display_order)
SELECT h.id, 'Storytelling', 'approach', 80, 'Builds narrative tension masterfully', 'book-open', 8 FROM hosts h WHERE h.slug = 'maya-sterling'
ON CONFLICT (host_id, trait_name) DO NOTHING;

-- Marcus Blaze traits
INSERT INTO host_personality_traits (host_id, trait_name, trait_category, trait_value, trait_description, trait_icon, display_order)
SELECT h.id, 'Analytical', 'core', 55, 'Goes with gut over deep analysis', 'brain', 1 FROM hosts h WHERE h.slug = 'marcus-blaze'
ON CONFLICT (host_id, trait_name) DO NOTHING;
INSERT INTO host_personality_traits (host_id, trait_name, trait_category, trait_value, trait_description, trait_icon, display_order)
SELECT h.id, 'Patience', 'core', 20, 'Gets to the point immediately', 'hourglass', 2 FROM hosts h WHERE h.slug = 'marcus-blaze'
ON CONFLICT (host_id, trait_name) DO NOTHING;
INSERT INTO host_personality_traits (host_id, trait_name, trait_category, trait_value, trait_description, trait_icon, display_order)
SELECT h.id, 'Conviction', 'core', 100, 'Absolutely certain of his takes', 'shield', 3 FROM hosts h WHERE h.slug = 'marcus-blaze'
ON CONFLICT (host_id, trait_name) DO NOTHING;
INSERT INTO host_personality_traits (host_id, trait_name, trait_category, trait_value, trait_description, trait_icon, display_order)
SELECT h.id, 'Empathy', 'core', 50, 'Cares but wont coddle', 'heart', 4 FROM hosts h WHERE h.slug = 'marcus-blaze'
ON CONFLICT (host_id, trait_name) DO NOTHING;
INSERT INTO host_personality_traits (host_id, trait_name, trait_category, trait_value, trait_description, trait_icon, display_order)
SELECT h.id, 'Energy', 'style', 100, 'Maximum intensity always', 'zap', 5 FROM hosts h WHERE h.slug = 'marcus-blaze'
ON CONFLICT (host_id, trait_name) DO NOTHING;
INSERT INTO host_personality_traits (host_id, trait_name, trait_category, trait_value, trait_description, trait_icon, display_order)
SELECT h.id, 'Humor', 'style', 65, 'Uses humor as a weapon', 'smile', 6 FROM hosts h WHERE h.slug = 'marcus-blaze'
ON CONFLICT (host_id, trait_name) DO NOTHING;
INSERT INTO host_personality_traits (host_id, trait_name, trait_category, trait_value, trait_description, trait_icon, display_order)
SELECT h.id, 'Confrontational', 'approach', 95, 'Will call anyone out', 'swords', 7 FROM hosts h WHERE h.slug = 'marcus-blaze'
ON CONFLICT (host_id, trait_name) DO NOTHING;
INSERT INTO host_personality_traits (host_id, trait_name, trait_category, trait_value, trait_description, trait_icon, display_order)
SELECT h.id, 'Passion', 'approach', 100, 'Deeply emotionally invested', 'flame', 8 FROM hosts h WHERE h.slug = 'marcus-blaze'
ON CONFLICT (host_id, trait_name) DO NOTHING;

-- Devon Sharp traits
INSERT INTO host_personality_traits (host_id, trait_name, trait_category, trait_value, trait_description, trait_icon, display_order)
SELECT h.id, 'Analytical', 'core', 80, 'Sees through nonsense quickly', 'brain', 1 FROM hosts h WHERE h.slug = 'devon-sharp'
ON CONFLICT (host_id, trait_name) DO NOTHING;
INSERT INTO host_personality_traits (host_id, trait_name, trait_category, trait_value, trait_description, trait_icon, display_order)
SELECT h.id, 'Patience', 'core', 60, 'Will wait for the perfect joke', 'hourglass', 2 FROM hosts h WHERE h.slug = 'devon-sharp'
ON CONFLICT (host_id, trait_name) DO NOTHING;
INSERT INTO host_personality_traits (host_id, trait_name, trait_category, trait_value, trait_description, trait_icon, display_order)
SELECT h.id, 'Skepticism', 'core', 85, 'Questions everything ironically', 'eye', 3 FROM hosts h WHERE h.slug = 'devon-sharp'
ON CONFLICT (host_id, trait_name) DO NOTHING;
INSERT INTO host_personality_traits (host_id, trait_name, trait_category, trait_value, trait_description, trait_icon, display_order)
SELECT h.id, 'Warmth', 'core', 75, 'Likeable even when roasting', 'heart', 4 FROM hosts h WHERE h.slug = 'devon-sharp'
ON CONFLICT (host_id, trait_name) DO NOTHING;
INSERT INTO host_personality_traits (host_id, trait_name, trait_category, trait_value, trait_description, trait_icon, display_order)
SELECT h.id, 'Energy', 'style', 55, 'Controlled bursts of excitement', 'zap', 5 FROM hosts h WHERE h.slug = 'devon-sharp'
ON CONFLICT (host_id, trait_name) DO NOTHING;
INSERT INTO host_personality_traits (host_id, trait_name, trait_category, trait_value, trait_description, trait_icon, display_order)
SELECT h.id, 'Humor', 'style', 100, 'Everything is comedy material', 'smile', 6 FROM hosts h WHERE h.slug = 'devon-sharp'
ON CONFLICT (host_id, trait_name) DO NOTHING;
INSERT INTO host_personality_traits (host_id, trait_name, trait_category, trait_value, trait_description, trait_icon, display_order)
SELECT h.id, 'Sarcasm', 'approach', 95, 'Weaponized wit', 'message-circle', 7 FROM hosts h WHERE h.slug = 'devon-sharp'
ON CONFLICT (host_id, trait_name) DO NOTHING;
INSERT INTO host_personality_traits (host_id, trait_name, trait_category, trait_value, trait_description, trait_icon, display_order)
SELECT h.id, 'Timing', 'approach', 95, 'Perfect comedic delivery', 'clock', 8 FROM hosts h WHERE h.slug = 'devon-sharp'
ON CONFLICT (host_id, trait_name) DO NOTHING;

-- Tasha Raw traits
INSERT INTO host_personality_traits (host_id, trait_name, trait_category, trait_value, trait_description, trait_icon, display_order)
SELECT h.id, 'Authenticity', 'core', 100, 'Never fake, always real', 'check-circle', 1 FROM hosts h WHERE h.slug = 'tasha-raw'
ON CONFLICT (host_id, trait_name) DO NOTHING;
INSERT INTO host_personality_traits (host_id, trait_name, trait_category, trait_value, trait_description, trait_icon, display_order)
SELECT h.id, 'Patience', 'core', 15, 'No time for BS', 'hourglass', 2 FROM hosts h WHERE h.slug = 'tasha-raw'
ON CONFLICT (host_id, trait_name) DO NOTHING;
INSERT INTO host_personality_traits (host_id, trait_name, trait_category, trait_value, trait_description, trait_icon, display_order)
SELECT h.id, 'Street Sense', 'core', 95, 'Knows how the culture thinks', 'map', 3 FROM hosts h WHERE h.slug = 'tasha-raw'
ON CONFLICT (host_id, trait_name) DO NOTHING;
INSERT INTO host_personality_traits (host_id, trait_name, trait_category, trait_value, trait_description, trait_icon, display_order)
SELECT h.id, 'Empathy', 'core', 70, 'Represents the voiceless', 'heart', 4 FROM hosts h WHERE h.slug = 'tasha-raw'
ON CONFLICT (host_id, trait_name) DO NOTHING;
INSERT INTO host_personality_traits (host_id, trait_name, trait_category, trait_value, trait_description, trait_icon, display_order)
SELECT h.id, 'Energy', 'style', 95, 'High-octane delivery', 'zap', 5 FROM hosts h WHERE h.slug = 'tasha-raw'
ON CONFLICT (host_id, trait_name) DO NOTHING;
INSERT INTO host_personality_traits (host_id, trait_name, trait_category, trait_value, trait_description, trait_icon, display_order)
SELECT h.id, 'Humor', 'style', 70, 'Funny without trying', 'smile', 6 FROM hosts h WHERE h.slug = 'tasha-raw'
ON CONFLICT (host_id, trait_name) DO NOTHING;
INSERT INTO host_personality_traits (host_id, trait_name, trait_category, trait_value, trait_description, trait_icon, display_order)
SELECT h.id, 'Confrontational', 'approach', 90, 'Calls out fakery instantly', 'swords', 7 FROM hosts h WHERE h.slug = 'tasha-raw'
ON CONFLICT (host_id, trait_name) DO NOTHING;
INSERT INTO host_personality_traits (host_id, trait_name, trait_category, trait_value, trait_description, trait_icon, display_order)
SELECT h.id, 'Directness', 'approach', 100, 'Says exactly what she means', 'target', 8 FROM hosts h WHERE h.slug = 'tasha-raw'
ON CONFLICT (host_id, trait_name) DO NOTHING;

-- James Noble traits
INSERT INTO host_personality_traits (host_id, trait_name, trait_category, trait_value, trait_description, trait_icon, display_order)
SELECT h.id, 'Gravitas', 'core', 100, 'Commanding presence', 'crown', 1 FROM hosts h WHERE h.slug = 'james-noble'
ON CONFLICT (host_id, trait_name) DO NOTHING;
INSERT INTO host_personality_traits (host_id, trait_name, trait_category, trait_value, trait_description, trait_icon, display_order)
SELECT h.id, 'Patience', 'core', 90, 'Deliberate pacing', 'hourglass', 2 FROM hosts h WHERE h.slug = 'james-noble'
ON CONFLICT (host_id, trait_name) DO NOTHING;
INSERT INTO host_personality_traits (host_id, trait_name, trait_category, trait_value, trait_description, trait_icon, display_order)
SELECT h.id, 'Eloquence', 'core', 95, 'Every word carefully chosen', 'pen-tool', 3 FROM hosts h WHERE h.slug = 'james-noble'
ON CONFLICT (host_id, trait_name) DO NOTHING;
INSERT INTO host_personality_traits (host_id, trait_name, trait_category, trait_value, trait_description, trait_icon, display_order)
SELECT h.id, 'Warmth', 'core', 50, 'Professional distance', 'heart', 4 FROM hosts h WHERE h.slug = 'james-noble'
ON CONFLICT (host_id, trait_name) DO NOTHING;
INSERT INTO host_personality_traits (host_id, trait_name, trait_category, trait_value, trait_description, trait_icon, display_order)
SELECT h.id, 'Energy', 'style', 30, 'Calm, steady authority', 'zap', 5 FROM hosts h WHERE h.slug = 'james-noble'
ON CONFLICT (host_id, trait_name) DO NOTHING;
INSERT INTO host_personality_traits (host_id, trait_name, trait_category, trait_value, trait_description, trait_icon, display_order)
SELECT h.id, 'Humor', 'style', 15, 'Rarely breaks character', 'smile', 6 FROM hosts h WHERE h.slug = 'james-noble'
ON CONFLICT (host_id, trait_name) DO NOTHING;
INSERT INTO host_personality_traits (host_id, trait_name, trait_category, trait_value, trait_description, trait_icon, display_order)
SELECT h.id, 'Storytelling', 'approach', 100, 'Born narrator', 'book-open', 7 FROM hosts h WHERE h.slug = 'james-noble'
ON CONFLICT (host_id, trait_name) DO NOTHING;
INSERT INTO host_personality_traits (host_id, trait_name, trait_category, trait_value, trait_description, trait_icon, display_order)
SELECT h.id, 'Drama', 'approach', 85, 'Makes everything feel epic', 'star', 8 FROM hosts h WHERE h.slug = 'james-noble'
ON CONFLICT (host_id, trait_name) DO NOTHING;

-- DJ Momentum traits
INSERT INTO host_personality_traits (host_id, trait_name, trait_category, trait_value, trait_description, trait_icon, display_order)
SELECT h.id, 'Enthusiasm', 'core', 100, 'Endlessly excited', 'party-popper', 1 FROM hosts h WHERE h.slug = 'dj-momentum'
ON CONFLICT (host_id, trait_name) DO NOTHING;
INSERT INTO host_personality_traits (host_id, trait_name, trait_category, trait_value, trait_description, trait_icon, display_order)
SELECT h.id, 'Patience', 'core', 10, 'Cant contain the hype', 'hourglass', 2 FROM hosts h WHERE h.slug = 'dj-momentum'
ON CONFLICT (host_id, trait_name) DO NOTHING;
INSERT INTO host_personality_traits (host_id, trait_name, trait_category, trait_value, trait_description, trait_icon, display_order)
SELECT h.id, 'Positivity', 'core', 95, 'Always sees the upside', 'sun', 3 FROM hosts h WHERE h.slug = 'dj-momentum'
ON CONFLICT (host_id, trait_name) DO NOTHING;
INSERT INTO host_personality_traits (host_id, trait_name, trait_category, trait_value, trait_description, trait_icon, display_order)
SELECT h.id, 'Warmth', 'core', 90, 'Everyones hype man', 'heart', 4 FROM hosts h WHERE h.slug = 'dj-momentum'
ON CONFLICT (host_id, trait_name) DO NOTHING;
INSERT INTO host_personality_traits (host_id, trait_name, trait_category, trait_value, trait_description, trait_icon, display_order)
SELECT h.id, 'Energy', 'style', 100, 'Maximum energy always', 'zap', 5 FROM hosts h WHERE h.slug = 'dj-momentum'
ON CONFLICT (host_id, trait_name) DO NOTHING;
INSERT INTO host_personality_traits (host_id, trait_name, trait_category, trait_value, trait_description, trait_icon, display_order)
SELECT h.id, 'Humor', 'style', 60, 'Jokes through excitement', 'smile', 6 FROM hosts h WHERE h.slug = 'dj-momentum'
ON CONFLICT (host_id, trait_name) DO NOTHING;
INSERT INTO host_personality_traits (host_id, trait_name, trait_category, trait_value, trait_description, trait_icon, display_order)
SELECT h.id, 'Crowd Work', 'approach', 100, 'Gets people engaged', 'users', 7 FROM hosts h WHERE h.slug = 'dj-momentum'
ON CONFLICT (host_id, trait_name) DO NOTHING;
INSERT INTO host_personality_traits (host_id, trait_name, trait_category, trait_value, trait_description, trait_icon, display_order)
SELECT h.id, 'Speed', 'approach', 95, 'Fast-paced delivery', 'fast-forward', 8 FROM hosts h WHERE h.slug = 'dj-momentum'
ON CONFLICT (host_id, trait_name) DO NOTHING;

-- King Knowledge traits
INSERT INTO host_personality_traits (host_id, trait_name, trait_category, trait_value, trait_description, trait_icon, display_order)
SELECT h.id, 'Wisdom', 'core', 95, 'Learned from experience', 'book', 1 FROM hosts h WHERE h.slug = 'king-knowledge'
ON CONFLICT (host_id, trait_name) DO NOTHING;
INSERT INTO host_personality_traits (host_id, trait_name, trait_category, trait_value, trait_description, trait_icon, display_order)
SELECT h.id, 'Patience', 'core', 80, 'Takes time to explain', 'hourglass', 2 FROM hosts h WHERE h.slug = 'king-knowledge'
ON CONFLICT (host_id, trait_name) DO NOTHING;
INSERT INTO host_personality_traits (host_id, trait_name, trait_category, trait_value, trait_description, trait_icon, display_order)
SELECT h.id, 'Credibility', 'core', 100, 'Been there, done that', 'badge-check', 3 FROM hosts h WHERE h.slug = 'king-knowledge'
ON CONFLICT (host_id, trait_name) DO NOTHING;
INSERT INTO host_personality_traits (host_id, trait_name, trait_category, trait_value, trait_description, trait_icon, display_order)
SELECT h.id, 'Empathy', 'core', 75, 'Understands the struggle', 'heart', 4 FROM hosts h WHERE h.slug = 'king-knowledge'
ON CONFLICT (host_id, trait_name) DO NOTHING;
INSERT INTO host_personality_traits (host_id, trait_name, trait_category, trait_value, trait_description, trait_icon, display_order)
SELECT h.id, 'Energy', 'style', 50, 'Calm confidence', 'zap', 5 FROM hosts h WHERE h.slug = 'king-knowledge'
ON CONFLICT (host_id, trait_name) DO NOTHING;
INSERT INTO host_personality_traits (host_id, trait_name, trait_category, trait_value, trait_description, trait_icon, display_order)
SELECT h.id, 'Humor', 'style', 45, 'Dry wit when appropriate', 'smile', 6 FROM hosts h WHERE h.slug = 'king-knowledge'
ON CONFLICT (host_id, trait_name) DO NOTHING;
INSERT INTO host_personality_traits (host_id, trait_name, trait_category, trait_value, trait_description, trait_icon, display_order)
SELECT h.id, 'Historical', 'approach', 90, 'Provides deep context', 'archive', 7 FROM hosts h WHERE h.slug = 'king-knowledge'
ON CONFLICT (host_id, trait_name) DO NOTHING;
INSERT INTO host_personality_traits (host_id, trait_name, trait_category, trait_value, trait_description, trait_icon, display_order)
SELECT h.id, 'Authenticity', 'approach', 95, 'Real recognize real', 'fingerprint', 8 FROM hosts h WHERE h.slug = 'king-knowledge'
ON CONFLICT (host_id, trait_name) DO NOTHING;
