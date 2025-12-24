-- APM Terminal Demo Database
-- MySQL Script for Testing MCP Server with Crane and Delay Data

-- Create database
CREATE DATABASE IF NOT EXISTS apm_terminal;
USE apm_terminal;

-- Drop tables if they exist (in correct order due to foreign keys - children first)
DROP TABLE IF EXISTS vsl_crane_statistics_delays;
DROP TABLE IF EXISTS vsl_crane_statistics;
DROP TABLE IF EXISTS ref_crane_delay_types;
DROP TABLE IF EXISTS inv_wi;
DROP TABLE IF EXISTS inv_move_event;
DROP TABLE IF EXISTS inv_wq;
DROP TABLE IF EXISTS xps_craneshift;
DROP TABLE IF EXISTS xps_pointofwork;
DROP TABLE IF EXISTS xps_che;
DROP TABLE IF EXISTS vsl_vessel_visit_details;
DROP TABLE IF EXISTS argo_carrier_visit;
DROP TABLE IF EXISTS argo_visit_details;
DROP TABLE IF EXISTS vsl_vessels;
DROP TABLE IF EXISTS ref_carrier_service;
DROP TABLE IF EXISTS ref_bizunit_scoped;

-- Reference tables
CREATE TABLE ref_bizunit_scoped (
    GKEY BIGINT PRIMARY KEY AUTO_INCREMENT,
    id VARCHAR(50) NOT NULL,
    name VARCHAR(100)
);

CREATE TABLE ref_carrier_service (
    GKEY BIGINT PRIMARY KEY AUTO_INCREMENT,
    id VARCHAR(50) NOT NULL,
    name VARCHAR(100)
);

CREATE TABLE vsl_vessels (
    gkey BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    OWNER_GKEY BIGINT,
    FOREIGN KEY (OWNER_GKEY) REFERENCES ref_bizunit_scoped(GKEY)
);

CREATE TABLE argo_visit_details (
    gkey BIGINT PRIMARY KEY AUTO_INCREMENT,
    eta DATETIME,
    etd DATETIME,
    service BIGINT,
    EST_DISCHARGE INT DEFAULT 0,
    EST_LOAD INT DEFAULT 0,
    EST_RESTOW INT DEFAULT 0,
    EST_SHIFT INT DEFAULT 0,
    FOREIGN KEY (service) REFERENCES ref_carrier_service(GKEY)
);

CREATE TABLE argo_carrier_visit (
    gkey BIGINT PRIMARY KEY AUTO_INCREMENT,
    id VARCHAR(50) NOT NULL UNIQUE,
    carrier_mode VARCHAR(20) DEFAULT 'VESSEL',
    phase VARCHAR(20),
    ata DATETIME,
    atd DATETIME,
    cvcvd_gkey BIGINT,
    FOREIGN KEY (cvcvd_gkey) REFERENCES argo_visit_details(gkey)
);

CREATE TABLE vsl_vessel_visit_details (
    gkey BIGINT PRIMARY KEY AUTO_INCREMENT,
    vvd_gkey BIGINT,
    vessel_gkey BIGINT,
    start_work DATETIME,
    end_work DATETIME,
    FLEX_DATE07 DATETIME,
    FOREIGN KEY (vvd_gkey) REFERENCES argo_visit_details(gkey),
    FOREIGN KEY (vessel_gkey) REFERENCES vsl_vessels(gkey)
);

-- Crane and Equipment tables
CREATE TABLE xps_che (
    gkey BIGINT PRIMARY KEY AUTO_INCREMENT,
    full_name VARCHAR(100) NOT NULL,
    short_name VARCHAR(50) NOT NULL,
    che_type VARCHAR(50) DEFAULT 'QUAY_CRANE',
    status VARCHAR(20) DEFAULT 'ACTIVE'
);

CREATE TABLE xps_pointofwork (
    gkey BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    description VARCHAR(200)
);

CREATE TABLE xps_craneshift (
    gkey BIGINT PRIMARY KEY AUTO_INCREMENT,
    owner_pow_gkey BIGINT,
    shift_start DATETIME,
    shift_end DATETIME,
    FOREIGN KEY (owner_pow_gkey) REFERENCES xps_pointofwork(gkey)
);

CREATE TABLE inv_wq (
    gkey BIGINT PRIMARY KEY AUTO_INCREMENT,
    first_shift_gkey BIGINT,
    queue_name VARCHAR(100),
    FOREIGN KEY (first_shift_gkey) REFERENCES xps_craneshift(gkey)
);

CREATE TABLE inv_move_event (
    gkey BIGINT PRIMARY KEY AUTO_INCREMENT,
    move_kind VARCHAR(10),
    FM_pos_locid VARCHAR(50),
    TO_pos_locid VARCHAR(50),
    moved DATETIME,
    container_id VARCHAR(50),
    che_fetch BIGINT,
    che_put BIGINT,
    t_discharge DATETIME,
    t_put DATETIME,
    FOREIGN KEY (che_fetch) REFERENCES xps_che(gkey),
    FOREIGN KEY (che_put) REFERENCES xps_che(gkey)
);

CREATE TABLE inv_wi (
    gkey BIGINT PRIMARY KEY AUTO_INCREMENT,
    carrier_locid VARCHAR(50),
    move_kind VARCHAR(10),
    container_id VARCHAR(50),
    work_queue_gkey BIGINT,
    est_move_time DECIMAL(10,2),
    FOREIGN KEY (work_queue_gkey) REFERENCES inv_wq(gkey)
);

-- Crane Statistics and Delays
CREATE TABLE ref_crane_delay_types (
    gkey BIGINT PRIMARY KEY AUTO_INCREMENT,
    id VARCHAR(50) NOT NULL,
    description VARCHAR(200),
    delay_category VARCHAR(50)
);

CREATE TABLE vsl_crane_statistics (
    gkey BIGINT PRIMARY KEY AUTO_INCREMENT,
    vvd_gkey BIGINT,
    crane_gkey BIGINT,
    total_moves INT DEFAULT 0,
    FOREIGN KEY (vvd_gkey) REFERENCES vsl_vessel_visit_details(vvd_gkey),
    FOREIGN KEY (crane_gkey) REFERENCES xps_che(gkey)
);

CREATE TABLE vsl_crane_statistics_delays (
    gkey BIGINT PRIMARY KEY AUTO_INCREMENT,
    cstat_gkey BIGINT,
    crane_delay_type_gkey BIGINT,
    delay_date DATETIME,
    time INT,
    notes VARCHAR(500),
    FOREIGN KEY (cstat_gkey) REFERENCES vsl_crane_statistics(gkey),
    FOREIGN KEY (crane_delay_type_gkey) REFERENCES ref_crane_delay_types(gkey)
);

-- Insert sample data

-- Business Units (Shipping Lines)
INSERT INTO ref_bizunit_scoped (id, name) VALUES
('MSC', 'Mediterranean Shipping Company'),
('MAERSK', 'Maersk Line'),
('CMA', 'CMA CGM'),
('HAPAG', 'Hapag-Lloyd'),
('COSCO', 'COSCO Shipping');

-- Services
INSERT INTO ref_carrier_service (id, name) VALUES
('MEDEX', 'Mediterranean Express'),
('ATLANTIC', 'Atlantic Bridge'),
('ASIAMED', 'Asia Mediterranean'),
('EURAF', 'Europe Africa'),
('PACMED', 'Pacific Mediterranean');

-- Vessels
INSERT INTO vsl_vessels (name, OWNER_GKEY) VALUES
('MSC MEDITERRANEAN', 1),
('MAERSK ESSEX', 2),
('CMA CGM TANGER', 3),
('HAPAG EXPRESS', 4),
('COSCO GLORY', 5),
('MSC FORTUNE', 1),
('MAERSK TANGOR', 2);

-- Quay Cranes
INSERT INTO xps_che (full_name, short_name, che_type, status) VALUES
('QUAY_CRANE_QC01', 'QC01', 'QUAY_CRANE', 'ACTIVE'),
('QUAY_CRANE_QC02', 'QC02', 'QUAY_CRANE', 'ACTIVE'),
('QUAY_CRANE_QC03', 'QC03', 'QUAY_CRANE', 'ACTIVE'),
('QUAY_CRANE_QC04', 'QC04', 'QUAY_CRANE', 'ACTIVE'),
('QUAY_CRANE_QC05', 'QC05', 'QUAY_CRANE', 'ACTIVE'),
('QUAY_CRANE_QC06', 'QC06', 'QUAY_CRANE', 'ACTIVE');

-- Points of Work (Berth positions)
INSERT INTO xps_pointofwork (name, description) VALUES
('BERTH_A1', 'Berth A Position 1'),
('BERTH_A2', 'Berth A Position 2'),
('BERTH_B1', 'Berth B Position 1'),
('BERTH_B2', 'Berth B Position 2');

-- Crane Shifts
INSERT INTO xps_craneshift (owner_pow_gkey, shift_start, shift_end) VALUES
(1, DATE_SUB(NOW(), INTERVAL 8 HOUR), NOW()),
(1, DATE_SUB(NOW(), INTERVAL 8 HOUR), NOW()),
(2, DATE_SUB(NOW(), INTERVAL 8 HOUR), NOW()),
(2, DATE_SUB(NOW(), INTERVAL 8 HOUR), NOW()),
(3, DATE_SUB(NOW(), INTERVAL 24 HOUR), DATE_SUB(NOW(), INTERVAL 8 HOUR)),
(3, DATE_SUB(NOW(), INTERVAL 24 HOUR), DATE_SUB(NOW(), INTERVAL 8 HOUR));

-- Work Queues
INSERT INTO inv_wq (first_shift_gkey, queue_name) VALUES
(1, 'TNG001_QC01_QUEUE'),
(2, 'TNG001_QC02_QUEUE'),
(3, 'TNG001_QC03_QUEUE'),
(4, 'TNG002_QC04_QUEUE'),
(5, 'TNG003_QC01_QUEUE'),
(6, 'TNG003_QC02_QUEUE');

-- Delay Types
INSERT INTO ref_crane_delay_types (id, description, delay_category) VALUES
('MECH', 'Mechanical Breakdown', 'EQUIPMENT'),
('OPER', 'Operational Delay', 'OPERATIONAL'),
('WAIT', 'Waiting for Cargo', 'OPERATIONAL'),
('WEATHER', 'Weather Delay', 'ENVIRONMENTAL'),
('LABOR', 'Labor Issue', 'OPERATIONAL'),
('POWER', 'Power Failure', 'EQUIPMENT'),
('SAFETY', 'Safety Stop', 'OPERATIONAL'),
('REPOSITION', 'Crane Repositioning', 'OPERATIONAL');

-- Visit Details with various dates
-- Today's visits
INSERT INTO argo_visit_details (eta, etd, service, EST_DISCHARGE, EST_LOAD, EST_RESTOW, EST_SHIFT) VALUES
(NOW(), DATE_ADD(NOW(), INTERVAL 18 HOUR), 1, 450, 380, 20, 10),
(DATE_ADD(NOW(), INTERVAL 6 HOUR), DATE_ADD(NOW(), INTERVAL 24 HOUR), 2, 520, 430, 15, 5);

-- Recent visits (this week)
INSERT INTO argo_visit_details (eta, etd, service, EST_DISCHARGE, EST_LOAD, EST_RESTOW, EST_SHIFT) VALUES
(DATE_SUB(NOW(), INTERVAL 2 DAY), DATE_SUB(NOW(), INTERVAL 1 DAY), 3, 680, 720, 30, 20),
(DATE_SUB(NOW(), INTERVAL 1 DAY), NOW(), 4, 390, 410, 10, 5);

-- Inbound visits (future - this year)
INSERT INTO argo_visit_details (eta, etd, service, EST_DISCHARGE, EST_LOAD, EST_RESTOW, EST_SHIFT) VALUES
(DATE_ADD(NOW(), INTERVAL 3 DAY), DATE_ADD(NOW(), INTERVAL 4 DAY), 5, 550, 600, 25, 15),
(DATE_ADD(NOW(), INTERVAL 5 DAY), DATE_ADD(NOW(), INTERVAL 6 DAY), 1, 470, 490, 18, 12),
(DATE_ADD(NOW(), INTERVAL 7 DAY), DATE_ADD(NOW(), INTERVAL 8 DAY), 2, 510, 530, 20, 10);

-- Carrier Visits
-- Today's visits
INSERT INTO argo_carrier_visit (id, carrier_mode, phase, ata, atd, cvcvd_gkey) VALUES
('TNG001', 'VESSEL', '40WORKING', NOW(), NULL, 1),
('TNG002', 'VESSEL', '30ARRIVED', DATE_ADD(NOW(), INTERVAL 6 HOUR), NULL, 2);

-- Recent completed visits
INSERT INTO argo_carrier_visit (id, carrier_mode, phase, ata, atd, cvcvd_gkey) VALUES
('TNG003', 'VESSEL', '60DEPARTED', DATE_SUB(NOW(), INTERVAL 2 DAY), DATE_SUB(NOW(), INTERVAL 1 DAY), 3),
('TNG004', 'VESSEL', '50COMPLETE', DATE_SUB(NOW(), INTERVAL 1 DAY), NOW(), 4);

-- Inbound visits
INSERT INTO argo_carrier_visit (id, carrier_mode, phase, ata, atd, cvcvd_gkey) VALUES
('TNG005', 'VESSEL', '20INBOUND', NULL, NULL, 5),
('TNG006', 'VESSEL', '20INBOUND', NULL, NULL, 6),
('TNG007', 'VESSEL', '20INBOUND', NULL, NULL, 7);

-- Vessel Visit Details
INSERT INTO vsl_vessel_visit_details (vvd_gkey, vessel_gkey, start_work, end_work, FLEX_DATE07) VALUES
-- TNG001 - MSC MEDITERRANEAN (currently working)
(1, 1, NOW(), NULL, DATE_ADD(NOW(), INTERVAL 2 HOUR)),
-- TNG002 - MAERSK ESSEX (arrived, not yet working)
(2, 2, NULL, NULL, NULL),
-- TNG003 - CMA CGM TANGER (departed)
(3, 3, DATE_SUB(NOW(), INTERVAL 2 DAY), DATE_SUB(NOW(), INTERVAL 1 DAY), DATE_SUB(NOW(), INTERVAL 46 HOUR)),
-- TNG004 - HAPAG EXPRESS (complete)
(4, 4, DATE_SUB(NOW(), INTERVAL 1 DAY), NOW(), DATE_SUB(NOW(), INTERVAL 23 HOUR)),
-- TNG005 - COSCO GLORY (inbound)
(5, 5, NULL, NULL, NULL),
-- TNG006 - MSC FORTUNE (inbound)
(6, 6, NULL, NULL, NULL),
-- TNG007 - MAERSK TANGOR (inbound)
(7, 7, NULL, NULL, NULL);

-- Move Events with Crane assignments
-- TNG001 - MSC MEDITERRANEAN (450 discharge + 380 load = 830 moves, some executed)
-- Discharge moves with QC01, QC02, QC03
INSERT INTO inv_move_event (move_kind, FM_pos_locid, TO_pos_locid, moved, container_id, che_fetch, t_discharge)
SELECT
    'DSCH',
    'TNG001',
    CONCAT('YARD-A', FLOOR(1 + RAND() * 50)),
    DATE_ADD(NOW(), INTERVAL FLOOR(RAND() * 3 * 60) MINUTE),
    CONCAT('MSCU', LPAD(seq, 7, '0')),
    CASE
        WHEN seq % 3 = 0 THEN 1
        WHEN seq % 3 = 1 THEN 2
        ELSE 3
    END,
    DATE_ADD(NOW(), INTERVAL FLOOR(RAND() * 3 * 60) MINUTE)
FROM (
    SELECT @row := @row + 1 as seq
    FROM (SELECT 0 UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3) t1,
         (SELECT 0 UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3) t2,
         (SELECT 0 UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3) t3,
         (SELECT 0 UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3) t4,
         (SELECT 0 UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3) t5,
         (SELECT @row := 0) r
    LIMIT 320
) seq_table;

-- Load moves with QC01, QC02, QC03
INSERT INTO inv_move_event (move_kind, FM_pos_locid, TO_pos_locid, moved, container_id, che_put, t_put)
SELECT
    'LOAD',
    CONCAT('YARD-B', FLOOR(1 + RAND() * 50)),
    'TNG001',
    DATE_ADD(NOW(), INTERVAL FLOOR(RAND() * 3 * 60) MINUTE),
    CONCAT('MSCU', LPAD(seq + 320, 7, '0')),
    CASE
        WHEN seq % 3 = 0 THEN 1
        WHEN seq % 3 = 1 THEN 2
        ELSE 3
    END,
    DATE_ADD(NOW(), INTERVAL FLOOR(RAND() * 3 * 60) MINUTE)
FROM (
    SELECT @row := @row + 1 as seq
    FROM (SELECT 0 UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3) t1,
         (SELECT 0 UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3) t2,
         (SELECT 0 UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3) t3,
         (SELECT 0 UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3) t4,
         (SELECT @row := 0) r
    LIMIT 250
) seq_table;

-- TNG003 - CMA CGM TANGER (completed - all moves executed with QC01, QC02)
INSERT INTO inv_move_event (move_kind, FM_pos_locid, TO_pos_locid, moved, container_id, che_fetch, t_discharge)
SELECT
    'DSCH',
    'TNG003',
    CONCAT('YARD-C', FLOOR(1 + RAND() * 50)),
    DATE_SUB(NOW(), INTERVAL 1 + FLOOR(RAND() * 20) HOUR),
    CONCAT('CMAU', LPAD(seq, 7, '0')),
    CASE
        WHEN seq % 2 = 0 THEN 1
        ELSE 2
    END,
    DATE_SUB(NOW(), INTERVAL 1 + FLOOR(RAND() * 20) HOUR)
FROM (
    SELECT @row := @row + 1 as seq
    FROM (SELECT 0 UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3) t1,
         (SELECT 0 UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3) t2,
         (SELECT 0 UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3) t3,
         (SELECT 0 UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3) t4,
         (SELECT 0 UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3) t5,
         (SELECT @row := 0) r
    LIMIT 680
) seq_table;

INSERT INTO inv_move_event (move_kind, FM_pos_locid, TO_pos_locid, moved, container_id, che_put, t_put)
SELECT
    'LOAD',
    CONCAT('YARD-D', FLOOR(1 + RAND() * 50)),
    'TNG003',
    DATE_SUB(NOW(), INTERVAL 1 + FLOOR(RAND() * 20) HOUR),
    CONCAT('CMAU', LPAD(seq + 680, 7, '0')),
    CASE
        WHEN seq % 2 = 0 THEN 1
        ELSE 2
    END,
    DATE_SUB(NOW(), INTERVAL 1 + FLOOR(RAND() * 20) HOUR)
FROM (
    SELECT @row := @row + 1 as seq
    FROM (SELECT 0 UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3) t1,
         (SELECT 0 UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3) t2,
         (SELECT 0 UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3) t3,
         (SELECT 0 UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3) t4,
         (SELECT 0 UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3) t5,
         (SELECT @row := 0) r
    LIMIT 720
) seq_table;

-- Work Instructions (planned moves) with work queues and estimated times
-- TNG001 - Remaining planned moves
INSERT INTO inv_wi (carrier_locid, move_kind, container_id, work_queue_gkey, est_move_time)
SELECT
    'TNG001',
    'DSCH',
    CONCAT('MSCU', LPAD(seq + 10000, 7, '0')),
    CASE
        WHEN seq % 3 = 0 THEN 1
        WHEN seq % 3 = 1 THEN 2
        ELSE 3
    END,
    90 + FLOOR(RAND() * 60)
FROM (
    SELECT @row := @row + 1 as seq
    FROM (SELECT 0 UNION ALL SELECT 1 UNION ALL SELECT 2) t1,
         (SELECT 0 UNION ALL SELECT 1 UNION ALL SELECT 2) t2,
         (SELECT 0 UNION ALL SELECT 1 UNION ALL SELECT 2) t3,
         (SELECT @row := 0) r
    LIMIT 130
) seq_table;

INSERT INTO inv_wi (carrier_locid, move_kind, container_id, work_queue_gkey, est_move_time)
SELECT
    'TNG001',
    'LOAD',
    CONCAT('MSCU', LPAD(seq + 10200, 7, '0')),
    CASE
        WHEN seq % 3 = 0 THEN 1
        WHEN seq % 3 = 1 THEN 2
        ELSE 3
    END,
    85 + FLOOR(RAND() * 50)
FROM (
    SELECT @row := @row + 1 as seq
    FROM (SELECT 0 UNION ALL SELECT 1 UNION ALL SELECT 2) t1,
         (SELECT 0 UNION ALL SELECT 1 UNION ALL SELECT 2) t2,
         (SELECT 0 UNION ALL SELECT 1 UNION ALL SELECT 2) t3,
         (SELECT @row := 0) r
    LIMIT 130
) seq_table;

-- TNG002 - MAERSK ESSEX - All planned moves
INSERT INTO inv_wi (carrier_locid, move_kind, container_id, work_queue_gkey, est_move_time)
SELECT
    'TNG002',
    'DSCH',
    CONCAT('MAEU', LPAD(seq, 7, '0')),
    4,
    90 + FLOOR(RAND() * 60)
FROM (
    SELECT @row := @row + 1 as seq
    FROM (SELECT 0 UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3) t1,
         (SELECT 0 UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3) t2,
         (SELECT 0 UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3) t3,
         (SELECT 0 UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3) t4,
         (SELECT 0 UNION ALL SELECT 1 UNION ALL SELECT 2) t5,
         (SELECT @row := 0) r
    LIMIT 520
) seq_table;

INSERT INTO inv_wi (carrier_locid, move_kind, container_id, work_queue_gkey, est_move_time)
SELECT
    'TNG002',
    'LOAD',
    CONCAT('MAEU', LPAD(seq + 520, 7, '0')),
    4,
    85 + FLOOR(RAND() * 50)
FROM (
    SELECT @row := @row + 1 as seq
    FROM (SELECT 0 UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3) t1,
         (SELECT 0 UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3) t2,
         (SELECT 0 UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3) t3,
         (SELECT 0 UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3) t4,
         (SELECT @row := 0) r
    LIMIT 430
) seq_table;

-- Crane Statistics
-- TNG001 - Currently Working (QC01, QC02, QC03)
INSERT INTO vsl_crane_statistics (vvd_gkey, crane_gkey, total_moves) VALUES
(1, 1, 190),
(1, 2, 195),
(1, 3, 185);

-- TNG003 - Departed (QC01, QC02)
INSERT INTO vsl_crane_statistics (vvd_gkey, crane_gkey, total_moves) VALUES
(3, 1, 700),
(3, 2, 700);

-- Crane Delays
-- TNG001 delays
INSERT INTO vsl_crane_statistics_delays (cstat_gkey, crane_delay_type_gkey, delay_date, time, notes) VALUES
-- QC01 delays
(1, 1, DATE_ADD(NOW(), INTERVAL 45 MINUTE), 35, 'Spreader malfunction - maintenance required'),
(1, 7, DATE_ADD(NOW(), INTERVAL 90 MINUTE), 15, 'Safety stop for personnel near crane'),
-- QC02 delays
(2, 3, DATE_ADD(NOW(), INTERVAL 60 MINUTE), 42, 'Waiting for import containers to be positioned'),
(2, 8, DATE_ADD(NOW(), INTERVAL 120 MINUTE), 28, 'Repositioning for different bay'),
-- QC03 delays
(3, 2, DATE_ADD(NOW(), INTERVAL 30 MINUTE), 20, 'Operational delay - stowage plan revision');

-- TNG003 delays (historical)
INSERT INTO vsl_crane_statistics_delays (cstat_gkey, crane_delay_type_gkey, delay_date, time, notes) VALUES
-- QC01 delays
(4, 1, DATE_SUB(NOW(), INTERVAL 36 HOUR), 125, 'Major hydraulic system failure'),
(4, 3, DATE_SUB(NOW(), INTERVAL 30 HOUR), 55, 'Waiting for cargo - vessel stowage issue'),
(4, 4, DATE_SUB(NOW(), INTERVAL 28 HOUR), 90, 'Heavy wind - operations suspended'),
-- QC02 delays
(5, 2, DATE_SUB(NOW(), INTERVAL 35 HOUR), 45, 'Operational coordination delay'),
(5, 6, DATE_SUB(NOW(), INTERVAL 32 HOUR), 65, 'Power supply interruption'),
(5, 5, DATE_SUB(NOW(), INTERVAL 26 HOUR), 30, 'Labor shift change coordination');

-- Summary statistics
SELECT '=== DATABASE SETUP COMPLETE ===' as '';
SELECT CONCAT('Business Units: ', COUNT(*)) as summary FROM ref_bizunit_scoped
UNION ALL
SELECT CONCAT('Services: ', COUNT(*)) FROM ref_carrier_service
UNION ALL
SELECT CONCAT('Vessels: ', COUNT(*)) FROM vsl_vessels
UNION ALL
SELECT CONCAT('Cranes: ', COUNT(*)) FROM xps_che
UNION ALL
SELECT CONCAT('Visits: ', COUNT(*)) FROM argo_carrier_visit
UNION ALL
SELECT CONCAT('Move Events: ', COUNT(*)) FROM inv_move_event
UNION ALL
SELECT CONCAT('Work Instructions: ', COUNT(*)) FROM inv_wi
UNION ALL
SELECT CONCAT('Crane Statistics: ', COUNT(*)) FROM vsl_crane_statistics
UNION ALL
SELECT CONCAT('Crane Delays: ', COUNT(*)) FROM vsl_crane_statistics_delays
UNION ALL
SELECT CONCAT('Delay Types: ', COUNT(*)) FROM ref_crane_delay_types;

SELECT '=== VESSEL VISITS BY PHASE ===' as '';
SELECT phase, COUNT(*) as count FROM argo_carrier_visit GROUP BY phase ORDER BY phase;

SELECT '=== CRANES ===' as '';
SELECT short_name, full_name, status FROM xps_che ORDER BY short_name;

SELECT '=== SAMPLE VESSEL DATA ===' as '';
SELECT
    acv.id as visit_id,
    v.name as vessel,
    acv.phase,
    vd.eta,
    vd.etd,
    GROUP_CONCAT(DISTINCT c.short_name ORDER BY c.short_name SEPARATOR ', ') as assigned_cranes
FROM argo_carrier_visit acv
JOIN argo_visit_details vd ON acv.cvcvd_gkey = vd.gkey
JOIN vsl_vessel_visit_details vvd ON vvd.vvd_gkey = vd.gkey
JOIN vsl_vessels v ON vvd.vessel_gkey = v.gkey
LEFT JOIN vsl_crane_statistics cs ON cs.vvd_gkey = vvd.gkey
LEFT JOIN xps_che c ON c.gkey = cs.crane_gkey
GROUP BY acv.id, v.name, acv.phase, vd.eta, vd.etd
ORDER BY vd.eta;

SELECT '=== CRANE DELAYS SUMMARY ===' as '';
SELECT
    acv.id as visit_id,
    c.short_name as crane,
    dt.id as delay_code,
    dt.description,
    COUNT(*) as delay_count,
    SUM(csd.time) as total_delay_minutes
FROM vsl_crane_statistics_delays csd
JOIN vsl_crane_statistics cs ON cs.gkey = csd.cstat_gkey
JOIN ref_crane_delay_types dt ON dt.gkey = csd.crane_delay_type_gkey
JOIN xps_che c ON c.gkey = cs.crane_gkey
JOIN vsl_vessel_visit_details vvd ON vvd.vvd_gkey = cs.vvd_gkey
JOIN argo_visit_details avd ON avd.gkey = vvd.vvd_gkey
JOIN argo_carrier_visit acv ON acv.cvcvd_gkey = avd.gkey
GROUP BY acv.id, c.short_name, dt.id, dt.description
ORDER BY acv.id, c.short_name;
