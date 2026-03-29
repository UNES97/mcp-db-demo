// MySQL 5.7 compatible queries for APM Terminal

export const QUERIES = {
  // Get vessel visits with executed and planned moves (MySQL 5.7 compatible)
  VESSEL_VISITS: `
    SELECT
      v.name,
      v.visitId,
      v.phase,
      v.ata,
      v.eta,
      v.etd,
      v.week_number,
      v.month,
      v.year,
      COALESCE(em.totalExecutedMoves, 0) AS totalExecutedMoves,
      COALESCE(pm.totalPlannedMoves, 0) AS totalPlannedMoves
    FROM (
      SELECT
        vslnm.name AS name,
        argo.id AS visitId,
        argo.phase AS phase,
        argo.ata AS ata,
        vd.eta AS eta,
        vd.etd AS etd,
        WEEK(CASE WHEN argo.phase = '20INBOUND' THEN vd.eta ELSE argo.ata END, 3) AS week_number,
        MONTH(CASE WHEN argo.phase = '20INBOUND' THEN vd.eta ELSE argo.ata END) AS month,
        YEAR(CASE WHEN argo.phase = '20INBOUND' THEN vd.eta ELSE argo.ata END) AS year
      FROM argo_carrier_visit argo
      LEFT OUTER JOIN argo_visit_details vd ON vd.gkey = argo.cvcvd_gkey
      LEFT OUTER JOIN vsl_vessel_visit_details vvd ON argo.cvcvd_gkey = vvd.vvd_gkey
      LEFT OUTER JOIN vsl_vessels vslnm ON vslnm.gkey = vvd.vessel_gkey
      WHERE argo.carrier_mode = 'VESSEL'
        AND argo.phase IN ('20INBOUND','30ARRIVED', '40WORKING', '50COMPLETE','60DEPARTED','70CLOSED')
    ) v
    LEFT JOIN (
      SELECT
        CASE
          WHEN move_kind = 'DSCH' THEN a.FM_pos_locid
          WHEN move_kind = 'LOAD' THEN a.TO_pos_locid
        END AS visitId,
        COUNT(*) AS totalExecutedMoves
      FROM inv_move_event a
      WHERE a.move_kind IN ('DSCH', 'LOAD')
      GROUP BY
        CASE
          WHEN move_kind = 'DSCH' THEN a.FM_pos_locid
          WHEN move_kind = 'LOAD' THEN a.TO_pos_locid
        END
    ) em ON v.visitId = em.visitId
    LEFT JOIN (
      SELECT
        wi.carrier_locid AS visitId,
        COUNT(*) AS totalPlannedMoves
      FROM inv_wi wi
      WHERE wi.move_kind IN ('DSCH', 'LOAD')
      GROUP BY wi.carrier_locid
    ) pm ON v.visitId = pm.visitId
    ORDER BY
      CASE WHEN v.phase = '20INBOUND' THEN v.eta ELSE v.ata END DESC
    LIMIT 100
  `,

  // Get inbound vessels for current year
  INBOUND_VESSELS_CURRENT_YEAR: `
    SELECT
      acv.ID AS VISITID,
      vsl.NAME AS VESSELNAME,
      acv.PHASE AS PHASE,
      service.id AS SERVICE,
      op.id AS LINE,
      YEAR(avd.etd) AS YEAR,
      MONTH(avd.etd) AS MONTH,
      WEEK(avd.etd, 3) AS WEEK,
      avd.ETA AS ETA,
      avd.ETD AS ETD,
      ROUND(TIMESTAMPDIFF(HOUR, avd.ETA, avd.ETD), 2) AS PORTHOURS,
      COALESCE(avd.EST_DISCHARGE, 0) + COALESCE(avd.EST_LOAD, 0) +
      COALESCE(avd.EST_RESTOW, 0) + COALESCE(avd.EST_SHIFT, 0) AS ESTIMATEDMOVES
    FROM argo_carrier_visit acv
    JOIN argo_visit_details avd ON acv.CVCVD_GKEY = avd.GKEY
    LEFT JOIN ref_carrier_service service ON service.GKEY = avd.SERVICE
    LEFT JOIN vsl_vessel_visit_details vvd ON vvd.VVD_GKEY = avd.GKEY
    LEFT JOIN vsl_vessels vsl ON vvd.VESSEL_GKEY = vsl.GKEY
    LEFT JOIN ref_bizunit_scoped op ON op.GKEY = vsl.OWNER_GKEY
    WHERE acv.CARRIER_MODE = 'VESSEL'
      AND acv.PHASE != '80CANCELED'
      AND YEAR(avd.etd) = YEAR(CURRENT_TIMESTAMP)
    ORDER BY avd.ETA ASC
  `,

  // Get vessel details by visit ID
  VESSEL_DETAILS_BY_ID: `
    SELECT
      srv.id AS service,
      argo.id AS visitId,
      vslnm.name AS name,
      SUBSTRING(argo.phase, 3) AS phase,
      argo.ata AS ata,
      argo.atd AS atd,
      vd.eta AS eta,
      vd.etd AS etd,
      ROUND(TIMESTAMPDIFF(HOUR, vd.eta, vd.etd), 2) AS portHoursPlanned,
      ROUND(TIMESTAMPDIFF(HOUR, argo.ata, COALESCE(argo.atd, NOW())), 2) AS portHoursActual,
      (SELECT COUNT(*) FROM inv_move_event ime
        WHERE ime.move_kind IN ('DSCH','LOAD')
        AND (CASE WHEN ime.move_kind='DSCH' THEN ime.FM_pos_locid ELSE ime.TO_pos_locid END) = argo.id
      ) AS executedMoves
    FROM vsl_vessel_visit_details vvd
    LEFT JOIN argo_carrier_visit argo ON argo.cvcvd_gkey = vvd.vvd_gkey
    LEFT JOIN argo_visit_details vd ON vd.gkey = argo.cvcvd_gkey
    LEFT JOIN ref_carrier_service srv ON srv.gkey = vd.service
    LEFT JOIN vsl_vessels vslnm ON vslnm.gkey = vvd.vessel_gkey
    WHERE argo.carrier_mode = 'VESSEL'
      AND argo.id = ?
  `,

  // Get visits by terminal (filtered)
  VISITS_BY_TERMINAL: `
    SELECT
      vslnm.name AS vesselName,
      argo.id AS visitId,
      argo.phase AS phase,
      argo.ata AS ata,
      vd.eta AS eta,
      vd.etd AS etd
    FROM argo_carrier_visit argo
    LEFT JOIN argo_visit_details vd ON vd.gkey = argo.cvcvd_gkey
    LEFT JOIN vsl_vessel_visit_details vvd ON argo.cvcvd_gkey = vvd.vvd_gkey
    LEFT JOIN vsl_vessels vslnm ON vslnm.gkey = vvd.vessel_gkey
    WHERE argo.carrier_mode = 'VESSEL'
      AND DATE(vd.eta) = CURDATE()
    ORDER BY vd.eta DESC
  `,

  // Get visits by terminal for specific date
  VISITS_BY_TERMINAL_DATE: `
    SELECT
      vslnm.name AS vesselName,
      argo.id AS visitId,
      argo.phase AS phase,
      argo.ata AS ata,
      vd.eta AS eta,
      vd.etd AS etd
    FROM argo_carrier_visit argo
    LEFT JOIN argo_visit_details vd ON vd.gkey = argo.cvcvd_gkey
    LEFT JOIN vsl_vessel_visit_details vvd ON argo.cvcvd_gkey = vvd.vvd_gkey
    LEFT JOIN vsl_vessels vslnm ON vslnm.gkey = vvd.vessel_gkey
    WHERE argo.carrier_mode = 'VESSEL'
      AND DATE(vd.eta) = ?
    ORDER BY vd.eta DESC
  `,

  // Get vessel productivity (CMPH - Container Moves Per Hour)
  VESSEL_PRODUCTIVITY: `
    SELECT
      argo.id AS visitId,
      vslnm.name AS vesselName,
      argo.phase,
      COUNT(*) AS totalMoves,
      ROUND(TIMESTAMPDIFF(MINUTE,
        MIN(CASE WHEN ime.move_kind = 'DSCH' THEN ime.t_fetch ELSE ime.t_put END),
        MAX(CASE WHEN ime.move_kind = 'DSCH' THEN ime.t_fetch ELSE ime.t_put END)
      ) / 60.0, 2) AS workingHours,
      ROUND(
        COUNT(*) /
        NULLIF(TIMESTAMPDIFF(MINUTE,
          MIN(CASE WHEN ime.move_kind = 'DSCH' THEN ime.t_fetch ELSE ime.t_put END),
          MAX(CASE WHEN ime.move_kind = 'DSCH' THEN ime.t_fetch ELSE ime.t_put END)
        ) / 60.0, 0),
        2
      ) AS cmph
    FROM inv_move_event ime
    JOIN argo_carrier_visit argo ON argo.id = (
      CASE WHEN ime.move_kind = 'DSCH' THEN ime.FM_pos_locid ELSE ime.TO_pos_locid END
    )
    JOIN vsl_vessel_visit_details vvd ON vvd.vvd_gkey = argo.cvcvd_gkey
    JOIN vsl_vessels vslnm ON vslnm.gkey = vvd.vessel_gkey
    WHERE argo.carrier_mode = 'VESSEL'
      AND ime.move_kind IN ('DSCH', 'LOAD')
      AND vslnm.name LIKE ?
    GROUP BY argo.id, vslnm.name, argo.phase
    HAVING COUNT(*) > 0
    ORDER BY argo.ata DESC
    LIMIT 10
  `,

  // Get vessel cranes with first and last move times
  VESSEL_CRANES: `
    SELECT
      qc.full_name AS crane,
      DATE_FORMAT(MIN(
        CASE WHEN a.move_kind = 'LOAD' THEN a.t_put WHEN a.move_kind = 'DSCH' THEN t_discharge END
      ), '%Y-%m-%dT%H:%i:%s') AS first_move,
      DATE_FORMAT(MAX(
        CASE WHEN a.move_kind = 'LOAD' THEN a.t_put WHEN a.move_kind = 'DSCH' THEN t_discharge END
      ), '%Y-%m-%dT%H:%i:%s') AS latest_move
    FROM inv_move_event a
    JOIN xps_che qc ON (
      CASE WHEN a.move_kind = 'DSCH' THEN a.che_fetch WHEN a.move_kind = 'LOAD' THEN a.che_put END
    ) = qc.gkey
    WHERE (
      CASE WHEN a.move_kind = 'DSCH' THEN a.FM_pos_locid WHEN a.move_kind = 'LOAD' THEN a.TO_pos_locid END
    ) = ?
      AND (
        CASE WHEN a.move_kind = 'LOAD' THEN a.t_put WHEN a.move_kind = 'DSCH' THEN t_discharge END
      ) IS NOT NULL
      AND qc.full_name LIKE '%QC%'
    GROUP BY qc.full_name
  `,

  // Get vessel's longest working crane
  VESSEL_LONGEST_CRANE: `
    SELECT
      a.carrier_locid AS VesselVisitId,
      b.CraneName AS CraneName
    FROM (
      SELECT
        MAX(est_move_time) AS topp,
        carrier_locid
      FROM (
        SELECT
          pow.name AS CraneName,
          wi.carrier_locid,
          wi.est_move_time
        FROM inv_wi wi
        LEFT JOIN inv_wq wq ON wi.work_queue_gkey = wq.gkey
        LEFT JOIN argo_carrier_visit argo ON argo.id = wi.carrier_locid
        LEFT JOIN xps_craneshift cs ON cs.gkey = wq.first_shift_gkey
        LEFT JOIN xps_pointofwork pow ON cs.owner_pow_gkey = pow.gkey
        WHERE wi.move_kind IN ('LOAD', 'DSCH')
          AND argo.phase = '40WORKING'
      ) lgcr
      GROUP BY carrier_locid
    ) a
    LEFT JOIN (
      SELECT
        pow.name AS CraneName,
        wi.carrier_locid,
        wi.est_move_time
      FROM inv_wi wi
      LEFT JOIN inv_wq wq ON wi.work_queue_gkey = wq.gkey
      LEFT JOIN argo_carrier_visit argo ON argo.id = wi.carrier_locid
      LEFT JOIN xps_craneshift cs ON cs.gkey = wq.first_shift_gkey
      LEFT JOIN xps_pointofwork pow ON cs.owner_pow_gkey = pow.gkey
      WHERE wi.move_kind IN ('LOAD', 'DSCH')
        AND argo.phase = '40WORKING'
    ) b ON a.topp = b.est_move_time AND a.carrier_locid = b.carrier_locid
  `,

  // Get inbound vessels for date range
  INBOUND_VESSELS_DATE_RANGE: `
    SELECT
      acv.ID AS VISITID,
      vsl.NAME AS VESSELNAME,
      acv.PHASE AS PHASE,
      service.id AS SERVICE,
      op.id AS LINE,
      YEAR(avd.etd) AS YEAR,
      MONTH(avd.etd) AS MONTH,
      WEEK(avd.etd, 3) AS WEEK,
      avd.ETA AS ETA,
      avd.ETD AS ETD,
      ROUND(TIMESTAMPDIFF(HOUR, avd.ETA, avd.ETD), 2) AS PORTHOURS,
      COALESCE(avd.EST_DISCHARGE, 0) + COALESCE(avd.EST_LOAD, 0) +
      COALESCE(avd.EST_RESTOW, 0) + COALESCE(avd.EST_SHIFT, 0) AS ESTIMATEDMOVES
    FROM argo_carrier_visit acv
    JOIN argo_visit_details avd ON acv.CVCVD_GKEY = avd.GKEY
    LEFT JOIN ref_carrier_service service ON service.GKEY = avd.SERVICE
    LEFT JOIN vsl_vessel_visit_details vvd ON vvd.VVD_GKEY = avd.GKEY
    LEFT JOIN vsl_vessels vsl ON vvd.VESSEL_GKEY = vsl.GKEY
    LEFT JOIN ref_bizunit_scoped op ON op.GKEY = vsl.OWNER_GKEY
    WHERE acv.CARRIER_MODE = 'VESSEL'
      AND acv.PHASE != '80CANCELED'
      AND avd.ETD >= ?
      AND avd.ETD <= ?
    ORDER BY avd.ETA ASC
  `,

  // Get crane delays (historical)
  CRANE_DELAYS_HISTORICAL: `
    SELECT
      che.full_name AS crane,
      csd.delay_date AS start_time,
      csd.time AS duration_minutes,
      cdt.id AS delay_code,
      cdt.description AS delay_description,
      cdt.delay_category,
      acv.id AS vessel_visit_id,
      vsl.name AS vessel_name
    FROM vsl_crane_statistics_delays csd
    JOIN ref_crane_delay_types cdt ON cdt.gkey = csd.crane_delay_type_gkey
    JOIN vsl_crane_statistics vcs ON vcs.gkey = csd.cstat_gkey
    JOIN vsl_vessel_visit_details vvd ON vvd.vvd_gkey = vcs.vvd_gkey
    JOIN argo_visit_details avd ON avd.gkey = vvd.vvd_gkey
    JOIN argo_carrier_visit acv ON acv.cvcvd_gkey = avd.gkey
    JOIN xps_che che ON che.gkey = vcs.crane_gkey
    LEFT JOIN vsl_vessels vsl ON vsl.gkey = vvd.vessel_gkey
    WHERE (? IS NULL OR acv.id = ?)
    ORDER BY csd.delay_date DESC, che.full_name
  `,

  // Crane delay summary grouped by category
  CRANE_DELAYS_SUMMARY: `
    SELECT
      cdt.delay_category AS category,
      cdt.description AS delay_type,
      COUNT(*) AS occurrence_count,
      SUM(csd.time) AS total_minutes,
      ROUND(AVG(csd.time), 1) AS avg_minutes
    FROM vsl_crane_statistics_delays csd
    JOIN ref_crane_delay_types cdt ON cdt.gkey = csd.crane_delay_type_gkey
    GROUP BY cdt.delay_category, cdt.description
    ORDER BY total_minutes DESC
  `,

  // Crane delays by crane (which crane has most delays)
  CRANE_DELAYS_BY_CRANE: `
    SELECT
      che.full_name AS crane,
      COUNT(*) AS delay_count,
      SUM(csd.time) AS total_delay_minutes,
      ROUND(AVG(csd.time), 1) AS avg_delay_minutes
    FROM vsl_crane_statistics_delays csd
    JOIN vsl_crane_statistics vcs ON vcs.gkey = csd.cstat_gkey
    JOIN xps_che che ON che.gkey = vcs.crane_gkey
    GROUP BY che.full_name
    ORDER BY total_delay_minutes DESC
  `,

  // Yard inventory: units and TEUs by category (import/export/transship) and reefer/dry
  YARD_INVENTORY_BY_CATEGORY: `
    SELECT
      unit.category AS category,
      CASE WHEN unit.requires_power = 1 THEN 'Reefer' ELSE 'Dry' END AS reefer_dry,
      COUNT(*) AS units_in_yard,
      ROUND(SUM(CAST(REPLACE(reqt.basic_length, 'BASIC', '') AS UNSIGNED) / 20), 2) AS teus_in_yard
    FROM inv_unit unit
    JOIN inv_unit_fcy_visit iufv ON unit.gkey = iufv.unit_gkey
    JOIN ref_equipment reqm ON reqm.gkey = unit.eq_gkey
    JOIN ref_equip_type reqt ON reqt.gkey = reqm.eqtyp_gkey
    WHERE iufv.transit_state = 'S40_YARD'
      AND SUBSTRING(iufv.last_pos_slot, 1, 2) NOT IN ('??','IN','WA','WS')
    GROUP BY unit.category, CASE WHEN unit.requires_power = 1 THEN 'Reefer' ELSE 'Dry' END
    ORDER BY units_in_yard DESC
  `,

  // Yard inventory: units and TEUs by block
  YARD_INVENTORY_BY_BLOCK: `
    SELECT
      SUBSTRING(iufv.last_pos_slot, 1, 2) AS block,
      unit.category AS category,
      COUNT(*) AS units_in_yard,
      ROUND(SUM(CAST(REPLACE(reqt.basic_length, 'BASIC', '') AS UNSIGNED) / 20), 2) AS teus_in_yard,
      SUM(unit.requires_power) AS reefer_count,
      SUM(unit.is_hazardous) AS hazardous_count
    FROM inv_unit unit
    JOIN inv_unit_fcy_visit iufv ON unit.gkey = iufv.unit_gkey
    JOIN ref_equipment reqm ON reqm.gkey = unit.eq_gkey
    JOIN ref_equip_type reqt ON reqt.gkey = reqm.eqtyp_gkey
    WHERE iufv.transit_state = 'S40_YARD'
      AND SUBSTRING(iufv.last_pos_slot, 1, 2) NOT IN ('??','IN','WA','WS')
    GROUP BY SUBSTRING(iufv.last_pos_slot, 1, 2), unit.category
    ORDER BY block, category
  `,

  // Gate truck transactions (in/out) for a date range
  GATE_ACTIVITY: `
    SELECT
      DATE(COALESCE(time_in, time_out)) AS activity_date,
      sub_type,
      COUNT(*) AS transaction_count,
      COUNT(CASE WHEN sub_type LIKE 'R%' THEN 1 END) AS receive_count,
      COUNT(CASE WHEN sub_type LIKE 'D%' THEN 1 END) AS delivery_count,
      SUM(CASE WHEN COALESCE(temp_required, 0) != 0 THEN 1 ELSE 0 END) AS reefer_count,
      SUM(is_hazard) AS hazardous_count
    FROM road_truck_transactions
    WHERE status = 'COMPLETE'
      AND COALESCE(time_in, time_out) >= COALESCE(?, DATE(NOW()))
      AND COALESCE(time_in, time_out) < DATE_ADD(COALESCE(?, DATE(NOW())), INTERVAL 1 DAY)
    GROUP BY DATE(COALESCE(time_in, time_out)), sub_type
    ORDER BY activity_date DESC, sub_type
  `,

  // Gate truck turnaround times
  GATE_TRUCK_TURNAROUND: `
    SELECT
      truck_license_nbr,
      ctr_id AS container,
      sub_type,
      line_id AS line,
      ctr_freight_kind AS freight_kind,
      time_in,
      time_out,
      ROUND(TIMESTAMPDIFF(MINUTE, time_in, time_out), 0) AS turnaround_minutes
    FROM road_truck_transactions
    WHERE status = 'COMPLETE'
      AND time_in IS NOT NULL
      AND time_out IS NOT NULL
      AND DATE(time_in) = COALESCE(?, DATE(NOW()))
    ORDER BY time_in DESC
    LIMIT 100
  `,

  // Equipment (CHE) list with types
  EQUIPMENT_LIST: `
    SELECT
      id,
      full_name,
      kind_enum AS equipment_type,
      active
    FROM xps_che
    WHERE active = 1
    ORDER BY kind_enum, full_name
  `,

  // Equipment moves per day for a given month (MySQL version of che_daily)
  EQUIPMENT_DAILY_MOVES: `
    SELECT
      DATE(COALESCE(ime.t_fetch, ime.t_put)) AS move_date,
      che.full_name AS equipment_name,
      che.kind_enum AS equipment_type,
      COUNT(*) AS total_moves,
      SUM(CASE WHEN ime.move_kind = 'DSCH' THEN 1 ELSE 0 END) AS discharge_moves,
      SUM(CASE WHEN ime.move_kind = 'LOAD' THEN 1 ELSE 0 END) AS load_moves
    FROM inv_move_event ime
    JOIN xps_che che ON che.gkey IN (ime.che_fetch, ime.che_put)
    WHERE che.kind_enum = ?
      AND COALESCE(ime.t_fetch, ime.t_put) >= ?
      AND COALESCE(ime.t_fetch, ime.t_put) < DATE_ADD(?, INTERVAL 1 DAY)
    GROUP BY DATE(COALESCE(ime.t_fetch, ime.t_put)), che.full_name, che.kind_enum
    ORDER BY move_date DESC, equipment_name
  `,

  // Dwell time by category
  DWELL_TIME_BY_CATEGORY: `
    SELECT
      unit.category,
      CASE WHEN unit.requires_power = 1 THEN 'Reefer' ELSE 'Dry' END AS reefer_dry,
      COUNT(*) AS total_units,
      ROUND(AVG(TIMESTAMPDIFF(HOUR, iufv.time_in, COALESCE(iufv.time_out, NOW())) / 24), 1) AS avg_dwell_days,
      ROUND(MAX(TIMESTAMPDIFF(HOUR, iufv.time_in, COALESCE(iufv.time_out, NOW())) / 24), 1) AS max_dwell_days
    FROM inv_unit unit
    JOIN inv_unit_fcy_visit iufv ON unit.gkey = iufv.unit_gkey
    WHERE iufv.transit_state = 'S40_YARD'
      AND SUBSTRING(iufv.last_pos_slot, 1, 2) NOT IN ('??','IN','WA','WS')
    GROUP BY unit.category, CASE WHEN unit.requires_power = 1 THEN 'Reefer' ELSE 'Dry' END
    ORDER BY avg_dwell_days DESC
  `,

  // Crane moves detail for a vessel (discharge vs load, per crane)
  CRANE_MOVES_BY_VESSEL: `
    SELECT
      qc.full_name AS crane,
      a.move_kind,
      COUNT(*) AS move_count,
      CASE WHEN a.length_mm IN (6096, 6068, 6066) THEN 20 ELSE 40 END AS container_length
    FROM inv_move_event a
    JOIN xps_che qc ON (
      CASE WHEN a.move_kind = 'DSCH' THEN a.che_fetch WHEN a.move_kind = 'LOAD' THEN a.che_put END
    ) = qc.gkey
    WHERE (
      CASE WHEN a.move_kind = 'DSCH' THEN a.FM_pos_locid WHEN a.move_kind = 'LOAD' THEN a.TO_pos_locid END
    ) = ?
      AND qc.full_name LIKE '%QC%'
    GROUP BY qc.full_name, a.move_kind, CASE WHEN a.length_mm IN (6096, 6068, 6066) THEN 20 ELSE 40 END
    ORDER BY crane, a.move_kind
  `,

  // Vessel twin lift stats
  VESSEL_TWIN_STATS: `
    SELECT
      CASE WHEN ime.move_kind = 'LOAD' THEN ime.to_pos_locid ELSE ime.fm_pos_locid END AS visitId,
      COUNT(*) AS total_moves,
      SUM(CASE WHEN ime.move_kind = 'LOAD' THEN ime.twin_put ELSE ime.twin_fetch END) AS twin_moves,
      ROUND(
        SUM(CASE WHEN ime.move_kind = 'LOAD' THEN ime.twin_put ELSE ime.twin_fetch END) / COUNT(*) * 100,
      1) AS twin_percentage
    FROM inv_move_event ime
    JOIN xps_che qc ON (
      CASE WHEN ime.move_kind = 'LOAD' THEN qc.gkey = ime.che_put ELSE qc.gkey = ime.che_fetch END
    )
    JOIN argo_carrier_visit c ON c.id = (
      CASE WHEN ime.move_kind = 'LOAD' THEN ime.to_pos_locid ELSE ime.fm_pos_locid END
    )
    WHERE ime.move_kind IN ('LOAD', 'DSCH')
      AND c.id = ?
      AND qc.full_name LIKE '%QC%'
    GROUP BY CASE WHEN ime.move_kind = 'LOAD' THEN ime.to_pos_locid ELSE ime.fm_pos_locid END
  `,

  // KPI: Active vessels (arrived + working)
  // Terminal overview: all key metrics for today in one query set
  OVERVIEW_VESSELS_TODAY: `
    SELECT
      vsl.name AS vessel,
      argo.id AS visitId,
      SUBSTRING(argo.phase, 3) AS phase,
      argo.ata,
      vd.eta,
      vd.etd,
      COALESCE(em.moves, 0) AS executedMoves,
      COALESCE(pm.moves, 0) AS plannedMoves
    FROM argo_carrier_visit argo
    JOIN argo_visit_details vd ON vd.gkey = argo.cvcvd_gkey
    JOIN vsl_vessel_visit_details vvd ON vvd.vvd_gkey = argo.cvcvd_gkey
    JOIN vsl_vessels vsl ON vsl.gkey = vvd.vessel_gkey
    LEFT JOIN (
      SELECT CASE WHEN move_kind='DSCH' THEN FM_pos_locid ELSE TO_pos_locid END AS vid, COUNT(*) AS moves
      FROM inv_move_event WHERE move_kind IN ('DSCH','LOAD')
      GROUP BY CASE WHEN move_kind='DSCH' THEN FM_pos_locid ELSE TO_pos_locid END
    ) em ON em.vid = argo.id
    LEFT JOIN (
      SELECT carrier_locid AS vid, COUNT(*) AS moves FROM inv_wi WHERE move_kind IN ('DSCH','LOAD') GROUP BY carrier_locid
    ) pm ON pm.vid = argo.id
    WHERE argo.carrier_mode = 'VESSEL'
      AND argo.phase IN ('30ARRIVED','40WORKING','50COMPLETE')
      AND DATE(COALESCE(argo.ata, vd.eta)) = CURDATE()
    ORDER BY argo.ata DESC
  `,

  OVERVIEW_MOVES_BY_HOUR: `
    SELECT
      HOUR(COALESCE(t_fetch, t_put)) AS hour,
      SUM(CASE WHEN move_kind = 'DSCH' THEN 1 ELSE 0 END) AS discharge,
      SUM(CASE WHEN move_kind = 'LOAD' THEN 1 ELSE 0 END) AS load_moves,
      COUNT(*) AS total
    FROM inv_move_event
    WHERE move_kind IN ('DSCH', 'LOAD')
      AND DATE(COALESCE(t_fetch, t_put)) = CURDATE()
    GROUP BY HOUR(COALESCE(t_fetch, t_put))
    ORDER BY hour
  `,

  OVERVIEW_YARD_SUMMARY: `
    SELECT
      unit.category,
      CASE WHEN unit.requires_power = 1 THEN 'Reefer' ELSE 'Dry' END AS type,
      COUNT(*) AS units,
      ROUND(SUM(CAST(REPLACE(reqt.basic_length, 'BASIC', '') AS UNSIGNED) / 20), 0) AS teus
    FROM inv_unit unit
    JOIN inv_unit_fcy_visit iufv ON unit.gkey = iufv.unit_gkey
    JOIN ref_equipment reqm ON reqm.gkey = unit.eq_gkey
    JOIN ref_equip_type reqt ON reqt.gkey = reqm.eqtyp_gkey
    WHERE iufv.transit_state = 'S40_YARD'
      AND SUBSTRING(iufv.last_pos_slot, 1, 2) NOT IN ('??','IN','WA','WS')
    GROUP BY unit.category, CASE WHEN unit.requires_power = 1 THEN 'Reefer' ELSE 'Dry' END
    ORDER BY units DESC
  `,

  OVERVIEW_GATE_SUMMARY: `
    SELECT
      COUNT(*) AS total_transactions,
      SUM(CASE WHEN sub_type LIKE 'R%' THEN 1 ELSE 0 END) AS receives,
      SUM(CASE WHEN sub_type LIKE 'D%' THEN 1 ELSE 0 END) AS deliveries,
      SUM(CASE WHEN COALESCE(temp_required, 0) != 0 THEN 1 ELSE 0 END) AS reefers,
      SUM(is_hazard) AS hazardous,
      ROUND(AVG(TIMESTAMPDIFF(MINUTE, time_in, time_out)), 0) AS avg_turnaround_min
    FROM road_truck_transactions
    WHERE status = 'COMPLETE'
      AND DATE(COALESCE(time_in, time_out)) = CURDATE()
  `,

  OVERVIEW_DELAYS_TODAY: `
    SELECT
      cdt.delay_category AS category,
      COUNT(*) AS occurrences,
      SUM(csd.time) AS total_minutes
    FROM vsl_crane_statistics_delays csd
    JOIN ref_crane_delay_types cdt ON cdt.gkey = csd.crane_delay_type_gkey
    WHERE DATE(csd.delay_date) = CURDATE()
    GROUP BY cdt.delay_category
    ORDER BY total_minutes DESC
  `,

  OVERVIEW_CRANE_PRODUCTIVITY: `
    SELECT
      qc.full_name AS crane,
      COUNT(*) AS moves,
      ROUND(TIMESTAMPDIFF(MINUTE,
        MIN(CASE WHEN ime.move_kind='DSCH' THEN ime.t_fetch ELSE ime.t_put END),
        MAX(CASE WHEN ime.move_kind='DSCH' THEN ime.t_fetch ELSE ime.t_put END)
      ) / 60.0, 1) AS hours,
      ROUND(COUNT(*) / NULLIF(TIMESTAMPDIFF(MINUTE,
        MIN(CASE WHEN ime.move_kind='DSCH' THEN ime.t_fetch ELSE ime.t_put END),
        MAX(CASE WHEN ime.move_kind='DSCH' THEN ime.t_fetch ELSE ime.t_put END)
      ) / 60.0, 0), 1) AS cmph
    FROM inv_move_event ime
    JOIN xps_che qc ON qc.gkey = (CASE WHEN ime.move_kind='DSCH' THEN ime.che_fetch ELSE ime.che_put END)
    WHERE ime.move_kind IN ('DSCH','LOAD')
      AND DATE(COALESCE(ime.t_fetch, ime.t_put)) = CURDATE()
      AND qc.full_name LIKE '%QC%'
    GROUP BY qc.full_name
    ORDER BY moves DESC
  `,

  // Compare: this week vs last week moves
  COMPARE_WEEKLY_MOVES: `
    SELECT
      CASE WHEN YEARWEEK(COALESCE(t_fetch, t_put), 1) = YEARWEEK(CURDATE(), 1) THEN 'This Week' ELSE 'Last Week' END AS period,
      SUM(CASE WHEN move_kind = 'DSCH' THEN 1 ELSE 0 END) AS discharge,
      SUM(CASE WHEN move_kind = 'LOAD' THEN 1 ELSE 0 END) AS load_moves,
      COUNT(*) AS total
    FROM inv_move_event
    WHERE move_kind IN ('DSCH', 'LOAD')
      AND COALESCE(t_fetch, t_put) >= DATE_SUB(CURDATE(), INTERVAL (WEEKDAY(CURDATE()) + 7) DAY)
    GROUP BY CASE WHEN YEARWEEK(COALESCE(t_fetch, t_put), 1) = YEARWEEK(CURDATE(), 1) THEN 'This Week' ELSE 'Last Week' END
    ORDER BY period DESC
  `,

  // Compare: this week vs last week productivity per vessel
  COMPARE_WEEKLY_PRODUCTIVITY: `
    SELECT
      CASE WHEN YEARWEEK(COALESCE(ime.t_fetch, ime.t_put), 1) = YEARWEEK(CURDATE(), 1) THEN 'This Week' ELSE 'Last Week' END AS period,
      vsl.name AS vessel,
      argo.id AS visitId,
      COUNT(*) AS moves,
      ROUND(TIMESTAMPDIFF(MINUTE,
        MIN(CASE WHEN ime.move_kind='DSCH' THEN ime.t_fetch ELSE ime.t_put END),
        MAX(CASE WHEN ime.move_kind='DSCH' THEN ime.t_fetch ELSE ime.t_put END)
      ) / 60.0, 1) AS hours,
      ROUND(COUNT(*) / NULLIF(TIMESTAMPDIFF(MINUTE,
        MIN(CASE WHEN ime.move_kind='DSCH' THEN ime.t_fetch ELSE ime.t_put END),
        MAX(CASE WHEN ime.move_kind='DSCH' THEN ime.t_fetch ELSE ime.t_put END)
      ) / 60.0, 0), 1) AS cmph
    FROM inv_move_event ime
    JOIN argo_carrier_visit argo ON argo.id = (CASE WHEN ime.move_kind='DSCH' THEN ime.FM_pos_locid ELSE ime.TO_pos_locid END)
    JOIN vsl_vessel_visit_details vvd ON vvd.vvd_gkey = argo.cvcvd_gkey
    JOIN vsl_vessels vsl ON vsl.gkey = vvd.vessel_gkey
    WHERE ime.move_kind IN ('DSCH', 'LOAD')
      AND COALESCE(ime.t_fetch, ime.t_put) >= DATE_SUB(CURDATE(), INTERVAL (WEEKDAY(CURDATE()) + 7) DAY)
    GROUP BY period, vsl.name, argo.id
    HAVING COUNT(*) > 10
    ORDER BY period DESC, cmph DESC
  `,

  // Compare: this week vs last week delays
  COMPARE_WEEKLY_DELAYS: `
    SELECT
      CASE WHEN YEARWEEK(csd.delay_date, 1) = YEARWEEK(CURDATE(), 1) THEN 'This Week' ELSE 'Last Week' END AS period,
      cdt.delay_category AS category,
      COUNT(*) AS occurrences,
      SUM(csd.time) AS total_minutes
    FROM vsl_crane_statistics_delays csd
    JOIN ref_crane_delay_types cdt ON cdt.gkey = csd.crane_delay_type_gkey
    WHERE csd.delay_date >= DATE_SUB(CURDATE(), INTERVAL (WEEKDAY(CURDATE()) + 7) DAY)
    GROUP BY period, cdt.delay_category
    ORDER BY period DESC, total_minutes DESC
  `,

  // HQ: Top/bottom vessels by CMPH this month
  HQ_VESSEL_RANKING: `
    SELECT vessel, visitId, phase, moves, hours, cmph,
      RANK() OVER (ORDER BY cmph DESC) AS rank_best,
      RANK() OVER (ORDER BY cmph ASC) AS rank_worst
    FROM (
      SELECT vsl.name AS vessel, argo.id AS visitId, argo.phase,
        COUNT(*) AS moves,
        ROUND(TIMESTAMPDIFF(MINUTE,
          MIN(CASE WHEN ime.move_kind='DSCH' THEN ime.t_fetch ELSE ime.t_put END),
          MAX(CASE WHEN ime.move_kind='DSCH' THEN ime.t_fetch ELSE ime.t_put END)
        ) / 60.0, 1) AS hours,
        ROUND(COUNT(*) / NULLIF(TIMESTAMPDIFF(MINUTE,
          MIN(CASE WHEN ime.move_kind='DSCH' THEN ime.t_fetch ELSE ime.t_put END),
          MAX(CASE WHEN ime.move_kind='DSCH' THEN ime.t_fetch ELSE ime.t_put END)
        ) / 60.0, 0), 1) AS cmph
      FROM inv_move_event ime
      JOIN argo_carrier_visit argo ON argo.id = (CASE WHEN ime.move_kind='DSCH' THEN ime.FM_pos_locid ELSE ime.TO_pos_locid END)
      JOIN vsl_vessel_visit_details vvd ON vvd.vvd_gkey = argo.cvcvd_gkey
      JOIN vsl_vessels vsl ON vsl.gkey = vvd.vessel_gkey
      WHERE ime.move_kind IN ('DSCH','LOAD')
        AND MONTH(COALESCE(ime.t_fetch, ime.t_put)) = MONTH(CURDATE())
        AND YEAR(COALESCE(ime.t_fetch, ime.t_put)) = YEAR(CURDATE())
      GROUP BY vsl.name, argo.id, argo.phase
      HAVING COUNT(*) > 20
    ) ranked
    ORDER BY cmph DESC
  `,

  // HQ: Delay breakdown by category with percentages
  HQ_DELAY_BREAKDOWN: `
    SELECT
      cdt.delay_category AS category,
      COUNT(*) AS occurrences,
      SUM(csd.time) AS total_minutes,
      ROUND(SUM(csd.time) / (SELECT SUM(time) FROM vsl_crane_statistics_delays WHERE MONTH(delay_date) = MONTH(CURDATE())) * 100, 1) AS pct_of_total
    FROM vsl_crane_statistics_delays csd
    JOIN ref_crane_delay_types cdt ON cdt.gkey = csd.crane_delay_type_gkey
    WHERE MONTH(csd.delay_date) = MONTH(CURDATE()) AND YEAR(csd.delay_date) = YEAR(CURDATE())
    GROUP BY cdt.delay_category
    ORDER BY total_minutes DESC
  `,

  // HQ: Delay root causes per vessel (top offenders)
  HQ_DELAY_BY_VESSEL: `
    SELECT
      vsl.name AS vessel, acv.id AS visitId,
      COUNT(*) AS delay_count,
      SUM(csd.time) AS total_delay_min,
      GROUP_CONCAT(DISTINCT cdt.delay_category ORDER BY cdt.delay_category SEPARATOR ', ') AS categories
    FROM vsl_crane_statistics_delays csd
    JOIN ref_crane_delay_types cdt ON cdt.gkey = csd.crane_delay_type_gkey
    JOIN vsl_crane_statistics vcs ON vcs.gkey = csd.cstat_gkey
    JOIN vsl_vessel_visit_details vvd ON vvd.vvd_gkey = vcs.vvd_gkey
    JOIN argo_visit_details avd ON avd.gkey = vvd.vvd_gkey
    JOIN argo_carrier_visit acv ON acv.cvcvd_gkey = avd.gkey
    JOIN vsl_vessels vsl ON vsl.gkey = vvd.vessel_gkey
    WHERE MONTH(csd.delay_date) = MONTH(CURDATE()) AND YEAR(csd.delay_date) = YEAR(CURDATE())
    GROUP BY vsl.name, acv.id
    ORDER BY total_delay_min DESC
    LIMIT 15
  `,

  // HQ: Monthly CMPH average
  HQ_MONTHLY_CMPH: `
    SELECT
      ROUND(AVG(cmph), 1) AS avg_cmph,
      ROUND(MIN(cmph), 1) AS min_cmph,
      ROUND(MAX(cmph), 1) AS max_cmph,
      COUNT(*) AS vessel_count,
      SUM(moves) AS total_moves
    FROM (
      SELECT
        COUNT(*) AS moves,
        ROUND(COUNT(*) / NULLIF(TIMESTAMPDIFF(MINUTE,
          MIN(CASE WHEN ime.move_kind='DSCH' THEN ime.t_fetch ELSE ime.t_put END),
          MAX(CASE WHEN ime.move_kind='DSCH' THEN ime.t_fetch ELSE ime.t_put END)
        ) / 60.0, 0), 1) AS cmph
      FROM inv_move_event ime
      JOIN argo_carrier_visit argo ON argo.id = (CASE WHEN ime.move_kind='DSCH' THEN ime.FM_pos_locid ELSE ime.TO_pos_locid END)
      WHERE ime.move_kind IN ('DSCH','LOAD')
        AND MONTH(COALESCE(ime.t_fetch, ime.t_put)) = MONTH(CURDATE())
        AND YEAR(COALESCE(ime.t_fetch, ime.t_put)) = YEAR(CURDATE())
      GROUP BY argo.id
      HAVING COUNT(*) > 20
    ) vessels
  `,

  // HQ: Gate hourly throughput pattern
  HQ_GATE_HOURLY: `
    SELECT
      HOUR(COALESCE(time_in, time_out)) AS hour,
      COUNT(*) AS transactions,
      SUM(CASE WHEN sub_type LIKE 'R%' THEN 1 ELSE 0 END) AS receives,
      SUM(CASE WHEN sub_type LIKE 'D%' THEN 1 ELSE 0 END) AS deliveries,
      ROUND(AVG(TIMESTAMPDIFF(MINUTE, time_in, time_out)), 0) AS avg_turnaround
    FROM road_truck_transactions
    WHERE status = 'COMPLETE'
      AND COALESCE(time_in, time_out) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
    GROUP BY HOUR(COALESCE(time_in, time_out))
    ORDER BY hour
  `,

  // HQ: Berth utilization (vessels per day this month)
  HQ_BERTH_UTILIZATION: `
    SELECT
      DATE(COALESCE(ata, vd.eta)) AS day,
      COUNT(*) AS vessels,
      SUM(CASE WHEN phase = '40WORKING' THEN 1 ELSE 0 END) AS working,
      SUM(CASE WHEN phase IN ('50COMPLETE','60DEPARTED','70CLOSED') THEN 1 ELSE 0 END) AS completed
    FROM argo_carrier_visit acv
    JOIN argo_visit_details vd ON vd.gkey = acv.cvcvd_gkey
    WHERE acv.carrier_mode = 'VESSEL'
      AND acv.phase IN ('30ARRIVED','40WORKING','50COMPLETE','60DEPARTED','70CLOSED')
      AND COALESCE(acv.ata, vd.eta) >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
    GROUP BY DATE(COALESCE(ata, vd.eta))
    ORDER BY day DESC
  `,

  KPI_ACTIVE_VESSELS: `
    SELECT COUNT(*) AS count
    FROM argo_carrier_visit acv
    JOIN argo_visit_details avd ON avd.gkey = acv.cvcvd_gkey
    WHERE acv.carrier_mode = 'VESSEL'
      AND acv.phase IN ('30ARRIVED', '40WORKING')
      AND DATE(COALESCE(acv.ata, avd.eta)) = CURDATE()
  `,

  // KPI: Total moves today
  KPI_TOTAL_MOVES_TODAY: `
    SELECT COUNT(*) AS count
    FROM inv_move_event
    WHERE move_kind IN ('DSCH', 'LOAD')
      AND DATE(COALESCE(t_fetch, t_put)) = CURDATE()
  `,

  // KPI: Yard TEUs
  KPI_YARD_TEUS: `
    SELECT ROUND(SUM(CAST(REPLACE(reqt.basic_length, 'BASIC', '') AS UNSIGNED) / 20), 0) AS teus
    FROM inv_unit unit
    JOIN inv_unit_fcy_visit iufv ON unit.gkey = iufv.unit_gkey
    JOIN ref_equipment reqm ON reqm.gkey = unit.eq_gkey
    JOIN ref_equip_type reqt ON reqt.gkey = reqm.eqtyp_gkey
    WHERE iufv.transit_state = 'S40_YARD'
      AND SUBSTRING(iufv.last_pos_slot, 1, 2) NOT IN ('??','IN','WA','WS')
  `,

  // KPI: Average truck turnaround today (minutes)
  KPI_AVG_TURNAROUND: `
    SELECT ROUND(AVG(TIMESTAMPDIFF(MINUTE, time_in, time_out)), 0) AS avg_minutes
    FROM road_truck_transactions
    WHERE status = 'COMPLETE'
      AND time_in IS NOT NULL AND time_out IS NOT NULL
      AND DATE(time_in) = CURDATE()
  `
};
