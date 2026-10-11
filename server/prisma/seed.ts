import { PrismaClient, UserRole, FacilityType, AssetCategory, AssetStatus, Criticality, InspectionStatus, SyncStatus, IssueSeverity, WorkOrderStatus, ScheduleFrequency } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding SpotCheck database...');

  // Clean existing data in reverse dependency order
  await prisma.auditEvent.deleteMany();
  await prisma.appNotification.deleteMany();
  await prisma.conflictRecord.deleteMany();
  await prisma.syncOperationRecord.deleteMany();
  await prisma.workOrderEvent.deleteMany();
  await prisma.issue.deleteMany();
  await prisma.inspection.deleteMany();
  await prisma.inspectionSchedule.deleteMany();
  await prisma.inspectionTemplate.deleteMany();
  await prisma.asset.deleteMany();
  await prisma.checkpoint.deleteMany();
  await prisma.zone.deleteMany();
  await prisma.userFacilityAssignment.deleteMany();
  await prisma.userSession.deleteMany();
  await prisma.facility.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash('Password123!', 10);

  // 1. Users
  const manager = await prisma.user.create({
    data: {
      id: '11111111-1111-1111-1111-111111111111',
      email: 'manager@spotcheck.io',
      passwordHash,
      fullName: 'Morgan Brooks',
      role: UserRole.FACILITY_MANAGER,
      isActive: true,
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    },
  });

  const inspector = await prisma.user.create({
    data: {
      id: '22222222-2222-2222-2222-222222222222',
      email: 'inspector@spotcheck.io',
      passwordHash,
      fullName: 'Alex Chen',
      role: UserRole.INSPECTOR,
      isActive: true,
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    },
  });

  const technician = await prisma.user.create({
    data: {
      id: '33333333-3333-3333-3333-333333333333',
      email: 'tech@spotcheck.io',
      passwordHash,
      fullName: 'Samira Patel',
      role: UserRole.MAINTENANCE_TECHNICIAN,
      isActive: true,
      avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
    },
  });

  console.log('Created users:');
  console.log(' - Facility Manager:', manager.email);
  console.log(' - Inspector:', inspector.email);
  console.log(' - Technician:', technician.email);

  // 2. Facilities
  const facility1 = await prisma.facility.create({
    data: {
      id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      name: 'Apex Innovation Center — Building A',
      code: 'FAC-APEX-01',
      type: FacilityType.COMMERCIAL,
      address: '100 Industrial Parkway, Tech Corridor',
      city: 'Austin',
      state: 'TX',
      postalCode: '78701',
      squareMeters: 18500,
      contactName: 'Dan Reynolds (Director of Facilities)',
      contactEmail: 'reynolds@apexcommercial.com',
      contactPhone: '+1 (512) 555-0199',
      isActive: true,
    },
  });

  const facility2 = await prisma.facility.create({
    data: {
      id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      name: 'Westside Logistics Distribution Hub',
      code: 'FAC-WEST-02',
      type: FacilityType.WAREHOUSE,
      address: '4200 Rivergate Logistics Way',
      city: 'Portland',
      state: 'OR',
      postalCode: '97203',
      squareMeters: 32000,
      contactName: 'Elena Rostova',
      contactEmail: 'erostova@westsidelogistics.com',
      contactPhone: '+1 (503) 555-4421',
      isActive: true,
    },
  });

  // Assign users to facilities
  await prisma.userFacilityAssignment.createMany({
    data: [
      { userId: manager.id, facilityId: facility1.id },
      { userId: manager.id, facilityId: facility2.id },
      { userId: inspector.id, facilityId: facility1.id },
      { userId: inspector.id, facilityId: facility2.id },
      { userId: technician.id, facilityId: facility1.id },
      { userId: technician.id, facilityId: facility2.id },
    ],
  });

  // 3. Zones
  const zoneBasement = await prisma.zone.create({
    data: {
      id: 'z1111111-1111-1111-1111-111111111111',
      facilityId: facility1.id,
      name: 'Sub-level Mechanical & Utility Vault',
      code: 'ZONE-B1-MECH',
      floor: 'Basement Level 1',
      description: 'Houses central chiller plant, primary electrical switchgear, and backup diesel generator.',
    },
  });

  const zoneLobby = await prisma.zone.create({
    data: {
      id: 'z2222222-2222-2222-2222-222222222222',
      facilityId: facility1.id,
      name: 'Main Atrium & Central Lobby',
      code: 'ZONE-01-LOBBY',
      floor: 'Level 1',
      description: 'Primary public entrance, security console, central elevators, and main fire panel.',
    },
  });

  const zoneRooftop = await prisma.zone.create({
    data: {
      id: 'z3333333-3333-3333-3333-333333333333',
      facilityId: facility1.id,
      name: 'Rooftop HVAC Plant & Cooling Towers',
      code: 'ZONE-RF-HVAC',
      floor: 'Roof Level',
      description: 'Air handling units AHU-01 through AHU-06, cooling towers CT-1/2, and solar inverter banks.',
    },
  });

  // 4. Checkpoints
  const chkChiller = await prisma.checkpoint.create({
    data: {
      id: 'c1111111-1111-1111-1111-111111111111',
      zoneId: zoneBasement.id,
      facilityId: facility1.id,
      name: 'Primary Chiller & Header Manifold (CH-01)',
      code: 'CHK-B1-CHL01',
      qrCodeToken: 'QR-SPOTCHECK-APEX-CHL01',
      locationDescription: 'East wall of central boiler/chiller room, adjacent to expansion tank',
      instructions: 'Check inlet/outlet water temperatures, compressor oil level sight glass, and verify refrigerant pressure.',
      sequenceOrder: 1,
    },
  });

  const chkGen = await prisma.checkpoint.create({
    data: {
      id: 'c2222222-2222-2222-2222-222222222222',
      zoneId: zoneBasement.id,
      facilityId: facility1.id,
      name: 'Emergency Standby Diesel Generator (GEN-01)',
      code: 'CHK-B1-GEN01',
      qrCodeToken: 'QR-SPOTCHECK-APEX-GEN01',
      locationDescription: 'Dedicated fire-rated generator enclosure in northwest mechanical yard',
      instructions: 'Inspect battery charger output, check fuel day-tank level (must exceed 80%), and test block heater jacket temperature.',
      sequenceOrder: 2,
    },
  });

  const chkFire = await prisma.checkpoint.create({
    data: {
      id: 'c3333333-3333-3333-3333-333333333333',
      zoneId: zoneLobby.id,
      facilityId: facility1.id,
      name: 'Master Fire Alarm Control Panel (FACP)',
      code: 'CHK-01-FACP',
      qrCodeToken: 'QR-SPOTCHECK-APEX-FACP01',
      locationDescription: 'Behind security concierge desk, secured cabinet 1A',
      instructions: 'Verify power LED is illuminated green, ensure no active trouble/supervisory buzzer, verify annunciator display.',
      sequenceOrder: 3,
    },
  });

  const chkAHU = await prisma.checkpoint.create({
    data: {
      id: 'c4444444-4444-4444-4444-444444444444',
      zoneId: zoneRooftop.id,
      facilityId: facility1.id,
      name: 'Rooftop Air Handling Unit #4 (AHU-04)',
      code: 'CHK-RF-AHU04',
      qrCodeToken: 'QR-SPOTCHECK-APEX-AHU04',
      locationDescription: 'Roof section B, North orientation, elevated catwalk access',
      instructions: 'Inspect drive belt alignment and tension, record differential pressure on magnehelic gauge, verify damper actuation.',
      sequenceOrder: 4,
    },
  });

  // 5. Assets
  const assetChiller = await prisma.asset.create({
    data: {
      id: 'a1111111-1111-1111-1111-111111111111',
      facilityId: facility1.id,
      zoneId: zoneBasement.id,
      checkpointId: chkChiller.id,
      name: 'Trane CenTraVac 500-Ton Water-Cooled Chiller',
      assetTag: 'AST-HVAC-CHL-001',
      category: AssetCategory.HVAC,
      modelNumber: 'CVHE0500',
      serialNumber: 'TRN-2021-99841',
      manufacturer: 'Trane Technologies',
      installationDate: new Date('2021-03-15'),
      status: AssetStatus.OPERATIONAL,
      criticality: Criticality.CRITICAL,
    },
  });

  const assetGen = await prisma.asset.create({
    data: {
      id: 'a2222222-2222-2222-2222-222222222222',
      facilityId: facility1.id,
      zoneId: zoneBasement.id,
      checkpointId: chkGen.id,
      name: 'Cummins QSK19 600kW Standby Diesel Generator',
      assetTag: 'AST-ELEC-GEN-001',
      category: AssetCategory.ELECTRICAL,
      modelNumber: 'DQCA-600',
      serialNumber: 'CUM-2020-44120',
      manufacturer: 'Cummins Power Generation',
      installationDate: new Date('2020-11-01'),
      status: AssetStatus.OPERATIONAL,
      criticality: Criticality.CRITICAL,
    },
  });

  const assetAHU = await prisma.asset.create({
    data: {
      id: 'a3333333-3333-3333-3333-333333333333',
      facilityId: facility1.id,
      zoneId: zoneRooftop.id,
      checkpointId: chkAHU.id,
      name: 'Carrier Aero 39M Custom Rooftop Air Handler',
      assetTag: 'AST-HVAC-AHU-004',
      category: AssetCategory.HVAC,
      modelNumber: '39M-18000CFM',
      serialNumber: 'CAR-2019-38192',
      manufacturer: 'Carrier Corporation',
      installationDate: new Date('2019-06-20'),
      status: AssetStatus.NEEDS_ATTENTION,
      criticality: Criticality.HIGH,
    },
  });

  // 6. Inspection Templates
  const mechanicalTemplateFields = [
    {
      id: 'f1',
      key: 'chiller_status',
      label: 'Chiller Operating State & Compressor Vibration',
      type: 'PASS_FAIL',
      required: true,
      instructions: 'Listen for unusual bearing noise, cavitation, or abnormal vibration.',
      isCriticalFailure: true,
      failureDefectSeverity: 'CRITICAL',
      failureDefectCategory: 'HVAC',
      requireEvidenceOnFailure: true,
    },
    {
      id: 'f2',
      key: 'chilled_water_delta_t',
      label: 'Chilled Water Delta T (°F)',
      type: 'NUMERIC',
      required: true,
      minNumeric: 8.0,
      maxNumeric: 14.0,
      unit: '°F',
      instructions: 'Record delta between return (approx 54°F) and supply (approx 44°F). Normal band: 8.0°F - 14.0°F.',
      isCriticalFailure: true,
      failureDefectSeverity: 'HIGH',
      failureDefectCategory: 'HVAC',
    },
    {
      id: 'f3',
      key: 'gen_battery_voltage',
      label: 'Generator Battery Float Voltage (VDC)',
      type: 'NUMERIC',
      required: true,
      minNumeric: 25.0,
      maxNumeric: 28.5,
      unit: 'VDC',
      instructions: 'Measure at float charger terminal. Acceptable range is 25.0V to 28.5V.',
      isCriticalFailure: true,
      failureDefectSeverity: 'CRITICAL',
      failureDefectCategory: 'ELECTRICAL',
    },
    {
      id: 'f4',
      key: 'facp_status_indicator',
      label: 'Fire Alarm Panel Display State',
      type: 'SINGLE_CHOICE',
      required: true,
      options: ['Normal / All Clear', 'Supervisory Active', 'Trouble Buzzer Active', 'Alarm State'],
      isCriticalFailure: true,
      failureDefectSeverity: 'CRITICAL',
      failureDefectCategory: 'FIRE_SAFETY',
    },
    {
      id: 'f5',
      key: 'ahu_filter_dp',
      label: 'AHU-04 Filter Differential Pressure (in. w.g.)',
      type: 'NUMERIC',
      required: false,
      minNumeric: 0.1,
      maxNumeric: 1.0,
      unit: 'in. w.g.',
      instructions: 'If reading exceeds 1.0 in. w.g., filter replacement is mandatory.',
      isCriticalFailure: false,
    },
    {
      id: 'f6',
      key: 'fluid_leak_inspection',
      label: 'Piping & Joint Fluid Leaks Observed',
      type: 'PASS_FAIL',
      required: true,
      instructions: 'Inspect all valve packing, flange connections, and condensate drain lines.',
      isCriticalFailure: true,
      failureDefectSeverity: 'HIGH',
      failureDefectCategory: 'PLUMBING',
      requireEvidenceOnFailure: true,
    },
    {
      id: 'f7',
      key: 'technician_notes',
      label: 'Field Technician Observations & Commentary',
      type: 'TEXT',
      required: false,
      isCriticalFailure: false,
    },
    {
      id: 'f8',
      key: 'inspection_evidence_photo',
      label: 'General Photographic Evidence of Area',
      type: 'PHOTO_EVIDENCE',
      required: false,
      isCriticalFailure: false,
    },
  ];

  const template1 = await prisma.inspectionTemplate.create({
    data: {
      id: 't1111111-1111-1111-1111-111111111111',
      name: 'Critical Mechanical & Electrical Weekly Inspection',
      description: 'Comprehensive weekly operational audit of chillers, emergency power generators, and life-safety systems.',
      facilityType: FacilityType.COMMERCIAL,
      version: 1,
      isLatest: true,
      isActive: true,
      fieldsJson: mechanicalTemplateFields,
    },
  });

  const fireSafetyTemplateFields = [
    {
      id: 'fs1',
      key: 'egress_lighting',
      label: 'Emergency Exit Lighting & Illuminated Signage',
      type: 'PASS_FAIL',
      required: true,
      isCriticalFailure: true,
      failureDefectSeverity: 'HIGH',
      failureDefectCategory: 'FIRE_SAFETY',
    },
    {
      id: 'fs2',
      key: 'extinguishers_tagged',
      label: 'Fire Extinguisher Gauges & Monthly Inspection Tag',
      type: 'PASS_FAIL',
      required: true,
      isCriticalFailure: true,
      failureDefectSeverity: 'MEDIUM',
      failureDefectCategory: 'FIRE_SAFETY',
    },
    {
      id: 'fs3',
      key: 'sprinkler_valves',
      label: 'Sprinkler Control Valves Padlocked in Open Position',
      type: 'PASS_FAIL',
      required: true,
      isCriticalFailure: true,
      failureDefectSeverity: 'CRITICAL',
      failureDefectCategory: 'FIRE_SAFETY',
    },
    {
      id: 'fs4',
      key: 'general_safety_notes',
      label: 'Safety Auditor Notes',
      type: 'TEXT',
      required: false,
      isCriticalFailure: false,
    },
  ];

  const template2 = await prisma.inspectionTemplate.create({
    data: {
      id: 't2222222-2222-2222-2222-222222222222',
      name: 'Life Safety & Fire Protection Monthly Audit',
      description: 'Monthly NFPA compliance inspection for egress paths, fire extinguishers, and sprinkler main valves.',
      facilityType: FacilityType.COMMERCIAL,
      version: 1,
      isLatest: true,
      isActive: true,
      fieldsJson: fireSafetyTemplateFields,
    },
  });

  // 7. Inspection Schedule
  await prisma.inspectionSchedule.create({
    data: {
      facilityId: facility1.id,
      templateId: template1.id,
      assignedToId: inspector.id,
      frequency: ScheduleFrequency.WEEKLY,
      nextDueDate: new Date(Date.now() + 86400000 * 2), // 2 days from now
      isActive: true,
    },
  });

  // 8. Sample Inspections
  // Completed inspection with one critical failure triggering an issue
  const completedInspectionId = 'i1111111-1111-1111-1111-111111111111';
  const completedItems = [
    {
      fieldId: 'f1',
      key: 'chiller_status',
      label: 'Chiller Operating State & Compressor Vibration',
      result: 'PASS',
      notes: 'Compressor operating within baseline vibration threshold (<0.15 in/sec RMS).',
      attachmentIds: [],
      isFlaggedDefect: false,
    },
    {
      fieldId: 'f2',
      key: 'chilled_water_delta_t',
      label: 'Chilled Water Delta T (°F)',
      numericValue: 10.4,
      notes: 'Return 54.2°F, Supply 43.8°F. Delta T = 10.4°F.',
      attachmentIds: [],
      isFlaggedDefect: false,
    },
    {
      fieldId: 'f3',
      key: 'gen_battery_voltage',
      label: 'Generator Battery Float Voltage (VDC)',
      numericValue: 27.2,
      notes: 'Optimal float charge on battery bank.',
      attachmentIds: [],
      isFlaggedDefect: false,
    },
    {
      fieldId: 'f4',
      key: 'facp_status_indicator',
      label: 'Fire Alarm Panel Display State',
      selectedOption: 'Normal / All Clear',
      notes: 'Green status confirmed.',
      attachmentIds: [],
      isFlaggedDefect: false,
    },
    {
      fieldId: 'f5',
      key: 'ahu_filter_dp',
      label: 'AHU-04 Filter Differential Pressure (in. w.g.)',
      numericValue: 1.35, // High! Exceeds 1.0
      notes: 'Magnehelic reading 1.35 in. w.g. Primary pre-filters heavily loaded with airborne particulate.',
      attachmentIds: [],
      isFlaggedDefect: true,
      failedReason: 'Filter differential pressure (1.35 in. w.g.) exceeds maximum allowable 1.0 in. w.g.',
    },
    {
      fieldId: 'f6',
      key: 'fluid_leak_inspection',
      label: 'Piping & Joint Fluid Leaks Observed',
      result: 'PASS',
      notes: 'No drips or active weeping detected.',
      attachmentIds: [],
      isFlaggedDefect: false,
    },
  ];

  const inspection1 = await prisma.inspection.create({
    data: {
      id: completedInspectionId,
      templateId: template1.id,
      templateVersion: 1,
      facilityId: facility1.id,
      zoneId: zoneRooftop.id,
      checkpointId: chkAHU.id,
      assetId: assetAHU.id,
      inspectorId: inspector.id,
      status: InspectionStatus.SUBMITTED,
      startedAt: new Date(Date.now() - 86400000 * 2),
      completedAt: new Date(Date.now() - 86400000 * 2 + 1800000),
      summaryNotes: 'Completed weekly audit. AHU-04 filter differential pressure exceeds safe limits; replacement work order created.',
      weatherCondition: 'Clear, 72°F',
      itemsJson: completedItems,
      version: 2,
      syncStatus: SyncStatus.SYNCED,
      idempotencyKey: 'IDEMP-INSP-2026-001',
    },
  });

  // Draft inspection currently in progress
  const draftInspectionId = 'i2222222-2222-2222-2222-222222222222';
  const draftItems = [
    {
      fieldId: 'f1',
      key: 'chiller_status',
      label: 'Chiller Operating State & Compressor Vibration',
      result: 'PASS',
      notes: 'Audible hum normal.',
      attachmentIds: [],
      isFlaggedDefect: false,
    },
    {
      fieldId: 'f2',
      key: 'chilled_water_delta_t',
      label: 'Chilled Water Delta T (°F)',
      numericValue: 9.8,
      notes: 'Delta within target range.',
      attachmentIds: [],
      isFlaggedDefect: false,
    },
  ];

  await prisma.inspection.create({
    data: {
      id: draftInspectionId,
      templateId: template1.id,
      templateVersion: 1,
      facilityId: facility1.id,
      zoneId: zoneBasement.id,
      checkpointId: chkChiller.id,
      assetId: assetChiller.id,
      inspectorId: inspector.id,
      status: InspectionStatus.IN_PROGRESS,
      startedAt: new Date(),
      summaryNotes: 'Beginning morning chiller plant walk-through.',
      itemsJson: draftItems,
      version: 1,
      syncStatus: SyncStatus.SYNCED,
    },
  });

  // 9. Issues & Work Orders with strict state machine history
  // Issue 1: High severity, currently IN_PROGRESS
  const issue1 = await prisma.issue.create({
    data: {
      id: 'iss11111-1111-1111-1111-111111111111',
      facilityId: facility1.id,
      zoneId: zoneRooftop.id,
      checkpointId: chkAHU.id,
      assetId: assetAHU.id,
      inspectionId: inspection1.id,
      title: 'AHU-04 Severe Filter Loading & Differential Pressure Spike',
      description: 'Differential pressure gauge reading 1.35 in. w.g. against maximum allowable 1.0 in. w.g. Reduced static pressure causing supply fan airflow throttling.',
      category: 'HVAC',
      severity: IssueSeverity.HIGH,
      reportedById: inspector.id,
      status: WorkOrderStatus.IN_PROGRESS,
      assignedToId: technician.id,
      dueDate: new Date(Date.now() + 86400000 * 3),
      evidenceAttachmentIds: [],
      workAttachmentIds: [],
      version: 3,
    },
  });

  // Work order event history for Issue 1
  await prisma.workOrderEvent.createMany({
    data: [
      {
        issueId: issue1.id,
        actorId: inspector.id,
        fromStatus: WorkOrderStatus.REPORTED,
        toStatus: WorkOrderStatus.REPORTED,
        notes: 'Defect automatically logged following weekly mechanical inspection threshold violation.',
        createdAt: new Date(Date.now() - 86400000 * 2),
      },
      {
        issueId: issue1.id,
        actorId: manager.id,
        fromStatus: WorkOrderStatus.REPORTED,
        toStatus: WorkOrderStatus.ASSIGNED,
        notes: 'Assigned to Senior HVAC Technician Samira Patel for MERV-13 filter replacement.',
        createdAt: new Date(Date.now() - 86400000 * 1.5),
      },
      {
        issueId: issue1.id,
        actorId: technician.id,
        fromStatus: WorkOrderStatus.ASSIGNED,
        toStatus: WorkOrderStatus.IN_PROGRESS,
        notes: 'Pulled filter stock from warehouse. Tagged out AHU-04 supply fan disconnect; beginning replacement.',
        createdAt: new Date(Date.now() - 86400000 * 0.5),
      },
    ],
  });

  // Issue 2: Medium severity, currently RESOLVED, awaiting verification by manager
  const issue2 = await prisma.issue.create({
    data: {
      id: 'iss22222-2222-2222-2222-222222222222',
      facilityId: facility1.id,
      zoneId: zoneLobby.id,
      checkpointId: chkFire.id,
      title: 'Atrium East Stairwell Emergency Exit Egress Light Offline',
      description: 'Emergency exit sign fixture 1-E dropped out during simulated battery disconnect test.',
      category: 'ELECTRICAL',
      severity: IssueSeverity.MEDIUM,
      reportedById: inspector.id,
      status: WorkOrderStatus.RESOLVED,
      assignedToId: technician.id,
      dueDate: new Date(Date.now() + 86400000 * 1),
      resolutionNotes: 'Replaced dead NiCad battery backup pack and installed new 3W LED lamp assembly. 90-minute push-button test passed.',
      evidenceAttachmentIds: [],
      workAttachmentIds: [],
      version: 4,
    },
  });

  await prisma.workOrderEvent.createMany({
    data: [
      {
        issueId: issue2.id,
        actorId: inspector.id,
        fromStatus: WorkOrderStatus.REPORTED,
        toStatus: WorkOrderStatus.REPORTED,
        notes: 'Issue reported during monthly life safety check.',
        createdAt: new Date(Date.now() - 86400000 * 4),
      },
      {
        issueId: issue2.id,
        actorId: manager.id,
        fromStatus: WorkOrderStatus.REPORTED,
        toStatus: WorkOrderStatus.ASSIGNED,
        notes: 'Assigned to electrical tech Samira.',
        createdAt: new Date(Date.now() - 86400000 * 3),
      },
      {
        issueId: issue2.id,
        actorId: technician.id,
        fromStatus: WorkOrderStatus.ASSIGNED,
        toStatus: WorkOrderStatus.IN_PROGRESS,
        notes: 'Investigating power supply to exit fixture.',
        createdAt: new Date(Date.now() - 86400000 * 2),
      },
      {
        issueId: issue2.id,
        actorId: technician.id,
        fromStatus: WorkOrderStatus.IN_PROGRESS,
        toStatus: WorkOrderStatus.RESOLVED,
        notes: 'Replaced dead NiCad battery backup pack and installed new 3W LED lamp assembly. 90-minute push-button test passed.',
        createdAt: new Date(Date.now() - 86400000 * 1),
      },
    ],
  });

  // Issue 3: Critical severity, fully VERIFIED
  const issue3 = await prisma.issue.create({
    data: {
      id: 'iss33333-3333-3333-3333-333333333333',
      facilityId: facility1.id,
      zoneId: zoneBasement.id,
      checkpointId: chkChiller.id,
      assetId: assetChiller.id,
      title: 'Chiller CH-01 Condenser Water Pump Mechanical Seal Leak',
      description: 'Condenser pump seal weeping glycol solution at approx 15 drops/min onto drip pan.',
      category: 'HVAC',
      severity: IssueSeverity.CRITICAL,
      reportedById: inspector.id,
      status: WorkOrderStatus.VERIFIED,
      assignedToId: technician.id,
      resolutionNotes: 'Disassembled pump volute, replaced silicon-carbide mechanical face seal and wear ring. Realigned motor coupling.',
      verificationNotes: 'Inspected under full 500-ton chiller load for 4 hours. Zero fluid leakage detected. Operating temperature 112°F nominal. Verified and closed.',
      verifiedById: manager.id,
      verifiedAt: new Date(Date.now() - 86400000 * 5),
      evidenceAttachmentIds: [],
      workAttachmentIds: [],
      version: 5,
    },
  });

  await prisma.workOrderEvent.createMany({
    data: [
      {
        issueId: issue3.id,
        actorId: inspector.id,
        fromStatus: WorkOrderStatus.REPORTED,
        toStatus: WorkOrderStatus.REPORTED,
        notes: 'Glycol leak observed under pump CWP-01.',
        createdAt: new Date(Date.now() - 86400000 * 8),
      },
      {
        issueId: issue3.id,
        actorId: manager.id,
        fromStatus: WorkOrderStatus.REPORTED,
        toStatus: WorkOrderStatus.ASSIGNED,
        notes: 'Dispatched emergency work order.',
        createdAt: new Date(Date.now() - 86400000 * 8),
      },
      {
        issueId: issue3.id,
        actorId: technician.id,
        fromStatus: WorkOrderStatus.ASSIGNED,
        toStatus: WorkOrderStatus.IN_PROGRESS,
        notes: 'Isolated pump, locked out 480V breaker.',
        createdAt: new Date(Date.now() - 86400000 * 7),
      },
      {
        issueId: issue3.id,
        actorId: technician.id,
        fromStatus: WorkOrderStatus.IN_PROGRESS,
        toStatus: WorkOrderStatus.RESOLVED,
        notes: 'Seal replaced and pressure tested to 75 PSI.',
        createdAt: new Date(Date.now() - 86400000 * 6),
      },
      {
        issueId: issue3.id,
        actorId: manager.id,
        fromStatus: WorkOrderStatus.RESOLVED,
        toStatus: WorkOrderStatus.VERIFIED,
        notes: 'Inspected under full 500-ton chiller load for 4 hours. Zero fluid leakage detected. Operating temperature 112°F nominal. Verified and closed.',
        createdAt: new Date(Date.now() - 86400000 * 5),
      },
    ],
  });

  // 10. Notifications
  await prisma.appNotification.createMany({
    data: [
      {
        userId: technician.id,
        title: 'New Work Order Assigned',
        message: 'You have been assigned to: AHU-04 Severe Filter Loading & Differential Pressure Spike',
        type: 'ASSIGNMENT',
        entityType: 'ISSUE',
        entityId: issue1.id,
        isRead: false,
      },
      {
        userId: manager.id,
        title: 'Work Order Awaiting Verification',
        message: 'Technician Samira Patel resolved: Atrium East Stairwell Emergency Exit Egress Light. Verification required.',
        type: 'STATUS_CHANGE',
        entityType: 'ISSUE',
        entityId: issue2.id,
        isRead: false,
      },
      {
        userId: inspector.id,
        title: 'Inspection Schedule Due',
        message: 'Upcoming: Critical Mechanical & Electrical Weekly Inspection is due in 2 days.',
        type: 'INSPECTION_SUBMITTED',
        entityType: 'SCHEDULE',
        entityId: facility1.id,
        isRead: true,
      },
    ],
  });

  // 11. Audit Events
  await prisma.auditEvent.createMany({
    data: [
      {
        actorId: inspector.id,
        actorEmail: inspector.email,
        actorRole: inspector.role,
        action: 'INSPECTION_SUBMITTED',
        entityType: 'INSPECTION',
        entityId: inspection1.id,
        facilityId: facility1.id,
        previousVersion: 1,
        newVersion: 2,
        details: { checkpoint: chkAHU.name, failedItemsCount: 1 },
      },
      {
        actorId: inspector.id,
        actorEmail: inspector.email,
        actorRole: inspector.role,
        action: 'ISSUE_AUTO_CREATED',
        entityType: 'ISSUE',
        entityId: issue1.id,
        facilityId: facility1.id,
        previousVersion: 0,
        newVersion: 1,
        details: { trigger: 'AHU_FILTER_DP_EXCEEDED', severity: 'HIGH' },
      },
      {
        actorId: manager.id,
        actorEmail: manager.email,
        actorRole: manager.role,
        action: 'WORK_ORDER_ASSIGNED',
        entityType: 'ISSUE',
        entityId: issue1.id,
        facilityId: facility1.id,
        previousVersion: 1,
        newVersion: 2,
        details: { assignedToId: technician.id, technicianName: technician.fullName },
      },
      {
        actorId: manager.id,
        actorEmail: manager.email,
        actorRole: manager.role,
        action: 'WORK_ORDER_VERIFIED',
        entityType: 'ISSUE',
        entityId: issue3.id,
        facilityId: facility1.id,
        previousVersion: 4,
        newVersion: 5,
        details: { signOffNotes: 'Thermal camera check completed; zero leakage.' },
      },
    ],
  });

  console.log('Seed completed successfully with facilities, zones, checkpoints, templates, inspections, issues, and audit logs!');
}

main()
  .catch((e) => {
    console.error('Error running seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
