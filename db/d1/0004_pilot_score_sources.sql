-- Source registrations for bounded public scoreboards. These are not sportsbook odds.
-- Isolated pilot only. Does not modify production PostgreSQL or primary D1.
INSERT OR IGNORE INTO intelligence_sources(source_id,upstream_id,source_type,enabled) VALUES
('espn-scoreboard-nfl','site.api.espn.com','scoreboard',1),
('espn-scoreboard-ncaaf','site.api.espn.com','scoreboard',1),
('espn-scoreboard-nba','site.api.espn.com','scoreboard',1),
('espn-scoreboard-ncaab','site.api.espn.com','scoreboard',1),
('espn-scoreboard-wnba','site.api.espn.com','scoreboard',1),
('espn-scoreboard-mlb','site.api.espn.com','scoreboard',1),
('espn-scoreboard-nhl','site.api.espn.com','scoreboard',1),
('espn-scoreboard-soccer-epl','site.api.espn.com','scoreboard',1),
('espn-scoreboard-soccer-laliga','site.api.espn.com','scoreboard',1),
('espn-scoreboard-soccer-bundesliga','site.api.espn.com','scoreboard',1),
('espn-scoreboard-soccer-serie-a','site.api.espn.com','scoreboard',1),
('espn-scoreboard-soccer-ligue-1','site.api.espn.com','scoreboard',1),
('espn-scoreboard-soccer-mls','site.api.espn.com','scoreboard',1),
('espn-scoreboard-soccer-nwsl','site.api.espn.com','scoreboard',1),
('espn-scoreboard-soccer-ucl','site.api.espn.com','scoreboard',1),
('espn-scoreboard-soccer-uel','site.api.espn.com','scoreboard',1);
