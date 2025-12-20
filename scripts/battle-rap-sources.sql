-- Add missing Twitter sources for Battle Rap
-- Topic ID: 864dbcf4-e1f7-4b1a-86ed-c18007439ad5

-- Major leagues and personalities
INSERT INTO source_accounts (topic_id, platform, handle, display_name, notes, status, credibility_score)
VALUES
  ('864dbcf4-e1f7-4b1a-86ed-c18007439ad5', 'twitter', 'urlosmg', 'Ultimate Rap League', 'Biggest battle rap league - official account', 'verified', 0.95),
  ('864dbcf4-e1f7-4b1a-86ed-c18007439ad5', 'twitter', 'KingOfTheDot', 'King of the Dot', 'Major Canadian league - KOTD', 'verified', 0.9),
  ('864dbcf4-e1f7-4b1a-86ed-c18007439ad5', 'twitter', 'RBE_Legion', 'Rare Breed Entertainment', 'RBE - growing league', 'verified', 0.85),
  ('864dbcf4-e1f7-4b1a-86ed-c18007439ad5', 'twitter', 'jayblac1615', 'Jay Blac', 'Battle rap media personality, interviews', 'verified', 0.8),
  ('864dbcf4-e1f7-4b1a-86ed-c18007439ad5', 'twitter', 'ChampagneDuane', 'Champagne Duane', 'Battle rap personality/host', 'verified', 0.8),
  ('864dbcf4-e1f7-4b1a-86ed-c18007439ad5', 'twitter', 'AyeVerb', 'Aye Verb', 'Legendary battler, runs own league', 'verified', 0.85),
  ('864dbcf4-e1f7-4b1a-86ed-c18007439ad5', 'twitter', 'Angryfan007', 'Angry Fan', 'Battle rap commentator/reactor', 'verified', 0.75)
ON CONFLICT (topic_id, platform, handle) DO NOTHING;

-- Add YouTube channels
INSERT INTO youtube_channels (topic_id, channel_id, channel_name, handle, notes, status, credibility_score)
VALUES
  ('864dbcf4-e1f7-4b1a-86ed-c18007439ad5', 'UCt2PBj8cNCAUe3PxzTl-pKQ', 'Ultimate Rap League', 'URLTV', 'Biggest battle rap channel - 2.7M subs', 'trusted', 0.95),
  ('864dbcf4-e1f7-4b1a-86ed-c18007439ad5', 'UC0kKMV5dSMmwBPFzXB-Wf7A', 'King Of The Dot Entertainment', 'KingOfTheDot', 'KOTD - major Canadian league', 'trusted', 0.9),
  ('864dbcf4-e1f7-4b1a-86ed-c18007439ad5', 'UC-mXCH_IWfzfLEGqtLCz0ww', 'RBE Presents', 'RBEofficial', 'Rare Breed Entertainment', 'trusted', 0.85),
  ('864dbcf4-e1f7-4b1a-86ed-c18007439ad5', 'UCdz-bOq_HYGZgOCyK1AmptA', 'Champion', 'Champion', 'Smack/URL secondary channel', 'trusted', 0.9),
  ('864dbcf4-e1f7-4b1a-86ed-c18007439ad5', 'UCbP-gGEaEGKUBsN6AaFCpPQ', 'No Studio N', 'NoStudioN', 'Battle rap reactions/breakdowns', 'trusted', 0.75),
  ('864dbcf4-e1f7-4b1a-86ed-c18007439ad5', 'UC8R23D52_10HHCfkXXD0gig', '15 Minutes of Fame', '15MinutesofFame', 'Battle rap media/reactions', 'trusted', 0.75),
  ('864dbcf4-e1f7-4b1a-86ed-c18007439ad5', 'UCxZzVLBIgI9SvC9qcvsFfWg', 'Jay Blac Is Bored', 'JayBlacIsBored', 'Battle rap commentary', 'trusted', 0.8),
  ('864dbcf4-e1f7-4b1a-86ed-c18007439ad5', 'UCsbjTS5ELYvqXQ_SF2WCbqg', 'Algorithm Institute of Battle Rap', 'algorithminstituteofbattlerap', 'YOUR channel - documentary style', 'trusted', 0.95)
ON CONFLICT (topic_id, channel_id) DO NOTHING;

-- Verify counts
SELECT 'Twitter Sources:' as type, count(*) as count FROM source_accounts WHERE topic_id = '864dbcf4-e1f7-4b1a-86ed-c18007439ad5'
UNION ALL
SELECT 'YouTube Channels:' as type, count(*) as count FROM youtube_channels WHERE topic_id = '864dbcf4-e1f7-4b1a-86ed-c18007439ad5';
