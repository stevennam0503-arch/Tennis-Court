-- Preserve the original surface separately; zones are not court surfaces.
ALTER TABLE courts ADD COLUMN surface_type varchar(255);
ALTER TABLE courts ADD COLUMN zone_needs_review boolean NOT NULL DEFAULT false;
UPDATE courts SET zone_needs_review = true
WHERE type NOT IN ('VIP','INDOOR','OUTDOOR')
 AND upper(regexp_replace(trim(name), '^(Sân|San)\s+', '', 'i')) !~ '^[ABV][0-9]';
UPDATE courts SET surface_type = type WHERE type IN ('HARD','CLAY','GRASS');
UPDATE courts SET type = CASE
 WHEN upper(regexp_replace(trim(name), '^(Sân|San)\s+', '', 'i')) ~ '^V[0-9]' THEN 'VIP'
 WHEN upper(regexp_replace(trim(name), '^(Sân|San)\s+', '', 'i')) ~ '^B[0-9]' THEN 'INDOOR'
 ELSE 'OUTDOOR' END
WHERE type NOT IN ('VIP','INDOOR','OUTDOOR');
