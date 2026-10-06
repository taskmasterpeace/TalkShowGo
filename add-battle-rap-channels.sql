-- Re-add Hip Hop Is Real + Add new channels for CNN-level battle rap coverage
-- Topic ID: 864dbcf4-e1f7-4b1a-86ed-c18007439ad5 (Battle Rap)

-- Re-add Hip Hop Is Real (user confirmed active)
INSERT INTO youtube_channels (topic_id, channel_name, channel_id, description)
VALUES (
  '864dbcf4-e1f7-4b1a-86ed-c18007439ad5',
  'Hip Hop Is Real',
  'UCtPVIFBKnG3fQzZMlpuwpwQ',
  'Knowledge The God - #1 viewed battle rap channel, 149K subs'
)
ON CONFLICT (topic_id, channel_id) DO NOTHING;

-- Add HeySandyyy
INSERT INTO youtube_channels (topic_id, channel_name, channel_id, description)
VALUES (
  '864dbcf4-e1f7-4b1a-86ed-c18007439ad5',
  'Hey Sandy',
  'UCYgxZ2f7d8lchZT7i5kgH9w',
  'Battle rap commentary and analysis - 3.4K subs'
)
ON CONFLICT (topic_id, channel_id) DO NOTHING;

-- Add M3S3 TV
INSERT INTO youtube_channels (topic_id, channel_name, channel_id, description)
VALUES (
  '864dbcf4-e1f7-4b1a-86ed-c18007439ad5',
  'M3S3 TV',
  'UC40MFoYWBVTQyiJiXyiXXcg',
  'Battle rap commentary and culture - 20.2K subs'
)
ON CONFLICT (topic_id, channel_id) DO NOTHING;

-- Add GOAT STATUS
INSERT INTO youtube_channels (topic_id, channel_name, channel_id, description)
VALUES (
  '864dbcf4-e1f7-4b1a-86ed-c18007439ad5',
  'GOAT STATUS',
  'UCJKZZLUVsbtOu9Uzpg4MN5g',
  'Battle rap news and analysis - 20.7K subs'
)
ON CONFLICT (topic_id, channel_id) DO NOTHING;

-- Verify the additions
SELECT channel_name, channel_id, description
FROM youtube_channels
WHERE topic_id = '864dbcf4-e1f7-4b1a-86ed-c18007439ad5'
ORDER BY channel_name;
