-- H2A.1 retires Routine Import authorization while preserving the database
-- structures required by the previous application binary during deployment.
-- Physical persistence contraction is deferred to H2A.2 after those processes
-- are confirmed retired.
DELETE FROM `team_capability_grants`
WHERE `capabilityKey` = 'routine.import.manage';

DELETE FROM `team_role_capability_grants`
WHERE `capabilityKey` = 'routine.import.manage';

DELETE FROM `user_capability_grants`
WHERE `capabilityKey` = 'routine.import.manage';
