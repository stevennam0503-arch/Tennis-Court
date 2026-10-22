-- Keep configured policies; fill missing customer cancellation/change deadlines.
UPDATE club_settings
SET hold_minutes = CASE WHEN hold_minutes = 10 THEN 5 ELSE hold_minutes END,
    policies = ('{"cancelCutoffMinutes":1440,"changeCutoffMinutes":1440}'::jsonb
                || policies::jsonb)::text;
