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
      argo.ata AS allfast,
      vvd.start_work AS firstlift,
      vvd.FLEX_DATE07 AS firstLine,
      argo.atd AS atd,
      vd.eta AS eta,
      vd.etd AS etd,
      ROUND(TIMESTAMPDIFF(HOUR, vd.eta, vd.etd), 2) AS PORTHOURS,
      COALESCE(vd.EST_DISCHARGE, 0) + COALESCE(vd.EST_LOAD, 0) +
      COALESCE(vd.EST_RESTOW, 0) + COALESCE(vd.EST_SHIFT, 0) AS ESTIMATEDMOVES,
      ROUND(TIMESTAMPDIFF(HOUR, argo.ata, argo.atd), 2) AS portstayExecuted,
      ROUND(TIMESTAMPDIFF(MINUTE, argo.ata, vvd.start_work), 0) AS idleArrival,
      ROUND(TIMESTAMPDIFF(MINUTE, vvd.end_work, argo.atd), 0) AS idleDeparture
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

  // Get vessel productivity (CMPH - Container Moves Per Hour)
  VESSEL_PRODUCTIVITY: `
    SELECT
      argo.id AS visitId,
      vslnm.name AS vesselName,
      COUNT(CASE WHEN ime.move_kind IN ('DSCH', 'LOAD') THEN 1 END) AS totalMoves,
      ROUND(TIMESTAMPDIFF(HOUR, vvd.start_work, vvd.end_work), 2) AS workingHours,
      ROUND(
        COUNT(CASE WHEN ime.move_kind IN ('DSCH', 'LOAD') THEN 1 END) /
        NULLIF(TIMESTAMPDIFF(HOUR, vvd.start_work, vvd.end_work), 0),
        2
      ) AS cmph
    FROM vsl_vessel_visit_details vvd
    LEFT JOIN argo_carrier_visit argo ON argo.cvcvd_gkey = vvd.vvd_gkey
    LEFT JOIN vsl_vessels vslnm ON vslnm.gkey = vvd.vessel_gkey
    LEFT JOIN inv_move_event ime ON
      (ime.FM_pos_locid = argo.id AND ime.move_kind = 'DSCH') OR
      (ime.TO_pos_locid = argo.id AND ime.move_kind = 'LOAD')
    WHERE argo.carrier_mode = 'VESSEL'
      AND vslnm.name LIKE ?
      AND vvd.start_work IS NOT NULL
      AND vvd.end_work IS NOT NULL
    GROUP BY argo.id, vslnm.name, vvd.start_work, vvd.end_work
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
      crane,
      start_time,
      SEC_TO_TIME(SUM(duration_min) * 60) AS duration,
      delay_code,
      delay_description,
      vessel_visit_id
    FROM (
      SELECT
        acv.id AS vessel_visit_id,
        che.short_name AS crane,
        csd.delay_date AS start_time,
        csd.time AS duration_min,
        cdt.id AS delay_code,
        cdt.description AS delay_description,
        cdt.delay_category AS delay_category
      FROM vsl_crane_statistics_delays csd
      LEFT JOIN ref_crane_delay_types cdt ON cdt.gkey = csd.crane_delay_type_gkey
      LEFT JOIN vsl_crane_statistics vcs ON vcs.gkey = csd.cstat_gkey
      LEFT JOIN vsl_vessel_visit_details vvd ON vvd.vvd_gkey = vcs.vvd_gkey
      LEFT JOIN argo_visit_details avd ON avd.gkey = vvd.vvd_gkey
      LEFT JOIN argo_carrier_visit acv ON acv.cvcvd_gkey = avd.gkey
      LEFT JOIN xps_che che ON che.gkey = vcs.crane_gkey
      WHERE (? IS NULL OR acv.id = ?)
    ) Delays_raw
    GROUP BY vessel_visit_id, crane, start_time, delay_code, delay_description
    ORDER BY start_time DESC, crane, vessel_visit_id
  `
};
