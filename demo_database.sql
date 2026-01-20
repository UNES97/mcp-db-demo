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
('MAERSK TANGOR', 2),
('MSC AURORA', 1),
('MAERSK VIKING', 2),
('CMA CGM ATLAS', 3),
('HAPAG NAVIGATOR', 4),
('COSCO PRIDE', 5);

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
-- Historical visits from early January 2026 (completed)
INSERT INTO argo_visit_details (eta, etd, service, EST_DISCHARGE, EST_LOAD, EST_RESTOW, EST_SHIFT) VALUES
('2026-01-02 06:00:00', '2026-01-03 02:00:00', 1, 580, 620, 24, 12),
('2026-01-05 10:00:00', '2026-01-06 08:00:00', 2, 690, 710, 28, 16),
('2026-01-08 14:00:00', '2026-01-09 10:00:00', 3, 510, 540, 20, 10),
('2026-01-12 08:00:00', '2026-01-13 06:00:00', 4, 640, 660, 26, 14),
('2026-01-15 12:00:00', '2026-01-16 10:00:00', 5, 570, 590, 22, 11);

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

-- Additional 2026 visits - January to March
INSERT INTO argo_visit_details (eta, etd, service, EST_DISCHARGE, EST_LOAD, EST_RESTOW, EST_SHIFT) VALUES
('2026-01-25 08:00:00', '2026-01-26 02:00:00', 1, 620, 580, 25, 15),
('2026-01-28 14:00:00', '2026-01-29 10:00:00', 3, 490, 510, 18, 10),
('2026-02-02 06:00:00', '2026-02-03 04:00:00', 2, 710, 690, 30, 20),
('2026-02-05 10:00:00', '2026-02-06 08:00:00', 4, 550, 570, 22, 12),
('2026-02-10 12:00:00', '2026-02-11 10:00:00', 5, 480, 500, 20, 8),
('2026-02-15 16:00:00', '2026-02-16 14:00:00', 1, 650, 620, 28, 16),
('2026-02-20 08:00:00', '2026-02-21 06:00:00', 3, 590, 610, 24, 14),
('2026-02-25 14:00:00', '2026-02-26 12:00:00', 2, 520, 540, 19, 11),
('2026-03-01 10:00:00', '2026-03-02 08:00:00', 4, 680, 700, 32, 18),
('2026-03-05 06:00:00', '2026-03-06 04:00:00', 5, 510, 530, 21, 10);

-- Additional 2026 visits - April to June
INSERT INTO argo_visit_details (eta, etd, service, EST_DISCHARGE, EST_LOAD, EST_RESTOW, EST_SHIFT) VALUES
('2026-04-03 08:00:00', '2026-04-04 06:00:00', 1, 640, 660, 26, 14),
('2026-04-08 14:00:00', '2026-04-09 12:00:00', 3, 570, 590, 23, 12),
('2026-04-15 10:00:00', '2026-04-16 08:00:00', 2, 720, 740, 34, 20),
('2026-04-22 12:00:00', '2026-04-23 10:00:00', 4, 490, 510, 20, 9),
('2026-04-28 16:00:00', '2026-04-29 14:00:00', 5, 610, 630, 27, 15),
('2026-05-05 08:00:00', '2026-05-06 06:00:00', 1, 580, 600, 24, 13),
('2026-05-12 14:00:00', '2026-05-13 12:00:00', 3, 660, 680, 29, 17),
('2026-05-20 10:00:00', '2026-05-21 08:00:00', 2, 530, 550, 22, 11),
('2026-05-27 06:00:00', '2026-05-28 04:00:00', 4, 690, 710, 31, 19),
('2026-06-04 12:00:00', '2026-06-05 10:00:00', 5, 500, 520, 21, 10);

-- Carrier Visits
-- Historical completed visits from early January 2026
INSERT INTO argo_carrier_visit (id, carrier_mode, phase, ata, atd, cvcvd_gkey) VALUES
('TNG_JAN02', 'VESSEL', '60DEPARTED', '2026-01-02 06:00:00', '2026-01-03 02:00:00', 1),
('TNG_JAN05', 'VESSEL', '60DEPARTED', '2026-01-05 10:00:00', '2026-01-06 08:00:00', 2),
('TNG_JAN08', 'VESSEL', '60DEPARTED', '2026-01-08 14:00:00', '2026-01-09 10:00:00', 3),
('TNG_JAN12', 'VESSEL', '60DEPARTED', '2026-01-12 08:00:00', '2026-01-13 06:00:00', 4),
('TNG_JAN15', 'VESSEL', '60DEPARTED', '2026-01-15 12:00:00', '2026-01-16 10:00:00', 5);

-- Today's visits
INSERT INTO argo_carrier_visit (id, carrier_mode, phase, ata, atd, cvcvd_gkey) VALUES
('TNG001', 'VESSEL', '40WORKING', NOW(), NULL, 6),
('TNG002', 'VESSEL', '30ARRIVED', DATE_ADD(NOW(), INTERVAL 6 HOUR), NULL, 7);

-- Recent completed visits
INSERT INTO argo_carrier_visit (id, carrier_mode, phase, ata, atd, cvcvd_gkey) VALUES
('TNG003', 'VESSEL', '60DEPARTED', DATE_SUB(NOW(), INTERVAL 2 DAY), DATE_SUB(NOW(), INTERVAL 1 DAY), 8),
('TNG004', 'VESSEL', '50COMPLETE', DATE_SUB(NOW(), INTERVAL 1 DAY), NOW(), 9);

-- Inbound visits
INSERT INTO argo_carrier_visit (id, carrier_mode, phase, ata, atd, cvcvd_gkey) VALUES
('TNG005', 'VESSEL', '20INBOUND', NULL, NULL, 10),
('TNG006', 'VESSEL', '20INBOUND', NULL, NULL, 11),
('TNG007', 'VESSEL', '20INBOUND', NULL, NULL, 12);

-- Additional 2026 carrier visits - January to June
INSERT INTO argo_carrier_visit (id, carrier_mode, phase, ata, atd, cvcvd_gkey) VALUES
('TNG008', 'VESSEL', '20INBOUND', NULL, NULL, 13),
('TNG009', 'VESSEL', '20INBOUND', NULL, NULL, 14),
('TNG010', 'VESSEL', '20INBOUND', NULL, NULL, 15),
('TNG011', 'VESSEL', '20INBOUND', NULL, NULL, 16),
('TNG012', 'VESSEL', '20INBOUND', NULL, NULL, 17),
('TNG013', 'VESSEL', '20INBOUND', NULL, NULL, 18),
('TNG014', 'VESSEL', '20INBOUND', NULL, NULL, 19),
('TNG015', 'VESSEL', '20INBOUND', NULL, NULL, 20),
('TNG016', 'VESSEL', '20INBOUND', NULL, NULL, 21),
('TNG017', 'VESSEL', '20INBOUND', NULL, NULL, 22),
('TNG018', 'VESSEL', '20INBOUND', NULL, NULL, 23),
('TNG019', 'VESSEL', '20INBOUND', NULL, NULL, 24),
('TNG020', 'VESSEL', '20INBOUND', NULL, NULL, 25),
('TNG021', 'VESSEL', '20INBOUND', NULL, NULL, 26),
('TNG022', 'VESSEL', '20INBOUND', NULL, NULL, 27),
('TNG023', 'VESSEL', '20INBOUND', NULL, NULL, 28),
('TNG024', 'VESSEL', '20INBOUND', NULL, NULL, 29),
('TNG025', 'VESSEL', '20INBOUND', NULL, NULL, 30),
('TNG026', 'VESSEL', '20INBOUND', NULL, NULL, 31),
('TNG027', 'VESSEL', '20INBOUND', NULL, NULL, 32);

-- Vessel Visit Details
INSERT INTO vsl_vessel_visit_details (vvd_gkey, vessel_gkey, start_work, end_work, FLEX_DATE07) VALUES
-- Historical completed visits from early January 2026
(1, 8, '2026-01-02 06:30:00', '2026-01-03 01:45:00', '2026-01-02 08:00:00'),  -- TNG_JAN02 - MSC AURORA
(2, 9, '2026-01-05 10:30:00', '2026-01-06 07:45:00', '2026-01-05 12:00:00'),  -- TNG_JAN05 - MAERSK VIKING
(3, 10, '2026-01-08 14:30:00', '2026-01-09 09:45:00', '2026-01-08 16:00:00'), -- TNG_JAN08 - CMA CGM ATLAS
(4, 11, '2026-01-12 08:30:00', '2026-01-13 05:45:00', '2026-01-12 10:00:00'), -- TNG_JAN12 - HAPAG NAVIGATOR
(5, 12, '2026-01-15 12:30:00', '2026-01-16 09:45:00', '2026-01-15 14:00:00'), -- TNG_JAN15 - COSCO PRIDE
-- TNG001 - MSC MEDITERRANEAN (currently working)
(6, 1, NOW(), NULL, DATE_ADD(NOW(), INTERVAL 2 HOUR)),
-- TNG002 - MAERSK ESSEX (arrived, not yet working)
(7, 2, NULL, NULL, NULL),
-- TNG003 - CMA CGM TANGER (departed)
(8, 3, DATE_SUB(NOW(), INTERVAL 2 DAY), DATE_SUB(NOW(), INTERVAL 1 DAY), DATE_SUB(NOW(), INTERVAL 46 HOUR)),
-- TNG004 - HAPAG EXPRESS (complete)
(9, 4, DATE_SUB(NOW(), INTERVAL 1 DAY), NOW(), DATE_SUB(NOW(), INTERVAL 23 HOUR)),
-- TNG005 - COSCO GLORY (inbound)
(10, 5, NULL, NULL, NULL),
-- TNG006 - MSC FORTUNE (inbound)
(11, 6, NULL, NULL, NULL),
-- TNG007 - MAERSK TANGOR (inbound)
(12, 7, NULL, NULL, NULL),
-- Additional 2026 vessel visit details (rotating through vessels)
(13, 1, NULL, NULL, NULL),  -- TNG008 - MSC MEDITERRANEAN
(14, 3, NULL, NULL, NULL),  -- TNG009 - CMA CGM TANGER
(15, 2, NULL, NULL, NULL), -- TNG010 - MAERSK ESSEX
(16, 4, NULL, NULL, NULL), -- TNG011 - HAPAG EXPRESS
(17, 5, NULL, NULL, NULL), -- TNG012 - COSCO GLORY
(18, 1, NULL, NULL, NULL), -- TNG013 - MSC MEDITERRANEAN
(19, 3, NULL, NULL, NULL), -- TNG014 - CMA CGM TANGER
(20, 2, NULL, NULL, NULL), -- TNG015 - MAERSK ESSEX
(21, 4, NULL, NULL, NULL), -- TNG016 - HAPAG EXPRESS
(22, 5, NULL, NULL, NULL), -- TNG017 - COSCO GLORY
(23, 1, NULL, NULL, NULL), -- TNG018 - MSC MEDITERRANEAN
(24, 3, NULL, NULL, NULL), -- TNG019 - CMA CGM TANGER
(25, 2, NULL, NULL, NULL), -- TNG020 - MAERSK ESSEX
(26, 4, NULL, NULL, NULL), -- TNG021 - HAPAG EXPRESS
(27, 5, NULL, NULL, NULL), -- TNG022 - COSCO GLORY
(28, 8, NULL, NULL, NULL), -- TNG023 - MSC AURORA
(29, 9, NULL, NULL, NULL), -- TNG024 - MAERSK VIKING
(30, 10, NULL, NULL, NULL), -- TNG025 - CMA CGM ATLAS
(31, 11, NULL, NULL, NULL), -- TNG026 - HAPAG NAVIGATOR
(32, 12, NULL, NULL, NULL); -- TNG027 - COSCO PRIDE

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
-- Historical visits crane statistics
INSERT INTO vsl_crane_statistics (vvd_gkey, crane_gkey, total_moves) VALUES
(1, 1, 600), (1, 2, 600),  -- TNG_JAN02 - MSC AURORA
(2, 3, 700), (2, 4, 700),  -- TNG_JAN05 - MAERSK VIKING
(3, 1, 525), (3, 2, 525),  -- TNG_JAN08 - CMA CGM ATLAS
(4, 5, 650), (4, 6, 650),  -- TNG_JAN12 - HAPAG NAVIGATOR
(5, 1, 580), (5, 2, 580);  -- TNG_JAN15 - COSCO PRIDE

-- TNG001 - Currently Working (QC01, QC02, QC03)
INSERT INTO vsl_crane_statistics (vvd_gkey, crane_gkey, total_moves) VALUES
(6, 1, 190),
(6, 2, 195),
(6, 3, 185);

-- TNG003 - Departed (QC01, QC02)
INSERT INTO vsl_crane_statistics (vvd_gkey, crane_gkey, total_moves) VALUES
(8, 1, 700),
(8, 2, 700);

-- Crane Delays
-- Historical delays from early January 2026
INSERT INTO vsl_crane_statistics_delays (cstat_gkey, crane_delay_type_gkey, delay_date, time, notes) VALUES
(1, 1, '2026-01-02 12:30:00', 45, 'Spreader malfunction during MSC AURORA operation'),
(2, 3, '2026-01-02 16:00:00', 30, 'Waiting for containers - MSC AURORA'),
(3, 4, '2026-01-05 14:00:00', 60, 'Weather delay - high winds'),
(4, 2, '2026-01-05 18:30:00', 25, 'Operational coordination issue'),
(5, 1, '2026-01-08 16:45:00', 55, 'Hydraulic system maintenance'),
(6, 7, '2026-01-08 20:00:00', 20, 'Safety inspection'),
(7, 6, '2026-01-12 11:00:00', 40, 'Power supply fluctuation'),
(8, 3, '2026-01-12 15:30:00', 35, 'Waiting for yard equipment'),
(9, 2, '2026-01-15 13:45:00', 28, 'Stowage plan revision'),
(10, 8, '2026-01-15 19:00:00', 22, 'Crane repositioning');

-- TNG001 delays
INSERT INTO vsl_crane_statistics_delays (cstat_gkey, crane_delay_type_gkey, delay_date, time, notes) VALUES
-- QC01 delays
(11, 1, DATE_ADD(NOW(), INTERVAL 45 MINUTE), 35, 'Spreader malfunction - maintenance required'),
(11, 7, DATE_ADD(NOW(), INTERVAL 90 MINUTE), 15, 'Safety stop for personnel near crane'),
-- QC02 delays
(12, 3, DATE_ADD(NOW(), INTERVAL 60 MINUTE), 42, 'Waiting for import containers to be positioned'),
(12, 8, DATE_ADD(NOW(), INTERVAL 120 MINUTE), 28, 'Repositioning for different bay'),
-- QC03 delays
(13, 2, DATE_ADD(NOW(), INTERVAL 30 MINUTE), 20, 'Operational delay - stowage plan revision');

-- TNG003 delays (historical)
INSERT INTO vsl_crane_statistics_delays (cstat_gkey, crane_delay_type_gkey, delay_date, time, notes) VALUES
-- QC01 delays
(14, 1, DATE_SUB(NOW(), INTERVAL 36 HOUR), 125, 'Major hydraulic system failure'),
(14, 3, DATE_SUB(NOW(), INTERVAL 30 HOUR), 55, 'Waiting for cargo - vessel stowage issue'),
(14, 4, DATE_SUB(NOW(), INTERVAL 28 HOUR), 90, 'Heavy wind - operations suspended'),
-- QC02 delays
(15, 2, DATE_SUB(NOW(), INTERVAL 35 HOUR), 45, 'Operational coordination delay'),
(15, 6, DATE_SUB(NOW(), INTERVAL 32 HOUR), 65, 'Power supply interruption'),
(15, 5, DATE_SUB(NOW(), INTERVAL 26 HOUR), 30, 'Labor shift change coordination');

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
