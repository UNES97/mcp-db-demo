-- vessel_cranes.sql
SELECT
  qc.full_name AS crane,
  TO_CHAR(MIN(
    CASE WHEN a.move_kind = 'LOAD' THEN a.t_put WHEN a.move_kind = 'DSCH' THEN t_discharge END
  ), 'YYYY-MM-DD"T"HH24:MI:SS') AS first_move,
  TO_CHAR(MAX(
    CASE WHEN a.move_kind = 'LOAD' THEN a.t_put WHEN a.move_kind = 'DSCH' THEN t_discharge END
  ), 'YYYY-MM-DD"T"HH24:MI:SS') AS latest_move
FROM inv_move_event a
JOIN xps_che qc ON (
  CASE WHEN a.move_kind = 'DSCH' THEN a.che_fetch WHEN a.move_kind = 'LOAD' THEN a.che_put END
) = qc.gkey
WHERE (
  CASE WHEN a.move_kind = 'DSCH' THEN a.FM_pos_locid WHEN a.move_kind = 'LOAD' THEN a.TO_pos_locid END
) = :vessel_visit_id
  AND (
    CASE WHEN a.move_kind = 'LOAD' THEN a.t_put WHEN a.move_kind = 'DSCH' THEN t_discharge END
  ) IS NOT NULL
  AND qc.full_name LIKE '%QC%'
GROUP BY qc.full_name
